import queue from "../lib/queue.js";
import { generate256BitToken } from "../utils/crypto.js";
import SongQueueManager from "../utils/queue/songQueueManager.js";
import TokenManager from "../utils/queue/tokenManager.js";
import BlockListManager from "../utils/queue/blockListManager.js";
import { generateSongMetadata } from "./metadataFetcherService.js";
import { durationFormatter } from "../utils/utils.js";
import logger from "../utils/logger.js";

class Service {
    constructor() {
        this.blockListManager = new BlockListManager();
    }

    /**
    * ==========================================
    * Songs Related Services
    * ==========================================
    */

    async getCurrentSong() {
        const { title, duration, requestedBy } = queue.tracks[queue.index];
        const formattedDuration = durationFormatter(duration);
        return { title, duration: formattedDuration, requestedBy }
    }

    async getQueueList() {
        const songQueue = new SongQueueManager();
        const trackList = queue.tracks;
        const queueSongList = songQueue.printQueue();

        // Format durations for both current tracks and queued songs
        const response = [...trackList, ...queueSongList].map((item, index) => {
            const formattedDuration = durationFormatter(item?.duration);
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
        const formattedDuration = durationFormatter(duration);
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

    /**
     * ==========================================
     * Administrated Related Services
     * ==========================================
     */
    async generateToken(username) {
        const token = generate256BitToken();
        const tokenManager = new TokenManager();
        tokenManager.addToken({ token, username });
        return { token, username };
    }

    /**
     * ==========================================
     * Block List of songs Related Services
     * ==========================================
     */
    async blockCurrentSong(requestedBy = "anonymous") {
        try {
            const songDetail = await this.getCurrentSong();
            return await this.blockListManager.blockCurrentSong(songDetail.title, requestedBy);
        } catch (error) {
            logger.error("Error in blockCurrentSong service:", {error});
            throw error;
        }
    }

    async blockSongBySongName(songName, requestedBy) {
        try {
            return await this.blockListManager.blockSongBySongName(songName, requestedBy);
        } catch (error) {
            logger.error("Error in blockSongBySongName service:", {error});
            throw error;
        }
    }

    async unblockSongBySongName(songName) {
        try {
            return await this.blockListManager.unblockSongBySongName(songName);
        } catch (error) {
            logger.error("Error in unblockSongBySongName service:", {error});
            throw error;
        }
    }

    async unblockSongByIndex(index) {
        try {
            return await this.blockListManager.unblockSongByIndex(index);
        } catch (error) {
            logger.error("Error in unblockSongByIndex service:", {error});
            throw error;
        }
    }

    async clearBlockList() {
        try {
            return await this.blockListManager.clearBlockList();
        } catch (error) {
            logger.error("Error in clearBlockList service:", {error});
            throw error;
        }
    }

    async getAllBlockList() {
        try {
            return await this.blockListManager.getAllBlockList();
        } catch (error) {
            logger.error("Error in getAllBlockList service:", {error});
            return [];
        }
    }

    async isSongBlocked(songName) {
        try {
            return await this.blockListManager.isSongBlocked(songName);
        } catch (error) {
            logger.error("Error in isSongBlocked service:", {error});
            return false;
        }
    }
}

export default Service;
