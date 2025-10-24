import yt_dlp as ytdl
import aiohttp
import asyncio
import subprocess
import os
from pathlib import Path
from app.core import logger
from app.core.utils import get_ffmpeg_path, get_cookies_path
from app.core.constants import DEFAULT_TRACKS_LOCATION
from app.core.fs_helper import fs_helper
from app.core.crypto import create_download_links
from app.streaming.cache_manager import cache_manager

class Downloader:
    async def download_video(self, url: str, title: str, output_path: str = DEFAULT_TRACKS_LOCATION):
        cached_path = cache_manager.get_from_cache(title)
        if cached_path:
            logger.info(f"Using cached version of: {title}")
            return {'url': cached_path}
        
        if not fs_helper.exists(output_path):
            fs_helper.create_directory(output_path)
            logger.info(f"Created directory: {output_path}")
        
        output_file_path = cache_manager.get_original_path(title)
        logger.info(f"Downloading {title} to {output_file_path}")
        
        try:
            cookies_path = get_cookies_path()
            
            use_cookies = False
            if os.path.exists(cookies_path):
                with open(cookies_path, 'r') as f:
                    cookies_content = f.read()
                    cookie_lines = [
                        line for line in cookies_content.split('\n')
                        if line.strip() and not line.startswith('#') and '.youtube.com' in line
                    ]
                    
                    if len(cookie_lines) > 0:
                        logger.info(f"Found {len(cookie_lines)} YouTube cookies, will try with cookies first")
                        use_cookies = True
                    else:
                        logger.warn('No valid YouTube cookies found in cookies.txt')
            else:
                logger.warn('No cookies.txt file found')
            
            download_methods = [
                {
                    'name': 'without cookies',
                    'options': {
                        'format': 'bestaudio/best',
                        'outtmpl': output_file_path,
                        'postprocessors': [{
                            'key': 'FFmpegExtractAudio',
                            'preferredcodec': 'mp3',
                            'preferredquality': '192',
                        }],
                        'ffmpeg_location': get_ffmpeg_path(),
                        'quiet': True,
                        'no_warnings': True,
                    }
                }
            ]
            
            if use_cookies:
                download_methods.append({
                    'name': 'with cookies',
                    'options': {
                        'format': 'bestaudio/best',
                        'outtmpl': output_file_path,
                        'postprocessors': [{
                            'key': 'FFmpegExtractAudio',
                            'preferredcodec': 'mp3',
                            'preferredquality': '192',
                        }],
                        'cookiefile': cookies_path,
                        'ffmpeg_location': get_ffmpeg_path(),
                        'quiet': True,
                        'no_warnings': True,
                    }
                })
            
            download_successful = False
            last_error = None
            
            for method in download_methods:
                try:
                    logger.info(f"Attempting download of {title} {method['name']}")
                    with ytdl.YoutubeDL(method['options']) as ydl:
                        await asyncio.to_thread(ydl.download, [url])
                    logger.info(f"Successfully downloaded {title} using {method['name']}")
                    download_successful = True
                    break
                except Exception as error:
                    logger.warn(f"Download failed {method['name']}: {str(error)}")
                    last_error = error
                    continue
            
            if not download_successful:
                raise Exception(f"All download methods failed. Last error: {str(last_error)}")
            
            return {'url': output_file_path}
        
        except Exception as error:
            logger.error(f"Error downloading {title}", error=str(error))
            raise error
    
    async def download_from_url(self, url: str, title: str, output_path: str = DEFAULT_TRACKS_LOCATION):
        cached_path = cache_manager.get_from_cache(title)
        if cached_path:
            logger.info(f"Using cached version of: {title}")
            return {'url': cached_path}
        
        if not fs_helper.exists(output_path):
            fs_helper.create_directory(output_path)
            logger.info(f"Created directory: {output_path}")
        
        output_file_path = cache_manager.get_original_path(title)
        safe_title = title.replace('<', '').replace('>', '').replace(':', '').replace('"', '').replace('/', '').replace('\\', '').replace('|', '').replace('?', '').replace('*', '')
        temp_file = os.path.join(output_path, f"temp_{safe_title}.mp3")
        logger.info(f"Downloading {title} to {output_file_path}")
        
        try:
            logger.info(f"Downloading {title} from URL to {output_file_path}")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    with open(temp_file, 'wb') as f:
                        async for chunk in response.content.iter_chunked(8192):
                            f.write(chunk)
            
            ffmpeg_path = get_ffmpeg_path()
            process = await asyncio.create_subprocess_exec(
                ffmpeg_path, '-i', temp_file,
                '-acodec', 'libmp3lame',
                '-aq', '6',
                output_file_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()
            
            if fs_helper.exists(temp_file):
                fs_helper.delete(temp_file)
            
            logger.info(f"Successfully downloaded {title} to {output_file_path}")
            return {'url': output_file_path}
        
        except Exception as error:
            logger.error(f"Error downloading {title}", error=str(error))
            if fs_helper.exists(temp_file):
                fs_helper.delete(temp_file)
                logger.info(f"Cleaned up temp file: {temp_file}")
            raise error
    
    async def download_jiosaavn(self, url: str, title: str):
        stream_url = create_download_links(url)[3]['url']
        return await self.download_from_url(stream_url, title)
    
    async def download_soundcloud(self, url: str, title: str):
        return await self.download_video(url, title)

downloader = Downloader()
