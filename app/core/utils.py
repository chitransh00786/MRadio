import os
import random
import shutil
from pathlib import Path
from fuzzywuzzy import fuzz
from app.core.fs_helper import fs_helper
from app.core.constants import (
    AUTH_TOKEN_LOCATION, SONG_QUEUE_LOCATION, BLOCK_LIST_LOCATION,
    DEFAULT_PLAYLIST_METADATA_LOCATION, DEFAULT_PLAYLIST_LOCATION,
    COMMON_CONFIG_LOCATION, SPOTIFY_TOKEN_LOCATION
)
from app.core import logger

def get_ffmpeg_path() -> str:
    from app.core.config import config
    env = config.FFMPEG_ENV
    if env == 'production':
        return '/usr/bin/ffmpeg'
    elif env == 'development':
        ffmpeg_path = shutil.which('ffmpeg')
        if not ffmpeg_path:
            raise RuntimeError("FFmpeg not found. Please install FFmpeg.")
        return ffmpeg_path
    else:
        raise ValueError("Unknown environment")

def get_cookies_path() -> str:
    logger.info("Fetching the cookies")
    cookies_path = os.path.join('config', 'cookies.txt')
    
    if not fs_helper.exists(cookies_path):
        directory_path = os.path.dirname(cookies_path)
        if not fs_helper.exists(directory_path):
            fs_helper.create_directory(directory_path)
        
        with open(cookies_path, 'w') as f:
            f.write('')
        logger.info('Created new empty cookies.txt file')
    
    return cookies_path

def get_queue_list_json():
    return fs_helper.read_from_json(SONG_QUEUE_LOCATION, [])

def save_queue_list_json(data):
    return fs_helper.write_to_json(SONG_QUEUE_LOCATION, data)

def get_token_list_json():
    return fs_helper.read_from_json(AUTH_TOKEN_LOCATION, [])

def save_token_list_json(data):
    return fs_helper.write_to_json(AUTH_TOKEN_LOCATION, data)

def get_block_list_json():
    return fs_helper.read_from_json(BLOCK_LIST_LOCATION, [])

def save_block_list_json(data):
    return fs_helper.write_to_json(BLOCK_LIST_LOCATION, data)

def get_spotify_config_json():
    return fs_helper.read_from_json(SPOTIFY_TOKEN_LOCATION, {})

def get_default_playlist_json():
    return fs_helper.read_from_json(DEFAULT_PLAYLIST_LOCATION, [])

def save_default_playlist_json(data):
    return fs_helper.write_to_json(DEFAULT_PLAYLIST_LOCATION, data)

def get_default_playlist_metadata_json():
    return fs_helper.read_from_json(DEFAULT_PLAYLIST_METADATA_LOCATION, [])

def save_default_playlist_metadata_json(data):
    return fs_helper.write_to_json(DEFAULT_PLAYLIST_METADATA_LOCATION, data)

def get_random_number(min_val: int, max_val: int) -> int:
    return random.randint(min_val, max_val)

def duration_formatter(duration) -> str:
    if isinstance(duration, str) and ":" in duration:
        return duration
    
    try:
        num_duration = float(duration)
    except (ValueError, TypeError):
        logger.info('Invalid duration, returning 00:00')
        return "00:00"
    
    minutes = int(num_duration // 60)
    seconds = int(num_duration % 60)
    formatted = f"{minutes:02d}:{seconds:02d}"
    return formatted

def check_similarity(original: str, found: str) -> float:
    similarity = fuzz.token_set_ratio(original, found)
    return similarity

def extract_youtube_playlist_id(url: str) -> str:
    from urllib.parse import urlparse, parse_qs
    parsed_url = urlparse(url)
    query_params = parse_qs(parsed_url.query)
    playlist_id = query_params.get('list', [None])[0]
    return playlist_id

def add_youtube_video_id(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"

def get_common_config_json():
    return fs_helper.read_from_json(COMMON_CONFIG_LOCATION, {})

def save_common_config_json(data):
    return fs_helper.write_to_json(COMMON_CONFIG_LOCATION, data)
