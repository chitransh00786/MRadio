from app.core.constants import DEFAULT_PLAYLIST_SEED_DATA
from app.managers.default_playlist_manager import DefaultPlaylistManager

class Initializer:
    @staticmethod
    async def init():
        await Initializer.default_playlist_initializer()
    
    @staticmethod
    async def default_playlist_initializer():
        from app.services.api_service import Service
        
        default_playlist = DefaultPlaylistManager()
        if default_playlist.get_length() != 0:
            return
        
        api_service = Service()
        for playlist in DEFAULT_PLAYLIST_SEED_DATA():
            await api_service.add_default_playlist(playlist)

initializer = Initializer()
