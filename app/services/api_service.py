from app.core.logger import logger
from app.core.crypto import generate_256bit_token
from app.core.utils import duration_formatter
from app.core.constants import DEFAULT_QUEUE_SIZE
from app.managers.song_queue_manager import SongQueueManager
from app.managers.token_manager import TokenManager
from app.managers.block_list_manager import BlockListManager
from app.managers.default_playlist_manager import DefaultPlaylistManager
from app.managers.default_playlist_metadata_manager import DefaultPlaylistMetadataManager
from app.services.metadata_fetcher import generate_song_metadata, generate_playlist_metadata
from app.services.common_config_service import common_config_service
from app.integrations.youtube import YouTube
from datetime import datetime

class Service:
    def __init__(self):
        self.block_list_manager = BlockListManager()
        self.queue_instance = None
    
    def set_queue(self, queue):
        self.queue_instance = queue
    
    async def get_current_song(self) -> dict:
        if not self.queue_instance or not self.queue_instance.tracks:
            raise Exception("No tracks available")
        
        track = self.queue_instance.tracks[self.queue_instance.index]
        return {
            "title": track["title"],
            "duration": duration_formatter(track.get("duration", 0)),
            "requestedBy": track.get("requestedBy", "anonymous")
        }
    
    async def seek_song(self, seconds: int) -> bool:
        if self.queue_instance:
            await self.queue_instance.seek(seconds)
        return True
    
    async def get_queue_list(self) -> list:
        song_queue = SongQueueManager()
        track_list = self.queue_instance.tracks if self.queue_instance else []
        queue_song_list = song_queue.print_queue()
        
        response = []
        for idx, item in enumerate([*track_list, *queue_song_list]):
            response.append({
                "id": idx + 1,
                "title": item.get("title"),
                "duration": duration_formatter(item.get("duration", 0)),
                "requestedBy": item.get("requestedBy", "anonymous")
            })
        
        return response
    
    async def get_upcoming_song(self) -> dict:
        if not self.queue_instance or not self.queue_instance.tracks:
            raise Exception("No tracks available")
        
        next_index = (self.queue_instance.index + 1) % len(self.queue_instance.tracks)
        track = self.queue_instance.tracks[next_index]
        
        formatted_duration = duration_formatter(track.get("duration", 0))
        logger.info(f"Upcoming song duration: {track.get('title')} - {formatted_duration}")
        
        return {
            "title": track["title"],
            "duration": formatted_duration,
            "requestedBy": track.get("requestedBy", "anonymous")
        }
    
    async def skip(self) -> bool:
        if self.queue_instance:
            await self.queue_instance.skip()
        return True
    
    async def previous(self) -> bool:
        if self.queue_instance:
            await self.queue_instance.previous()
        return True
    
    async def add_song_to_queue(self, song_name: str, requested_by: str = "anonymous", 
                                 force: bool = False, preference: str = None) -> dict:
        metadata = await generate_song_metadata(song_name, requested_by, force, preference)
        is_blocked = await self.is_song_blocked(metadata["title"])
        
        if is_blocked:
            raise Exception("Song is blocked! You cannot play this song.")
        
        song_queue = SongQueueManager()
        song_queue.add_to_queue(metadata)
        
        return {
            "title": metadata["title"],
            "duration": metadata["duration"],
            "requestedBy": requested_by
        }
    
    async def add_playlist_to_queue(self, playlist_id: str, source: str = "youtube", 
                                     requested_by: str = "anonymous") -> dict:
        metadata = await generate_playlist_metadata(playlist_id, source, requested_by)
        
        if not metadata:
            raise Exception("No songs found in the playlist.")
        
        song_queue = SongQueueManager()
        song_queue.add_many_to_queue(metadata)
        
        return {"added": True, "total": len(metadata)}
    
    async def add_playlist_to_top(self, playlist_id: str, source: str = "youtube", 
                                   requested_by: str = "anonymous") -> dict:
        metadata = await generate_playlist_metadata(playlist_id, source, requested_by)
        
        if not metadata:
            raise Exception("No songs found in the playlist.")
        
        song_queue = SongQueueManager()
        song_queue.add_many_to_top(metadata)
        
        return {"added": True, "total": len(metadata)}
    
    async def add_song_to_top(self, song_name: str, requested_by: str = "anonymous") -> dict:
        metadata = await generate_song_metadata(song_name, requested_by)
        is_blocked = await self.is_song_blocked(metadata["title"])
        
        if is_blocked:
            raise Exception("Song is blocked! You cannot play this song.")
        
        song_queue = SongQueueManager()
        song_queue.add_to_front(metadata)
        
        return {
            "title": metadata["title"],
            "duration": metadata["duration"],
            "requestedBy": requested_by
        }
    
    async def remove_from_queue(self, params: dict) -> dict:
        index = params.get("index", 0)
        if index <= DEFAULT_QUEUE_SIZE:
            raise Exception(f"Cannot remove songs from positions 1 to {DEFAULT_QUEUE_SIZE}")
        
        song_queue = SongQueueManager()
        removed_item = song_queue.remove_at_index(index - DEFAULT_QUEUE_SIZE)
        
        if not removed_item:
            raise Exception("Invalid index or queue is empty.")
        
        return {
            "title": removed_item["title"],
            "duration": removed_item.get("duration", 0),
            "requestedBy": removed_item.get("requestedBy", "anonymous")
        }
    
    async def remove_last_song_requested_by_user(self, requested_by: str) -> dict:
        if not requested_by:
            raise Exception("Username is required")
        
        song_queue = SongQueueManager()
        removed_item = song_queue.remove_last_song_requested_by_user(requested_by)
        
        if not removed_item:
            raise Exception(f"No songs found in queue for User: @{requested_by}")
        
        return {
            "title": removed_item["title"],
            "duration": removed_item.get("duration", 0),
            "requestedBy": removed_item.get("requestedBy", "anonymous")
        }
    
    async def add_song_to_queue_from_source(self, url: str, video_id: str, 
                                             requested_by: str = "anonymous", 
                                             source: str = "youtube") -> dict:
        youtube = YouTube()
        validation = await youtube.validate_video(url)
        
        if not validation["status"]:
            raise Exception(validation["message"])
        
        song_detail = await youtube.get_video_detail_by_url(video_id)
        metadata = {
            "requestedBy": requested_by,
            "title": song_detail.get("title"),
            "duration": song_detail.get("duration", {}).get("timestamp", 0),
            "url": song_detail.get("url"),
            "urlType": "youtube"
        }
        
        song_queue = SongQueueManager()
        song_queue.add_to_queue(metadata)
        
        return {
            "title": metadata["title"],
            "duration": metadata["duration"],
            "requestedBy": requested_by
        }
    
    async def generate_token(self, username: str) -> dict:
        token = generate_256bit_token()
        token_manager = TokenManager()
        token_manager.add_token({"token": token, "username": username})
        return {"token": token, "username": username}
    
    async def block_current_song(self, requested_by: str = "anonymous") -> dict:
        try:
            song_detail = await self.get_current_song()
            return await self.block_list_manager.block_current_song(song_detail["title"], requested_by)
        except Exception as error:
            logger.error(f"Error in block_current_song service: {error}")
            raise
    
    async def block_song_by_song_name(self, song_name: str, requested_by: str = "anonymous") -> dict:
        try:
            return await self.block_list_manager.block_song_by_song_name(song_name, requested_by)
        except Exception as error:
            logger.error(f"Error in block_song_by_song_name service: {error}")
            raise
    
    async def unblock_song_by_song_name(self, song_name: str) -> dict:
        try:
            return await self.block_list_manager.unblock_song_by_song_name(song_name)
        except Exception as error:
            logger.error(f"Error in unblock_song_by_song_name service: {error}")
            raise
    
    async def unblock_song_by_index(self, index: int) -> dict:
        try:
            return await self.block_list_manager.unblock_song_by_index(index)
        except Exception as error:
            logger.error(f"Error in unblock_song_by_index service: {error}")
            raise
    
    async def clear_block_list(self) -> dict:
        try:
            return await self.block_list_manager.clear_block_list()
        except Exception as error:
            logger.error(f"Error in clear_block_list service: {error}")
            raise
    
    async def get_all_block_list(self) -> list:
        try:
            return await self.block_list_manager.get_all_block_list()
        except Exception as error:
            logger.error(f"Error in get_all_block_list service: {error}")
            return []
    
    async def is_song_blocked(self, song_name: str) -> bool:
        try:
            return self.block_list_manager.is_song_blocked(song_name)
        except Exception as error:
            logger.error(f"Error in is_song_blocked service: {error}")
            return False
    
    async def add_default_playlist(self, data: dict) -> dict:
        try:
            playlist_id = data.get("playlistId")
            title = data.get("title")
            source = data.get("source")
            requested_by = data.get("requestedBy", "auto")
            is_active = data.get("isActive", True)
            genre = data.get("genre", "mix")
            
            metadata = await generate_playlist_metadata(playlist_id, source, requested_by)
            
            if not metadata:
                logger.warning(f"No songs found in the playlist {playlist_id} from {source}")
                return {"added": False, "total": 0}
            
            default_playlist_store = DefaultPlaylistManager()
            default_playlist_store.add({
                "playlistId": playlist_id,
                "title": title,
                "source": source,
                "metadataUpdatedAt": datetime.now().isoformat(),
                "isActive": is_active,
                "genre": genre
            })
            
            metadata_store = DefaultPlaylistMetadataManager()
            updated_metadata = [
                {**item, "playlistId": playlist_id}
                for item in metadata
            ]
            metadata_store.add_many(updated_metadata)
            
            return {"added": True, "total": len(metadata)}
        except Exception as error:
            logger.error(f"Error in add_default_playlist service: {error}")
            logger.warning(f"Skipping playlist {playlist_id} due to errors")
            return {"added": False, "total": 0}
    
    async def remove_default_playlist(self, index: int) -> dict:
        default_playlist_store = DefaultPlaylistManager()
        default_playlist_metadata_store = DefaultPlaylistMetadataManager()
        
        length = default_playlist_store.get_length()
        if length <= 1:
            raise Exception("Cannot remove default playlist. There should be at least one playlist.")
        
        removed_playlist = default_playlist_store.remove_at_index(index)
        if not removed_playlist:
            raise Exception("Failed to remove playlist")
        
        all_metadata_entries = default_playlist_metadata_store.get_all()
        
        indexes_to_remove = sorted([
            idx + 1
            for idx, entry in enumerate(all_metadata_entries)
            if entry.get("playlistId") == removed_playlist.get("playlistId")
        ], reverse=True)
        
        for idx in indexes_to_remove:
            default_playlist_metadata_store.remove_at_index(idx)
        
        return removed_playlist
    
    async def get_default_playlist(self) -> list:
        default_playlist_store = DefaultPlaylistManager()
        return default_playlist_store.get_all()
    
    async def update_playlist_status(self, index: int, is_active: bool) -> dict:
        default_playlist_store = DefaultPlaylistManager()
        all_playlists = default_playlist_store.get_all()
        
        actual_index = index - 1
        
        if actual_index < 0 or actual_index >= len(all_playlists):
            raise Exception("Invalid playlist index")
        
        if not is_active:
            active_playlist_count = sum(
                1 for idx, playlist in enumerate(all_playlists)
                if idx != actual_index and playlist.get("isActive")
            )
            
            if active_playlist_count == 0:
                raise Exception("Cannot deactivate playlist: At least one playlist must remain active")
        
        updated_playlist = {
            **all_playlists[actual_index],
            "isActive": is_active
        }
        
        default_playlist_store.remove_at_index(index)
        default_playlist_store.add(updated_playlist)
        
        return updated_playlist
    
    async def get_common_config(self) -> dict:
        try:
            return await common_config_service.get_all()
        except Exception as error:
            logger.error(f"Error in get_common_config service: {error}")
            raise
    
    async def create_or_update_common_config(self, key: str, value: str) -> dict:
        try:
            await common_config_service.update(key, value)
            return {"updated": True, "key": key, "value": value}
        except Exception as error:
            logger.error(f"Error in create_or_update_common_config service: {error}")
            raise
