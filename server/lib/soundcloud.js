import SoundCloudScraper from "soundcloud-scraper";
import logger from "../utils/logger.js";
import secret from "../utils/secret.js";

const GENRES = ['pop', 'rock', 'hip-hop', 'electronic', 'classical', 'jazz'];

class SoundCloud {
    constructor() {
        this.client = new SoundCloudScraper.Client(secret.SOUNDCLOUD_API_KEY);
    }

    async getSongBySongName(songName, retryCount = 1) {
        try {
            // Search for the song
            const songs = await this.client.search(songName, 'track');
            if (!songs || songs.length === 0) {
                throw new Error("No Song Data Found");
            }

            const songData = songs[0];
            const song = await this.client.getSongInfo(songData.url);
            if (!song) throw new Error("No Song Data Found");

            // Check duration (convert ms to seconds)
            const duration = Math.floor(song.duration / 1000);
            if (duration > 600) {
                throw new Error("Song Duration is more than 10 minutes.");
            }
            
            return {
                title: song.title,
                url: song.trackURL ?? song.streams.progressive,
                duration: duration,
            };
        } catch (error) {
            logger.error(error);
            logger.error("Failed after retrying:", { error });
            throw error;
        }
    }

    async fetchStreamUrl(url){
        try {
            const stream = await this.client.fetchStreamURL(url);
            return stream;
        } catch (error) {
            logger.error(error);
            throw error;
        }
    }
}

export default SoundCloud;
