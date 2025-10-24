from app.core import logger
from app.core.utils import get_token_list_json, save_token_list_json

class TokenManager:
    def __init__(self):
        self.queue = self._read_token_queue() or []
    
    def _read_token_queue(self):
        return get_token_list_json()
    
    def _save_token_queue(self):
        save_token_list_json(self.queue)
    
    def is_token_exist(self, token):
        return any(item.get('token') == token for item in self.queue)
    
    def is_duplicate(self, token, username):
        return any(
            item.get('token') == token or item.get('username') == username
            for item in self.queue
        )
    
    def add_token(self, item):
        if isinstance(item, dict) and item.get('token') and item.get('username'):
            if self.is_duplicate(item['token'], item['username']):
                logger.warn(f"Duplicate item not added: {item['token']}")
                raise Exception("Duplicate username not allowed!")
            else:
                self.queue.append(item)
                self._save_token_queue()
        else:
            logger.error("Invalid input. Item must be an object with 'token' and 'username'.")
    
    def remove_token_by_index(self, index):
        index = index - 1
        if 0 <= index < len(self.queue):
            removed_item = self.queue.pop(index)
            self._save_token_queue()
            return removed_item
        else:
            logger.error("Invalid index or queue is empty.")
            return None
    
    def print_queue(self):
        return self.queue
