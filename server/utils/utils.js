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

// TODO:
export const fetchNextTrack = async () => {
    // Fetch queue list from json.
    const songQueue = new SongQueueManager();
    // const getFirst = songQueue.
    const jio = new JioSavan();
    const song = await jio.getRandomFromTop50();
    return song;
}