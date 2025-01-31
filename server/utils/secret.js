import dotenv from 'dotenv';

export default {
    NODE_ENV: process.env.NODE_ENV ?? "development",
    FFMPEG_ENV: process.env.FFMPEG_ENV ?? "development",
    SPOTIFY_CLIEND_ID: process.env.SPOTIFY_CLIEND_ID,
    SPOTIFY_CLIEND_SECRET_ID: process.env.SPOTIFY_CLIEND_SECRET_ID
}