from typing import Callable, Optional, List, Any
from app.core import logger

class BaseQueueManager:
    def __init__(self, options: dict = None):
        if options is None:
            options = {}
        
        self.items = []
        self.options = {
            'read_function': None,
            'save_function': None,
            'validate_function': None,
            'format_function': None,
            'duplicate_check_key': None,
            **options
        }
        self.initialize()
    
    def initialize(self):
        if self.options['read_function']:
            self.items = self.read_items() or []
    
    def read_items(self):
        try:
            return self.options['read_function']()
        except Exception as error:
            logger.error("Error reading items", message=str(error))
            return []
    
    def save_items(self):
        if self.options['save_function']:
            try:
                self.options['save_function'](self.items)
            except Exception as error:
                logger.error("Error saving items", error=str(error))
    
    def validate_item(self, item):
        if self.options['validate_function']:
            return self.options['validate_function'](item)
        return True
    
    def format_item(self, item):
        if self.options['format_function']:
            return self.options['format_function'](item)
        return item
    
    def is_duplicate(self, item):
        if not self.options['duplicate_check_key']:
            return False
        key = self.options['duplicate_check_key']
        return any(
            existing_item.get(key) == item.get(key)
            for existing_item in self.items
        )
    
    def add(self, item):
        if not self.validate_item(item):
            logger.error("Invalid item", item=item)
            return False
        
        if self.is_duplicate(item):
            logger.warn("Duplicate item not added", item=item)
            return False
        
        formatted_item = self.format_item(item)
        self.items.append(formatted_item)
        self.save_items()
        return True
    
    def add_to_front(self, item):
        if not self.validate_item(item):
            logger.error("Invalid item", item=item)
            return False
        
        if self.is_duplicate(item):
            logger.warn("Duplicate item not added", item=item)
            return False
        
        formatted_item = self.format_item(item)
        self.items.insert(0, formatted_item)
        self.save_items()
        return True
    
    def add_many(self, items, add_to_front=False):
        if not isinstance(items, list):
            logger.error("Invalid input. Items must be an array.")
            return 0
        
        added_count = 0
        valid_items = []
        
        for item in items:
            if self.validate_item(item) and not self.is_duplicate(item):
                formatted_item = self.format_item(item)
                valid_items.append(formatted_item)
                added_count += 1
        
        if added_count > 0:
            if add_to_front:
                self.items = valid_items + self.items
            else:
                self.items.extend(valid_items)
            self.save_items()
        
        return added_count
    
    def remove_from_front(self):
        if len(self.items) > 0:
            removed_item = self.items.pop(0)
            self.save_items()
            return removed_item
        logger.warn("No items to remove from front")
        return None
    
    def remove_from_back(self):
        if len(self.items) > 0:
            removed_item = self.items.pop()
            self.save_items()
            return removed_item
        logger.warn("No items to remove from back")
        return None
    
    def remove_at_index(self, index):
        actual_index = index - 1
        if 0 <= actual_index < len(self.items):
            removed_item = self.items.pop(actual_index)
            self.save_items()
            return removed_item
        logger.error("Invalid index or no items to remove")
        return None
    
    def get_first(self):
        return self.items[0] if len(self.items) > 0 else None
    
    def get_last(self):
        return self.items[-1] if len(self.items) > 0 else None
    
    def get_all(self):
        return self.items
    
    def clear(self):
        self.items = []
        self.save_items()
    
    def get_length(self):
        return len(self.items)
