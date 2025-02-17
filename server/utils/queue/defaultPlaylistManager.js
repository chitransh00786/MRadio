import { getDefaulPlaylistJson, saveDefaultPlayistJson } from "../utils.js";
import BaseQueueManager from "./baseQueueManager.js";

class DefaultPlaylistManager extends BaseQueueManager {
    constructor() {
        super({
            readFunction: getDefaulPlaylistJson,
            saveFunction: saveDefaultPlayistJson,
            validateFunction: (item) => {
                return typeof item === "object" && item.title && item.playlistId && item.source;
            },
            formatFunction: (item) => ({
                ...item,
                metadataUpdatedAt: item.metadataUpdatedAt || new Date().toISOString()
            }),
            duplicateCheckKey: "playlistId"
        });
    }
    addToQueue(item) {
        return this.addToQueue(item);
    }
}

export default DefaultPlaylistManager;