from app.core.config import config

SPOTIFY_TOKEN_LOCATION = "config/spotify.json"
AUTH_TOKEN_LOCATION = "config/authToken.json"

DEFAULT_CACHE_LOCATION = "cache"

DEFAULT_TRACKS_LOCATION = "media/tracks"
DEFAULT_FALLBACK_LOCATION = "media/fallback"

SONG_QUEUE_LOCATION = "data/queue.json"
BLOCK_LIST_LOCATION = "data/blockList.json"
DEFAULT_PLAYLIST_LOCATION = "data/defaultSongPlaylist.json"
DEFAULT_PLAYLIST_METADATA_LOCATION = "data/defaultPlaylistMetadata.json"
COMMON_CONFIG_LOCATION = "data/commonConfig.json"

DEFAULT_QUEUE_SIZE = 2
SONG_METADATA_UPDATE_TIME = 2 * 24 * 60 * 60 * 1000
CACHE_SIZE = 1024 * 1024 * 1024

COMMON_CONFIG_KEYS = {
    "defaultPlaylistGenre": "defaultPlaylistGenre"
}

class STREAM_MEDIA_TYPE:
    youtube = "youtube"
    jiosaavn = "jiosaavn"
    soundcloud = "soundcloud"

def JIO_SAAVN_SONG_SEARCH(song_name):
    return f"https://www.jiosaavn.com/api.php?p=1&q={song_name}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=1&__call=search.getResults"

def JIO_SAAVN_PLAYLIST_SEARCH(playlist_id):
    return f"https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid={playlist_id}&api_version=4&_format=json&_marker=0&ctx=web6dot0"

def DEFAULT_PLAYLIST_SEED_DATA():
    playlist_id = config.INITIAL_PLAYLIST_ID
    source = config.INITIAL_PLAYLIST_SOURCE
    title = config.INITIAL_PLAYLIST_TITLE
    
    if not playlist_id or not source or not title:
        return [{
            "playlistId": "1134543272",
            "title": "Top 50 Songs",
            "source": "jiosaavn",
            "isActive": True,
            "genre": "mix",
        }]
    
    return [{
        "playlistId": config.INITIAL_PLAYLIST_ID,
        "title": config.INITIAL_PLAYLIST_TITLE,
        "source": config.INITIAL_PLAYLIST_SOURCE,
        "isActive": True,
        "genre": "mix",
    }]
