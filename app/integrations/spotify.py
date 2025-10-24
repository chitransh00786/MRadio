import aiohttp
import base64
import json
import time
from pathlib import Path
from app.core import logger
from app.core.config import config
from app.core.utils import check_similarity

class SpotifyAPI:
    def __init__(self):
        self.client_id = config.SPOTIFY_CLIENT_ID
        self.client_secret = config.SPOTIFY_CLIENT_SECRET
        if self.client_id and self.client_secret:
            auth_string = f"{self.client_id}:{self.client_secret}"
            self.auth_header = base64.b64encode(auth_string.encode()).decode()
        else:
            self.auth_header = None
        self.token_url = 'https://accounts.spotify.com/api/token'
        self.token_file_path = Path('./config/token.json')
    
    async def get_access_token(self):
        if not self.client_id or not self.client_secret:
            raise Exception("Spotify credentials not configured")
        
        data = {'grant_type': 'client_credentials'}
        headers = {
            'Authorization': f'Basic {self.auth_header}',
            'Content-Type': 'application/x-www-form-urlencoded',
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.token_url, data=data, headers=headers) as response:
                    response_data = await response.json()
                    access_token = response_data.get('access_token')
                    return access_token
        except Exception as error:
            logger.error(f'Error fetching access token: {str(error)}')
            raise error
    
    def token_file_exists(self):
        return self.token_file_path.exists()
    
    def read_token_from_file(self):
        with open(self.token_file_path, 'r') as f:
            return json.load(f)
    
    def write_token_to_file(self, token, expiration):
        token_data = {
            'accessToken': token,
            'expiration': expiration,
        }
        self.token_file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.token_file_path, 'w') as f:
            json.dump(token_data, f, indent=2)
    
    def is_token_valid(self):
        if self.token_file_exists():
            token_data = self.read_token_from_file()
            return time.time() * 1000 < token_data['expiration']
        return False
    
    async def get_valid_access_token(self):
        if not self.is_token_valid():
            access_token = await self.get_access_token()
            expiration = int(time.time() * 1000) + 3600 * 1000 - 5000
            self.write_token_to_file(access_token, expiration)
        
        token_data = self.read_token_from_file()
        return token_data['accessToken']
    
    async def search_track(self, query: str):
        try:
            access_token = await self.get_valid_access_token()
            url = f"https://api.spotify.com/v1/search?q={query}&type=track&limit=10&include_external=audio"
            
            headers = {
                'Authorization': f'Bearer {access_token}',
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    data = await response.json()
                    
                    tracks = data.get('tracks', {}).get('items', [])
                    
                    for track in tracks:
                        if check_similarity(query, track.get('name', '')) > 60:
                            return track
                    
                    return None
        except Exception as error:
            logger.error(f'Error searching for track: {str(error)}')
            raise error
