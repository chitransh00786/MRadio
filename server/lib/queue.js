import { v4 as uuid } from "uuid";
import { PassThrough } from "stream";
import Throttle from "throttle";
import ffmpeg from "fluent-ffmpeg";
import { spawn } from "child_process";
import path from 'path';
import { fetchNextTrack } from "../services/nextTrackFetcherService.js";
import fsHelper from "../utils/helper/fs-helper.js";
import logger from "../utils/logger.js";
import { getFfmpegPath, durationFormatter } from "../utils/utils.js";
import cacheManager from "./cacheManager.js";
import { DEFAULT_QUEUE_SIZE, DEFAULT_TRACKS_LOCATION } from "../utils/constant.js";
import socketManager from "./socketManager.js";

ffmpeg.setFfmpegPath(getFfmpegPath());

class Queue {
    constructor() {
        this.tracks = [];
        this.index = 0;
        this.clients = new Map();
        this.currentTrack = null;
        this.playing = false;
        this.stream = null;
        this.throttle = null;
        this.ffmpegProcess = null;
        this.isDownloading = false;
        this.minQueueSize = DEFAULT_QUEUE_SIZE;
        this.previousTrack = null;
        this.startTime = null;
        this.progressInterval = null;
    }

    async previous() {
        if (!this.previousTrack || this.isTransitioning) {
            logger.info("No previous track available");
            return;
        }

        this.isTransitioning = true;

        try {
            this.playing = false;
            logger.info("Going to previous track:", this.previousTrack?.title || 'Unknown');

            await this.cleanupCurrentStream();

            // Check if the previous track is in cache
            if (this.previousTrack?.url) {
                if (this.previousTrack.url.startsWith(`${DEFAULT_TRACKS_LOCATION}/`)) {
                    const cachedPath = cacheManager.getFromCache(this.previousTrack?.title);
                    if (cachedPath) {
                        this.previousTrack.url = cachedPath;
                    } else {
                        logger.info(`Previous track ${this.previousTrack?.title || 'Unknown'} not found in cache`);
                        return;
                    }
                }
            } else {
                logger.info("Previous track URL is missing");
                return;
            }

            const temp = this.currentTrack;
            
            this.currentTrack = this.previousTrack;
            
            this.previousTrack = temp;

            this.playing = true;
            await this.play(false);

        } catch (error) {
            logger.error('Error during previous:', { error });
            this.playing = false;
        } finally {
            this.isTransitioning = false;
        }
    }

    async ensureQueueSize() {
        if (this.isDownloading) {
            return;
        }
        this.isDownloading = true;

        Promise.resolve().then(async () => {
            try {
                while (this.tracks.length < this.minQueueSize) {
                    const song = await fetchNextTrack();
                    if (this.tracks.length < this.minQueueSize) {
                        const songBitrate = await this.getTrackBitrate(song.url);
                        this.tracks.push({
                            url: song.url,
                            bitrate: songBitrate,
                            title: song.title,
                            duration: song?.duration ? durationFormatter(song.duration) : "00:00",
                            requestedBy: song?.requestedBy ?? "anonymous"
                        });
                        logger.info(`Added track: ${song.title}`);
                    }
                }
            } catch (error) {
                logger.error("Error ensuring queue size:", { error });
            } finally {
                this.isDownloading = false;
            }
        });
    }

    current() {
        return this.tracks[this.index];
    }

    broadcast(chunk) {
        this.clients.forEach((client) => {
            // Only write to active clients
            if (!client.destroyed) {
                client.write(chunk);
            }
        });
    }

    addClient() {
        const id = uuid();
        const client = new PassThrough();

        client.on('error', (err) => {
            logger.error(`Client ${id} disconnected: ${err.message}`);
            this.removeClient(id);
        });

        // Send current track metadata if available
        if (this.currentTrack) {
            const metadata = {
                type: 'metadata',
                track: this.currentTrack?.url ? this.currentTrack.url.split('/').pop() : null,
                index: this.index
            };
            client.write(JSON.stringify(metadata));
        }

        this.clients.set(id, client);
        return { id, client };
    }

    removeClient(id) {
        const client = this.clients.get(id);
        if (client) {
            client.end();
            client.destroy();
            this.clients.delete(id);
        }
    }

    getAllQueueList() {
        return this.tracks;
    }

    async loadTracks(dir) {
        try {
            this.tracks = [];
            this.index = 0;
            this.currentTrack = null;
            this.isDownloading = false;

            logger.info("Cleaning up tracks directory...");
            const tracksDir = path.join(process.cwd(), dir);
            if (fsHelper.exists(tracksDir)) {
                const files = fsHelper.listFiles(tracksDir);
                for (const file of files) {
                    const filePath = path.join(tracksDir, file);
                    try {
                        const success = cacheManager.moveToCache(filePath, path.basename(file, '.mp3'));
                        if (!success) {
                            fsHelper.delete(filePath);
                            logger.info(`Deleted file: ${file}`);
                        } else {
                            logger.info(`Moved file to cache: ${file}`);
                        }
                    } catch (error) {
                        logger.error(`Error processing file ${file}:`, error);
                    }
                }
            }

            logger.info("Loading initial tracks...");

            const song = await fetchNextTrack();
            const songBitrate = await this.getTrackBitrate(song.url);
            this.tracks.push({ 
                url: song.url, 
                bitrate: songBitrate, 
                title: song.title, 
                duration: song?.duration ? durationFormatter(song.duration) : "00:00", 
                requestedBy: song?.requestedBy ?? "anonymous" 
            });
            logger.info(`Added initial track: ${song.title}`);

            this.ensureQueueSize();

            logger.info(`Loaded initial track and queued downloads. Current queue size: ${this.tracks.length}`);
        } catch (error) {
            logger.error(`Error loading tracks: ${error.message}`);
            this.tracks = [];
            throw error;
        }
    }

    async getTrackBitrate(url) {
        return new Promise((resolve) => {
            ffmpeg.ffprobe(url, (err, metadata) => {
                if (err || !metadata?.format?.bit_rate) {
                    return resolve(128000);
                }
                resolve(metadata.format.bit_rate);
            });
        });
    }

    async cleanupCurrentStream() {
        this.playing = false;
        this.startTime = null;
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }

        return new Promise((resolve) => {
            const cleanup = () => {
                if (this.ffmpegProcess) {
                    this.ffmpegProcess.removeAllListeners();
                    try {
                        process.kill(this.ffmpegProcess.pid, 'SIGKILL');
                    } catch (error) {
                        if (error.code !== 'ESRCH') {
                            logger.error('Error during FFmpeg cleanup:', { error });
                        }
                    }
                    this.ffmpegProcess = null;
                }

                if (this.stream) {
                    this.stream.removeAllListeners();
                    this.stream.destroy();
                    this.stream = null;
                }

                if (this.throttle) {
                    this.throttle.removeAllListeners();
                    this.throttle.destroy();
                    this.throttle = null;
                }

                resolve();
            };

            cleanup();
        });
    }

    getNextTrack() {
        if (this.tracks.length === 0) return null;

        this.index = Math.min(this.index, this.tracks.length - 1);

        this.currentTrack = this.tracks[this.index];

        const metadata = {
            type: 'metadata',
            track: this.currentTrack?.url ? this.currentTrack.url.split('/').pop() : null,
            title: this.currentTrack?.title || '',
            index: this.index
        };
        this.broadcast(Buffer.from(JSON.stringify(metadata)));

        logger.info(`Now playing: ${this.currentTrack?.title || 'Unknown'}`);
        return this.currentTrack;
    }

    async skip() {
        if (this.tracks.length === 0 || this.isTransitioning) {
            logger.info("Skip not possible at this time");
            return;
        }

        this.isTransitioning = true;

        try {
            this.playing = false;
            logger.info("Skipping song:", this.currentTrack?.title || 'Unknown');

            const hasNextTrack = this.tracks.length > 1;

            await this.cleanupCurrentStream();

            if (this.currentTrack) {
                this.previousTrack = { ...this.currentTrack };
            }

            const currentTrack = this.tracks[0];
            if (currentTrack?.url) {
                const normalizedPath = currentTrack.url.replace(/\\/g, '/');
                logger.info(`Processing track for caching: ${currentTrack.title} (${normalizedPath})`);
                
                if (normalizedPath.includes('cache')) {
                    logger.info(`Skipping cache for already cached file: ${currentTrack.url}`);
                } else if (!normalizedPath.startsWith(`${DEFAULT_TRACKS_LOCATION}/`)) {
                    logger.info(`Track URL not in tracks folder: ${currentTrack.url}`);
                } else if (fsHelper.exists(currentTrack.url)) {
                    const title = currentTrack.title || path.basename(currentTrack.url, '.mp3');
                    logger.info(`File exists at ${currentTrack.url}, moving to cache...`);
                    if (!title) {
                        logger.error('Cannot move file to cache: missing title');
                    } else {
                        await new Promise((resolve) => {
                            setTimeout(() => {
                                const success = cacheManager.moveToCache(currentTrack.url, title);
                                if (success) {
                                    logger.info(`Successfully moved ${title} to cache`);
                                } else {
                                    logger.error(`Failed to move ${title} to cache`);
                                }
                                resolve();
                            }, 100);
                        });
                    }
                }

            } else {
                logger.info(`No track URL available`);
            }

            this.tracks.shift();
            this.index = 0;

            if (hasNextTrack) {
                this.playing = true;
                await this.play(true);
            } else {
                const maxWaitTime = 2000;
                const startTime = Date.now();

                while (this.tracks.length === 0) {
                    if (Date.now() - startTime > maxWaitTime) {
                        logger.info("No tracks available after waiting");
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                if (this.tracks.length > 0) {
                    this.playing = true;
                    await this.play(true);
                } else {
                    logger.warn("No tracks available after skip");
                }
            }
            this.ensureQueueSize();
        } catch (error) {
            logger.error('Error during skip:', { error });
            this.playing = false;
        } finally {
            this.isTransitioning = false;
        }
    }

    pause() {
        if (!this.started() || !this.playing) return;
        this.playing = false;
        this.cleanupCurrentStream();
        logger.info("Paused");
    }

    resume() {
        if (!this.started() || this.playing) return;
        logger.info("Resumed");
        this.play(false);
    }

    started() {
        return this.currentTrack !== null;
    }

    async play(useNewTrack = false) {
        if (this.tracks.length === 0) {
            logger.error("No tracks in queue");
            this.playing = false;
            return;
        }

        try {
            if (useNewTrack || !this.currentTrack) {
                this.getNextTrack();
            }

            await this.cleanupCurrentStream();
            this.loadTrackStream();
            this.start();
            const songData = {
                title: this.currentTrack?.title || 'Unknown',
                duration: this.currentTrack?.duration || '00:00',
                requestedBy: this.currentTrack?.requestedBy || 'anonymous'
            }
            socketManager.emit('newSong', songData);
        } catch (error) {
            logger.error('Error during play:', { error });
            this.playing = false;
        }
    }

    loadTrackStream(seekTime = 0) {
        const track = this.currentTrack;
        if (!track) return;

        if (this.ffmpegProcess) {
            this.cleanupCurrentStream();
        }

        const ffmpegArgs = [
            '-hide_banner',
            '-loglevel', 'error',
            '-ss', Math.max(0, seekTime).toString(),
            '-i', track.url,
            '-vn',
            '-acodec', 'libmp3lame',
            '-ab', '128k',
            '-ac', '2',
            '-ar', '44100',
            '-f', 'mp3',
            '-fflags', '+nobuffer',
            '-flags', '+low_delay',
            'pipe:1'
        ];

        this.ffmpegProcess = spawn(getFfmpegPath(), ffmpegArgs, {
            windowsHide: true
        });

        this.stream = this.ffmpegProcess.stdout;

        this.ffmpegProcess.stderr.on('data', (data) => {
            const errorMsg = data.toString().toLowerCase();
            if (!errorMsg.includes('config') && !errorMsg.includes('version')) {
                logger.error(`FFmpeg error: ${data.toString()}`);
            }
        });

        this.ffmpegProcess.once('close', async (code) => {
            if (code !== 0 && 
                this.playing && 
                !this.isTransitioning && 
                this.tracks.length > 0 && 
                this.tracks[0]?.url === this.currentTrack?.url) {
                
                logger.error(`FFmpeg process exited with code ${code}`);
                this.play(true);
            }
        });

        this.stream.on('error', (error) => {
            logger.error('Stream error:', { error });
            if (this.playing && !this.isTransitioning) {
                this.play(true);
            }
        });
    }

    async handleTrackEnd() {
        if (!this.playing || this.isTransitioning) return;

        logger.info("Track ended, managing queue...");
        this.isTransitioning = true;

        try {
            if (this.currentTrack) {
                this.previousTrack = { ...this.currentTrack };
            }

            const currentTrack = this.tracks[0];
            if (currentTrack?.url) {
                const normalizedPath = currentTrack.url.replace(/\\/g, '/');
                logger.info(`Processing track for caching: ${currentTrack.title} (${normalizedPath})`);
                
                if (normalizedPath.includes('cache')) {
                    logger.info(`Skipping cache for already cached file: ${currentTrack.url}`);
                } else if (!normalizedPath.startsWith(`${DEFAULT_TRACKS_LOCATION}/`)) {
                    logger.info(`Track URL not in tracks folder: ${currentTrack.url}`);
                } else if (fsHelper.exists(currentTrack.url)) {
                    const title = currentTrack.title || path.basename(currentTrack.url, '.mp3');
                    logger.info(`File exists at ${currentTrack.url}, moving to cache...`);
                    if (!title) {
                        logger.error('Cannot move file to cache: missing title');
                    } else {
                        await new Promise((resolve) => {
                            setTimeout(() => {
                                const success = cacheManager.moveToCache(currentTrack.url, title);
                                if (success) {
                                    logger.info(`Successfully moved ${title} to cache`);
                                } else {
                                    logger.error(`Failed to move ${title} to cache`);
                                }
                                resolve();
                            }, 100);
                        });
                    }
                }
            } else {
                logger.info(`Track URL not in tracks folder: ${currentTrack?.url}`);
            }

            this.tracks.shift();
            this.index = 0;
            await this.ensureQueueSize();

            const maxWaitTime = 5000;
            const startTime = Date.now();

            while (this.tracks.length === 0) {
                if (Date.now() - startTime > maxWaitTime) {
                    logger.warn("Timeout waiting for next track");
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (this.tracks.length > 0) {
                this.play(true);
            } else {
                logger.warn("No tracks available after current track ended");
                this.playing = false;
            }
        } catch (error) {
            logger.error('Error handling track end:', { error });
            this.playing = false;
        } finally {
            this.isTransitioning = false;
        }
    }

    async seek(seconds) {
        if (!this.currentTrack || !this.playing || this.isTransitioning) {
            logger.info("Seek not possible at this time");
            return;
        }

        this.isTransitioning = true;

        try {
            // Convert seconds parameter to number and get current position
            const seekOffset = parseInt(seconds, 10);
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const [totalMinutes, totalSeconds] = this.currentTrack.duration.split(':').map(Number);
            const totalInSeconds = (totalMinutes * 60) + totalSeconds;
            
            // Calculate new position with proper number addition
            const newPosition = Math.max(0, Math.min(totalInSeconds, elapsed + seekOffset));
            
            if (newPosition >= totalInSeconds) {
                await this.handleTrackEnd();
                return;
            }

            if (newPosition === 0 && elapsed < 5) {
                await this.play(false);
                return;
            }

            logger.info(`Seeking from ${elapsed}s to ${newPosition}s`);
            
            // Reload stream with new position
            await this.cleanupCurrentStream();
            this.loadTrackStream(newPosition);
            
            this.startTime = Date.now() - (newPosition * 1000);
            this.playing = true;
            this.start();

            socketManager.emit('seeked', {
                position: newPosition,
                duration: totalInSeconds
            });

        } catch (error) {
            logger.error('Error during seek:', { error });
            // Try to recover by restarting playback
            this.play(false);
        } finally {
            this.isTransitioning = false;
        }
    }

    calculateProgress() {
        if (!this.startTime || !this.playing || !this.currentTrack?.duration) {
            return { elapsed: "00:00", total: this.currentTrack?.duration || "00:00", percent: 0 };
        }

        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const [totalMinutes, totalSeconds] = this.currentTrack.duration.split(':').map(Number);
        const totalInSeconds = (totalMinutes * 60) + totalSeconds;
        
        const percent = Math.min((elapsed / totalInSeconds) * 100, 100);
        const elapsedMinutes = Math.floor(elapsed / 60);
        const elapsedSeconds = elapsed % 60;
        
        return {
            elapsed: `${String(elapsedMinutes).padStart(2, '0')}:${String(elapsedSeconds).padStart(2, '0')}`,
            total: this.currentTrack.duration,
            percent: Math.round(percent)
        };
    }

    start() {
        const track = this.currentTrack;
        if (!track) return;

        const bitrate = 128000;
        this.playing = true;
        this.startTime = Date.now();
        this.throttle = new Throttle(bitrate / 8);

        // Set up progress interval
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        this.progressInterval = setInterval(() => {
            const progress = this.calculateProgress();
            socketManager.emit('playbackProgress', progress);
        }, 30000);

        const pipeline = this.stream.pipe(this.throttle);

        pipeline.on("data", (chunk) => {
            if (this.playing) {
                try {
                    this.broadcast(chunk);
                } catch (error) {
                    logger.error('Broadcast error:', { error });
                }
            }
        });

        pipeline.on("end", () => this.handleTrackEnd());

        pipeline.on("error", (err) => {
            logger.error("Stream error:", { err });
            if (this.playing && !this.isTransitioning) {
                this.play(true);
            }
        });
    }
}

const queue = new Queue();
export default queue;
