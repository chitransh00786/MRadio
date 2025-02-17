import express from 'express';
import { addSongToQueue, getCurrentSong, getQueueList, getUpcomingSong, skip, generateToken, previousSong, blockCurrentSong, blockSongBySongName, unblockSongBySongName, unblockSongByIndex, clearBlockList, getAllBlockList, isSongBlocked, removeSongFromQueue, addSongToTop, removeLastSongRequestedByUser, addPlaylistToQueue, addPlaylistToTop, addSongToQueueFromSource, addDefaultPlaylists } from './controller.js';
import { isAdmin, isValidUser } from './middleware.js';
const router = express.Router();

router.get("/songs/skip", isValidUser, skip);
router.get("/songs/previous", isValidUser, previousSong)
router.get("/songs/queue", isValidUser, getQueueList);
router.get("/songs/current", isValidUser, getCurrentSong);
router.get("/songs/upcoming", isValidUser, getUpcomingSong);
router.post("/songs/add", isValidUser, express.json(), addSongToQueue);
router.post("/songs/add/youtube", isValidUser, express.json(), addSongToQueueFromSource);
router.post("/songs/add/top", isValidUser, express.json(), addSongToTop);
router.delete("/songs/requests/last/:requestedBy", isValidUser, express.json(), removeLastSongRequestedByUser);
router.delete("/songs/remove/:index", isValidUser, removeSongFromQueue);

router.post("/playlist/add", isValidUser, express.json(), addPlaylistToQueue);
router.post("/playlist/add/top", isValidUser, express.json(), addPlaylistToTop);
router.post("/playlist/default", isValidUser, express.json(), addDefaultPlaylists);

router.post("/songs/block/current", isValidUser, express.json(), blockCurrentSong);
router.post("/songs/block", isValidUser, express.json(), blockSongBySongName);
router.delete("/songs/block/:songName", isValidUser, unblockSongBySongName);
router.delete("/songs/block/all", isValidUser, clearBlockList);
router.delete("/songs/block/:index", isValidUser, unblockSongByIndex);

router.get("/songs/block/list", isValidUser, getAllBlockList);
router.get("/songs/block/check", isValidUser, isSongBlocked);

router.post("/admin/token", express.json(), isAdmin, generateToken);

export default router;
