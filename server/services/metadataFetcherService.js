import YouTubeDownloader from "../lib/download.js";
import JioSavan from "../lib/jiosavan.js";
import SpotifyAPI from "../lib/spotify.js";
import Yts from "../lib/yts.js";
import { addYoutubeVideoId, checkSimilarity, durationFormatter } from "../utils/utils.js";

/**
 * @description Search song on spotify
 * @param {*} songName 
 * @returns 
 */
const searchSpotifySong = async (songName) => {
    try {
        const spotify = new SpotifyAPI();
        const songDetail = await spotify.searchTrack(songName);
        const { name, id } = songDetail;

        if (!name) {
            throw new Error("Invalid song name");
        }

        checkSimilarity(songName, name);
        return { name, id };
    } catch (error) {
        console.error("Spotify search error:", error.message);
        return null;
    }
};

/**
 * @description Search song on JioSavan
 * @param {*} spotifyName 
 * @returns 
 */
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

/**
 * @description Search Song on Youtube
 */
export const searchYouTubeSong = async (spotifyName) => {
    try {
        const yt = new YouTubeDownloader();
        const { url, title, duration } = await yt.getVideoDetail(spotifyName);
        const { status, message } = await yt.validateVideo(url);

        if (!status) {
            throw new Error(message);
        }

        return { url, title, duration };
    } catch (error) {
        console.error("YouTube search error:", error.message);
        return null;
    }
};

// Create metadata object
/**
 * @description Create Initial metadata object.
 * @param {*} originalName 
 * @param {*} spotifyName 
 * @param {*} requestedBy 
 * @returns 
 */
const createMetadata = (originalName, spotifyName, requestedBy) => ({
    title: '',
    url: '',
    urlType: '',
    duration: '',
    originalName,
    spotifyName,
    requestedBy
});

/**
 * @description Update the metadata object.
 * @param {*} metadata 
 * @param {*} type 
 * @param {*} title 
 * @param {*} url 
 * @param {*} duration 
 * @returns 
 */
const updateMetadata = (metadata, type, title, url, duration) => {
    checkSimilarity(metadata.originalName, title);
    return {
        ...metadata,
        title,
        url,
        urlType: type,
        duration: durationFormatter(duration)
    };
};

/**
 * @description Main function to generate single song metadata
 * @param {*} songName 
 * @param {*} requestedBy 
 * @returns 
 */
export const generateSongMetadata = async (songName, requestedBy) => {
    try {
        const spotifyResult = await searchSpotifySong(songName);
        if (!spotifyResult) {
            throw new Error("Could not find song on Spotify");
        }
        const metadata = createMetadata(songName, spotifyResult.name, requestedBy);

        const jioSaavnResult = await searchJioSaavnSong(spotifyResult.name);
        if (jioSaavnResult) {
            return updateMetadata(metadata, "jiosavan", jioSaavnResult.title, jioSaavnResult.url, jioSaavnResult.duration);
        }

        const youtubeResult = await searchYouTubeSong(spotifyResult.name);
        if (youtubeResult) {
            return updateMetadata(metadata, "youtube", youtubeResult.title, youtubeResult.url, youtubeResult.duration);
        }
        throw new Error("Song not found on any platform");
    } catch (error) {
        console.error("Error generating metadata:", error.message);
        return null;
    }
};


export const searchYoutubePlaylist = async (playlistId, requestedBy) => {
    const yts = new Yts();
    const playlistArray = await yts.getPlaylistDetail(playlistId);
    const playListMetadata = playlistArray
        .filter((video) => video.duration.seconds <= 900)
        .map((video) => ({
            title: video.title,
            duration: durationFormatter(video.duration.timestamp),
            requestedBy: requestedBy,
            url: addYoutubeVideoId(video.videoId),
            urlType: "youtube"
        }));
    return playListMetadata;
}

/**
 * @description Main function to generate playlist metadata
 * @param {*} playlistId 
 * @param {*} sourceName 
 * @returns 
 */
export const generatePlaylistMetadata = async (playlistId, sourceName, requestedBy) => {
    if (!sourceName || !playlistId) {
        throw new Error("Invalid playlist parameters");
    }
    if (sourceName === "youtube") {
        return await searchYoutubePlaylist(playlistId, requestedBy);
    }
    throw new Error("Unsupported playlist source");
}