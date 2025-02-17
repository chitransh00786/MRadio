import { getBlockListJson, saveBlockListJson, checkSimilarity } from "../utils.js";
import BaseQueueManager from "./baseQueueManager.js";
import logger from "../logger.js";

class BlockListManager extends BaseQueueManager {
    constructor() {
        super({
            readFunction: getBlockListJson,
            saveFunction: saveBlockListJson,
            validateFunction: (item) => {
                return typeof item === "object" && item.songName;
            },
            formatFunction: (item) => ({
                ...item,
                blockedAt: item.blockedAt || new Date().toISOString()
            })
        });
    }

    #isSimilarSong(songName1, songName2) {
        const similarity = checkSimilarity(songName1, songName2);
        return similarity >= 85;
    }

    async blockCurrentSong(songName, requestedBy) {
        try {
            if (!songName) {
                throw new Error("Song name is required");
            }

            if (this.isSongBlocked(songName)) {
                logger.warn(`Song already blocked: ${songName}`);
                return "Song is already in block list.";
            }

            const blockItem = {
                songName,
                requestedBy,
                blockedAt: new Date().toISOString()
            };

            this.add(blockItem);
            logger.info(`Blocked song: ${songName}`);
            return "Blocked the current song.";
        } catch (error) {
            logger.error("Error blocking current song:", {error});
            throw error;
        }
    }

    async blockSongBySongName(songName, requestedBy) {
        try {
            if (!songName) {
                throw new Error("Song name is required");
            }

            return await this.blockCurrentSong(songName, requestedBy);
        } catch (error) {
            logger.error("Error blocking song by name:", {error});
            throw error;
        }
    }

    async unblockSongBySongName(songName) {
        try {
            if (!songName) {
                throw new Error("Song name is required");
            }

            const index = this.items.findIndex(item => this.#isSimilarSong(item.songName, songName));
            if (index === -1) {
                logger.warn(`Song not found in block list: ${songName}`);
                throw new Error("Song not found in block list");
            }

            this.removeAtIndex(index + 1); // +1 because removeAtIndex expects 1-based index
            logger.info(`Unblocked song: ${songName}`);
            return "Unblock Successful";
        } catch (error) {
            logger.error("Error unblocking song by name:", { error });
            throw error;
        }
    }

    async unblockSongByIndex(index) {
        try {
            const result = this.removeAtIndex(index);
            if (result) {
                logger.info(`Unblocked song at index ${index}: ${result.songName}`);
                return "Unblock Successful.";
            }
            throw new Error("Invalid index");
        } catch (error) {
            logger.error("Error unblocking song by index:", {error});
            throw error;
        }
    }

    async clearBlockList() {
        try {
            this.clear();
            logger.info("Cleared block list");
            return "Cleared the block list.";
        } catch (error) {
            logger.error("Error clearing block list:", {error});
            throw error;
        }
    }

    async getAllBlockList() {
        try {
            return this.getAll();
        } catch (error) {
            logger.error("Error getting block list:", {error});
            throw error;
        }
    }

    isSongBlocked(songName) {
        return this.items.some(item => this.#isSimilarSong(item.songName, songName));
    }
}

export default BlockListManager;
