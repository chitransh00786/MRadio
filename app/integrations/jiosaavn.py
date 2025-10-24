import aiohttp
from app.core import logger
from app.core.utils import check_similarity
from app.core.constants import JIO_SAAVN_SONG_SEARCH, JIO_SAAVN_PLAYLIST_SEARCH

class JioSaavn:
    async def get_song_by_song_name(self, song_name: str, retry_count: int = 1):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(JIO_SAAVN_SONG_SEARCH(song_name)) as response:
                    data = await response.json()
                    
                    if not data.get('results'):
                        return None
                    
                    results = None
                    for track in data['results']:
                        if check_similarity(song_name, track.get('title', '')) > 60:
                            results = track
                            break
                    
                    if not results:
                        return None
                    
                    more_info = results.get('more_info', {})
                    
                    if more_info.get('duration', 0) > 600:
                        raise Exception("Song Duration is more than 10 minutes.")
                    
                    return {
                        'title': results.get('title'),
                        'url': more_info.get('encrypted_media_url'),
                        'duration': more_info.get('duration')
                    }
        except Exception as error:
            logger.error(str(error))
            logger.error("Failed after retrying", error=str(error))
            return None
    
    async def get_playlist_detail(self, playlist_id: str):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(JIO_SAAVN_PLAYLIST_SEARCH(playlist_id)) as response:
                    data = await response.json()
                    
                    playlist_list = data.get('list', [])
                    if len(playlist_list) <= 0:
                        raise Exception("Invalid Playlist ID")
                    
                    return playlist_list
        except Exception as error:
            logger.error(str(error))
            logger.error("Error fetching Playlist")
            return None
