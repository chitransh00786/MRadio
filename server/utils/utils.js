import fsHelper from "./helper/fs-helper.js";
import { token_set_ratio } from 'fuzzball';
import { SONG_QUEUE_LOCATION, SPOTIFY_TOKEN } from "./constant.js";
import logger from "./logger.js";

/**
 * ====================
 * Common Utils
 * ====================
 */
export const getQueueListJson = () => {
    return fsHelper.readFromJson(SONG_QUEUE_LOCATION, []);
}

function calculateSimilarity(str1, str2) {
    const similarity = token_set_ratio(str1, str2);
    return similarity;
}

export const saveQueueListJson = (data) => {
    return fsHelper.writeToJson(SONG_QUEUE_LOCATION, data);
}

export const getSpotifyConfigJson = () => {
    return fsHelper.readFromJson(SPOTIFY_TOKEN, {});
}

export const getRandomNumber = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
export const durationFormatter = (duration) => {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

const SIMILARITY_THRESHOLD = 60;

export const checkSimilarity = (original, found, source) => {
    const similarity = calculateSimilarity(original, found);
    if (similarity < SIMILARITY_THRESHOLD) {
        logger.info(`similarity less than ${SIMILARITY_THRESHOLD}: \n original: ${original} \n ${source}: found`);
    }
    return similarity;
};
