import { v4 as uuid } from "uuid";
import { PassThrough } from "stream";
import Throttle from "throttle";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { spawn } from "child_process";
import pathHelper from "../helper/path-helper.js";
import { fetchNextTrack } from "../utils/utils.js";

ffmpeg.setFfmpegPath(ffmpegStatic);

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
                        this.tracks.push({
                            url: song.url,
                            bitrate: 128,
                            title: song.title
                        });
                        console.log(`Downloaded and added new track: ${song.title}`);
                    }
                }
            } catch (error) {
                console.error("Error ensuring queue size:", error);
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
            console.log(`Client ${id} disconnected: ${err.message}`);
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
            console.log("Loading initial tracks...");

            // Load first track
            const song = await fetchNextTrack()
            console.log(song, "song detail");
            this.tracks.push({ url: song.url, bitrate: 128, title: song.title });
            console.log(`Added initial track: ${song.title}`);

            this.ensureQueueSize();

            console.log(`Loaded initial track and queued downloads. Current queue size: ${this.tracks.length}`);
        } catch (error) {
            console.error(`Error loading tracks: ${error.message}`);
            this.tracks = [];
            throw error;
        }
    }

    async getTrackBitrate(url) {
        return new Promise((resolve) => {
            ffmpeg.ffprobe(url, (err, metadata) => {
                if (err || !metadata?.format?.bit_rate) {
                    return resolve(128000); // Default to 128kbps
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
                            console.error('Error during FFmpeg cleanup:', error);
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

        console.log(`Now playing: ${this.currentTrack.title || 'Unknown'}`);
        return this.currentTrack;
    }

    async skip() {
        if (this.tracks.length === 0 || this.isTransitioning) {
            console.log("Skip not possible at this time");
            return;
        }

        this.isTransitioning = true;

        try {
            this.playing = false;
            console.log("Skipping song:", this.currentTrack?.title || 'Unknown');

            const hasNextTrack = this.tracks.length > 1;

            await this.cleanupCurrentStream();
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
                        console.log("No tracks available after waiting");
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                if (this.tracks.length > 0) {
                    this.playing = true;
                    await this.play(true);
                } else {
                    console.log("No tracks available after skip");
                }
            }
            this.ensureQueueSize();
        } catch (error) {
            console.error('Error during skip:', error);
            this.playing = false;
        } finally {
            this.isTransitioning = false;
        }
    }

    pause() {
        if (!this.started() || !this.playing) return;
        this.playing = false;
        this.cleanupCurrentStream();
        console.log("Paused");
    }

    resume() {
        if (!this.started() || this.playing) return;
        console.log("Resumed");
        this.play(false);
    }

    started() {
        return this.currentTrack !== null;
    }

    async play(useNewTrack = false) {
        if (this.tracks.length === 0) {
            console.log("No tracks in queue");
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
            console.error('Error during play:', error);
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

        this.ffmpegProcess = spawn(ffmpegStatic, ffmpegArgs, {
            windowsHide: true
        });

        this.stream = this.ffmpegProcess.stdout;

        this.ffmpegProcess.stderr.on('data', (data) => {
            const errorMsg = data.toString().toLowerCase();
            if (!errorMsg.includes('config') && !errorMsg.includes('version')) {
                console.error(`FFmpeg error: ${data.toString()}`);
            }
        });

        this.ffmpegProcess.once('close', (code) => {
            if (code !== 0 && this.playing && !this.isTransitioning) {
                console.log(`FFmpeg process exited with code ${code}`);
                this.play(true);
            }
        });

        // Handle stream errors
        this.stream.on('error', (error) => {
            console.error('Stream error:', error);
            if (this.playing && !this.isTransitioning) {
                this.play(true);
            }
        });
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
                    console.error('Broadcast error:', error);
                }
            }
        });

        pipeline.on("end", async () => {
            if (!this.playing || this.isTransitioning) return;

            console.log("Track ended, managing queue...");
            this.isTransitioning = true;

            try {
                this.tracks.shift();
                this.index = 0;
                await this.ensureQueueSize();

                const maxWaitTime = 5000;
                const startTime = Date.now();

                while (this.tracks.length === 0) {
                    if (Date.now() - startTime > maxWaitTime) {
                        console.log("Timeout waiting for next track");
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                if (this.tracks.length > 0) {
                    this.play(true);
                } else {
                    console.log("No tracks available after current track ended");
                    this.playing = false;
                }
            } catch (error) {
                console.error('Error handling track end:', error);
                this.playing = false;
            } finally {
                this.isTransitioning = false;
            }
        });

        pipeline.on("error", (err) => {
            console.error("Stream error:", err);
            if (this.playing && !this.isTransitioning) {
                this.play(true);
            }
        });
    }
}

const queue = new Queue();
export default queue;
