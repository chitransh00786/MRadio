from datetime import datetime
from app.managers.base_queue_manager import BaseQueueManager
from app.core.utils import get_block_list_json, save_block_list_json, check_similarity
from app.core import logger

class BlockListManager(BaseQueueManager):
    def __init__(self):
        def read_function():
            return get_block_list_json()
        
        def save_function(items):
            return save_block_list_json(items)
        
        def validate_function(item):
            return isinstance(item, dict) and item.get('songName')
        
        def format_function(item):
            return {
                **item,
                'blockedAt': item.get('blockedAt') or datetime.now().isoformat()
            }
        
        super().__init__({
            'read_function': read_function,
            'save_function': save_function,
            'validate_function': validate_function,
            'format_function': format_function
        })
    
    def _is_similar_song(self, song_name1, song_name2):
        similarity = check_similarity(song_name1, song_name2)
        return similarity >= 85
    
    async def block_current_song(self, song_name, requested_by):
        try:
            if not song_name:
                raise Exception("Song name is required")
            
            if self.is_song_blocked(song_name):
                logger.warn(f"Song already blocked: {song_name}")
                return "Song is already in block list."
            
            block_item = {
                'songName': song_name,
                'requestedBy': requested_by,
                'blockedAt': datetime.now().isoformat()
            }
            
            self.add(block_item)
            logger.info(f"Blocked song: {song_name}")
            return "Blocked the current song."
        except Exception as error:
            logger.error("Error blocking current song", error=str(error))
            raise error
    
    async def block_song_by_song_name(self, song_name, requested_by):
        try:
            if not song_name:
                raise Exception("Song name is required")
            
            return await self.block_current_song(song_name, requested_by)
        except Exception as error:
            logger.error("Error blocking song by name", error=str(error))
            raise error
    
    async def unblock_song_by_song_name(self, song_name):
        try:
            if not song_name:
                raise Exception("Song name is required")
            
            index = None
            for i, item in enumerate(self.items):
                if self._is_similar_song(item['songName'], song_name):
                    index = i
                    break
            
            if index is None:
                logger.warn(f"Song not found in block list: {song_name}")
                raise Exception("Song not found in block list")
            
            self.remove_at_index(index + 1)
            logger.info(f"Unblocked song: {song_name}")
            return "Unblock Successful"
        except Exception as error:
            logger.error("Error unblocking song by name", error=str(error))
            raise error
    
    async def unblock_song_by_index(self, index):
        try:
            result = self.remove_at_index(index)
            if result:
                logger.info(f"Unblocked song at index {index}: {result['songName']}")
                return "Unblock Successful."
            raise Exception("Invalid index")
        except Exception as error:
            logger.error("Error unblocking song by index", error=str(error))
            raise error
    
    async def clear_block_list(self):
        try:
            self.clear()
            logger.info("Cleared block list")
            return "Cleared the block list."
        except Exception as error:
            logger.error("Error clearing block list", error=str(error))
            raise error
    
    async def get_all_block_list(self):
        try:
            return self.get_all()
        except Exception as error:
            logger.error("Error getting block list", error=str(error))
            raise error
    
    def is_song_blocked(self, song_name):
        return any(self._is_similar_song(item['songName'], song_name) for item in self.items)
