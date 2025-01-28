import express from 'express';
import { addSongToQueue, addTrack, getCurrentSong, getQueueList, getStatus, getUpcomingSong, skip } from './controller.js';
const router = express.Router();

router.get('/status', getStatus);
router.get("/skip", skip);
router.get("/current", getCurrentSong);
router.get("/upcoming", getUpcomingSong);

router.get("/queue", getQueueList);
router.post("/queue", addSongToQueue)

router.post("/add", express.json(), addTrack);

export default router;