from app.managers.base_queue_manager import BaseQueueManager
from app.core.utils import get_queue_list_json, save_queue_list_json, duration_formatter

class SongQueueManager(BaseQueueManager):
    def __init__(self):
        def read_function():
            queue = get_queue_list_json()
            return [
                {
                    **item,
                    'duration': duration_formatter(item.get('duration')) if item.get('duration') else "00:00"
                }
                for item in queue
            ]
        
        def save_function(items):
            return save_queue_list_json(items)
        
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
    
    def print_queue(self):
        return self.get_all()
    
    def add_many_to_queue(self, items):
        return self.add_many(items, False)
    
    def add_many_to_top(self, items):
        return self.add_many(items, True)
    
    def remove_last_song_requested_by_user(self, requested_by):
        reversed_items = list(reversed(self.items))
        for i, item in enumerate(reversed_items):
            if item.get('requestedBy') == requested_by:
                actual_index = len(self.items) - 1 - i
                return self.remove_at_index(actual_index + 1)
        return None
