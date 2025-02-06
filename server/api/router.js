import express from 'express';
import { addSongToQueue, getCurrentSong, getQueueList, getUpcomingSong, skip, generateToken, previousSong } from './controller.js';
import { isAdmin, isValidUser } from './middleware.js';
const router = express.Router();

router.get("/songs/skip", isValidUser, skip);
router.get("/songs/previous", isValidUser, previousSong)
router.get("/songs/queue", isValidUser, getQueueList);
router.get("/songs/current", isValidUser, getCurrentSong);
router.get("/songs/upcoming", isValidUser, getUpcomingSong);
router.post("/songs/add", isValidUser, express.json(), addSongToQueue)

router.post("/admin/token", express.json(), isAdmin, generateToken);
// router.get("admin/token", isAdmin, getAllToken);
export default router;