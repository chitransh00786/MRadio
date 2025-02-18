import { DEFAULT_PLAYLIST_SEED_DATA } from "../utils/constant.js";
import DefaultPlaylistManager from "../utils/queue/defaultPlaylistManager.js";
import Service from "./apiService.js"

class Initializer {
    static async init() {
        await this.defaultPlaylistInitializer();
    }

    static async defaultPlaylistInitializer() {
        const defaultPlaylist = new DefaultPlaylistManager();
        if (defaultPlaylist.getLength() !== 0) {
            return;
        }
        const apiService = new Service();
        for (const playlist of DEFAULT_PLAYLIST_SEED_DATA()) {
            await apiService.addDefaultPlaylist(playlist);
        }
    }
}

export default Initializer;