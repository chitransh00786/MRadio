import { durationFormatter, getDefaultPlaylistMetadataJson, saveDefaultPlaylistMetadataJson } from "../utils.js";
import BaseQueueManager from "./baseQueueManager.js";

class DefaultPlaylistMetadataManager extends BaseQueueManager {
    constructor() {
        super({
            readFunction: () => {
                const queue = getDefaultPlaylistMetadataJson();
                return queue.map(item => ({
                    ...item,
                    duration: item.duration ? durationFormatter(item.duration) : "00:00"
                }));
            },
            saveFunction: (items) => saveDefaultPlaylistMetadataJson(items),
            validateFunction: (item) => {
                return typeof item === "object" && item.title && item.url;
            },
            formatFunction: (item) => ({
                ...item,
                duration: item.duration ? durationFormatter(item.duration) : "00:00"
            }),
            duplicateCheckKey: "url"
        });
    }

    // Alias methods to match existing API
    addToQueue(item) {
        return this.add(item);
    }

    getFirstFromQueue() {
        return this.getFirst();
    }

    getLastFromQueue() {
        return this.getLast();
    }

    printQueue() {
        return this.getAll();
    }

    addManyToQueue(items) {
        return this.addMany(items, false);
    }

    addManyToTop(items) {
        return this.addMany(items, true);
    }
}

export default DefaultPlaylistMetadataManager;