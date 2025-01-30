import fsHelper from "../helper/fs-helper.js";
import YouTubeDownloader from "../lib/download.js";
import JioSavan from "../lib/jiosavan.js";
import SpotifyAPI from "../lib/spotify.js";

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

const downloadFromYoutube = async (songData) => {
    const yt = new YouTubeDownloader();
    const { filepath } = await yt.downloadVideo(songData.url, songData.title);
    return { filepath: filepath, title: songData.title };
}

const downloadFromJioSavan = async (songData) => {
    return { filepath: songData.url, title: songData.title }
}

const fetchByUrlType = async (songData) => {
    switch (songData.urlType) {
        case 'youtube':
            return await downloadFromYoutube(songData);
        case 'jiosavan':
            return await downloadFromJioSavan(songData);
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
    songResult = await fetchByUrlType(getFirst);

    return songResult;
}



// generate metadata for song to add on the song queue.
export const generateSongMetadata = async (songName) => {
    try {
        const spotify = new SpotifyAPI();
        const songDetail = await spotify.searchTrack(songName);
        const { name, id } = songDetail;
        if (!name) {
            // TODO: return the user song name is incorrect.
        }
        const jio = new JioSavan();
        const song = await jio.getSongBySongName(name);
        const songMetadata = { title: '', url: '', urlType: '', originalName: songName, spotifyName: name };
        if (song) {
            songMetadata.title = song.title;
            songMetadata.url = song.url;
            songMetadata.urlType = "jiosavan";
        } else {
            const yt = new YouTubeDownloader();
            const { url } = yt.getVideoDetail(name);
            const { status, message, data } = await this.validateVideo(url);
            if (status) {
                songMetadata.title = data.name;
                songMetadata.url = data.url;
                songMetadata.urlType = "youtube";
            }
        }
        return songMetadata;
    } catch (error) {
        console.error("Error generating metadata:", error.message);
    }
}


// (async () => {
//     const meta = await generateSongMetadata("aaj ki raat")
//     console.log(meta);
// })();