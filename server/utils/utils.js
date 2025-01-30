import fsHelper from "../helper/fs-helper.js";
import YouTubeDownloader from "../lib/download.js";
import JioSavan from "../lib/jiosavan.js";
import SpotifyAPI from "../lib/spotify.js";
import { token_set_ratio } from 'fuzzball';

import { SONG_QUEUE_LOCATION, SPOTIFY_TOKEN } from "./constant.js";
import SongQueueManager from "./songQueueManager.js";

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



const SIMILARITY_THRESHOLD = 60;

const checkAndLogSimilarity = (original, found, source) => {
    const similarity = calculateSimilarity(original, found);
    if (similarity < SIMILARITY_THRESHOLD) {
        console.log(`similarity less than ${SIMILARITY_THRESHOLD}: \n original: ${original} \n ${source}: found`);
    }
    return similarity;
};

// Search song on Spotify
const searchSpotifySong = async (songName) => {
    try {
        const spotify = new SpotifyAPI();
        const songDetail = await spotify.searchTrack(songName);
        const { name, id } = songDetail;
        
        if (!name) {
            throw new Error("Invalid song name");
        }

        checkAndLogSimilarity(songName, name, "spotify");
        return { name, id };
    } catch (error) {
        console.error("Spotify search error:", error.message);
        return null;
    }
};

// Search song on JioSaavn
const searchJioSaavnSong = async (spotifyName) => {
    try {
        const jio = new JioSavan();
        const song = await jio.getSongBySongName(spotifyName);
        return song;
    } catch (error) {
        console.error("JioSaavn search error:", error.message);
        return null;
    }
};

// Search song on YouTube
const searchYouTubeSong = async (spotifyName) => {
    try {
        const yt = new YouTubeDownloader();
        const { url, title } = await yt.getVideoDetail(spotifyName);
        const { status, message } = await yt.validateVideo(url);
        
        if (!status) {
            throw new Error(message);
        }
        
        return {url, title};
    } catch (error) {
        console.error("YouTube search error:", error.message);
        return null;
    }
};

// Create metadata object
const createMetadata = (originalName, spotifyName) => ({
    title: '',
    url: '',
    urlType: '',
    originalName,
    spotifyName
});

// Update metadata with source info
const updateMetadata = (metadata, source, title, url, type) => {
    checkAndLogSimilarity(metadata.originalName, title, type);
    return {
        ...metadata,
        title,
        url,
        urlType: type
    };
};

// Main function to generate metadata
export const generateSongMetadata = async (songName) => {
    try {
        const spotifyResult = await searchSpotifySong(songName);
        if (!spotifyResult) {
            throw new Error("Could not find song on Spotify");
        }

        const metadata = createMetadata(songName, spotifyResult.name);

        // const jioSaavnResult = await searchJioSaavnSong(spotifyResult.name);
        // if (jioSaavnResult) {
        //     return updateMetadata(
        //         metadata,
        //         "jiosavan",
        //         jioSaavnResult.title,
        //         jioSaavnResult.url,
        //         "jiosavan"
        //     );
        // }

        const youtubeResult = await searchYouTubeSong(spotifyResult.name);
        if (youtubeResult) {
            return updateMetadata(
                metadata,
                "youtube",
                youtubeResult.title,
                youtubeResult.url,
                "youtube"
            );
        }

        throw new Error("Song not found on any platform");
    } catch (error) {
        console.error("Error generating metadata:", error.message);
        return null;
    }
};


(async () => {
    const meta = await generateSongMetadata("tum mile dil kile")
    console.log(meta);
})();
