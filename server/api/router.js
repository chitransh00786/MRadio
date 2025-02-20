import express from 'express';
import { addSongToQueue, getCurrentSong, getQueueList, getUpcomingSong, skip, generateToken, previousSong, blockCurrentSong, blockSongBySongName, unblockSongBySongName, unblockSongByIndex, clearBlockList, getAllBlockList, isSongBlocked, removeSongFromQueue, addSongToTop, removeLastSongRequestedByUser, addPlaylistToQueue, addPlaylistToTop, addDefaultPlaylists, getCommonConfig, createConfigOrUpdateCommonConfig, getDefaultPlaylist, removeDefaultPlaylist, updatePlaylistStatus } from './controller.js';
import { isAdmin, isValidUser } from './middleware.js';
const router = express.Router();

router.get("/songs/queue", isValidUser, getQueueList);
router.get("/songs/skip", isValidUser, skip);
router.get("/songs/previous", isValidUser, previousSong);
router.get("/songs/current", isValidUser, getCurrentSong);
router.get("/songs/upcoming", isValidUser, getUpcomingSong);
router.post("/songs/add", isValidUser, addSongToQueue);
router.post("/songs/add/top", isValidUser, addSongToTop);
router.delete("/songs/requests/last/:requestedBy", isValidUser, removeLastSongRequestedByUser);
router.delete("/songs/remove/:index", isValidUser, removeSongFromQueue);

router.post("/playlist/add", isValidUser, addPlaylistToQueue);
router.post("/playlist/add/top", isValidUser, addPlaylistToTop);

router.post("/playlist/default", isValidUser, addDefaultPlaylists);
router.get("/playlist/default", isValidUser, getDefaultPlaylist);
router.delete("/playlist/default/:index", isValidUser, removeDefaultPlaylist);
router.put("/playlist/default/:index/status", isValidUser, updatePlaylistStatus);

router.post("/songs/block/current", isValidUser, blockCurrentSong);
router.post("/songs/block", isValidUser, blockSongBySongName);
router.delete("/songs/block/:songName", isValidUser, unblockSongBySongName);
router.delete("/songs/block/all", isValidUser, clearBlockList);
router.delete("/songs/block/:index", isValidUser, unblockSongByIndex);
router.get("/songs/block/list", isValidUser, getAllBlockList);
router.get("/songs/block/check", isValidUser, isSongBlocked);

router.post("/admin/token", isAdmin, generateToken);

router.get("/config", isValidUser, getCommonConfig);
router.post("/config", isValidUser, createConfigOrUpdateCommonConfig);

export default router;
