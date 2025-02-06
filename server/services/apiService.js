import queue from "../lib/queue.js";
import { generate256BitToken } from "../utils/crypto.js";
import SongQueueManager from "../utils/queue/songQueueManager.js";
import TokenManager from "../utils/queue/tokenManager.js";
import { generateSongMetadata } from "./metadataFetcherService.js";

class Service {

    async getCurrentSong() {
        const { title, duration, requestedBy } = queue.tracks[queue.index];
        return { title, duration, requestedBy }
    }

    async getQueueList() {
        const songQueue = new SongQueueManager();
        const trackList = queue.tracks;
        const queueSongList = songQueue.printQueue();
        const response = [...trackList, ...queueSongList].map((item, index) => ({
            id: index + 1,
            title: item.title,
            duration: item.duration,
            requestedBy: item.requestedBy
        }));
        return response;
    }

    async getUpcomingSong() {
        const { title, duration, requestedBy } = queue.tracks[(queue.index + 1) % queue.tracks.length];
        return { title, duration, requestedBy }
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