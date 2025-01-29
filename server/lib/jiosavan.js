import axios from "axios";
import { JIO_SAVAN_TOP50 } from "../utils/constant.js";
import { createDownloadLinks } from "../utils/crypto.js";
import { getRandomNumber } from "../utils/utils.js";

class JioSavan {
    async getRandomFromTop50(){
        try {
            const response = await axios.get(JIO_SAVAN_TOP50);
            const {list_count, list} = response.data;
            const songData = list[getRandomNumber(0, list_count)];
            const {title, more_info} = songData;
            const {encrypted_media_url} = more_info;
            const songLink = createDownloadLinks(encrypted_media_url);
            return {
                title,
                url: songLink[3].url,
                quality: songLink[3].quality
            }
        } catch (error) {
            console.log(error);
        }
    }
}

export default JioSavan;