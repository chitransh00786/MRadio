import ytdl from 'youtube-dl-exec';
import yts from 'yt-search'
import logger from '../utils/logger.js';

class Yts {
    async getVideoDetail(name, artistName) {
        try {
            const r = await yts({ query: `${name} - ${artistName} official audio song music`, category: 'music' });
            if (r.videos?.length === 0) {
                throw new Error('No video found for the given name and artist');
            }

            return r.videos[0];
        } catch (error) {
            logger.error("Error getting details: " + error.message);
            throw error;
        }
    }

    async getVideoDetailByUrl(videoId) {
        try {
            const r = await yts({ videoId: videoId });
            if (r.videos?.length === 0) {
                throw new Error('No video found for the given name and artist');
            }
            return r;
        } catch (error) {
            logger.error("Error getting details: " + error.message);
            throw error;
        }
    }

    async validateVideo(url) {
        try {
            const info = await ytdl(url, {
                dumpSingleJson: true,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true
            });

            const duration = parseInt(info.duration);

            if (duration > 600) {
                return { status: false, message: 'Video duration exceeds 10 minutes' };
            }

            const categories = info.categories || [];
            const tags = info.tags || [];
            const isMusicCategory =
                categories.some(cat => cat.toLowerCase().includes('music')) ||
                tags.some(tag => tag.toLowerCase().includes('music'));

            if (!isMusicCategory) {
                return { status: false, message: 'Video is not in the Music category' };
            }

            return { status: true, message: "Successfull" };
        } catch (error) {
            logger.error('Video validation error:', error);
            return { status: false, message: "Video validation error: " }
        }
    }
    async getPlaylistDetail(listId) {
        try {
            const r = await yts({ listId });
            if (r.videos?.length === 0) {
                throw new Error('No video found for the given name and artist');
            }

            return r.videos;
        } catch (error) {
            logger.error("Error getting details: " + error.message);
            throw error;
        }
    }
}

export default Yts;
