import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import queue from "./queue.js";
import SpotifyAPI from "./spotify.js";
import YouTubeDownloader from "./download.js";

const PORT = 9126;
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

    app.get("/status", (req, res) => {
        const status = queue.getCurrentSongStatus(); // Was missing assignment
        return res.json(status); // Was using res.send()
    })

    app.get("/skip", (req, res) => {
        queue.skip();
        return res.json({ message: "Skip successfull" })
    })

    app.get("/current", (req, res) => {
        const status = queue.getCurrentSongStatus();
        res.json(status);
    });


    app.get("/upcoming", (req, res) => {
        const status = queue.getUpcomingSongStatus();
        res.json(status);
    });

    app.get("/queue", (req, res) => {
        const songList = queue.getAllQueueList();
        console.log(songList)
        res.json({ songlist: songList });
    })

    app.post("/add", express.json(), async (req, res) => {
        try {
            const { songName } = req.body;
            if (!songName) {
                return res.status(400).json({ message: "Song name is required." });
            }
            const spotify = new SpotifyAPI();
            const songDetail = await spotify.searchTrack(songName);
            const { name, id } = songDetail;
            console.log("song Detail: ", songDetail, name, id);
            if (!name) {
                return res.status(400).json({ message: "Song not found." });
            }
            const yt = new YouTubeDownloader();
            const { filepath } = await yt.downloadVideo(name);
            if (!filepath) {
                return res.status(400).json({ message: "Unable to find video." });
            }
            console.log(filepath);
            const result = await queue.addTrack(filepath);
            res.json(result);
        } catch (error) {
            console.log("error downloading", error.message);
            res.status(500).json({ message: "Error Downloading vieo.", error: error })
        }
    });



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
