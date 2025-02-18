import { getCommonConfigJson, saveCommonConfigJson, getDefaultPlaylistJson } from "../utils/utils.js";
import { COMMON_CONFIG_KEYS } from "../utils/constant.js";
import logger from "../utils/logger.js";

class CommonConfigService {
    constructor() {
        this.config = getCommonConfigJson();
        this.allowedKeys = Object.values(COMMON_CONFIG_KEYS);
        this.validations = this.setupValidations();
    }

    setupValidations() {
        const validatePlaylistValue = (value) => value === "all";
        return {
            [COMMON_CONFIG_KEYS.defaultPlaylistGenre]: {
                validate: async (value) => {
                    if (validatePlaylistValue(value)) return true;
                    
                    const playlists = getDefaultPlaylistJson();
                    return new Set(playlists.map(p => p.genre)).has(value);
                },
                errorMessage: (value) => `Genre '${value}' does not exist in default playlists`
            },
        };
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
    async validateKeyAndValue(key, value) {
        if (!this.isValidKey(key)) {
            throw new Error(`Invalid config key: ${key}. Allowed keys are: ${this.allowedKeys.join(', ')}`);
        }

        // If there's a validation rule for this key, run it
        if (this.validations[key]) {
            const validation = this.validations[key];
            const isValid = await validation.validate(value);
            if (!isValid) {
                throw new Error(validation.errorMessage(value));
            }
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
    async get(key) {
        return this.config[key];
    }

    /**
     * Update config value by key
     * @param {string} key - The key to update
     * @param {any} value - The new value
     * @param {boolean} [partial=false] - If true and both old and new values are objects, performs a partial update
     * @returns {boolean} True if update was successful, false otherwise
     */
    async update(key, value, partial = false) {
        try {
            await this.validateKeyAndValue(key, value);
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
            throw error;
        }
    }

    /**
     * Update multiple config values at once
     * @param {Object} updates - Object containing key-value pairs to update
     * @param {boolean} [partial=false] - If true, performs partial updates for object values
     * @returns {boolean} True if all updates were successful, false otherwise
     */
    async updateMultiple(updates, partial = false) {
        try {
            // Validate all updates first
            await Promise.all(
                Object.entries(updates).map(([key, value]) =>
                    this.validateKeyAndValue(key, value)
                )
            );

            // If all validations pass, apply the updates
            Object.entries(updates).forEach(([key, value]) => {
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
    async delete(key) {
        try {
            if (!this.isValidKey(key)) {
                throw new Error(`Invalid config key: ${key}. Allowed keys are: ${this.allowedKeys.join(', ')}`);
            }
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
