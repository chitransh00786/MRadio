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
        this.downloadPromise = null;
    }

    async ensureQueueSize() {
        if (this.isDownloading || this.tracks.length >= this.minQueueSize) {
            return;
        }

        this.isDownloading = true;
        try {
            const song = await fetchNextTrack();
            this.tracks.push({ filepath: song.url, bitrate: 128, title: song.title });
            console.log(`Added new track to queue: ${song.title}`);
            
            // Start downloading next song if queue is still below minimum
            if (this.tracks.length < this.minQueueSize) {
                this.downloadPromise = this.downloadNextTrack();
            }
        } catch (error) {
            console.error("Error ensuring queue size:", error);
        } finally {
            this.isDownloading = false;
        }
    }

    async downloadNextTrack() {
        if (this.isDownloading) {
            return;
        }

        this.isDownloading = true;
        try {
            const song = await fetchNextTrack();
            this.tracks.push({ filepath: song.url, bitrate: 128, title: song.title });
            console.log(`Downloaded and added new track: ${song.title}`);
        } catch (error) {
            console.error("Error downloading next track:", error);
        } finally {
            this.isDownloading = false;
        }
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
                track: this.currentTrack.filepath.split('/').pop(),
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

    async addTrack(filepath) {
        try {
            if (pathHelper.checkExtension(filepath, ".mp3")) {
                throw new Error("Only MP3 files are supported");
            }

            // Check bitrate and add track metadata
            const bitrate = await this.getTrackBitrate(filepath);
            const track = { filepath, bitrate };
            this.tracks.push(track);
            console.log(`Track added: ${filepath}`);
            return track;
        } catch (error) {
            console.error(`Error adding track: ${error.message}`);
            throw error;
        }
    }

    async loadTracks(dir) {
        try {
            // Reset queue state
            this.tracks = [];
            this.index = 0;
            this.currentTrack = null;
            this.isDownloading = false;
            this.downloadPromise = null;

            // Load initial tracks up to minQueueSize
            console.log("Loading initial tracks...");
            
            // Load first track
            const song = await fetchNextTrack()
            this.tracks.push({ filepath: song.url, bitrate: 128, title: song.title });
            console.log(`Added initial track: ${song.title}`);

            // Start downloading additional tracks in background
            this.downloadPromise = (async () => {
                while (this.tracks.length < this.minQueueSize) {
                    await this.downloadNextTrack();
                }
            })();

            console.log(`Loaded initial track and queued downloads. Current queue size: ${this.tracks.length}`);
        } catch (error) {
            console.error(`Error loading tracks: ${error.message}`);
            this.tracks = [];
            throw error;
        }
    }

    async getTrackBitrate(filepath) {
        return new Promise((resolve) => {
            ffmpeg.ffprobe(filepath, (err, metadata) => {
                if (err || !metadata?.format?.bit_rate) {
                    return resolve(128000); // Default to 128kbps
                }
                resolve(metadata.format.bit_rate);
            });
        });
    }

    async cleanupCurrentStream() {
        return new Promise((resolve) => {
            const cleanup = () => {
                if (this.throttle) {
                    this.throttle.removeAllListeners();
                    this.throttle.destroy();
                    this.throttle = null;
                }

                if (this.stream) {
                    this.stream.removeAllListeners();
                    this.stream.destroy();
                    this.stream = null;
                }

                if (this.ffmpegProcess) {
                    this.ffmpegProcess.removeAllListeners();

                    // Check if process is still running before attempting to kill
                    try {
                        // First check if process exists and is killable
                        process.kill(this.ffmpegProcess.pid, 0);

                        // If we get here, process exists, so kill it
                        process.kill(this.ffmpegProcess.pid, 'SIGKILL');
                    } catch (error) {
                        // Ignore ESRCH errors (process already gone)
                        if (error.code !== 'ESRCH') {
                            console.error('Error during process cleanup:', error);
                        }
                    }

                    this.ffmpegProcess = null;
                }
                resolve();
            };

            // If there's an active FFmpeg process, wait for it to close
            if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
                this.ffmpegProcess.once('close', cleanup);
                try {
                    process.kill(this.ffmpegProcess.pid, 'SIGTERM');
                } catch (error) {
                    // Ignore ESRCH errors
                    if (error.code !== 'ESRCH') {
                        console.error('Error sending SIGTERM:', error);
                    }
                    cleanup();
                }
            } else {
                cleanup();
            }
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
            track: this.currentTrack.filepath.split('/').pop(),
            title: this.currentTrack.title || '',
            index: this.index
        };
        this.broadcast(Buffer.from(JSON.stringify(metadata)));

        console.log(`Now playing: ${this.currentTrack.title || 'Unknown'}`);
        return this.currentTrack;
    }

    async skip() {
        if (!this.tracks.length || this.isTransitioning) {
            console.log("Skip not possible at this time");
            return;
        }

        this.isTransitioning = true;

        try {
            console.log("Skipping song: " + this.currentTrack)
            // Stop current playback
            this.playing = false;

            // Clean up current stream
            await this.cleanupCurrentStream();

            // Send silence buffer to keep connection alive
            const silenceBuffer = Buffer.alloc(4096);
            this.broadcast(silenceBuffer);

            // Start downloading next track if needed
            if (this.tracks.length < this.minQueueSize + 1 && !this.isDownloading) {
                this.downloadPromise = this.downloadNextTrack();
            }

            // Remove the current track and adjust index
            this.tracks.shift();
            this.index = Math.max(0, this.index - 1);
            console.log("Removed skipped track");

            // Ensure we have enough tracks
            await this.ensureQueueSize();

            // If we're downloading and queue is empty, wait
            if (this.tracks.length === 0 && this.downloadPromise) {
                console.log("Waiting for track download to complete...");
                await this.downloadPromise;
            }

            // Start next track
            setTimeout(() => {
                this.playing = true;
                this.play(true);
                this.isTransitioning = false;
            }, 200);  // Increased delay for better stability
        } catch (error) {
            console.error('Error during skip:', error);
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

    play(useNewTrack = false) {
        if (this.tracks.length === 0) {
            console.log("No tracks in queue");
            this.playing = false;
            return;
        }

        if (useNewTrack || !this.currentTrack) {
            this.getNextTrack();
        }

        this.loadTrackStream();
        this.start();
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
            '-i', track.filepath,
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
            if (this.playing && !this.isTransitioning) {
                console.log("Track ended, managing queue...");
                
                // Start downloading next track early if needed
                if (this.tracks.length < this.minQueueSize + 1 && !this.isDownloading) {
                    this.downloadPromise = this.downloadNextTrack();
                }

                // Remove the completed track and adjust index
                this.tracks.shift();
                this.index = Math.max(0, this.index - 1);
                console.log("Removed completed track");

                // Ensure we have enough tracks
                await this.ensureQueueSize();

                // If we're still downloading and queue is empty, wait for download
                if (this.tracks.length === 0 && this.downloadPromise) {
                    console.log("Waiting for track download to complete...");
                    await this.downloadPromise;
                }

                // Then play the next track
                console.log("Moving to next track...");
                this.play(true);
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
