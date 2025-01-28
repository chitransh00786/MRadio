import fsHelper from "../helper/fs-helper.js";
import pathHelper from "../helper/path-helper.js";

import { SONG_QUEUE_LOCATION, SPOTIFY_TOKEN } from "./constant.js";

export const getQueueListJson = () => {
    return fsHelper.readFromJson(SONG_QUEUE_LOCATION, []);
}

export const saveQueueListJson = (data) => {
    return fsHelper.writeToJson(SONG_QUEUE_LOCATION, data);
}

export const getSpotifyConfigJson = () => {
    return fsHelper.readFromJson(SPOTIFY_TOKEN, {});
}

export const popFrontFromSongQueue = () => {

}