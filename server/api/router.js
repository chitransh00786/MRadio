import express from 'express';
import { addSongToQueue, getCurrentSong, getQueueList, getUpcomingSong, skip } from './controller.js';
const router = express.Router();

router.get("/skip", skip);
router.get("/queue", getQueueList);
router.get("/current", getCurrentSong);
router.get("/upcoming", getUpcomingSong);

router.post("/add", express.json(), addSongToQueue)

export default router;