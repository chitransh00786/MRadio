# Radio Broadcast 🎵

A powerful and flexible radio broadcasting system that supports multiple music streaming platforms and provides real-time queue management.

## Features 🚀

- Multi-platform music streaming support:
  - JioSaavn
  - YouTube
  - SoundCloud
- Real-time queue management
- Socket-based live updates
- Metadata fetching and caching
- Fallback track support
- Docker support for easy deployment
- Token-based authentication
- Block list management

## Prerequisites 📋

- Node.js (v14 or higher)
- Docker (optional, for containerized deployment)
- API keys for supported music platforms:
  - Spotify API credentials
  - SoundCloud API key

## Installation 🛠️

1. Clone the repository:
```bash
git https://github.com/GauravGhost/MRadio
cd MRadio
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create a `.env` file in the root directory with the following variables:
```env
# Server Configuration
PORT=9126
NODE_ENV=development
FFMPEG_ENV: production

# API Keys
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SOUNDCLOUD_API_KEY=your_soundcloud_api_key
```
4. Optional Configuration in constant.js file
```
CACHE_SIZE=1022 * 1024 * 1024
MAX_QUEUE_SIZE=2
more...
```

## Usage 🎮

### Running Locally

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

All endpoints require user authentication. Use the token provided by the admin in the request headers.

### Queue Management

```http
# Current Song
GET /songs/current
Description: Get the currently playing song

# Queue Operations
GET /songs/queue
Description: Get the list of songs in the queue

GET /songs/upcoming
Description: Get information about the upcoming song

POST /songs/add
Description: Add a song to the queue

POST /songs/add/youtube
Description: Add a YouTube song to the queue

POST /songs/add/top
Description: Add a song to the top of the queue

DELETE /songs/remove/:index
Description: Remove a song from the queue at specified index

DELETE /songs/requests/last/:requestedBy
Description: Remove the last song requested by a specific user

# Playback Control
GET /songs/skip
Description: Skip the current song

GET /songs/previous
Description: Play the previous song
```

### Playlist Management

```http
POST /playlist/add
Description: Add an entire playlist to the queue

POST /playlist/add/top
Description: Add an entire playlist to the top of the queue
```

### Block List Management

```http
POST /songs/block/current
Description: Block the currently playing song

POST /songs/block
Description: Block a song by its name

DELETE /songs/block/:songName
Description: Unblock a song by its name

DELETE /songs/block/:index
Description: Unblock a song by its index in the block list

DELETE /songs/block/all
Description: Clear the entire block list

GET /songs/block/list
Description: Get all blocked songs

GET /songs/block/check
Description: Check if a song is blocked
```

### Admin Operations

```http
POST /admin/token
Description: Generate a new user token (requires admin authentication)
```

## Architecture 🏗️

The project follows a modular architecture:

- `/server`: Core server implementation
  - `/api`: REST API endpoints and middleware
  - `/lib`: Platform-specific implementations
  - `/services`: Business logic services
  - `/utils`: Utility functions and helpers

- `/config`: Configuration files
- `/data`: Runtime data storage
- `/tracks`: Temporary track storage
- `/fallback`: Fallback audio files

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License 📝

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments 🙏

- Thanks to all the streaming platforms for providing their APIs
- The open-source community for various dependencies used in this project

## Support 💪

If you find this project useful, please consider giving it a ⭐️ on GitHub!

For issues, questions, or contributions, please refer to the [GitHub Issues](https://github.com/GauravGhost/MRadio/issues) page.
