import express from "express";
import http from "http";
import socketManager from "./lib/socketManager.js";
import queue from "./lib/queue.js";
import router from "./api/router.js";
import { DEFAULT_TRACKS_LOCATION } from "./utils/constant.js";
import Initializer from "./services/initializer.js";

const PORT = 9126;
const app = express();

const server = http.createServer(app);
app.get("/", function (req, res) {
    res.redirect('/stream');
});

(async () => {
    // Initialize Initial Data
    await Initializer.init();

    // Load Initial Track
    await queue.loadTracks(DEFAULT_TRACKS_LOCATION);
    queue.play();

    // Initialize socket.io with queue for streaming
    socketManager.initialize(server, queue);
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
