import { errorRes, successRes } from "../utils/response.js";
import Service from "./service.js"

const service = new Service();
export const skip = (req, res) => {
    try {
        service.skip();
        res.status(200).json(successRes({ skip: true }, "skip Successful"));
    } catch (error) {
        res.status(400).json(errorRes({ error: error.message }, "Skip Error"))
    }
}

export const getCurrentSong = (req, res) => {
    try {
        const response = service.getCurrentSong();
        res.status(200).json(successRes(response, "Current Song"));
    } catch (error) {
        res.status(400).json(errorRes({ error: error.message }, "Current Song Error"));
    }
}

export const getUpcomingSong = (req, res) => {
    try {
        const response = service.getUpcomingSong();
        res.status(200).json(successRes(response, "Successfully Fetched upcoming Song"));
    } catch (error) {
        res.status(400).json(errorRes({ error: error.message }, "Upcoming Song Error")); 
    }
}

export const getQueueList = (req, res) => {
try {
    const response = service.getQueueList();
    res.status(200).json(successRes(response, "Successfully Fetched Queue List"));
} catch (error) {
    res.status(400).json(errorRes({ error: error.message }, "Queue List Error"));  
}
}

export const addSongToQueue = (req, res) => {

}

export const addTrack = (req, res) => {
    
}