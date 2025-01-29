import fsHelper from "../helper/fs-helper.js";
import pathHelper from "../helper/path-helper.js";
import JioSavan from "../lib/jiosavan.js";

import { SONG_QUEUE_LOCATION, SPOTIFY_TOKEN } from "./constant.js";
import SongQueueManager from "./songQueueManager.js";

export const getQueueListJson = () => {
    return fsHelper.readFromJson(SONG_QUEUE_LOCATION, []);
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

// Utils Related to fetching songs.
const emptySongQueueHandler = async () => {
    const jio = new JioSavan();
    const song = await jio.getRandomFromTop50();
    return song;
}

const fetchFromYoutube = async () => {

}

const fetchFromJioSavan = async () => {

}

const fetchByUrlType = async (urlType) => {
    switch (urlType) {
        case 'youtube':
            return await fetchFromYoutube();
        case 'jiosavan':
            return await fetchFromJioSavan();
    }
}

export const fetchNextTrack = async () => {
    // Fetch queue list from json.
    let songResult;
    const songQueue = new SongQueueManager();
    const getFirst = songQueue.getFirstFromQueue();

    // If Queue is empty, fetch next track randomly from hit songs.
    if (!getFirst) {
        songResult = await emptySongQueueHandler();
        return songResult;
    }

    // Fetch next track from given URL type.
    songResult = await fetchByUrlType(getFirst.urlType);

    return songResult;
}