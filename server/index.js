import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import queue from "./lib/queue.js";
import SpotifyAPI from "./lib/spotify.js";
import YouTubeDownloader from "./lib/download.js";
import { generateSongMetadata } from "./utils/utils.js";
import SongQueueManager from "./utils/songQueueManager.js";

const PORT = 4001;
const app = express();
const server = http.createServer(app);
const io = new IOServer(server);

app.get("/", function (req, res) {
    res.redirect('/stream');
});

(async () => {
    await queue.loadTracks("tracks");
    queue.play();

    io.on("connection", (socket) => {
        // Every new streamer must receive the header
        if (queue.bufferHeader) {
            socket.emit("bufferHeader", queue.bufferHeader);
        }

        socket.on("bufferHeader", (header) => {
            queue.bufferHeader = header;
            socket.broadcast.emit("bufferHeader", queue.bufferHeader);
        });

        socket.on("stream", (packet) => {
            // Only broadcast microphone if a header has been received
            if (!queue.bufferHeader) return;

            // Audio stream from host microphone
            socket.broadcast.emit("stream", packet);
        });
    });

    app.get("/skip", (req, res) => {
        queue.skip();
        return res.json({ message: "Skip successfull" })
    })

    app.post("/add", express.json(), async (req, res) => {
        console.log("calling add")
        const { songName } = req.body;
        const metadata = await generateSongMetadata(songName);
        const songQueue = new SongQueueManager();
        songQueue.addToQueue(metadata);
        return res.json({ message: "Track added successfully" })
    })

    app.get("/queue", (req, res) => {
        const songList = queue.getAllQueueList();
        res.json({ songlist: songList });
    })

    // HTTP stream for music
    app.get("/stream", (req, res) => {
        const { id, client } = queue.addClient();

        res.set({
            "Content-Type": "audio/mp3",
            "Transfer-Encoding": "chunked",
        }).status(200);

        client.pipe(res);

        req.on("close", () => {
            queue.removeClient(id);
        });
    });

    server.listen(PORT, () => {
        console.log(`Listening on port ${PORT}`);
    });
})();

export { };
