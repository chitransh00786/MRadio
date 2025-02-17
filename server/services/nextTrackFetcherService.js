import MyDownloader from "../lib/download.js";
import JioSaavn from "../lib/jiosaavn.js";
import SongQueueManager from "../utils/queue/songQueueManager.js";
import cacheManager from "../lib/cacheManager.js";
import logger from "../utils/logger.js";


/**
 * @description Fetch the song when song queue is empty.
 * @returns 
 */
const emptySongQueueHandler = async () => {
    const jio = new JioSaavn();
    const song = await jio.getRandomFromTop50();
    return song;
}

/**
 * @description Download song from youtube
 * @param {*} songData 
 * @returns 
 */
const downloadFromYoutube = async (songData) => {
    const yt = new MyDownloader();
    const { url } = await yt.downloadVideo(songData.url, songData.title);
    return { url: url, title: songData.title };
}

/**
 * @description Download song from jiosaavn, just return the url.
 * @param {*} songData 
 * @returns 
 */
const downloadFromJioSaavn = async (songData) => {
    const yt = new MyDownloader();
    const { url } = await yt.downloadFromUrl(songData.url, songData.title);
    return { url: url, title: songData.title };
}

/**
 * @description Download song from jiosaavn, just return the url.
 * @param {*} songData 
 * @returns 
 */
const downloadFromSoundCloud = async (songData) => {
    const yt = new MyDownloader();
    const { url } = await yt.downloadSoundCloud(songData.url, songData.title);
    return { url: url, title: songData.title };
}

/**
 * @description Fetching song file by the source type.
 * @param {*} songData 
 * @returns 
 */
const fetchByUrlType = async (songData) => {
    switch (songData.urlType) {
        case 'youtube':
            return await downloadFromYoutube(songData);
        case 'jiosaavn':
            return await downloadFromJioSaavn(songData);
        case 'soundcloud':
            return await downloadFromSoundCloud(songData);
    }
}

/**
 * @description Next song Fetch Logic
 * @returns 
 */
export const fetchNextTrack = async () => {
    // Fetch queue list from json.
    const songQueue = new SongQueueManager();
    try {
        let songResult;
        const getFirst = songQueue.getFirstFromQueue();

        if (!getFirst) {
            songResult = await emptySongQueueHandler();
            const cachedPath = cacheManager.getFromCache(songResult.title);
            if (cachedPath) {
                logger.info(`Using cached version of: ${songResult.title}`);
                return {
                    url: cachedPath,
                    title: songResult.title,
                    duration: songResult.duration,
                    requestedBy: songResult.requestedBy
                };
            }
            return songResult;
        }

        // Check if song exists in cache first
        const cachedPath = cacheManager.getFromCache(getFirst.title);
        if (cachedPath) {
            logger.info(`Using cached version of: ${getFirst.title}`);
            songQueue.removeFromFront();
            return {
                url: cachedPath,
                title: getFirst.title,
                duration: getFirst.duration,
                requestedBy: getFirst.requestedBy
            };
        }

        // If not in cache, fetch next track from given URL type
        songResult = await fetchByUrlType(getFirst);
        songQueue.removeFromFront();
        return { ...songResult, requestedBy: getFirst.requestedBy, duration: getFirst.duration };
    } catch (error) {
        const errorInfo = {
            message: error.message,
            code: error.code
        };
        logger.error('Error fetching next track:', errorInfo);
        
        // Remove the problematic track from queue
        logger.error("Deleting the error song and fetching again next track");
        songQueue.removeFromFront();
        return fetchNextTrack();
    }
}
