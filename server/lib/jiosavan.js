import axios from "axios";
import { JIO_SAVAN_SONG_SEARCH, JIO_SAVAN_TOP50 } from "../utils/constant.js";
import { createDownloadLinks } from "../utils/crypto.js";
import { getRandomNumber } from "../utils/utils.js";

class JioSavan {
    async getRandomFromTop50(retryCount = 1) {
        try {
            const response = await axios.get(JIO_SAVAN_TOP50);
            const { list_count, list } = response.data;
            const songData = list[getRandomNumber(0, list_count - 1)];

            if (!songData) throw new Error("No Song Data Found");

            const { title, more_info } = songData;
            const { encrypted_media_url } = more_info;
            const songLink = createDownloadLinks(encrypted_media_url);
            return {
                title,
                url: songLink[3].url,
                quality: songLink[3].quality
            }
        } catch (error) {
            console.log(error);
            console.log("Error fetching data, retries left:", retryCount);
            if (retryCount > 0) {
                return getRandomFromTop50(retryCount - 1);
            }
            console.error("Failed after retrying:", error);
            return null;
        }
    }
    async getSongBySongName(songName, retryCount = 1) {
        try {
            const response = await axios.get(JIO_SAVAN_SONG_SEARCH(songName));
            const { title, more_info } = response.data.results[0];

            if (!title) throw new Error("No Song Data Found");
            const { encrypted_media_url } = more_info;
            const songLink = createDownloadLinks(encrypted_media_url);
            return {
                title,
                url: songLink[3].url,
                quality: songLink[3].quality
            }
        } catch (error) {
            console.log(error);
            console.log("Error fetching data, retries left:", retryCount);
            if (retryCount > 0) {
                return getSongBySongName(songName, retryCount - 1);
            }
            console.error("Failed after retrying:", error);
            return null;
        }
    }
}

export default JioSavan;