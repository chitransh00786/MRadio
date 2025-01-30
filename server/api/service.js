import queue from "../lib/queue.js";

class Service {

    async getCurrentSong() {
        return queue.tracks[queue.index];
    }

    async getQueueList() {
        return queue.tracks;
    }

    async getUpcomingSong() {
        return queue.tracks[(queue.index + 1) % queue.tracks.length];
    }

    async skip() {
        if (!queue.tracks.length || queue.isTransitioning) {
            console.log("Skip not possible at this moment")
            throw new Error("Skip not possible at this moment");
        }
        this.isTransitioning = true;
        queue.playing = false;

        try {
            await queue.cleanupCurrentStream();

            const silenceBuffer = Buffer.alloc(4096);
            queue.broadcast(silenceBuffer);

            setTimeout(() => {
                queue.playing = true;
                queue.play(true);
                queue.isTransitioning = false;
            }, 200);
            return true;
        } catch (error) {
            console.error("Error while skipping: ", error)
            this.isTransitioning = false;
        }
    }

    async addTrack() {
        // TODO: Implementation of adding new track.
    }

    async addSongToQueue() {
        // TODO: Implement adding song to queue.
    }
}

export default Service;