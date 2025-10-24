import os
from pathlib import Path
from app.core.logger import logger
from app.core.constants import DEFAULT_FALLBACK_LOCATION, COMMON_CONFIG_KEYS
from app.core.utils import get_random_number
from app.managers.song_queue_manager import SongQueueManager
from app.managers.default_playlist_manager import DefaultPlaylistManager
from app.managers.default_playlist_metadata_manager import DefaultPlaylistMetadataManager
from app.streaming.cache_manager import cache_manager
from app.services.common_config_service import common_config_service
from app.streaming.download import Downloader
from datetime import datetime, timedelta

async def get_fallback_track(directory: str = DEFAULT_FALLBACK_LOCATION) -> dict:
    try:
        if not os.path.exists(directory):
            raise FileNotFoundError(f"Fallback directory not found: {directory}")
        
        files = [f for f in os.listdir(directory) if f.endswith('.mp3')]
        
        if not files:
            raise FileNotFoundError(f"No fallback tracks available in directory: {directory}")
        
        random_track = files[get_random_number(0, len(files) - 1)]
        
        return {
            "title": random_track.replace('.mp3', ''),
            "url": os.path.join(directory, random_track),
            "urlType": "fallback",
            "duration": 0,
            "requestedBy": "fallback"
        }
    except Exception as error:
        logger.error(f"Fallback mechanism failed: {error}")
        raise

async def check_and_refresh_metadata(playlist: dict):
    from app.services.api_service import Service
    
    TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
    metadata_date = datetime.fromisoformat(playlist["metadataUpdatedAt"])
    now = datetime.now()
    
    if (now - metadata_date).total_seconds() * 1000 > TWO_DAYS_MS:
        logger.info(f"Updating the metadata for: {playlist['title']}")
        api_service = Service()
        await api_service.remove_default_playlist(playlist["index"])
        await api_service.add_default_playlist({
            "playlistId": playlist["playlistId"],
            "title": playlist["title"],
            "source": playlist["source"],
            "isActive": playlist["isActive"],
            "genre": playlist["genre"]
        })

async def empty_song_queue_handler() -> dict:
    try:
        default_playlist_metadata = DefaultPlaylistMetadataManager()
        default_playlist_store = DefaultPlaylistManager()
        genre = await common_config_service.get(COMMON_CONFIG_KEYS["defaultPlaylistGenre"])
        
        filter_criteria = {
            "isActive": True,
            "genre": None if genre == "all" else genre
        }
        
        active_playlists = [
            {**playlist, "index": idx + 1}
            for idx, playlist in enumerate(default_playlist_store.get_all())
            if playlist.get("isActive") and (genre == "all" or playlist.get("genre") == genre)
        ]
        
        for playlist in active_playlists:
            await check_and_refresh_metadata(playlist)
        
        default_playlist_arr = default_playlist_metadata.get_all(filter_criteria)
        if not default_playlist_arr:
            return await get_fallback_track()
        
        return default_playlist_arr[get_random_number(0, len(default_playlist_arr) - 1)]
    except Exception as error:
        logger.error(f"Error in empty_song_queue_handler: {error}")
        return await get_fallback_track()

def create_track_response(song: dict, cached_path: str = None) -> dict:
    return {
        "url": cached_path or song["url"],
        "title": song["title"],
        "duration": song["duration"],
        "requestedBy": song["requestedBy"]
    }

async def download_from_youtube(song_data: dict) -> dict:
    downloader = Downloader()
    result = await downloader.download_video(song_data["url"], song_data["title"])
    return {"url": result["url"], "title": song_data["title"]}

async def download_from_jiosaavn(song_data: dict) -> dict:
    downloader = Downloader()
    result = await downloader.download_jiosaavn(song_data["url"], song_data["title"])
    return {"url": result["url"], "title": song_data["title"]}

async def download_from_soundcloud(song_data: dict) -> dict:
    downloader = Downloader()
    result = await downloader.download_soundcloud(song_data["url"], song_data["title"])
    return {"url": result["url"], "title": song_data["title"]}

async def fetch_by_url_type(song_data: dict) -> dict:
    url_type = song_data.get("urlType")
    
    if url_type == "youtube":
        return await download_from_youtube(song_data)
    elif url_type == "jiosaavn":
        return await download_from_jiosaavn(song_data)
    elif url_type == "soundcloud":
        return await download_from_soundcloud(song_data)
    elif url_type == "fallback":
        return {"url": song_data["url"], "title": song_data["title"]}
    else:
        raise ValueError(f"Unsupported URL type: {url_type}")

async def fetch_next_track() -> dict:
    song_queue = SongQueueManager()
    retry_count = 0
    MAX_RETRIES = 3
    
    async def try_fetch_track():
        nonlocal retry_count
        
        try:
            current_track = song_queue.get_first_from_queue()
            track_to_process = current_track or await empty_song_queue_handler()
            
            cached_path = cache_manager.get_from_cache(track_to_process["title"])
            if cached_path:
                logger.info(f"Using cached version of: {track_to_process['title']}")
                if current_track:
                    song_queue.remove_from_front()
                return create_track_response(track_to_process, cached_path)
            
            song_result = await fetch_by_url_type(track_to_process)
            if current_track:
                song_queue.remove_from_front()
            
            return create_track_response({
                **song_result,
                "requestedBy": track_to_process["requestedBy"],
                "duration": track_to_process["duration"]
            })
        
        except Exception as error:
            logger.error(f"Error fetching track: {error} (retry {retry_count + 1})")
            
            song_queue.remove_from_front()
            retry_count += 1
            
            if retry_count >= MAX_RETRIES:
                raise Exception(f"Failed to fetch track after {MAX_RETRIES} attempts")
            
            return await try_fetch_track()
    
    return await try_fetch_track()
