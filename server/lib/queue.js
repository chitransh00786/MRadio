import { v4 as uuid } from "uuid";
import { PassThrough } from "stream";
import Throttle from "throttle";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { spawn } from "child_process";
import { fetchNextTrack } from "../services/nextTrackFetcherService.js";
import fsHelper from "../utils/helper/fs-helper.js";
import logger from "../utils/logger.js";
import { getFfmpegPath } from "../utils/utils.js";

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
        this.minQueueSize = 2;
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
                            duration: song?.duration ?? "00:00",
                            requestedBy: song?.requestedBy ?? "anonymous"
                        });
                        logger.debug(`Downloaded and added new track: ${song.title}`);
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
                track: this.currentTrack.url.split('/').pop(),
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
            // Reset queue state
            this.tracks = [];
            this.index = 0;
            this.currentTrack = null;
            this.isDownloading = false;

            // Load initial tracks up to minQueueSize
            logger.debug("Loading initial tracks...");

            // Load first track
            const song = await fetchNextTrack()
            const songBitrate = await this.getTrackBitrate(song.url)
            this.tracks.push({ url: song.url, bitrate: songBitrate, title: song.title, duration: song?.duration, requestedBy: song?.requestedBy ?? "anonymous" });
            logger.debug(`Added initial track: ${song.title}`);

            this.ensureQueueSize();

            logger.debug(`Loaded initial track and queued downloads. Current queue size: ${this.tracks.length}`);
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
        // Immediately stop broadcasting any data
        this.playing = false;

        return new Promise((resolve) => {
            const cleanup = () => {
                // Immediately kill FFmpeg process first to stop audio generation
                if (this.ffmpegProcess) {
                    this.ffmpegProcess.removeAllListeners();
                    try {
                        process.kill(this.ffmpegProcess.pid, 'SIGKILL');
                    } catch (error) {
                        // Ignore ESRCH errors (process already gone)
                        if (error.code !== 'ESRCH') {
                            logger.error('Error during FFmpeg cleanup:', { error });
                        }
                    }
                    this.ffmpegProcess = null;
                }

                // Then clean up the stream
                if (this.stream) {
                    this.stream.removeAllListeners();
                    this.stream.destroy();
                    this.stream = null;
                }

                // Finally clean up the throttle
                if (this.throttle) {
                    this.throttle.removeAllListeners();
                    this.throttle.destroy();
                    this.throttle = null;
                }

                resolve();
            };

            // Execute cleanup immediately
            cleanup();
        });
    }

    getNextTrack() {
        if (this.tracks.length === 0) return null;

        // Ensure index is within bounds
        this.index = Math.min(this.index, this.tracks.length - 1);

        // Get the next track
        this.currentTrack = this.tracks[this.index];

        // Broadcast track change to all clients
        const metadata = {
            type: 'metadata',
            track: this.currentTrack.url.split('/').pop(),
            title: this.currentTrack.title || '',
            index: this.index
        };
        this.broadcast(Buffer.from(JSON.stringify(metadata)));

        logger.info(`Now playing: ${this.currentTrack.title || 'Unknown'}`);
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
            logger.debug("Skipping song:", this.currentTrack?.title || 'Unknown');

            const hasNextTrack = this.tracks.length > 1;

            await this.cleanupCurrentStream();

            // Delete track file if it exists in tracks folder
            const currentTrack = this.tracks[0];
            if (currentTrack?.url.startsWith('tracks/')) {
                if (fsHelper.exists(currentTrack.url)) {
                    fsHelper.delete(currentTrack.url);
                    logger.debug(`Deleted track file: ${currentTrack.url}`);
                }
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
                        logger.debug("No tracks available after waiting");
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
        logger.debug("Paused");
    }

    resume() {
        if (!this.started() || this.playing) return;
        logger.debug("Resumed");
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
        } catch (error) {
            logger.error('Error during play:', { error });
            this.playing = false;
        }
    }

    loadTrackStream() {
        const track = this.currentTrack;
        if (!track) return;

        // Ensure previous stream is cleaned up
        if (this.ffmpegProcess) {
            this.cleanupCurrentStream();
        }

        const ffmpegArgs = [
            '-hide_banner',
            '-loglevel', 'error',
            '-i', track.url,
            '-vn',
            '-acodec', 'libmp3lame',
            '-ab', '128k',
            '-ac', '2',
            '-ar', '44100',
            '-f', 'mp3',
            '-fflags', '+nobuffer',  // Reduce buffering
            '-flags', '+low_delay',   // Minimize latency
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

        this.ffmpegProcess.once('close', (code) => {
            if (code !== 0 && this.playing && !this.isTransitioning) {
                logger.error(`FFmpeg process exited with code ${code}`);
                this.play(true);
            }
        });

        // Handle stream errors
        this.stream.on('error', (error) => {
            logger.error('Stream error:', { error });
            if (this.playing && !this.isTransitioning) {
                this.play(true);
            }
        });
    }



    async handleTrackEnd() {
        if (!this.playing || this.isTransitioning) return;

        logger.debug("Track ended, managing queue...");
        this.isTransitioning = true;

        try {
            // Delete track file if it exists in tracks folder
            const currentTrack = this.tracks[0];
            if (currentTrack?.url.startsWith('tracks/')) {
                if (fsHelper.exists(currentTrack.url)) {
                    fsHelper.delete(currentTrack.url);
                    logger.debug(`Deleted track file: ${currentTrack.url}`);
                }
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

    start() {
        const track = this.currentTrack;
        if (!track) return;

        const bitrate = 128000;
        this.playing = true;
        this.throttle = new Throttle(bitrate / 8);

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
