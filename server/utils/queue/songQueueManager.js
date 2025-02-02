import logger from "../logger.js";
import { getQueueListJson, saveQueueListJson } from "../utils.js";

class SongQueueManager {
    constructor() {
        this.queue = this.readSongQueue() || [];
    }

    readSongQueue() {
        return getQueueListJson();
    }

    saveSongQueue() {
        saveQueueListJson(this.queue);
    }

    isDuplicate(url) {
        return this.queue.some(item => item.url === url);
    }

    addToQueue(item) {
        if (typeof item === "object" && item.title && item.url) {
            if (this.isDuplicate(item.url)) {
                console.warn(`Duplicate item not added: ${item.url}`);
            } else {
                this.queue.push(item);
                this.saveSongQueue();
            }
        } else {
            console.error("Invalid input. Item must be an object with 'title' and 'url'.");
        }
    }


    getFirstFromQueue() {
        if (this.queue.length > 0) {
            return this.queue[0];
        } else {
            logger.debug("Queue is empty!")
        }

    }

    getLastFromQueue() {
        if (this.queue.length > 0) {
            return this.queue[this.queue.length - 1];
        } else {
            logger.debug("Queue is empty!")
        }
    }

    addToFront(item) {
        if (typeof item === "object" && item.title && item.url) {
            if (this.isDuplicate(item.url)) {
                console.warn(`Duplicate item not added: ${item.url}`);
            } else {
                this.queue.unshift(item);
                this.saveSongQueue();
            }
        } else {
            console.error("Invalid input. Item must be an object with 'title' and 'url'.");
        }
    }

    removeFromFront() {
        if (this.queue.length > 0) {
            const removedItem = this.queue.shift();
            this.saveSongQueue(); // Save updated queue
            return removedItem;
        } else {
            console.error("Queue is empty.");
        }
    }

    removeFromBack() {
        if (this.queue.length > 0) {
            const removedItem = this.queue.pop();
            this.saveSongQueue();
            return removedItem;
        } else {
            console.error("Queue is empty.");
        }
    }

    removeAtIndex(index) {
        index = index - 1;
        if (index >= 0 && index < this.queue.length) {
            const removedItem = this.queue.splice(index, 1)[0];
            this.saveSongQueue();
            return removedItem;
        } else {
            console.error("Invalid index or queue is empty.");
            return null;
        }
    }

    printQueue() {
        return this.queue;
    }
}

export default SongQueueManager;