import logger from "../logger.js";
import { getTokenListJson, saveTokenListJson } from "../utils.js";

class TokenManager {
    constructor() {
        this.queue = this.#readTokenQueue() || [];
    }

    #readTokenQueue() {
        return getTokenListJson();
    }

    #saveTokenQueue() {
        saveTokenListJson(this.queue);
    }
    isTokenExist(token){
        return this.queue.some(item => item.token === token);
    }

    isDuplicate(token, username) {
        return this.queue.some(item => item.token === token || item.username === username);
    }

    addToken(item) {
        if (typeof item === "object" && item.token && item.username) {
            if (this.isDuplicate(item.token, item.username)) {
                logger.warn(`Duplicate item not added: ${item.token}`);
                throw new Error(`Duplicate username not allowed!`)
            } else {
                this.queue.push(item);
                this.#saveTokenQueue();
            }
        } else {
            console.error("Invalid input. Item must be an object with 'token' and 'username'.");
        }
    }

    removeTokenByIndex(index) {
        index = index - 1;
        if (index >= 0 && index < this.queue.length) {
            const removedItem = this.queue.splice(index, 1)[0];
            this.#saveTokenQueue();
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

export default TokenManager;