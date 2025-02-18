import { getCommonConfigJson, saveCommonConfigJson } from "../utils/utils.js";
import { COMMON_CONFIG_KEYS } from "../utils/constant.js";
import logger from "../utils/logger.js";

class CommonConfigService {
    constructor() {
        this.config = getCommonConfigJson();
        this.allowedKeys = Object.values(COMMON_CONFIG_KEYS);
    }

    /**
     * Validate if a key is allowed
     * @param {string} key - The key to validate
     * @returns {boolean} True if key is allowed, false otherwise
     */
    isValidKey(key) {
        return this.allowedKeys.includes(key);
    }

    /**
     * Throw error if key is invalid
     * @param {string} key - The key to validate
     * @throws {Error} If key is not allowed
     */
    validateKey(key) {
        if (!this.isValidKey(key)) {
            throw new Error(`Invalid config key: ${key}. Allowed keys are: ${this.allowedKeys.join(', ')}`);
        }
    }

    /**
     * Get all config data
     * @returns {Object} The entire config object
     */
    getAll() {
        return this.config;
    }

    /**
     * Get config value by key
     * @param {string} key - The key to retrieve
     * @returns {any} The value associated with the key, or undefined if not found
     */
    get(key) {
        this.validateKey(key);
        if (!(key in this.config)) {
            this.config[key] = null;
            saveCommonConfigJson(this.config);
        }
        return this.config[key];
    }

    /**
     * Update config value by key
     * @param {string} key - The key to update
     * @param {any} value - The new value
     * @param {boolean} [partial=false] - If true and both old and new values are objects, performs a partial update
     * @returns {boolean} True if update was successful, false otherwise
     */
    update(key, value, partial = false) {
        this.validateKey(key);
        try {
            if (partial && typeof this.config[key] === 'object' && typeof value === 'object') {
                this.config[key] = {
                    ...this.config[key],
                    ...value
                };
            } else {
                this.config[key] = value;
            }

            saveCommonConfigJson(this.config);
            return true;
        } catch (error) {
            logger.error('Error updating config:', error);
            return false;
        }
    }

    /**
     * Update multiple config values at once
     * @param {Object} updates - Object containing key-value pairs to update
     * @param {boolean} [partial=false] - If true, performs partial updates for object values
     * @returns {boolean} True if all updates were successful, false otherwise
     */
    updateMultiple(updates, partial = false) {
        try {
            Object.entries(updates).forEach(([key, value]) => {
                this.validateKey(key);
                if (partial && typeof this.config[key] === 'object' && typeof value === 'object') {
                    this.config[key] = {
                        ...this.config[key],
                        ...value
                    };
                } else {
                    this.config[key] = value;
                }
            });

            saveCommonConfigJson(this.config);
            return true;
        } catch (error) {
            logger.error('Error updating multiple configs:', error);
            return false;
        }
    }

    /**
     * Delete a config key
     * @param {string} key - The key to delete
     * @returns {boolean} True if deletion was successful, false otherwise
     */
    delete(key) {
        try {
            this.validateKey(key);
            delete this.config[key];
            saveCommonConfigJson(this.config);
            return true;
        } catch (error) {
            logger.error('Error deleting config:', error);
            return false;
        }
    }
}

export default new CommonConfigService();
