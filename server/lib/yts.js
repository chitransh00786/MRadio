import ytdl from 'youtube-dl-exec';
import yts from 'yt-search'
import logger from '../utils/logger.js';
import { checkSimilarity, getCookiesPath } from '../utils/utils.js';

class Yts {
    async getVideoDetail(name, artistName) {
        try {
            const r = await yts({ query: `${name} - ${artistName} official audio song music`, category: 'music' });
            if (r.videos?.length === 0) {
                return;
            }

            const result = r.videos.find(track => checkSimilarity(name, track.title) > 60);
            return result;
        } catch (error) {
            logger.error("Error getting details: " + error.message);
            return;
        }
    }

    async getVideoDetailByUrl(videoId) {
        try {
            const r = await yts({ videoId: videoId });
            if (r.videos?.length === 0) {
                return;
            }
            return r;
        } catch (error) {
            logger.error("Error getting details: " + error.message);
            throw error;
        }
    }

    async validateVideo(url) {
        try {
            // Check cookie expiration
            const fs = (await import('fs')).default;
            const cookiesPath = getCookiesPath();
            
            if (!fs.existsSync(cookiesPath)) {
                throw new Error('cookies.txt file not found. Please create it in the config directory.');
            }

            const cookiesContent = fs.readFileSync(cookiesPath, 'utf8');
            const cookieLines = cookiesContent.split('\n').filter(line => 
                line.trim() && !line.startsWith('#') && line.includes('.youtube.com')
            );

            if (cookieLines.length === 0) {
                throw new Error('No valid YouTube cookies found in cookies.txt');
            }

            const info = await ytdl(url, {
                dumpSingleJson: true,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
                cookies: cookiesPath
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
            return { 
                status: false, 
                message: `Video validation error: ${error.message}. Please ensure the cookies.txt file is properly configured in the config directory.`
            }
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
