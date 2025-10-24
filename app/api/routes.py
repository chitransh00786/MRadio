from fastapi import APIRouter, HTTPException, Header, Depends, Request
from typing import Optional
from pydantic import BaseModel
from app.core import logger
from app.core.config import config
from app.managers.token_manager import TokenManager
from app.services.api_service import Service

router = APIRouter()
service = Service()


class AddSongRequest(BaseModel):
    songName: str
    requestedBy: Optional[str] = "anonymous"
    force: Optional[bool] = False
    preference: Optional[str] = None


class AddPlaylistRequest(BaseModel):
    playlistId: str
    source: Optional[str] = "youtube"
    requestedBy: Optional[str] = "anonymous"


class BlockSongRequest(BaseModel):
    songName: str


class DefaultPlaylistRequest(BaseModel):
    playlistId: str
    title: str
    source: Optional[str] = "youtube"
    isActive: Optional[bool] = True
    genre: Optional[str] = "mix"


class UpdatePlaylistStatusRequest(BaseModel):
    isActive: bool


class ConfigRequest(BaseModel):
    key: str
    value: str


class TokenRequest(BaseModel):
    username: str


def success_response(data, message: str):
    return {
        "success": True,
        "message": message,
        "data": data
    }


def error_response(data, message: str):
    return {
        "success": False,
        "message": message,
        "error": data
    }


async def verify_token(x_token_key: Optional[str] = Header(None)):
    if not x_token_key:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token_manager = TokenManager()
    if not token_manager.is_token_exist(x_token_key):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    return x_token_key


async def verify_admin(
    x_admin_token_key: Optional[str] = Header(None),
    x_admin_api_key: Optional[str] = Header(None)
):
    if not x_admin_token_key or not x_admin_api_key:
        raise HTTPException(status_code=401, detail="Unauthorized: Admin Access Required!")
    
    admin_token_key = config.X_ADMIN_TOKEN_KEY
    admin_api_key = config.X_ADMIN_API_KEY
    
    if not admin_token_key or not admin_api_key:
        raise HTTPException(status_code=500, detail="Internal Server Error")
    
    if admin_api_key != x_admin_api_key or admin_token_key != x_admin_token_key:
        raise HTTPException(status_code=401, detail="Unauthorized: You have no admin Access.")
    
    return True


@router.post("/songs/add")
async def add_song_to_queue(request: AddSongRequest):
    try:
        if not request.songName:
            raise HTTPException(status_code=400, detail="Invalid song name")
        
        response = await service.add_song_to_queue(
            request.songName,
            request.requestedBy,
            request.force,
            request.preference
        )
        
        return success_response(response, "Successfully Added song to the queue")
    
    except Exception as error:
        logger.error(f"Error in Adding Song to Queue API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/songs/queue")
async def get_queue_list():
    try:
        response = await service.get_queue_list()
        return success_response(response, "Successfully Fetched Queue List")
    
    except Exception as error:
        logger.error(f"Error in Get Song Queue List API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/songs/current")
async def get_current_song():
    try:
        response = await service.get_current_song()
        return success_response(response, "Current Song")
    
    except Exception as error:
        logger.error(f"Error in get Current Song API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/songs/upcoming")
async def get_upcoming_song():
    try:
        response = await service.get_upcoming_song()
        logger.info("Upcoming Song api")
        return success_response(response, "Successfully Fetched upcoming Song")
    
    except Exception as error:
        logger.error(f"Error in Get Upcoming Song API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/songs/skip", dependencies=[Depends(verify_token)])
async def skip():
    try:
        await service.skip()
        return success_response({"skip": True}, "\nSkip Successful\nPlaying next song...")
    
    except Exception as error:
        logger.error(f"Error in skip API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/songs/seek/{seconds}", dependencies=[Depends(verify_token)])
async def seek_song(seconds: int):
    try:
        if seconds is None or seconds < 0:
            raise HTTPException(status_code=400, detail="Invalid seek time")
        
        response = await service.seek_song(seconds)
        return success_response(response, "Seek Song")
    
    except Exception as error:
        logger.error(f"Error in Seeking Song API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/songs/previous", dependencies=[Depends(verify_token)])
async def previous_song():
    try:
        response = await service.previous()
        return success_response(response, "Previous Song")
    
    except Exception as error:
        logger.error(f"Error in Previous Song API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/songs/add/top", dependencies=[Depends(verify_token)])
async def add_song_to_top(request: AddSongRequest):
    try:
        if not request.songName:
            raise HTTPException(status_code=400, detail="Invalid song name")
        
        response = await service.add_song_to_top(
            request.songName,
            request.requestedBy,
            request.force,
            request.preference
        )
        
        return success_response(response, "Successfully Added song to top of the queue")
    
    except Exception as error:
        logger.error(f"Error in Adding Song to Top API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.delete("/songs/requests/last/{requested_by}", dependencies=[Depends(verify_token)])
async def remove_last_song_requested_by_user(requested_by: str):
    try:
        response = await service.remove_last_song_requested_by_user(requested_by)
        return success_response(response, "Successfully Removed last song requested by user")
    
    except Exception as error:
        logger.error(f"Error in Removing Last Song Requested By User API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.delete("/songs/remove/{index}", dependencies=[Depends(verify_token)])
async def remove_song_from_queue(index: int):
    try:
        response = await service.remove_from_queue({"index": index})
        return success_response(response, "Successfully Removed song from the queue")
    
    except Exception as error:
        logger.error(f"Error in Removing Song from Queue API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/playlist/add", dependencies=[Depends(verify_token)])
async def add_playlist_to_queue(request: AddPlaylistRequest):
    try:
        if not request.playlistId:
            raise HTTPException(status_code=400, detail="Invalid playlist Id")
        
        response = await service.add_playlist_to_queue(
            request.playlistId,
            request.source,
            request.requestedBy
        )
        
        return success_response(response, f"Successfully Added {response['total']} songs to the queue")
    
    except Exception as error:
        logger.error(f"Error in Adding Playlist to Queue API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/playlist/add/top", dependencies=[Depends(verify_token)])
async def add_playlist_to_top(request: AddPlaylistRequest):
    try:
        if not request.playlistId:
            raise HTTPException(status_code=400, detail="Invalid playlist Id")
        
        response = await service.add_playlist_to_top(
            request.playlistId,
            request.source,
            request.requestedBy
        )
        
        return success_response(response, f"Successfully Added {response['total']} songs to top of the queue")
    
    except Exception as error:
        logger.error(f"Error in Adding Playlist to Top API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/playlist/default", dependencies=[Depends(verify_token)])
async def add_default_playlists(request: DefaultPlaylistRequest):
    try:
        response = await service.add_default_playlist({
            "playlistId": request.playlistId,
            "title": request.title,
            "source": request.source,
            "isActive": request.isActive,
            "genre": request.genre
        })
        
        return success_response(response, "Successfully Added default playlist")
    
    except Exception as error:
        logger.error(f"Error in Adding Default Playlist API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/playlist/default", dependencies=[Depends(verify_token)])
async def get_default_playlist():
    try:
        response = await service.get_default_playlist()
        return success_response(response, "Successfully Fetched default playlists")
    
    except Exception as error:
        logger.error(f"Error in Get Default Playlist API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.delete("/playlist/default/{index}", dependencies=[Depends(verify_token)])
async def remove_default_playlist(index: int):
    try:
        response = await service.remove_default_playlist(index)
        return success_response(response, "Successfully Removed default playlist")
    
    except Exception as error:
        logger.error(f"Error in Removing Default Playlist API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.put("/playlist/default/{index}/status", dependencies=[Depends(verify_token)])
async def update_playlist_status(index: int, request: UpdatePlaylistStatusRequest):
    try:
        response = await service.update_playlist_status(index, request.isActive)
        return success_response(response, "Successfully Updated playlist status")
    
    except Exception as error:
        logger.error(f"Error in Updating Playlist Status API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/songs/block/current", dependencies=[Depends(verify_token)])
async def block_current_song():
    try:
        response = await service.block_current_song()
        return success_response(response, "Successfully Blocked current song")
    
    except Exception as error:
        logger.error(f"Error in Blocking Current Song API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/songs/block", dependencies=[Depends(verify_token)])
async def block_song_by_song_name(request: BlockSongRequest):
    try:
        if not request.songName:
            raise HTTPException(status_code=400, detail="Invalid song name")
        
        response = await service.block_song_by_song_name(request.songName)
        return success_response(response, "Successfully Blocked song")
    
    except Exception as error:
        logger.error(f"Error in Blocking Song API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.delete("/songs/block/{song_name}", dependencies=[Depends(verify_token)])
async def unblock_song_by_song_name(song_name: str):
    try:
        response = await service.unblock_song_by_song_name(song_name)
        return success_response(response, "Successfully Unblocked song")
    
    except Exception as error:
        logger.error(f"Error in Unblocking Song API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.delete("/songs/block/all", dependencies=[Depends(verify_token)])
async def clear_block_list():
    try:
        response = await service.clear_block_list()
        return success_response(response, "Successfully Cleared block list")
    
    except Exception as error:
        logger.error(f"Error in Clearing Block List API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.delete("/songs/block/{index}", dependencies=[Depends(verify_token)])
async def unblock_song_by_index(index: int):
    try:
        response = await service.unblock_song_by_index(index)
        return success_response(response, "Successfully Unblocked song")
    
    except Exception as error:
        logger.error(f"Error in Unblocking Song by Index API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/songs/block/list", dependencies=[Depends(verify_token)])
async def get_all_block_list():
    try:
        response = await service.get_all_block_list()
        return success_response(response, "Successfully Fetched block list")
    
    except Exception as error:
        logger.error(f"Error in Get Block List API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/songs/block/check", dependencies=[Depends(verify_token)])
async def is_song_blocked(songName: Optional[str] = None):
    try:
        if not songName:
            raise HTTPException(status_code=400, detail="Invalid song name")
        
        response = await service.is_song_blocked(songName)
        return success_response({"blocked": response}, "Song block status")
    
    except Exception as error:
        logger.error(f"Error in Checking Song Block Status API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/config", dependencies=[Depends(verify_token)])
async def get_common_config():
    try:
        response = await service.get_common_config()
        return success_response(response, "Successfully Fetched config")
    
    except Exception as error:
        logger.error(f"Error in Get Config API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/config", dependencies=[Depends(verify_token)])
async def create_config_or_update_common_config(request: ConfigRequest):
    try:
        response = await service.create_or_update_common_config(request.key, request.value)
        return success_response(response, "Successfully Updated config")
    
    except Exception as error:
        logger.error(f"Error in Update Config API: {error}")
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/admin/token", dependencies=[Depends(verify_admin)])
async def generate_token(request: TokenRequest):
    try:
        if not request.username:
            raise HTTPException(status_code=400, detail="Invalid username")
        
        response = await service.generate_token(request.username)
        return success_response(response, "Successfully Generated token")
    
    except Exception as error:
        logger.error(f"Error in Generate Token API: {error}")
        raise HTTPException(status_code=400, detail=str(error))
