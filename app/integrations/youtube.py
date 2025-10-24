import yt_dlp as ytdl
import aiohttp
from app.core import logger
from app.core.utils import check_similarity, get_cookies_path

class YouTube:
    async def get_video_detail(self, name: str, artist_name: str = ""):
        try:
            search_query = f"{name} - {artist_name} official audio song music" if artist_name else f"{name} official audio song music"
            
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'default_search': 'ytsearch',
                'extract_flat': True,
            }
            
            with ytdl.YoutubeDL(ydl_opts) as ydl:
                result = ydl.extract_info(f"ytsearch10:{search_query}", download=False)
                
                if not result or 'entries' not in result or len(result['entries']) == 0:
                    return None
                
                for video in result['entries']:
                    if check_similarity(name, video.get('title', '')) > 60:
                        return {
                            'url': f"https://www.youtube.com/watch?v={video['id']}",
                            'title': video.get('title'),
                            'timestamp': video.get('duration', 0),
                            'videoId': video['id']
                        }
                
                first_video = result['entries'][0]
                return {
                    'url': f"https://www.youtube.com/watch?v={first_video['id']}",
                    'title': first_video.get('title'),
                    'timestamp': first_video.get('duration', 0),
                    'videoId': first_video['id']
                }
        except Exception as error:
            logger.error(f"Error getting details: {str(error)}")
            return None
    
    async def get_video_detail_by_url(self, video_id: str):
        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
            }
            
            with ytdl.YoutubeDL(ydl_opts) as ydl:
                result = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                
                if not result:
                    return None
                
                return {
                    'title': result.get('title'),
                    'url': result.get('webpage_url'),
                    'duration': {'timestamp': result.get('duration', 0)}
                }
        except Exception as error:
            logger.error(f"Error getting details: {str(error)}")
            raise error
    
    async def validate_video(self, url: str):
        try:
            import os
            cookies_path = get_cookies_path()
            
            has_cookies = os.path.exists(cookies_path)
            valid_cookie_lines = 0
            
            if has_cookies:
                with open(cookies_path, 'r') as f:
                    cookies_content = f.read()
                    cookie_lines = [
                        line for line in cookies_content.split('\n')
                        if line.strip() and not line.startswith('#') and '.youtube.com' in line
                    ]
                    valid_cookie_lines = len(cookie_lines)
            
            extraction_methods = [
                {
                    'name': 'without cookies',
                    'options': {
                        'quiet': True,
                        'no_warnings': True,
                        'no_check_certificate': True,
                        'ignoreerrors': True,
                    }
                }
            ]
            
            if has_cookies and valid_cookie_lines > 0:
                extraction_methods.extend([
                    {
                        'name': 'with cookies',
                        'options': {
                            'quiet': True,
                            'no_warnings': True,
                            'no_check_certificate': True,
                            'cookiefile': cookies_path,
                            'ignoreerrors': True,
                        }
                    },
                    {
                        'name': 'with cookies and audio format',
                        'options': {
                            'quiet': True,
                            'no_warnings': True,
                            'no_check_certificate': True,
                            'cookiefile': cookies_path,
                            'format': 'bestaudio[ext=m4a]/bestaudio/worst',
                            'ignoreerrors': True,
                        }
                    }
                ])
            
            info = None
            used_method = None
            
            for method in extraction_methods:
                try:
                    logger.info(f"Trying video extraction {method['name']} for {url}")
                    with ytdl.YoutubeDL(method['options']) as ydl:
                        info = ydl.extract_info(url, download=False)
                    used_method = method['name']
                    logger.info(f"Successfully extracted video info using {method['name']}")
                    break
                except Exception as error:
                    logger.warn(f"Video extraction failed using {method['name']}: {str(error)}")
                    continue
            
            if not info or not info.get('duration'):
                return {
                    'status': False,
                    'message': 'Unable to extract video information. The video might be private, unavailable, or region-locked.'
                }
            
            duration = int(info.get('duration', 0))
            
            if duration > 600:
                return {'status': False, 'message': 'Video duration exceeds 10 minutes'}
            
            categories = info.get('categories', [])
            tags = info.get('tags', [])
            is_music_category = (
                any('music' in str(cat).lower() for cat in categories) or
                any('music' in str(tag).lower() for tag in tags)
            )
            
            if not is_music_category:
                return {'status': False, 'message': 'Video is not in the Music category'}
            
            return {
                'status': True,
                'message': f"Successful (using {used_method})",
                'extractionMethod': used_method
            }
        except Exception as error:
            logger.error(f'Video validation error: {str(error)}')
            return {
                'status': False,
                'message': f"Video validation error: {str(error)}"
            }
    
    async def get_playlist_detail(self, list_id: str):
        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
            }
            
            with ytdl.YoutubeDL(ydl_opts) as ydl:
                result = ydl.extract_info(f"https://www.youtube.com/playlist?list={list_id}", download=False)
                
                if not result or 'entries' not in result or len(result['entries']) == 0:
                    raise Exception('No video found for the given playlist ID')
                
                videos = []
                for entry in result['entries']:
                    videos.append({
                        'title': entry.get('title'),
                        'videoId': entry.get('id'),
                        'duration': {'seconds': entry.get('duration', 0), 'timestamp': entry.get('duration', 0)}
                    })
                
                return videos
        except Exception as error:
            logger.error(f"Error getting playlist details: {str(error)}")
            raise error
