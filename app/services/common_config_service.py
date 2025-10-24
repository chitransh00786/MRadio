from app.core.utils import get_common_config_json, save_common_config_json, get_default_playlist_json
from app.core.constants import COMMON_CONFIG_KEYS
from app.core import logger

class CommonConfigService:
    def __init__(self):
        self.config = get_common_config_json()
        self.allowed_keys = [
            COMMON_CONFIG_KEYS["defaultPlaylistGenre"]
        ]
        self.validations = self.setup_validations()
    
    def setup_validations(self):
        async def validate_playlist_value(value):
            if value == "all":
                return True
            
            playlists = get_default_playlist_json()
            genres = set(p.get('genre') for p in playlists)
            return value in genres
        
        return {
            COMMON_CONFIG_KEYS["defaultPlaylistGenre"]: {
                'validate': validate_playlist_value,
                'errorMessage': lambda value: f"Genre '{value}' does not exist in default playlists"
            }
        }
    
    def is_valid_key(self, key: str) -> bool:
        return key in self.allowed_keys
    
    async def validate_key_and_value(self, key: str, value):
        if not self.is_valid_key(key):
            raise Exception(f"Invalid config key: {key}. Allowed keys are: {', '.join(self.allowed_keys)}")
        
        if key in self.validations:
            validation = self.validations[key]
            is_valid = await validation['validate'](value)
            if not is_valid:
                raise Exception(validation['errorMessage'](value))
    
    def get_all(self):
        return self.config
    
    async def get(self, key: str = None):
        if key:
            return self.config.get(key)
        return self.config
    
    async def update(self, key: str, value, partial: bool = False):
        try:
            await self.validate_key_and_value(key, value)
            
            if partial and isinstance(self.config.get(key), dict) and isinstance(value, dict):
                self.config[key] = {
                    **self.config.get(key, {}),
                    **value
                }
            else:
                self.config[key] = value
            
            save_common_config_json(self.config)
            return True
        except Exception as error:
            logger.error('Error updating config', error=str(error))
            raise error
    
    async def update_multiple(self, updates: dict, partial: bool = False):
        try:
            for key, value in updates.items():
                await self.validate_key_and_value(key, value)
            
            for key, value in updates.items():
                if partial and isinstance(self.config.get(key), dict) and isinstance(value, dict):
                    self.config[key] = {
                        **self.config.get(key, {}),
                        **value
                    }
                else:
                    self.config[key] = value
            
            save_common_config_json(self.config)
            return True
        except Exception as error:
            logger.error('Error updating multiple configs', error=str(error))
            return False
    
    async def delete(self, key: str):
        try:
            if not self.is_valid_key(key):
                raise Exception(f"Invalid config key: {key}. Allowed keys are: {', '.join(self.allowed_keys)}")
            
            if key in self.config:
                del self.config[key]
            save_common_config_json(self.config)
            return True
        except Exception as error:
            logger.error('Error deleting config', error=str(error))
            return False

common_config_service = CommonConfigService()
