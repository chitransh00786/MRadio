import fsHelper from "./helper/fs-helper.js";
import { token_set_ratio } from 'fuzzball';
import { AUTH_TOKEN_LOCATION, SONG_QUEUE_LOCATION } from "./constant.js";
import logger from "./logger.js";
import secret from "./secret.js";
import ffmpegStatic from 'ffmpeg-static';
import queue from "../lib/queue.js";
/**
 * ====================
 * Common Utils
 * ====================
 */

export const getFfmpegPath = () => {
    const env = secret.FFMPEG_ENV;
    if (env === 'production') {
        return '/usr/bin/ffmpeg';
    } else if (env === 'development') {
        return ffmpegStatic;
    } else {
        throw new Error("Unknown environment");
    }
}

function calculateSimilarity(str1, str2) {
    const similarity = token_set_ratio(str1, str2);
    return similarity;
}


export const getQueueListJson = () => {
    return fsHelper.readFromJson(SONG_QUEUE_LOCATION, []);
}
export const saveQueueListJson = (data) => {
    return fsHelper.writeToJson(SONG_QUEUE_LOCATION, data);
}

export const getTokenListJson = () => {
    return fsHelper.readFromJson(AUTH_TOKEN_LOCATION, []);
}

export const saveTokenListJson = (data) => {
    return fsHelper.writeToJson(AUTH_TOKEN_LOCATION, data);
}

export const getSpotifyConfigJson = () => {
    return fsHelper.readFromJson(SPOTIFY_TOKEN_LOCATION, {});
}

export const getRandomNumber = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
export const durationFormatter = (duration) => {
    logger.info('Duration formatter input:', { 
        value: duration, 
        type: typeof duration 
    });

    // If already in MM:SS format, return as is
    if (typeof duration === "string" && duration.includes(":")) {
        logger.info('Duration already formatted:', duration);
        return duration;
    }

    // Convert to number (handles both string "284" and number 284)
    const numDuration = Number(duration);

    if (isNaN(numDuration)) {
        logger.info('Invalid duration, returning 00:00');
        return "00:00";
    }

    const minutes = Math.floor(numDuration / 60);
    const seconds = Math.floor(numDuration % 60);
    const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return formatted;
};

const SIMILARITY_THRESHOLD = 60;

export const checkSimilarity = (original, found, source) => {
    const similarity = calculateSimilarity(original, found);
    if (similarity < SIMILARITY_THRESHOLD) {
        logger.info(`similarity less than ${SIMILARITY_THRESHOLD}: \n original: ${original} \n ${source}: found`);
    }
    return similarity;
};

export const checkStreamMethod = (urlType) => {
    const streamMethod = {
        youtube: 'download',
        jiosavan: 'online'
    };
    return streamMethod[urlType] || 'download';
}

export const shouldDeleteSong = (urlType) => {
    return checkStreamMethod(urlType) === 'download';
}
export const handleDeleteSong = async (urlType, filePath) => {
    try {
        if (!shouldDeleteSong(urlType)) {
            logger.info(`Skipping deletion for online stream: ${filePath}`);
            return;
        }

        if (fsHelper.exists(filePath)) {
            fsHelper.delete(filePath);
            logger.info(`Deleted song file: ${filePath}`);
        }

        const files = fsHelper.listFiles('tracks');
        const tracksInQueue = queue.tracks.map(track => track.url);

        for (const file of files) {
            const trackPath = `tracks/${file}`;

            if (!tracksInQueue.includes(trackPath)) {
                try {
                    fsHelper.delete(trackPath);
                    logger.info(`Deleted unexpected file: ${trackPath}`);
                } catch (error) {
                    logger.error(`Error deleting file ${trackPath}:`, { error });
                }
            }
        }
    } catch (error) {
        logger.error('Error in handleDeleteSong:', { error });
    }
}
