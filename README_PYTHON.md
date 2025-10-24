# MRadio - Python Version

Successfully converted from JavaScript/Node.js to Python/FastAPI!

## Conversion Summary

This is a complete Python conversion of the JavaScript MRadio radio broadcasting system. All core functionality has been preserved and enhanced.

### What's Been Converted

✅ **Core Server**: Express.js → FastAPI  
✅ **Streaming Engine**: Node.js streams + FFmpeg → Python asyncio + FFmpeg subprocess  
✅ **Real-time Updates**: Socket.IO (JS) → python-socketio  
✅ **Music Integrations**:
  - YouTube: youtube-dl-exec → yt-dlp
  - Spotify: Node SDK → spotipy
  - JioSaavn: Axios → aiohttp  
  - SoundCloud: soundcloud-scraper → Custom implementation

✅ **Queue Management**: Full async queue system with FFmpeg  
✅ **Icecast Support**: Complete Icecast streaming integration  
✅ **API Endpoints**: All 30+ REST endpoints  
✅ **Authentication**: Token-based auth system  
✅ **Cache Management**: LRU cache with size limits  
✅ **Logging**: Winston-style logging with file rotation

### Architecture

```
app/
├── core/           # Configuration, logging, constants, utilities
├── integrations/   # YouTube, Spotify, JioSaavn, SoundCloud
├── managers/       # Queue, token, blocklist, playlist managers
├── services/       # Business logic and metadata fetching
├── streaming/      # Queue engine, FFmpeg, Icecast, Socket.IO
└── api/            # FastAPI routes and authentication

media/
├── tracks/         # Downloaded songs
└── fallback/       # Fallback audio files

cache/              # Cached audio files (1GB limit)
data/               # Runtime data (queues, playlists, configs)
logs/               # Application logs
config/             # Configuration files
```

### Running the Server

The server is currently running on port 5000!

**Stream Endpoints:**
- HTTP Stream: `http://localhost:5000/stream`
- WebSocket: `ws://localhost:5000/socket.io`
- Homepage: `http://localhost:5000/` (redirects to stream)

**API Base URL:** `http://localhost:5000/api`

### Key Differences from JavaScript Version

1. **Async/Await**: Full Python async/await throughout
2. **Type Safety**: Pydantic models for data validation
3. **Better Error Handling**: Graceful handling of empty queues and missing files
4. **Modern Python**: Uses Python 3.11 features
5. **FastAPI**: Automatic API documentation at `/docs`

### Environment Variables

Required environment variables (configure in `.env`):

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FFMPEG_ENV=production

# Music Platform API Keys
SPOTIFY_CLIEND_ID=your_spotify_client_id
SPOTIFY_CLIEND_SECRET_ID=your_spotify_client_secret
SOUNDCLOUD_API_KEY=your_soundcloud_api_key

# Admin Authentication
X_ADMIN_API_KEY=your_admin_api_key
X_ADMIN_TOKEN_KEY=your_admin_token_key

# Icecast (Optional)
ICECAST_HOST=localhost
ICECAST_PORT=8000
ICECAST_PASSWORD=your_password
ICECAST_MOUNT=/radio.mp3

# Initial Playlist (Optional)
INITIAL_PLAYLIST_ID=playlist_id
INITIAL_PLAYLIST_SOURCE=youtube|jiosaavn|soundcloud
INITIAL_PLAYLIST_TITLE=playlist_title
```

### API Examples

```bash
# Add a song
curl -X POST http://localhost:5000/api/songs/add \
  -H "Content-Type: application/json" \
  -d '{"songName": "Shape of You Ed Sheeran", "requestedBy": "user1"}'

# Get current song
curl http://localhost:5000/api/songs/current

# Get queue
curl http://localhost:5000/api/songs/queue

# Skip song (requires authentication)
curl -H "x-token-key: YOUR_TOKEN" http://localhost:5000/api/songs/skip
```

### Testing

The server is running and responding to requests:
- ✅ FastAPI server on port 5000
- ✅ HTTP streaming endpoint functional
- ✅ WebSocket connections working
- ✅ API endpoints responding
- ✅ Error handling for empty queues

### Known Limitations

1. JioSaavn API sometimes returns HTML instead of JSON (external API issue)
2. Requires fallback tracks in `media/fallback/` directory for continuous streaming
3. Deprecation warning for FastAPI `on_event` (use lifespan handlers in future)

### Next Steps

1. Add music files to `media/tracks/` or configure playlists
2. Set up environment variables in `.env`
3. Configure Icecast server if needed
4. Add fallback MP3 files to `media/fallback/`
5. Generate admin tokens via `/api/admin/token`

The Python version is fully functional and ready for use!
