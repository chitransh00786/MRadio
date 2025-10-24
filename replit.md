# MRadio - Multi-platform Radio Broadcasting System

## Overview

MRadio is a powerful radio broadcasting system that streams music from multiple platforms (YouTube, JioSaavn, SoundCloud, Spotify) with real-time capabilities. The system supports both direct HTTP MP3 streaming and professional Icecast server integration, featuring intelligent queue management, WebSocket-based live updates, and automated fallback mechanisms.

The project has been converted from JavaScript/Node.js to Python/FastAPI while preserving all core functionality. It operates as a radio station that continuously streams music, managing a queue of songs requested by users while automatically falling back to default playlists when the queue is empty.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture Pattern
- **Backend Framework**: FastAPI (Python) - RESTful API server with async/await support
- **Real-time Communication**: python-socketio for WebSocket connections enabling live metadata updates to connected clients
- **Streaming Architecture**: Dual-mode streaming system supporting both direct HTTP streaming and Icecast broadcasting

### Music Integration Layer
The system integrates with multiple music platforms through dedicated modules:

- **YouTube**: Uses yt-dlp for video/audio extraction with cookie-based authentication support for age-restricted content
- **JioSaavn**: Direct API integration for Indian music streaming with encrypted media URL decryption
- **SoundCloud**: Custom implementation for independent artist tracks
- **Spotify**: Uses spotipy SDK primarily for metadata enrichment and song search (not for streaming)

**Design Decision**: Multiple platform support provides resilience - if one platform fails, the system automatically tries alternative sources for the same song.

### Queue Management System
- **Primary Queue**: User-requested songs with priority-based ordering
- **Default Playlists**: Automatically managed fallback playlists with genre-based filtering
- **Smart Fallback**: Multi-tier fallback system (Queue → Default Playlists → Local Fallback Files)
- **Manager Pattern**: BaseQueueManager provides reusable queue operations for SongQueue, BlockList, DefaultPlaylist, and TokenManagers

**Design Rationale**: The manager pattern ensures consistent queue operations across different data types while the fallback system guarantees continuous streaming even when queues are empty.

### Streaming Engine
- **FFmpeg Integration**: Subprocess-based FFmpeg for audio transcoding and format conversion
- **Icecast Support**: Optional professional broadcasting with metadata updates and reconnection handling
- **Cache System**: LRU-based file caching (1GB limit) to avoid re-downloading frequently played songs
- **Buffer Management**: PassThrough stream with multiple readers for concurrent client connections

**Key Decision**: Dual streaming modes allow the system to function as both a simple HTTP radio server and a professional broadcasting station compatible with standard radio clients.

### Authentication & Authorization
- **Token-Based Auth**: 256-bit cryptographically secure tokens for API access
- **Two-Tier Access**: Regular user tokens for song requests, admin tokens for system management
- **Header-Based**: Uses `x-token-key` for users and `x-admin-token-key` + `x-admin-api-key` for admins

### Content Moderation
- **Block List System**: Prevents specific songs from being played based on fuzzy name matching (85% similarity threshold)
- **Duration Limits**: Automatic rejection of songs longer than 10 minutes
- **Queue Validation**: All songs are validated before being added to prevent invalid entries

### Data Persistence
- **JSON-based Storage**: All persistent data (queues, playlists, configurations, tokens) stored in JSON files
- **File Structure**:
  - `data/` - Runtime data (queues, playlists, configs)
  - `cache/` - Temporary audio file cache
  - `media/tracks/` - Downloaded songs
  - `media/fallback/` - Emergency fallback audio files
  - `config/` - System configuration and tokens

**Design Rationale**: JSON-based storage provides simplicity and human-readability for a radio broadcasting system that doesn't require complex relational queries. This approach avoids database dependencies while maintaining data integrity.

### Logging System
- **Winston-style Logging**: Structured logging with file rotation
- **Circular Reference Handling**: Special filter to prevent JSON serialization errors
- **Multi-transport**: Console output with color coding and file-based persistence with daily rotation

### Configuration Management
- **Environment Variables**: Core credentials and Icecast settings via .env file
- **Runtime Config**: Dynamic configuration updates via API without restart
- **Validation Layer**: Type checking and value validation for configuration changes

## External Dependencies

### Third-Party Music Services
- **Spotify API**: Client ID and Secret required for metadata enrichment and song search
- **SoundCloud API**: API key required for SoundCloud integration
- **YouTube**: No API key required (uses yt-dlp), optional cookies.txt for age-restricted content
- **JioSaavn**: Public API, no authentication required

### Streaming Infrastructure
- **Icecast Server** (Optional): Professional broadcasting server for radio station deployments
  - Requires: host, port, password, mount point configuration
  - Provides: Standard Icecast2 streaming with metadata support

### System Dependencies
- **FFmpeg**: Required for all audio processing, transcoding, and streaming operations
- **Python 3.8+**: Core runtime environment
- **Docker** (Optional): Containerized deployment support

### Python Libraries
- **FastAPI**: Web framework for REST API
- **python-socketio**: WebSocket server for real-time updates
- **yt-dlp**: YouTube video/audio extraction
- **spotipy**: Spotify API client
- **aiohttp**: Async HTTP client for API calls
- **fuzzywuzzy**: Fuzzy string matching for song similarity
- **uvicorn**: ASGI server

### Key Integrations Flow
1. User requests song → Spotify API enriches metadata → Primary platform (YouTube/JioSaavn/SoundCloud) provides stream URL
2. FFmpeg downloads and transcodes → Cache manager stores file → Streaming engine broadcasts to clients
3. Socket.IO notifies all connected clients of metadata changes in real-time