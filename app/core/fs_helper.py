import os
import json
import shutil
from pathlib import Path
from typing import Any, List

class FSHelper:
    def read_from_json(self, file_path: str, empty_data_structure: Any = None):
        if empty_data_structure is None:
            empty_data_structure = []
        
        if not self.exists(file_path):
            self.write_to_json(file_path, empty_data_structure)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def write_to_json(self, file_path: str, data: Any):
        directory_path = os.path.dirname(file_path)
        if directory_path and not self.exists(directory_path):
            self.create_directory(directory_path)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    
    def exists(self, file_path: str) -> bool:
        return os.path.exists(file_path)
    
    def delete(self, file_path: str) -> bool:
        os.unlink(file_path)
        return True
    
    def create_directory(self, directory_path: str) -> bool:
        os.makedirs(directory_path, exist_ok=True)
        return True
    
    def rename(self, old_path: str, new_path: str) -> bool:
        try:
            os.rename(old_path, new_path)
            return True
        except OSError:
            self.copy(old_path, new_path)
            self.delete(old_path)
            return True
    
    def copy(self, source_path: str, destination_path: str) -> bool:
        try:
            shutil.copy2(source_path, destination_path)
            return True
        except Exception as e:
            raise Exception(f"Failed to copy file from {source_path} to {destination_path}: {str(e)}")
    
    def list_files(self, directory_path: str) -> List[str]:
        if not self.exists(directory_path):
            self.create_directory(directory_path)
        return os.listdir(directory_path)

fs_helper = FSHelper()
