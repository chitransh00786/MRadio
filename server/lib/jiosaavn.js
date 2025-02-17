import axios from "axios";
import { JIO_SAAVN_SONG_SEARCH, JIO_SAAVN_TOP50 } from "../utils/constant.js";
import { createDownloadLinks } from "../utils/crypto.js";
import { checkSimilarity, getRandomNumber } from "../utils/utils.js";
import logger from "../utils/logger.js";
import MyDownloader from "./download.js";

class JioSaavn {
    async getRandomFromTop50(retryCount = 1) {
        try {
            const response = await axios.get(JIO_SAAVN_TOP50);
            const { list_count, list } = response.data;
            const songData = list[getRandomNumber(0, list_count - 1)];

            if (!songData) throw new Error("No Song Data Found");

            const { title, more_info } = songData;
            const { encrypted_media_url, duration } = more_info;
            const songLink = createDownloadLinks(encrypted_media_url);
            const download = new MyDownloader()
            const downloadedSong = await download.downloadFromUrl(songLink[3].url, title);
            return {
                title,
                url: downloadedSong.url,
                quality: songLink[3].quality,
                duration: duration,
                requestedBy: "auto"
            }
        } catch (error) {
            logger.error(error);
            logger.error("Error fetching data, retries left:", retryCount);
            if (retryCount > 0) {
                return getRandomFromTop50(retryCount - 1);
            }
            logger.error("Failed after retrying:", error);
            return null;
        }
    }
    async getSongBySongName(songName, retryCount = 1) {
        try {
            const response = await axios.get(JIO_SAAVN_SONG_SEARCH(songName));
            const results = response.data.results.find(track => checkSimilarity(songName, track.title) > 60);
            if (!results) return;
            const moreInfo = results.more_info;

            if(moreInfo.duration > 600){
                throw new Error("Song Duration is more than 10 minutes.")
            }
            const songLink = createDownloadLinks(moreInfo.encrypted_media_url);
            return {
                title: results.title,
                url: songLink[3].url,
                quality: songLink[3].quality,
                duration: moreInfo.duration
            }
        } catch (error) {
            logger.error(error);
            logger.error("Failed after retrying:", { error });
            return;
        }
    }
}

export default JioSaavn;
