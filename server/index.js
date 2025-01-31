import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import queue from "./lib/queue.js";
import router from "./api/router.js";

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
    app.use("/api", router);
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
