from app.managers.base_queue_manager import BaseQueueManager
from app.core.utils import (
    duration_formatter, get_default_playlist_metadata_json,
    save_default_playlist_metadata_json, get_default_playlist_json
)

class DefaultPlaylistMetadataManager(BaseQueueManager):
    def __init__(self):
        def read_function():
            queue = get_default_playlist_metadata_json()
            return [
                {
                    **item,
                    'duration': duration_formatter(item.get('duration')) if item.get('duration') else "00:00"
                }
                for item in queue
            ]
        
        def save_function(items):
            return save_default_playlist_metadata_json(items)
        
        def validate_function(item):
            return isinstance(item, dict) and item.get('title') and item.get('url')
        
        def format_function(item):
            return {
                **item,
                'duration': duration_formatter(item.get('duration')) if item.get('duration') else "00:00"
            }
        
        super().__init__({
            'read_function': read_function,
            'save_function': save_function,
            'validate_function': validate_function,
            'format_function': format_function,
            'duplicate_check_key': 'url'
        })
    
    def add_to_queue(self, item):
        return self.add(item)
    
    def get_first_from_queue(self):
        return self.get_first()
    
    def get_last_from_queue(self):
        return self.get_last()
    
    def get_filtered_data(self, filters=None):
        if filters is None:
            filters = {}
        
        all_data = super().get_all()
        if not filters:
            return all_data
        
        filtered = []
        for item in all_data:
            matches = True
            
            if 'urlType' in filters and item.get('urlType') != filters['urlType']:
                matches = False
            if 'playlistId' in filters and item.get('playlistId') != filters['playlistId']:
                matches = False
            
            if 'isActive' in filters or 'genre' in filters:
                playlist = self.get_playlist_metadata(item.get('playlistId'))
                
                if playlist:
                    if 'isActive' in filters and playlist.get('isActive') != filters['isActive']:
                        matches = False
                    if 'genre' in filters and playlist.get('genre') != filters['genre']:
                        matches = False
                else:
                    matches = False
            
            if matches:
                filtered.append(item)
        
        return filtered
    
    def get_playlist_metadata(self, playlist_id):
        try:
            playlists = get_default_playlist_json()
            for p in playlists:
                if p.get('playlistId') == playlist_id:
                    return p
            return None
        except Exception as error:
            return None
    
    def get_all(self, filters=None):
        return self.get_filtered_data(filters)
    
    def add_many_to_queue(self, items):
        return self.add_many(items, False)
    
    def add_many_to_top(self, items):
        return self.add_many(items, True)
