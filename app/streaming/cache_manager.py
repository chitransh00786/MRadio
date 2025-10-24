import os
from pathlib import Path
from app.core import logger
from app.core.fs_helper import fs_helper
from app.core.constants import CACHE_SIZE, DEFAULT_CACHE_LOCATION, DEFAULT_TRACKS_LOCATION

class CacheManager:
    def __init__(self, cache_dir: str = DEFAULT_CACHE_LOCATION, max_cache_size: int = CACHE_SIZE):
        self.cache_dir = cache_dir.replace('\\', '/')
        self.max_cache_size = max_cache_size
        self.ensure_cache_directory()
    
    def ensure_cache_directory(self):
        if not fs_helper.exists(self.cache_dir):
            fs_helper.create_directory(self.cache_dir)
            logger.info(f"Created cache directory at {self.cache_dir}")
    
    def get_cached_path(self, title: str) -> str:
        safe_title = title.replace('<', '').replace('>', '').replace(':', '').replace('"', '').replace('/', '').replace('\\', '').replace('|', '').replace('?', '').replace('*', '')
        return os.path.join(self.cache_dir, f"{safe_title}.mp3").replace('\\', '/')
    
    def get_original_path(self, title: str) -> str:
        safe_title = title.replace('<', '').replace('>', '').replace(':', '').replace('"', '').replace('/', '').replace('\\', '').replace('|', '').replace('?', '').replace('*', '')
        return os.path.join(DEFAULT_TRACKS_LOCATION, f"{safe_title}.mp3").replace('\\', '/')
    
    def is_cached(self, title: str) -> bool:
        cached_path = self.get_cached_path(title)
        exists = fs_helper.exists(cached_path)
        if exists:
            logger.info(f"Found {title} in cache")
        return exists
    
    def move_to_cache(self, source_path: str, title: str) -> bool:
        try:
            source_path = source_path.replace('\\', '/')
            cached_path = self.get_cached_path(title)
            
            logger.info(f"Attempting to move {source_path} to {cached_path}")
            
            self.ensure_cache_directory()
            
            if fs_helper.exists(source_path):
                fs_helper.copy(source_path, cached_path)
                logger.info(f"Successfully copied file to cache at {cached_path}")
                
                try:
                    fs_helper.delete(source_path)
                    logger.info(f"Successfully deleted original file at {source_path}")
                except Exception as delete_error:
                    logger.error(f"Failed to delete original file: {str(delete_error)}")
                
                self.cleanup_if_needed()
                return True
            
            logger.info(f"Source file not found at {source_path}")
            return False
        except Exception as error:
            logger.error(f"Error moving file to cache: {str(error)}")
            return False
    
    def get_from_cache(self, title: str):
        cached_path = self.get_cached_path(title)
        if self.is_cached(title):
            logger.info(f"Using cached version of {title} from {cached_path}")
            return cached_path
        logger.info(f"{title} not found in cache")
        return None
    
    def cleanup_if_needed(self):
        try:
            self.ensure_cache_directory()
            
            files = fs_helper.list_files(self.cache_dir)
            logger.info(f"Found {len(files)} files in cache")
            
            if len(files) == 0:
                return
            
            file_details = []
            for file in files:
                file_path = os.path.join(self.cache_dir, file)
                stats = os.stat(file_path)
                file_details.append({
                    'path': file_path,
                    'size': stats.st_size,
                    'lastAccessed': stats.st_atime
                })
            
            file_details.sort(key=lambda x: x['lastAccessed'])
            
            total_size = sum(f['size'] for f in file_details)
            logger.info(f"Current cache size: {total_size / 1024 / 1024:.2f}MB")
            
            while total_size > self.max_cache_size and len(file_details) > 0:
                oldest_file = file_details.pop(0)
                try:
                    fs_helper.delete(oldest_file['path'])
                    total_size -= oldest_file['size']
                    logger.info(f"Removed {os.path.basename(oldest_file['path'])} from cache due to size limit")
                except Exception as error:
                    logger.error(f"Failed to remove old cache file {oldest_file['path']}: {str(error)}")
        except Exception as error:
            logger.error(f"Error cleaning cache: {str(error)}")

cache_manager = CacheManager()
