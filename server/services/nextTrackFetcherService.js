import MyDownloader from "../lib/download.js";
import SongQueueManager from "../utils/queue/songQueueManager.js";
import cacheManager from "../lib/cacheManager.js";
import logger from "../utils/logger.js";
import DefaultPlaylistManager from "../utils/queue/defaultPlaylistManager.js";
import DefaultPlaylistMetadataManager from "../utils/queue/defaultPlaylistMetadataManager.js";
import { getRandomNumber } from "../utils/utils.js";
import { extname, join } from "path";
import { DEFAULT_FALLBACK_LOCATION } from "../utils/constant.js";
import fsHelper from "../utils/helper/fs-helper.js";


/**
 * @description Fetch the song when song queue is empty.
 * @returns 
 */
const getFallbackTrack = async (dir = DEFAULT_FALLBACK_LOCATION) => {
    try {
        // This will create directory if it doesn't exist
        const files = fsHelper.listFiles(dir);
        const musicFiles = files.filter(file => extname(file) === '.mp3');
        
        if (musicFiles.length === 0) {
            throw new Error(`No fallback tracks available in directory: ${dir}`);
        }
        
        const randomTrack = musicFiles[getRandomNumber(0, musicFiles.length - 1)];
        
        return {
            title: randomTrack.replace('.mp3', ''),
            url: join(dir, randomTrack),
            urlType: 'fallback',
            duration: 0,
            requestedBy: 'fallback'
        };
    } catch (error) {
        logger.error('Fallback mechanism failed:', error);
        throw error;
    }
}

const emptySongQueueHandler = async () => {
    try {
        const defaultPlaylistMetadata = new DefaultPlaylistMetadataManager();
        const defaultPlaylistArr = defaultPlaylistMetadata.getAll({ isActive: true });
        if (!defaultPlaylistArr.length) {
            return getFallbackTrack();
        }
        
        return defaultPlaylistArr[getRandomNumber(0, defaultPlaylistArr.length - 1)];
    } catch (error) {
        logger.error('Error in emptySongQueueHandler:', error);
        return getFallbackTrack();
    }
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
        case 'fallback':
            return { url: songData.url, title: songData.title };
        default:
            throw new Error(`Unsupported URL type: ${songData.urlType}`);
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
