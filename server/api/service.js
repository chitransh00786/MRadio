import queue from "../lib/queue.js";
import SongQueueManager from "../utils/songQueueManager.js";
import { generateSongMetadata } from "../utils/utils.js";

class Service {

    async getCurrentSong() {
        const { title } = queue.tracks[queue.index];
        return { title, duration: "" }
    }

    async getQueueList() {
        const songQueue = new SongQueueManager();
        const trackList = queue.tracks;
        const queueSongList = songQueue.printQueue();
        const response = [...trackList, ...queueSongList].map((item, index) => ({
            id: index + 1,
            title: item.title,
            duration: ""
        }));
        return response;
    }

    async getUpcomingSong() {
        const { title } = queue.tracks[(queue.index + 1) % queue.tracks.length];
        return { title }
    }

    async skip() {
        await queue.skip();
        return true;
    }

    async addSongToQueue({ songName, requestedBy = "anonymous" }) {
        const metadata = await generateSongMetadata(songName, requestedBy);
        const songQueue = new SongQueueManager();
        songQueue.addToQueue(metadata);
        return { title: metadata.title, duration: "" }
    }

    async addSongToTop() {
        // TODO: Implement adding song to queue.
    }
}

export default Service;