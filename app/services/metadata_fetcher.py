from app.integrations.youtube import YouTube
from app.integrations.jiosaavn import JioSaavn
from app.integrations.spotify import SpotifyAPI
from app.integrations.soundcloud import SoundCloud
from app.core.utils import add_youtube_video_id, check_similarity, duration_formatter
from app.core import logger

async def search_spotify_song(song_name: str):
    try:
        spotify = SpotifyAPI()
        song_detail = await spotify.search_track(song_name)
        if not song_detail:
            raise Exception("No Song found By this Name")
        
        name = song_detail.get('name')
        song_id = song_detail.get('id')
        artists = song_detail.get('artists', [])
        artist_name = ''
        if len(artists) > 0:
            artist_name = artists[0].get('name', '')
        
        if not name:
            raise Exception("Invalid song name")
        
        return {'name': f"{name} {artist_name}", 'id': song_id}
    except Exception as error:
        logger.error(f"Spotify search error: {str(error)}")
        return None

async def search_jiosaavn_song(spotify_name: str):
    try:
        jio = JioSaavn()
        song = await jio.get_song_by_song_name(spotify_name)
        return song
    except Exception as error:
        logger.error(f"JioSaavn search error: {str(error)}")
        return None

async def search_soundcloud_song(spotify_name: str):
    try:
        soundcloud = SoundCloud()
        song = await soundcloud.get_song_by_song_name(spotify_name)
        return song
    except Exception as error:
        logger.error(f"SoundCloud search error: {str(error)}")
        return None

async def search_youtube_song(spotify_name: str):
    try:
        yt = YouTube()
        video_detail = await yt.get_video_detail(spotify_name)
        
        if not video_detail:
            return None
        
        url = video_detail.get('url')
        title = video_detail.get('title')
        timestamp = video_detail.get('timestamp')
        
        validation = await yt.validate_video(url)
        status = validation.get('status')
        message = validation.get('message')
        
        if not status:
            logger.warn(f"YouTube video validation failed: {message} - {title}")
            
            if 'format' in message.lower():
                logger.info(f"Accepting video despite format issues: {title}")
                return {'url': url, 'title': title, 'duration': timestamp, 'formatWarning': True}
            
            return None
        
        return {'url': url, 'title': title, 'duration': timestamp}
    except Exception as error:
        logger.error(f"YouTube search error: {str(error)}")
        return None

def create_metadata(original_name: str, spotify_name: str, requested_by: str):
    return {
        'title': '',
        'url': '',
        'urlType': '',
        'duration': '',
        'originalName': original_name,
        'spotifyName': spotify_name,
        'requestedBy': requested_by
    }

def update_metadata(metadata: dict, media_type: str, title: str, url: str, duration):
    check_similarity(metadata['originalName'], title)
    return {
        **metadata,
        'title': title,
        'url': url,
        'urlType': media_type,
        'duration': duration_formatter(duration)
    }

async def generate_song_metadata(song_name: str, requested_by: str, force: bool = False, preference: str = None):
    try:
        search_name = song_name
        
        if not force:
            spotify_result = await search_spotify_song(song_name)
            if not spotify_result:
                raise Exception("Could not find song on Spotify")
            search_name = spotify_result['name']
        
        metadata = create_metadata(song_name, search_name, requested_by)
        
        if force and preference:
            if preference.lower() == 'soundcloud':
                soundcloud_result = await search_soundcloud_song(search_name)
                if not soundcloud_result:
                    raise Exception("Song not found on SoundCloud")
                return update_metadata(metadata, "soundcloud", soundcloud_result['title'], soundcloud_result['url'], soundcloud_result['duration'])
            
            elif preference.lower() == 'jiosaavn':
                jiosaavn_result = await search_jiosaavn_song(search_name)
                if not jiosaavn_result:
                    raise Exception("Song not found on JioSaavn")
                return update_metadata(metadata, "jiosaavn", jiosaavn_result['title'], jiosaavn_result['url'], jiosaavn_result['duration'])
            
            elif preference.lower() == 'youtube':
                youtube_result = await search_youtube_song(search_name)
                if not youtube_result:
                    raise Exception("Song not found on YouTube")
                return update_metadata(metadata, "youtube", youtube_result['title'], youtube_result['url'], youtube_result['duration'])
            
            else:
                raise Exception("Invalid platform preference")
        
        soundcloud_result = await search_soundcloud_song(search_name)
        if soundcloud_result:
            return update_metadata(metadata, "soundcloud", soundcloud_result['title'], soundcloud_result['url'], soundcloud_result['duration'])
        
        jiosaavn_result = await search_jiosaavn_song(search_name)
        if jiosaavn_result:
            return update_metadata(metadata, "jiosaavn", jiosaavn_result['title'], jiosaavn_result['url'], jiosaavn_result['duration'])
        
        youtube_result = await search_youtube_song(search_name)
        if youtube_result:
            return update_metadata(metadata, "youtube", youtube_result['title'], youtube_result['url'], youtube_result['duration'])
        
        raise Exception("Song not found on any platform")
    except Exception as error:
        logger.error("Error generating metadata", error=str(error), song_name=song_name, requested_by=requested_by, force=force, preference=preference)
        raise Exception(str(error) or "Failed to generate song metadata")

async def search_youtube_playlist(playlist_id: str, requested_by: str):
    yts = YouTube()
    playlist_array = await yts.get_playlist_detail(playlist_id)
    playlist_metadata = [
        {
            'title': video['title'],
            'duration': duration_formatter(video['duration']['timestamp']),
            'requestedBy': requested_by,
            'url': add_youtube_video_id(video['videoId']),
            'urlType': "youtube"
        }
        for video in playlist_array
        if video['duration']['seconds'] <= 900
    ]
    return playlist_metadata

async def search_jiosaavn_playlist(playlist_id: str, requested_by: str):
    jio = JioSaavn()
    playlist_array = await jio.get_playlist_detail(playlist_id)
    if not playlist_array:
        return []
    playlist_metadata = [
        {
            'title': audio['title'],
            'duration': duration_formatter(audio['more_info']['duration']),
            'requestedBy': requested_by,
            'url': audio['more_info']['encrypted_media_url'],
            'urlType': "jiosaavn"
        }
        for audio in playlist_array
        if audio['more_info']['duration'] <= 900
    ]
    return playlist_metadata

async def generate_playlist_metadata(playlist_id: str, source_name: str, requested_by: str):
    if not source_name or not playlist_id:
        raise Exception("Invalid playlist parameters")
    
    if source_name == "youtube":
        return await search_youtube_playlist(playlist_id, requested_by)
    elif source_name == "jiosaavn":
        return await search_jiosaavn_playlist(playlist_id, requested_by)
    
    raise Exception("Unsupported playlist source")
