import queue from "../lib/queue.js";
import { generate256BitToken } from "../utils/crypto.js";
import SongQueueManager from "../utils/queue/songQueueManager.js";
import TokenManager from "../utils/queue/tokenManager.js";
import BlockListManager from "../utils/queue/blockListManager.js";
import { generatePlaylistMetadata, generateSongMetadata } from "./metadataFetcherService.js";
import { durationFormatter } from "../utils/utils.js";
import logger from "../utils/logger.js";
import { DEFAULT_QUEUE_SIZE } from "../utils/constant.js";
import Yts from "../lib/yts.js";
import DefaultPlaylistMetadataManager from "../utils/queue/defaultPlaylistMetadataManager.js";
import DefaultPlaylistManager from "../utils/queue/defaultPlaylistManager.js";

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

    async addSongToQueue({ songName, requestedBy = "anonymous", force, preference }) {
        const metadata = await generateSongMetadata(songName, requestedBy, force, preference);
        const isBlocked = await this.isSongBlocked(metadata.title);
        if (isBlocked) {
            throw new Error("Song is blocked! You cannot play this song.");
        }
        const songQueue = new SongQueueManager();
        songQueue.addToQueue(metadata);
        return { title: metadata.title, duration: metadata.duration, requestedBy };
    }

    async addPlaylistToQueue({ source = "youtube", type = "playlist", playlistId, requestedBy = "anonymous" }) {
        const metadata = await generatePlaylistMetadata(playlistId, source, requestedBy)
        if (metadata.length <= 0) {
            throw new Error("No songs found in the playlist.");
        }
        const songQueue = new SongQueueManager();
        songQueue.addManyToQueue(metadata);
        return { added: true, total: metadata.length }
    }

    async addPlaylistToTop({ source = "youtube", type = "playlist", playlistId, requestedBy = "anonymous" }) {
        const metadata = await generatePlaylistMetadata(playlistId, source, requestedBy)
        if (metadata.length <= 0) {
            throw new Error("No songs found in the playlist.");
        }
        const songQueue = new SongQueueManager();
        songQueue.addManyToTop(metadata);
        return { added: true, total: metadata.length }
    }

    async addSongToTop({ songName, requestedBy = "anonymous" }) {
        const metadata = await generateSongMetadata(songName, requestedBy);
        const isBlocked = await this.isSongBlocked(metadata.title);
        if (isBlocked) {
            throw new Error("Song is blocked! You cannot play this song.");
        }
        const songQueue = new SongQueueManager();
        songQueue.addToFront(metadata);
        return { title: metadata.title, duration: metadata.duration, requestedBy };
    }

    async removeFromQueue({ index }) {
        if (index <= DEFAULT_QUEUE_SIZE) {
            throw new Error(`Cannot remove songs from positions 1 to ${DEFAULT_QUEUE_SIZE}`);
        }
        const songQueue = new SongQueueManager();
        const removedItem = songQueue.removeAtIndex(index - DEFAULT_QUEUE_SIZE);
        if (!removedItem) {
            throw new Error("Invalid index or queue is empty.");
        }
        return { title: removedItem.title, duration: removedItem.duration, requestedBy: removedItem.requestedBy };
    }

    async removeLastSongRequestedByUser({ requestedBy }) {
        if (!requestedBy) {
            throw new Error("Username is required");
        }
        const songQueue = new SongQueueManager();
        for (let i = songQueue.queue.length - 1; i >= 0; i--) {
            if (songQueue.queue[i].requestedBy === requestedBy) {
                const removedItem = songQueue.queue.splice(i, 1)[0];
                songQueue.saveSongQueue();
                return { title: removedItem.title, duration: removedItem.duration, requestedBy: removedItem.requestedBy };
            }
        }

        throw new Error(`No songs found in queue for User: @${requestedBy}`);
    }

    async addSongToQueueFromSource({ url, videoId, requestedBy = "anonymous", source = "youtube" }) {
        const yts = new Yts();
        const { status, message } = await yts.validateVideo(url);

        if (!status) {
            throw new Error(message);
        }
        const songDetail = await yts.getVideoDetailByUrl(videoId);
        const metadata = {
            requestedBy: requestedBy,
            title: songDetail?.title,
            duration: songDetail?.duration.timestamp,
            url: songDetail?.url,
            urlType: "youtube"
        };
        const songQueue = new SongQueueManager();
        songQueue.addToQueue(metadata);
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
            logger.error("Error in blockCurrentSong service:", { error });
            throw error;
        }
    }

    async blockSongBySongName(songName, requestedBy) {
        try {
            return await this.blockListManager.blockSongBySongName(songName, requestedBy);
        } catch (error) {
            logger.error("Error in blockSongBySongName service:", { error });
            throw error;
        }
    }

    async unblockSongBySongName(songName) {
        try {
            return await this.blockListManager.unblockSongBySongName(songName);
        } catch (error) {
            logger.error("Error in unblockSongBySongName service:", { error });
            throw error;
        }
    }

    async unblockSongByIndex(index) {
        try {
            return await this.blockListManager.unblockSongByIndex(index);
        } catch (error) {
            logger.error("Error in unblockSongByIndex service:", { error });
            throw error;
        }
    }

    async clearBlockList() {
        try {
            return await this.blockListManager.clearBlockList();
        } catch (error) {
            logger.error("Error in clearBlockList service:", { error });
            throw error;
        }
    }

    async getAllBlockList() {
        try {
            return await this.blockListManager.getAllBlockList();
        } catch (error) {
            logger.error("Error in getAllBlockList service:", { error });
            return [];
        }
    }

    async isSongBlocked(songName) {
        try {
            return this.blockListManager.isSongBlocked(songName);
        } catch (error) {
            logger.error("Error in isSongBlocked service:", { error });
            return false;
        }
    }

    /**
    * ==========================================
    * Default Playlist Manager Service
    * ==========================================
    */
    async addDefaultPlaylist({ playlistId, title, source, requestedBy = "auto", isActive = true, genre = "mix" }) {
        try {
            const metadata = await generatePlaylistMetadata(playlistId, source, requestedBy)
            if (metadata.length <= 0) {
                throw new Error("No songs found in the playlist.");
            }
            const defaultPlaylistStore = new DefaultPlaylistManager();
            defaultPlaylistStore.add({
                playlistId,
                title,
                source,
                metadataUpdatedAt: new Date(),
                isActive: isActive,
                genre: genre
            })
            const metadataStore = new DefaultPlaylistMetadataManager();
            const updatedMetadata = metadata.map(data => ({ ...data, playlistId: playlistId }));
            metadataStore.addMany(updatedMetadata);
            return { added: true, total: metadata.length }
        } catch (error) {
            logger.error("Error in addDefaultPlaylist service:", { error });
            throw error;
        }
    };

    async removeDefaultPlaylist({ index }) {
        const defaultPlaylistStore = new DefaultPlaylistManager();
        const defaultPlaylistMetadataStore = new DefaultPlaylistMetadataManager();
        
        const len = defaultPlaylistStore.getLength();
        if (len <= 1) {
            throw new Error("Cannot remove default playlist. There should be at least one playlist.");
        }
        
        const removedPlaylist = defaultPlaylistStore.removeAtIndex(index);
        if (!removedPlaylist) {
            throw new Error("Failed to remove playlist");
        }

        const allMetadataEntries = defaultPlaylistMetadataStore.getAll();
        
        const indexesToRemove = allMetadataEntries
            .map((entry, idx) => entry.playlistId === removedPlaylist.playlistId ? idx + 1 : null)
            .filter(idx => idx !== null)
            .sort((a, b) => b - a);
        
        for (const idx of indexesToRemove) {
            defaultPlaylistMetadataStore.removeAtIndex(idx);
        }

        return removedPlaylist;
    };

    async getDefaultPlaylist() {
        const defaultPlaylistStore = new DefaultPlaylistManager();
        return defaultPlaylistStore.getAll();
    };
}

export default Service;
