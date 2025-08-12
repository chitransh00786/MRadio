import express from "express";
import http from "http";
import socketManager from "./lib/socketManager.js";
import queue from "./lib/queue.js";
import router from "./api/router.js";
import { DEFAULT_TRACKS_LOCATION } from "./utils/constant.js";
import Initializer from "./services/initializer.js";
import secret from "./utils/secret.js";
import logger from "./utils/logger.js";

const PORT = 9126;
const app = express();

const server = http.createServer(app);

app.use(express.json());

app.get("/", function (req, res) {
    res.redirect('/stream');
});

(async () => {
    // Initialize Initial Data
    await Initializer.init();

    // Initialize Icecast streaming if configured
    const icecastConfig = {
        host: secret.ICECAST_HOST,
        port: secret.ICECAST_PORT,
        password: secret.ICECAST_PASSWORD,
        mount: secret.ICECAST_MOUNT,
        name: secret.ICECAST_NAME,
        description: secret.ICECAST_DESCRIPTION,
        genre: secret.ICECAST_GENRE,
        bitrate: secret.ICECAST_BITRATE
    };

    if (icecastConfig.host && icecastConfig.port && icecastConfig.password) {
        const icecastInitialized = queue.initializeIcecast(icecastConfig);
        if (icecastInitialized) {
            logger.info('Icecast streaming enabled');
            logger.info(`Stream will be available at: http://${icecastConfig.host}:${icecastConfig.port}${icecastConfig.mount}`);
        } else {
            logger.warn('Failed to initialize Icecast streaming, falling back to direct HTTP streaming');
        }
    } else {
        logger.info('Icecast configuration not found in .env, using direct HTTP streaming only');
    }

    // Load Initial Track
    await queue.loadTracks(DEFAULT_TRACKS_LOCATION);
    queue.play();

    // Initialize socket.io with queue for streaming
    socketManager.initialize(server, queue);
    app.use("/api", router);
    
    // HTTP stream for music (kept as fallback/direct access)
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

    // Icecast status endpoint
    app.get("/api/icecast/status", (req, res) => {
        const status = queue.getIcecastStatus();
        res.json(status);
    });

    server.listen(PORT, () => {
        console.log(`Listening on port ${PORT}`);
        if (queue.useIcecast) {
            console.log(`Icecast stream available at: http://${icecastConfig.host}:${icecastConfig.port}${icecastConfig.mount}`);
        }
        console.log(`Direct HTTP stream available at: http://localhost:${PORT}/stream`);
    });
})();

export { };
