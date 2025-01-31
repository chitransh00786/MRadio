import queue from "../lib/queue.js";
import SongQueueManager from "../utils/songQueueManager.js";
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

    async addSongToQueue({ songName, requestedBy = "anonymous" }) {
        const metadata = await generateSongMetadata(songName, requestedBy);
        const songQueue = new SongQueueManager();
        songQueue.addToQueue(metadata);
        return { title: metadata.title, duration: metadata.duration, requestedBy };
    }
}

export default Service;