import { errorRes, successRes } from "../utils/response.js";
import Service from "../services/apiService.js"
import logger from "../utils/logger.js";

const service = new Service();
export const skip = async (req, res) => {
    try {
        await service.skip();
        res.status(200).json(successRes({ skip: true }, "\nSkip Successful\nPlaying next song..."));
    } catch (error) {
        logger.error("Error in skip API", { error });
        res.status(400).json(errorRes({ message: error.message }, "Skip Error"))
    }
}

export const getCurrentSong = async (req, res) => {
    try {
        const response = await service.getCurrentSong();
        res.status(200).json(successRes(response, "Current Song"));
    } catch (error) {
        logger.error("Error in get Current Song API", { error });
        res.status(400).json(errorRes({ message: error.message }, "Current Song Error"));
    }
}

export const previousSong = async (req, res) => {
    try {
        const response = await service.previous();
        res.status(200).json(successRes(response, "Previous Song"));
    } catch (error) {
        logger.error("Error in Previous Song API", { error });
        res.status(400).json(errorRes({ message: error.message }, "Previous song error"))

    }
}

export const getUpcomingSong = async (req, res) => {
    try {
        const response = await service.getUpcomingSong();
        logger.info("Upcoming Song api")
        res.status(200).json(successRes(response, "Successfully Fetched upcoming Song"));
    } catch (error) {
        logger.error("Error in Get Upcoming Song API", { error });
        res.status(400).json(errorRes({ message: error.message }, "Upcoming Song Error"));
    }
}

export const getQueueList = async (req, res) => {
    try {
        const response = await service.getQueueList();
        res.status(200).json(successRes(response, "Successfully Fetched Queue List"));
    } catch (error) {
        logger.error("Error in Get Song Queue List API", { error });
        res.status(400).json(errorRes({ message: error.message }, "Queue List Error"));
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
        logger.error("Error in Adding Song to Queue API", { error });
        res.status(400).json(errorRes({ message: error.message }, "Song Not Found!"))
    }
}

export const addPlaylistToQueue = async (req, res) => {
    try {
        if (!req.body.playlistId) {
            throw new Error("Invalid playlist Id");
        }
        const response = await service.addPlaylistToQueue(req.body);
        res.status(200).json(successRes(response, `Successfully Added ${response.total} songs to the queue`));
    } catch (error) {
        logger.error("Error in Adding Song to Queue API", { error });
        res.status(400).json(errorRes({ message: error.message }, "Something went wrong while adding playlist"))
    }
}

export const removeSongFromQueue = async (req, res) => {
    try {
        if (!req.params.index) {
            throw new Error("Invalid song index")
        }
        const response = await service.removeFromQueue(req.params);
        res.status(200).json(successRes(response, "Successfully Removed song from the queue"));
    } catch (error) {
        logger.error("Error in Removing Song from Queue API", { error });
        res.status(400).json(errorRes({ message: error.message }, error?.message ?? "Song Failed to remove from queue!"))
    }
}

export const addSongToTop = async (req, res) => {
    try {
        if (!req.body.songName) {
            throw new Error("Invalid song name")
        }
        const response = await service.addSongToTop(req.body);
        res.status(200).json(successRes(response, "Successfully Added Song to the queue"));
    } catch (error) {
        logger.error("Error in Adding Song to Top API", { error });
        res.status(400).json(errorRes({ message: error.message }, "Song Not Found!"))
    }
}

export const addPlaylistToTop = async (req, res) => {
    try {
        if (!req.body.playlistId) {
            throw new Error("Invalid playlist Id")
        }
        const response = await service.addPlaylistToTop(req.body);
        res.status(200).json(successRes(response, `Successfully Added ${response.total} songs to the queue`));
    } catch (error) {
        logger.error("Error in Adding Song to Top API", { error });
        res.status(400).json(errorRes({ message: error.message }, "Something went wrong while adding playlist"))
    }
}

export const addSongToQueueFromSource = async (req, res) => {
    try {
        if (!req.body.videoId || !req.body.url) {
            throw new Error("url and videoId are Required");
        }
        const response = await service.addSongToQueueFromSource(req.body);
        res.status(200).json(successRes(response, "Successfully Added song to the queue"));
    } catch (error) {
        logger.error("Error in Adding Song to Queue from Source API", { error });
        res.status(400).json(errorRes({ message: error.message }, "Song Failed to add from source!"))
    }
}

export const removeLastSongRequestedByUser = async (req, res) => {
    try {
        if (!req.params.requestedBy) {
            throw new Error("Requested by is required");
        }
        const response = await service.removeLastSongRequestedByUser(req.params);
        res.status(200).json(successRes(response, "Successfully Removed last song requested by user."));
    } catch (error) {
        logger.error("Error in Removing Last Song Requested By User API", { error });
        res.status(400).json(errorRes({ message: error.message }, error.message ?? "Failed to remove the last song requested by user."))
    }
}

export const addToQueueFromYT = async (req, res) => {
    // TODO: Implement this function to add songs from YouTube to the queue
}

export const generateToken = async (req, res) => {
    try {
        if (!req.body.username) {
            throw new Error("username is required!");
        }
        const response = await service.generateToken(req.body.username);
        res.status(200).json(successRes(response, "Successfully Generated token!"));
    } catch (error) {
        res.status(400).json(errorRes({ message: error.message }, "Error generating token!"))
    }
}

export const blockCurrentSong = async (req, res) => {
    try {
        const response = await service.blockCurrentSong(req.body.requestedBy);
        logger.info("Block current song api");
        res.status(200).json(successRes(response, "Successfully blocked current song"));
    } catch (error) {
        res.status(400).json(errorRes({ error: error.message }, "Error blocking current song"));
    }
};

export const blockSongBySongName = async (req, res) => {
    try {
        if (!req.body.songName) {
            throw new Error("Song name is required");
        }
        const response = await service.blockSongBySongName(req.body.songName, req.body.requestedBy);
        res.status(200).json(successRes(response, "Successfully blocked song"));
    } catch (error) {
        res.status(400).json(errorRes({ message: error.message }, "Error blocking song"));
    }
};

export const unblockSongBySongName = async (req, res) => {
    try {
        if (!req.params.songName) {
            throw new Error("Song name is required");
        }
        const response = await service.unblockSongBySongName(req.params.songName);
        res.status(200).json(successRes(response, "Successfully unblocked song"));
    } catch (error) {
        res.status(400).json(errorRes({ message: error.message }, "Error unblocking song"));
    }
};

export const unblockSongByIndex = async (req, res) => {
    try {
        if (req.params.index === undefined) {
            throw new Error("Index is required");
        }
        const response = await service.unblockSongByIndex(parseInt(req.params.index));
        res.status(200).json(successRes(response, "Successfully unblocked song"));
    } catch (error) {
        res.status(400).json(errorRes({ message: error.message }, "Error unblocking song"));
    }
};

export const clearBlockList = async (req, res) => {
    try {
        const response = await service.clearBlockList();
        logger.info("Clear block list api");
        res.status(200).json(successRes(response, "Successfully cleared block list"));
    } catch (error) {
        res.status(400).json(errorRes({ message: error.message }, "Error clearing block list"));
    }
};

export const getAllBlockList = async (req, res) => {
    try {
        const response = await service.getAllBlockList();
        logger.info("Get all block list api");
        res.status(200).json(successRes(response, "Successfully fetched block list"));
    } catch (error) {
        res.status(400).json(errorRes({ message: error.message }, "Error fetching block list"));
    }
};

export const isSongBlocked = async (req, res) => {
    try {
        if (!req.query.songName) {
            throw new Error("Song name is required");
        }
        const response = await service.isSongBlocked(req.query.songName);
        res.status(200).json(successRes({ isBlocked: response }, "Successfully checked song block status"));
    } catch (error) {
        res.status(400).json(errorRes({ message: error.message }, "Error checking song block status"));
    }
};