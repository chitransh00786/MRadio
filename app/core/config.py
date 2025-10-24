import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    NODE_ENV = os.getenv("NODE_ENV", "development")
    FFMPEG_ENV = os.getenv("FFMPEG_ENV", "development")
    
    SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIEND_ID")
    SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIEND_SECRET_ID")
    SOUNDCLOUD_API_KEY = os.getenv("SOUNDCLOUD_API_KEY")
    
    X_ADMIN_API_KEY = os.getenv("X_ADMIN_API_KEY")
    X_ADMIN_TOKEN_KEY = os.getenv("X_ADMIN_TOKEN_KEY")
    
    INITIAL_PLAYLIST_ID = os.getenv("INITIAL_PLAYLIST_ID")
    INITIAL_PLAYLIST_SOURCE = os.getenv("INITIAL_PLAYLIST_SOURCE")
    INITIAL_PLAYLIST_TITLE = os.getenv("INITIAL_PLAYLIST_TITLE")
    
    ICECAST_HOST = os.getenv("ICECAST_HOST")
    ICECAST_PORT = os.getenv("ICECAST_PORT")
    ICECAST_PASSWORD = os.getenv("ICECAST_PASSWORD")
    ICECAST_MOUNT = os.getenv("ICECAST_MOUNT", "/radio.mp3")
    ICECAST_NAME = os.getenv("ICECAST_NAME", "MRadio")
    ICECAST_DESCRIPTION = os.getenv("ICECAST_DESCRIPTION", "MRadio - Multi-platform Music Streaming")
    ICECAST_GENRE = os.getenv("ICECAST_GENRE", "Various")
    ICECAST_BITRATE = os.getenv("ICECAST_BITRATE", "128")

config = Config()
