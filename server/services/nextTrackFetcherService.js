import MyDownloader from "../lib/download.js";
import SongQueueManager from "../utils/queue/songQueueManager.js";
import cacheManager from "../lib/cacheManager.js";
import logger from "../utils/logger.js";
import DefaultPlaylistManager from "../utils/queue/defaultPlaylistManager.js";
import DefaultPlaylistMetadataManager from "../utils/queue/defaultPlaylistMetadataManager.js";
import { getRandomNumber } from "../utils/utils.js";


/**
 * @description Fetch the song when song queue is empty.
 * @returns 
 */
const emptySongQueueHandler = async () => {
    const defaultPlaylistMetadata = new DefaultPlaylistMetadataManager();
    const defaultPlaylistArr = defaultPlaylistMetadata.getAll();
    if (!defaultPlaylistArr.length) {
        throw new Error('No songs available in default playlist');
    }
    
    // Get a random song from default playlist
    return defaultPlaylistArr[getRandomNumber(0, defaultPlaylistArr.length - 1)];
}

const createTrackResponse = (song, cachedPath = null) => {
    return {
        url: cachedPath || song.url,
        title: song.title,
        duration: song.duration,
        requestedBy: song.requestedBy
    };
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
    const { url } = await yt.downloadJioSaavn(songData.url, songData.title);
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
    const songQueue = new SongQueueManager();
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const tryFetchTrack = async () => {
        try {
            const currentTrack = songQueue.getFirstFromQueue();
            let songResult;

            const trackToProcess = currentTrack ?? await emptySongQueueHandler();
            
            const cachedPath = cacheManager.getFromCache(trackToProcess.title);
            if (cachedPath) {
                logger.info(`Using cached version of: ${trackToProcess.title}`);
                if (currentTrack) songQueue.removeFromFront();
                return createTrackResponse(trackToProcess, cachedPath);
            }
            
            songResult = await fetchByUrlType(trackToProcess);
            if (currentTrack) songQueue.removeFromFront();
            return createTrackResponse({
                ...songResult,
                requestedBy: trackToProcess.requestedBy,
                duration: trackToProcess.duration
            });

        } catch (error) {
            const errorInfo = {
                message: error.message,
                code: error.code,
                retry: retryCount + 1
            };
            logger.error('Error fetching track:', errorInfo);
            
            songQueue.removeFromFront();
            retryCount++;
            
            if (retryCount >= MAX_RETRIES) {
                throw new Error(`Failed to fetch track after ${MAX_RETRIES} attempts`);
            }
            
            return tryFetchTrack();
        }
    };

    return tryFetchTrack();
}
