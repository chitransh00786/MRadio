import queue from "../lib/queue.js";
import { generate256BitToken } from "../utils/crypto.js";
import SongQueueManager from "../utils/queue/songQueueManager.js";
import TokenManager from "../utils/queue/tokenManager.js";
import { generateSongMetadata } from "./metadataFetcherService.js";
import { durationFormatter } from "../utils/utils.js";
import logger from "../utils/logger.js";

class Service {

    async getCurrentSong() {
        const { title, duration, requestedBy } = queue.tracks[queue.index];
        const formattedDuration = duration ? durationFormatter(duration) : "00:00";
        logger.info('Current song duration:', {
            title,
            originalDuration: duration,
            formattedDuration
        });
        return { title, duration: formattedDuration, requestedBy }
    }

    async getQueueList() {
        const songQueue = new SongQueueManager();
        const trackList = queue.tracks;
        const queueSongList = songQueue.printQueue();
        
        // Format durations for both current tracks and queued songs
        const response = [...trackList, ...queueSongList].map((item, index) => {
            const formattedDuration = item.duration ? durationFormatter(item.duration) : "00:00";
            logger.info('Queue list item duration:', {
                title: item.title,
                originalDuration: item.duration,
                formattedDuration
            });
            return {
                id: index + 1,
                title: item.title,
                duration: formattedDuration,
                requestedBy: item.requestedBy
            };
        });
        return response;
    }

    async getUpcomingSong() {
        const { title, duration, requestedBy } = queue.tracks[(queue.index + 1) % queue.tracks.length];
        const formattedDuration = duration ? durationFormatter(duration) : "00:00";
        logger.info('Upcoming song duration:', {
            title,
            originalDuration: duration,
            formattedDuration
        });
        return { title, duration: formattedDuration, requestedBy }
    }

    async skip() {
        await queue.skip();
        return true;
    }

    async previous() {
        await queue.previous();
        return true;
    }

    async addSongToQueue({ songName, requestedBy = "anonymous" }) {
        const metadata = await generateSongMetadata(songName, requestedBy);
        const songQueue = new SongQueueManager();
        songQueue.addToQueue(metadata);
        return { title: metadata.title, duration: metadata.duration, requestedBy };
    }

    async addSongToTop({ songName, requestedBy = "anonymous" }) {
        const metadata = await generateSongMetadata(songName, requestedBy);
        const songQueue = new SongQueueManager();
        songQueue.addToFront(metadata);
        return { title: metadata.title, duration: metadata.duration, requestedBy };
    }

    async generateToken(username) {
        const token = generate256BitToken();
        const tokenManager = new TokenManager();
        tokenManager.addToken({ token, username });
        return { token, username };
    }
}

export default Service;
