import MyDownloader from "../lib/download.js";
import JioSavan from "../lib/jiosavan.js";
import SoundCloud from "../lib/soundcloud.js";
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
        if(!songDetail){
            throw new Error("No Song found By this Name");
        } 
        const { name, id, artists } = songDetail;
        let artistName = '';
        if (artists.length > 0) {
            artistName = artists[0].name;
        }
        if (!name) {
            throw new Error("Invalid song name");
        }
        return { name: `${name} ${artistName}`, id };
    } catch (error) {
        console.error("Spotify search error:", error.message);
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
 * @description Search song on JioSavan
 * @param {*} spotifyName 
 * @returns 
 */
const searchSoundCloudSong = async (spotifyName) => {
    try {
        const soundCloud = new SoundCloud();
        const song = await soundCloud.getSongBySongName(spotifyName);
        return song;
    } catch (error) {
        console.error("SoundCloud search error:", error.message);
        return null;
    }
};

/**
 * @description Search Song on Youtube
 */
export const searchYouTubeSong = async (spotifyName) => {
    try {
        const yt = new Yts();
        const { url, title, timestamp } = await yt.getVideoDetail(spotifyName);
        const { status, message } = await yt.validateVideo(url);

        if (!status) {
            throw new Error(message);
        }

        return { url, title, duration: timestamp };
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
export const generateSongMetadata = async (songName, requestedBy, force = false, preference = null) => {
    try {
        let searchName = songName;
        
        // If not forced, verify with Spotify first
        if (!force) {
            const spotifyResult = await searchSpotifySong(songName);
            if (!spotifyResult) {
                throw new Error("Could not find song on Spotify");
            }
            searchName = spotifyResult.name;
        }

        const metadata = createMetadata(songName, searchName, requestedBy);

        // If force is true and preference is provided, search only on preferred platform
        if (force && preference) {
            switch (preference.toLowerCase()) {
                case 'soundcloud': {
                    const soundCloudResult = await searchSoundCloudSong(searchName);
                    if (!soundCloudResult) throw new Error("Song not found on SoundCloud");
                    return updateMetadata(metadata, "soundcloud", soundCloudResult.title, soundCloudResult.url, soundCloudResult.duration);
                }
                
                case 'jiosaavn': {
                    const jioSaavnResult = await searchJioSaavnSong(searchName);
                    if (!jioSaavnResult) throw new Error("Song not found on JioSaavn");
                    return updateMetadata(metadata, "jiosaavn", jioSaavnResult.title, jioSaavnResult.url, jioSaavnResult.duration);
                }
                
                case 'youtube': {
                    const youtubeResult = await searchYouTubeSong(searchName);
                    if (!youtubeResult) throw new Error("Song not found on YouTube");
                    return updateMetadata(metadata, "youtube", youtubeResult.title, youtubeResult.url, youtubeResult.duration);
                }
                
                default:
                    throw new Error("Invalid platform preference");
            }
        }

        // If no preference or force without preference, try all platforms
        const soundCloudResult = await searchSoundCloudSong(searchName);
        if (soundCloudResult) {
            return updateMetadata(metadata, "soundcloud", soundCloudResult.title, soundCloudResult.url, soundCloudResult.duration);
        }

        const jioSaavnResult = await searchJioSaavnSong(searchName);
        if (jioSaavnResult) {
            return updateMetadata(metadata, "jiosaavn", jioSaavnResult.title, jioSaavnResult.url, jioSaavnResult.duration);
        }

        const youtubeResult = await searchYouTubeSong(searchName);
        if (youtubeResult) {
            return updateMetadata(metadata, "youtube", youtubeResult.title, youtubeResult.url, youtubeResult.duration);
        }

        throw new Error("Song not found on any platform");
    } catch (error) {
        console.error("Error generating metadata:", error.message);
        throw error;
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