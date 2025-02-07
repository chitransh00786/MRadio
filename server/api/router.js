import express from 'express';
import { addSongToQueue, getCurrentSong, getQueueList, getUpcomingSong, skip, generateToken, previousSong, blockCurrentSong, blockSongBySongName, unblockSongBySongName, unblockSongByIndex, clearBlockList, getAllBlockList, isSongBlocked } from './controller.js';
import { isAdmin, isValidUser } from './middleware.js';
const router = express.Router();

router.get("/songs/skip", isValidUser, skip);
router.get("/songs/previous", isValidUser, previousSong)
router.get("/songs/queue", isValidUser, getQueueList);
router.get("/songs/current", isValidUser, getCurrentSong);
router.get("/songs/upcoming", isValidUser, getUpcomingSong);
router.post("/songs/add", isValidUser, express.json(), addSongToQueue)

router.post("/songs/block/current", isValidUser, express.json(), blockCurrentSong);
router.post("/songs/block", isValidUser, express.json(), blockSongBySongName);
router.delete("/songs/block", isValidUser, express.json(), unblockSongBySongName);
router.delete("/songs/block/all", isValidUser, clearBlockList);
router.delete("/songs/block/:index", isValidUser, unblockSongByIndex);

router.get("/songs/block/list", isValidUser, getAllBlockList);
router.get("/songs/block/check", isValidUser, isSongBlocked);

router.post("/admin/token", express.json(), isAdmin, generateToken);
// router.get("admin/token", isAdmin, getAllToken);
export default router;