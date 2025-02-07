import logger from "../logger.js";
import { getBlockListJson, saveBlockListJson, checkSimilarity } from "../utils.js";

class BlockListManager {
    constructor() {
        this.blockList = this.#readBlockList() || [];
    }

    #readBlockList() {
        return getBlockListJson();
    }

    #saveBlockList() {
        saveBlockListJson(this.blockList);
    }

    #isSimilarSong(songName1, songName2) {
        const similarity = checkSimilarity(songName1, songName2, "blockList");
        return similarity >= 75;
    }

    async blockCurrentSong(songName, requestedBy) {
        try {
            if (!songName) {
                throw new Error("Song name is required");
            }

            const blockItem = {
                songName,
                requestedBy,
                blockedAt: new Date().toISOString()
            };

            if (this.blockList.some(item => this.#isSimilarSong(item.songName, songName))) {
                logger.warn(`Song already blocked: ${songName}`);
                return "Song is already in block list.";
            }

            this.blockList.push(blockItem);
            this.#saveBlockList();
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

            const index = this.blockList.findIndex(item => this.#isSimilarSong(item.songName, songName));
            if (index === -1) {
                logger.warn(`Song not found in block list: ${songName}`);
                throw new Error("Song not found in block list");
            }

            this.blockList.splice(index, 1);
            this.#saveBlockList();
            logger.info(`Unblocked song: ${songName}`);
            return "Unblock Successful";
        } catch (error) {
            logger.error("Error unblocking song by name:", { error });
            throw error;
        }
    }

    async unblockSongByIndex(index) {
        try {
            // Convert to 0-based index
            const actualIndex = index - 1;

            if (actualIndex < 0 || actualIndex >= this.blockList.length) {
                throw new Error("Invalid index");
            }

            const removedSong = this.blockList.splice(actualIndex, 1)[0];
            this.#saveBlockList();
            logger.info(`Unblocked song at index ${index}: ${removedSong.songName}`);
            return "Unblock Successful.";
        } catch (error) {
            logger.error("Error unblocking song by index:", {error});
            throw error;
        }
    }

    async clearBlockList() {
        try {
            this.blockList = [];
            this.#saveBlockList();
            logger.info("Cleared block list");
            return "Cleared the block list.";
        } catch (error) {
            logger.error("Error clearing block list:", {error});
            throw error;
        }
    }

    async getAllBlockList() {
        try {
            return this.blockList;
        } catch (error) {
            logger.error("Error getting block list:", {error});
            throw error;
        }
    }

    isSongBlocked(songName) {
        return this.blockList.some(item => this.#isSimilarSong(item.songName, songName));
    }
}

export default BlockListManager;
