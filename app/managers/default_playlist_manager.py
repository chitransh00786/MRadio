from datetime import datetime
from app.managers.base_queue_manager import BaseQueueManager
from app.core.utils import get_default_playlist_json, save_default_playlist_json

class DefaultPlaylistManager(BaseQueueManager):
    def __init__(self):
        def read_function():
            return get_default_playlist_json()
        
        def save_function(items):
            return save_default_playlist_json(items)
        
        def validate_function(item):
            return isinstance(item, dict) and item.get('title') and item.get('playlistId') and item.get('source')
        
        def format_function(item):
            return {
                **item,
                'metadataUpdatedAt': item.get('metadataUpdatedAt') or datetime.now().isoformat()
            }
        
        super().__init__({
            'read_function': read_function,
            'save_function': save_function,
            'validate_function': validate_function,
            'format_function': format_function,
            'duplicate_check_key': 'playlistId'
        })
    
    def add_to_queue(self, item):
        return self.add(item)
