import ytdl from 'youtube-dl-exec';
import yts from 'yt-search'
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import ffmpeg from 'fluent-ffmpeg';
import { getFfmpegPath } from '../utils/utils.js';
import axios from 'axios';

ffmpeg.setFfmpegPath(getFfmpegPath());
class YouTubeDownloader {

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
            console.error('Video validation error:', error);
            return { status: false, message: "Video validation error: " }
        }
    }

    async downloadVideo(url, title, outputPath = 'tracks') {
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        const outputFilePath = path.join(outputPath, `${title}.mp3`);
        try {
            const options = {
                output: outputFilePath,
                extractAudio: true,
                audioFormat: 'mp3',
                audioQuality: 6,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
                preferFreeFormats: true,
                ffmpegLocation: getFfmpegPath()
            };

            await ytdl(url, options);
            return { url: outputFilePath }

        } catch (error) {
            console.error('Download error:', error);
            throw error;
        }
    }


    async downloadFromUrl(url, title, outputPath = 'tracks') {
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        const outputFilePath = path.join(outputPath, `${title}.mp3`);
        const tempFile = path.join(outputPath, `temp_${title}.mp3`);

        try {
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(tempFile);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            await new Promise((resolve, reject) => {
                ffmpeg(tempFile)
                    .toFormat('mp3')
                    .audioQuality(6)
                    .on('end', () => {
                        fs.unlink(tempFile, (err) => {
                            if (err) logger.error('Error deleting temp file:', err);
                        });
                        resolve();
                    })
                    .on('error', (err) => {
                        fs.unlink(tempFile, () => {
                            reject(err);
                        });
                    })
                    .save(outputFilePath);
            });

            return { url: outputFilePath };
        } catch (error) {
            logger.error('Download error:', error);
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            throw error;
        }
    }
}

export default YouTubeDownloader;
