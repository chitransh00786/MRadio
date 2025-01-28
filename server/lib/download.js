import ytdl from 'youtube-dl-exec';
import yts from 'yt-search'
import fs from 'fs';
import path from 'path';
class YouTubeDownloader {

    async getVideoDetail(name, artistName) {
        try {
            const r = await yts({ query: `${name} - ${artistName} audio`, category: 'music' })
            if (r.videos?.length === 0) {
                throw new Error('No video found for the given name and artist');
            }
            return r.videos[0];
        } catch (error) {
            console.log("Error getting details: " + error.message);
        }
    }
    async validateVideo(url) {
        try {
            // Use youtube-dl to extract video info
            const info = await ytdl(url, {
                dumpSingleJson: true,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true
            });

            // Parse video duration (in seconds)
            const duration = parseInt(info.duration);

            // Validate duration (less than 10 minutes = 600 seconds)
            if (duration > 600) {
                throw new Error('Video duration exceeds 10 minutes');
            }

            // Check video category
            const categories = info.categories || [];
            const tags = info.tags || [];
            const isMusicCategory =
                categories.some(cat => cat.toLowerCase().includes('music')) ||
                tags.some(tag => tag.toLowerCase().includes('music'));

            if (!isMusicCategory) {
                throw new Error('Video is not in the Music category');
            }

            return info;
        } catch (error) {
            console.error('Video validation error:', error);
            throw error;
        }
    }

    async downloadVideo(songName, outputPath = 'tracks') {
        const { url, title } = await this.getVideoDetail(songName);
        console.log(url);

        // Validate video first
        await this.validateVideo(url);

        // Ensure output directory exists
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }
        const outputFilePath = path.join(outputPath, `${title}.mp3`);
        try {
            const options = {
                output: outputFilePath,
                extractAudio: true,
                audioFormat: 'mp3',
                audioQuality: 0,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
                preferFreeFormats: true
            };

            await ytdl(url, options);
            return { filepath: outputFilePath }

        } catch (error) {
            console.error('Download error:', error);
            throw error;
        }
    }
}

export default YouTubeDownloader;