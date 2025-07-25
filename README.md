# MRadio 🎵

A powerful and flexible radio broadcasting system that supports multiple music streaming platforms with real-time streaming capabilities. Stream music from various sources and manage queues dynamically with live audio broadcasting.

## Features 🚀

### Core Features
- **Multi-platform Music Streaming Support:**
  - 🎵 **JioSaavn** - Indian music streaming
  - 🎬 **YouTube** - Video/audio content
  - 🎧 **SoundCloud** - Independent artists and tracks
  - 🎶 **Spotify** - Metadata and search integration

### Advanced Capabilities
- **Real-time Audio Broadcasting** - Live HTTP MP3 streaming
- **Smart Queue Management** - Dynamic song queuing with priority control
- **WebSocket Integration** - Live updates for connected clients
- **Intelligent Caching System** - Automatic file caching with size management
- **Block List Management** - Content filtering and moderation
- **Default Playlist System** - Automated fallback music rotation
- **Metadata Enrichment** - Spotify-powered song information
- **Token-based Authentication** - Secure access control
- **Admin Panel Controls** - Administrative song and user management
- **Docker Containerization** - Easy deployment and scaling
- **Smart Fallback System** - Automatic track switching when queue is empty
- **Configurable Settings** - Runtime configuration management

## Prerequisites 📋

- **Node.js** (v18 or higher)
- **FFmpeg** (for audio processing and streaming)
- **Docker** (optional, for containerized deployment)
- **API Keys** for music platforms:
  - Spotify Client ID & Secret (for metadata)
  - SoundCloud API Key (for SoundCloud integration)

## Installation 🛠️

### Method 1: Local Development

1. **Clone the repository:**
```bash
git clone https://github.com/GauravGhost/MRadio
cd MRadio
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment variables:**
Create a `.env` file in the root directory with the following variables:
```env
# Server Configuration
PORT=9126
NODE_ENV=development
FFMPEG_ENV=production

# Music Platform API Keys
SPOTIFY_CLIEND_ID=your_spotify_client_id
SPOTIFY_CLIEND_SECRET_ID=your_spotify_client_secret
SOUNDCLOUD_API_KEY=your_soundcloud_api_key

# Admin Authentication
X_ADMIN_API_KEY=your_admin_api_key
X_ADMIN_TOKEN_KEY=your_admin_token_key

# Initial Default Playlist (Optional)
INITIAL_PLAYLIST_ID=playlist_id
INITIAL_PLAYLIST_SOURCE=youtube|jiosaavn|soundcloud
INITIAL_PLAYLIST_TITLE=playlist_title
```

4. **Create required directories:**
```bash
mkdir -p cache data logs media/tracks media/fallback config
```

5. **Start the server:**
```bash
npm start
```

### Method 2: Docker Deployment

1. **Clone the repository:**
```bash
git clone https://github.com/GauravGhost/MRadio
cd MRadio
```

2. **Configure environment variables:**
Create a `.env` file with the required variables (same as above).

3. **Build and run with Docker:**
```bash
# Using the provided script
./run.sh

# Or manually
docker compose up -d
```

### Method 3: Quick Docker Setup
```bash
# Stop any existing containers and rebuild
docker compose down --rmi all
docker compose build
docker compose up -d
```

## Usage 🎮

### Starting the Radio Server

#### Local Development
```bash
npm start
```
The server will start on port `9126` by default.

#### Docker
```bash
docker compose up -d
```

### Accessing the Radio Stream

#### HTTP Audio Stream
```
http://localhost:9126/stream
```
Direct access to the MP3 audio stream for media players.

#### Web Interface
```
http://localhost:9126/
```
Redirects to the stream endpoint for immediate playback.

### Authentication Setup

1. **Generate User Token** (Admin required):
```bash
curl -X POST http://localhost:9126/api/admin/token \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: YOUR_ADMIN_API_KEY" \
  -H "x-admin-token-key: YOUR_ADMIN_TOKEN_KEY" \
  -d '{"username": "your_username"}'
```

2. **Use Token for API Requests:**
```bash
# Add token to headers for authenticated endpoints
-H "x-token-key: YOUR_GENERATED_TOKEN"
```

### Basic Usage Examples

#### Add a Song to Queue
```bash
curl -X POST http://localhost:9126/api/songs/add \
  -H "Content-Type: application/json" \
  -d '{"songName": "Shape of You Ed Sheeran", "requestedBy": "user1"}'
```

#### Skip Current Song
```bash
curl -X GET http://localhost:9126/api/songs/skip \
  -H "x-token-key: YOUR_TOKEN"
```

#### Get Current Playing Song
```bash
curl -X GET http://localhost:9126/api/songs/current
```

#### View Queue
```bash
curl -X GET http://localhost:9126/api/songs/queue
```

Start the server in development mode:
```bash
npm start
```

For production:
```bash
npm start
```

### Using Docker

Build and run using Docker Compose:
```bash
docker-compose up --build
```

## API Documentation 📚

### Authentication
All protected endpoints require a user token in the request headers:
```
x-token-key: YOUR_GENERATED_TOKEN
```

Admin endpoints require additional authentication:
```
x-admin-api-key: YOUR_ADMIN_API_KEY
x-admin-token-key: YOUR_ADMIN_TOKEN_KEY
```

### Public Endpoints (No Authentication Required)

#### Current Playback Information
```http
GET /api/songs/current
Description: Get the currently playing song information

GET /api/songs/upcoming  
Description: Get information about the next song in queue

GET /api/songs/queue
Description: Get the complete list of songs in the queue
```

#### Add Songs (Public)
```http
POST /api/songs/add
Content-Type: application/json
{
  "songName": "Artist - Song Title",
  "requestedBy": "username",
  "force": false,
  "preference": "youtube|jiosaavn|soundcloud"
}
Description: Add a song to the queue
```

### Authenticated User Endpoints

#### Queue Management
```http
GET /api/songs/skip
Description: Skip the current song

GET /api/songs/previous
Description: Play the previous song

GET /api/songs/seek/:seconds
Description: Seek to a specific time in the current song

POST /api/songs/add/top
Content-Type: application/json
{
  "songName": "Artist - Song Title", 
  "requestedBy": "username"
}
Description: Add a song to the top of the queue (priority)

DELETE /api/songs/remove/:index
Description: Remove a song from the queue at specified index

DELETE /api/songs/requests/last/:requestedBy
Description: Remove the last song requested by a specific user
```

#### Playlist Management
```http
POST /api/playlist/add
Content-Type: application/json
{
  "source": "youtube|jiosaavn",
  "playlistId": "playlist_id",
  "requestedBy": "username"
}
Description: Add an entire playlist to the queue

POST /api/playlist/add/top
Description: Add an entire playlist to the top of the queue

POST /api/playlist/default
Content-Type: application/json
{
  "playlistId": "playlist_id",
  "title": "Playlist Name",
  "source": "youtube|jiosaavn|soundcloud",
  "isActive": true,
  "genre": "mix|pop|rock|etc"
}
Description: Add a playlist to the default rotation

GET /api/playlist/default
Description: Get all default playlists

DELETE /api/playlist/default/:index
Description: Remove a default playlist by index

PUT /api/playlist/default/:index/status
Content-Type: application/json
{
  "isActive": true
}
Description: Update playlist active status
```

#### Block List Management
```http
POST /api/songs/block/current
Content-Type: application/json
{
  "requestedBy": "username"
}
Description: Block the currently playing song

POST /api/songs/block
Content-Type: application/json
{
  "songName": "Song Title",
  "requestedBy": "username"
}
Description: Block a song by its name

DELETE /api/songs/block/:songName
Description: Unblock a song by its name

DELETE /api/songs/block/:index
Description: Unblock a song by its index in the block list

DELETE /api/songs/block/all
Description: Clear the entire block list

GET /api/songs/block/list
Description: Get all blocked songs

GET /api/songs/block/check?songName=Song%20Title
Description: Check if a specific song is blocked
```

#### Configuration Management
```http
GET /api/config?key=configKey
Description: Get configuration value by key

POST /api/config
Content-Type: application/json
{
  "key": "defaultPlaylistGenre",
  "value": "pop"
}
Description: Update configuration values
```

### Admin Endpoints

#### Token Management
```http
POST /api/admin/token
Content-Type: application/json
Headers: x-admin-api-key, x-admin-token-key
{
  "username": "new_username"
}
Description: Generate a new user authentication token
```

### WebSocket Events

The server provides real-time updates via Socket.IO:

#### Client Events (Listening)
```javascript
socket.on('newSong', (songData) => {
  // New song started playing
  // songData: { title, duration, requestedBy }
});

socket.on('playbackProgress', (progress) => {
  // Playback progress update (every 30 seconds)
  // progress: { currentTime, duration, percentage }
});

socket.on('queueUpdate', (queueData) => {
  // Queue has been modified
});
```

#### Server Events (Sending)
```javascript
socket.emit('ping'); // Heartbeat check
socket.emit('pong'); // Heartbeat response
```

## Configuration ⚙️

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `9126` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `FFMPEG_ENV` | FFmpeg environment | `development` | No |
| `SPOTIFY_CLIEND_ID` | Spotify Client ID | - | Yes* |
| `SPOTIFY_CLIEND_SECRET_ID` | Spotify Client Secret | - | Yes* |
| `SOUNDCLOUD_API_KEY` | SoundCloud API Key | - | Yes* |
| `X_ADMIN_API_KEY` | Admin API Key | - | Yes |
| `X_ADMIN_TOKEN_KEY` | Admin Token Key | - | Yes |
| `INITIAL_PLAYLIST_ID` | Default playlist ID | - | No |
| `INITIAL_PLAYLIST_SOURCE` | Default playlist source | - | No |
| `INITIAL_PLAYLIST_TITLE` | Default playlist title | - | No |

*Required for full functionality, but the server can run with limited features without them.

### Directory Structure

```
MRadio/
├── server/                 # Core server code
│   ├── api/               # REST API routes and controllers
│   ├── lib/               # Platform integrations (YouTube, JioSaavn, etc.)
│   ├── services/          # Business logic services
│   └── utils/             # Utility functions and helpers
├── cache/                 # Cached audio files
├── data/                  # Runtime data (queues, configs, etc.)
├── logs/                  # Application logs
├── media/
│   ├── tracks/           # Temporary downloaded tracks
│   └── fallback/         # Fallback audio files
├── config/               # Configuration files
├── docker-compose.yml    # Docker deployment config
├── dockerfile           # Docker image config
└── package.json         # Node.js dependencies
```

### Runtime Configuration

The application supports runtime configuration through the `/api/config` endpoints:

#### Available Configuration Keys:
- `defaultPlaylistGenre`: Controls which genre of default playlists to use
  - Values: `"all"`, `"pop"`, `"rock"`, `"mix"`, etc.
  - Default: `"mix"`

### Cache Management

The system automatically manages audio file caching:
- **Cache Size Limit**: 1GB by default
- **Location**: `./cache` directory  
- **Cleanup**: Automatic when cache exceeds size limit
- **Strategy**: Least recently used (LRU) eviction

### Audio Processing

- **Format**: MP3 streaming at 128 kbps
- **FFmpeg**: Used for audio processing and streaming
- **Bitrate Throttling**: Automatic bandwidth management
- **Sample Rate**: 44.1 kHz, 2 channels (stereo)

## Architecture 🏗️

MRadio follows a modular, service-oriented architecture designed for scalability and maintainability.

### Core Components

#### 1. **HTTP Server & Streaming Engine**
- **Express.js** REST API server
- **FFmpeg** audio processing pipeline
- **Real-time MP3 streaming** with throttling
- **Socket.IO** for live client updates

#### 2. **Queue Management System**
- **Dynamic Queue Processing**: Real-time song queue management
- **Priority System**: Support for adding songs to top of queue
- **Smart Fallback**: Automatic playlist rotation when queue is empty
- **Cache Integration**: Intelligent file caching with LRU eviction

#### 3. **Multi-Platform Integration**
```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   YouTube   │    │   JioSaavn   │    │ SoundCloud  │
│   API/YT-DL │    │   API        │    │   Scraper   │
└─────────────┘    └──────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                          │
               ┌──────────────────┐
               │  Metadata Engine │
               │  (Spotify API)   │
               └──────────────────┘
                          │
               ┌──────────────────┐
               │   Audio Engine   │
               │   (FFmpeg)       │
               └──────────────────┘
```

#### 4. **Data Management**
- **JSON-based Storage**: Lightweight persistence for queues and configs
- **File System Caching**: Smart audio file management
- **Memory Management**: Efficient client connection handling

#### 5. **Security & Authentication**
- **Token-based Authentication**: 256-bit secure tokens
- **Admin Access Control**: Separate admin authentication layer
- **Request Validation**: Input sanitization and validation

### Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  Controllers│ │ Middleware  │ │       Routes            │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                             │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────────┐ │
│  │ API Service  │ │Config Service│ │ Metadata Service      │ │
│  └──────────────┘ └──────────────┘ └───────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                    Core Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │Queue Engine │ │Cache Manager│ │   Stream Manager        │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                 Platform Layer                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │   YouTube   │ │  JioSaavn   │ │      SoundCloud         │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Patterns

1. **Factory Pattern**: Platform-specific music service instantiation
2. **Observer Pattern**: Real-time client notifications via WebSocket
3. **Strategy Pattern**: Multiple music source handling
4. **Queue Pattern**: FIFO song processing with priority support
5. **Cache Pattern**: LRU audio file caching system

### Scalability Features

- **Stateless Design**: Easy horizontal scaling
- **Docker Support**: Container-based deployment
- **Modular Components**: Independent service scaling
- **Efficient Streaming**: Low-latency audio delivery
- **Resource Management**: Automatic cleanup and optimization

## Troubleshooting 🔧

### Common Issues

#### 1. **FFmpeg Not Found**
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Or set FFMPEG_ENV=production to use static build
```

#### 2. **Permission Issues with Cache/Data Directories**
```bash
# Create directories with proper permissions
mkdir -p cache data logs media/tracks media/fallback config
chmod -R 755 cache data logs media config
```

#### 3. **Port Already in Use**
```bash
# Check what's using port 9126
lsof -i :9126

# Kill the process or change PORT in .env
PORT=9127
```

#### 4. **API Authentication Errors**
- Verify `.env` file has correct admin keys
- Ensure token generation was successful
- Check token is included in request headers

#### 5. **Audio Stream Issues**
- Verify FFmpeg installation
- Check file permissions in tracks/cache directories
- Ensure adequate disk space for caching

### Performance Optimization

1. **Increase Cache Size**: Modify `CACHE_SIZE` in constants
2. **Optimize Queue Size**: Adjust `DEFAULT_QUEUE_SIZE` based on usage
3. **Monitor Logs**: Check `logs/` directory for errors
4. **Resource Monitoring**: Watch CPU/memory usage during streaming

### Development Tips

1. **Enable Debug Logging**: Set `NODE_ENV=development`
2. **Hot Reload**: Use `nodemon` for development
3. **API Testing**: Use Postman or curl for endpoint testing
4. **Docker Development**: Use volume mounts for live code updates

## License 📝

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Features Overview 📋

### Completed Features ✅
- ✅ Multi-platform music streaming (YouTube, JioSaavn, SoundCloud)
- ✅ Real-time HTTP MP3 streaming
- ✅ Dynamic queue management with priority support
- ✅ Smart caching system with LRU eviction
- ✅ Block list management for content filtering
- ✅ Token-based authentication system
- ✅ Admin panel with user management
- ✅ WebSocket integration for real-time updates
- ✅ Docker containerization support
- ✅ Default playlist rotation system
- ✅ Metadata enrichment via Spotify API
- ✅ Automatic fallback system
- ✅ RESTful API with comprehensive endpoints
- ✅ Configurable settings management
- ✅ Comprehensive logging system

### Roadmap 🚀
- 🔄 Web UI dashboard for easy management
- 🔄 Playlist import/export functionality
- 🔄 User favorites and personal playlists
- 🔄 Advanced analytics and reporting
- 🔄 Mobile app support
- 🔄 Social features (voting, requests)
- 🔄 Enhanced audio quality options
- 🔄 Multi-room audio support

## Contributing 🤝

We welcome contributions! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Install dependencies (`npm install`)
4. Set up environment variables (`.env` file)
5. Run the development server (`npm start`)
6. Make your changes and test thoroughly
7. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
8. Push to the branch (`git push origin feature/AmazingFeature`)
9. Open a Pull Request

### Contribution Guidelines
- Follow the existing code style and patterns
- Add tests for new features
- Update documentation for any API changes
- Ensure Docker builds work correctly
- Test on multiple platforms when possible

## Acknowledgments 🙏

- **Music Platform APIs**: Thanks to YouTube, JioSaavn, SoundCloud, and Spotify for their APIs
- **Open Source Community**: Various dependencies and tools that make this project possible
- **FFmpeg Team**: For the excellent audio processing capabilities
- **Node.js Ecosystem**: Express, Socket.IO, and other fantastic libraries
- **Docker Community**: For containerization best practices

## Support 💪

If you find this project useful, please consider:
- ⭐️ **Starring** the repository on GitHub
- 🐛 **Reporting issues** and bugs
- 💡 **Suggesting features** and improvements
- 🤝 **Contributing** code or documentation
- 📢 **Sharing** the project with others

### Get Help
- 📚 **Documentation**: Read this README and API docs
- 🐛 **Issues**: [GitHub Issues](https://github.com/GauravGhost/MRadio/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/GauravGhost/MRadio/discussions)
- 📧 **Contact**: Reach out via GitHub profile

---

**Made with ❤️ by [GauravGhost](https://github.com/GauravGhost)**
