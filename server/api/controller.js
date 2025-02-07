import { errorRes, successRes } from "../utils/response.js";
import Service from "../services/apiService.js"
import logger from "../utils/logger.js";

const service = new Service();
export const skip = async (req, res) => {
    try {
        await service.skip();
        res.status(200).json(successRes({ skip: true }, "Skip Successful \n Playing next song..."));
    } catch (error) {
        res.status(400).json(errorRes({ error: error.message }, "Skip Error"))
    }
}

export const getCurrentSong = async (req, res) => {
    try {
        const response = await service.getCurrentSong();
        logger.info("Current Song api Response: ", { response })
        res.status(200).json(successRes(response, "Current Song"));
    } catch (error) {
        res.status(400).json(errorRes({ error: error.message }, "Current Song Error"));
    }
}

export const previousSong = async (req, res) => {
    try {
        const response = await service.previous();
        res.status(200).json(successRes(response, "Previous Song"));
    } catch (error) {
        res.status(400).json(errorRes({ error: error.message }, "Previous song error"))

    }
}

export const getUpcomingSong = async (req, res) => {
    try {
        const response = await service.getUpcomingSong();
        logger.info("Upcoming Song api Response: ", { response })
        res.status(200).json(successRes(response, "Successfully Fetched upcoming Song"));
    } catch (error) {
        res.status(400).json(errorRes({ error: error.message }, "Upcoming Song Error"));
    }
}

export const getQueueList = async (req, res) => {
    try {
        const response = await service.getQueueList();
        res.status(200).json(successRes(response, "Successfully Fetched Queue List"));
    } catch (error) {
        res.status(400).json(errorRes({ error: error.message }, "Queue List Error"));
    }
}

export const addSongToQueue = async (req, res) => {
    try {
        if (!req.body.songName) {
            throw new Error("Invalid song name")
        }
        const response = await service.addSongToQueue(req.body);
        res.status(200).json(successRes(response, "Successfully Added song to the queue"));
    } catch (error) {
        res.status(400).json(errorRes({ error: error.message }, "Song Not Found!"))
    }
}

export const addSongToTop = async (req, res) => {
    try {
        if (!req.body.songName) {
            throw new Error("Invalid song name")
        }
        const response = await service.addSongToTop(req.body);
        res.status(200).json(successRes(response, "Successfully Added song to the queue"));
    } catch (error) {
        res.status(400).json(errorRes({ error: error.message }, "Song Not Found!"))
    }
}

export const generateToken = async (req, res) => {
    try {
        if (!req.body.username) {
            throw new Error("username is required!");
        }
        const response = await service.generateToken(req.body.username);
        res.status(200).json(successRes(response, "Successfully Generated token!"));
    } catch (error) {
        res.status(400).json(errorRes({ error: error.message }, "Error generating token!"))
    }
}
