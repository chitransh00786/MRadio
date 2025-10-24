import asyncio
from fastapi import FastAPI
from fastapi.responses import StreamingResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
import socketio
import uvicorn
from app.core import logger
from app.core.config import config
from app.core.constants import DEFAULT_TRACKS_LOCATION
from app.streaming.queue import queue
from app.streaming.socket_manager import socket_manager
from app.api.routes import router
from app.services.initializer import Initializer
from app.services.api_service import Service

PORT = 5000

app = FastAPI(title="MRadio", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sio = socket_manager.initialize(app, queue)

socket_app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=app,
    socketio_path='/socket.io'
)

api_service = Service()
api_service.set_queue(queue)


@app.on_event("startup")
async def startup_event():
    logger.info("Starting MRadio server...")
    
    await Initializer.init()
    
    icecast_config = {
        'host': config.ICECAST_HOST,
        'port': config.ICECAST_PORT,
        'password': config.ICECAST_PASSWORD,
        'mount': config.ICECAST_MOUNT,
        'name': config.ICECAST_NAME,
        'description': config.ICECAST_DESCRIPTION,
        'genre': config.ICECAST_GENRE,
        'bitrate': config.ICECAST_BITRATE
    }
    
    if icecast_config['host'] and icecast_config['port'] and icecast_config['password']:
        icecast_initialized = queue.initialize_icecast(icecast_config)
        if icecast_initialized:
            logger.info('Icecast streaming enabled')
            logger.info(f"Stream will be available at: http://{icecast_config['host']}:{icecast_config['port']}{icecast_config['mount']}")
        else:
            logger.warn('Failed to initialize Icecast streaming, falling back to direct HTTP streaming')
    else:
        logger.info('Icecast configuration not found in .env, using direct HTTP streaming only')
    
    await queue.load_tracks(DEFAULT_TRACKS_LOCATION)
    
    asyncio.create_task(queue.play())
    
    logger.info(f"MRadio server started on port {PORT}")
    if queue.use_icecast:
        logger.info(f"Icecast stream available at: http://{icecast_config['host']}:{icecast_config['port']}{icecast_config['mount']}")
    logger.info(f"Direct HTTP stream available at: http://localhost:{PORT}/stream")


@app.get("/")
async def root():
    return RedirectResponse(url="/stream")


async def stream_generator(client_buffer):
    try:
        while True:
            await asyncio.sleep(0.1)
            
            data = client_buffer.getvalue()
            if data:
                yield data
                client_buffer.seek(0)
                client_buffer.truncate()
    except Exception as e:
        logger.error(f"Stream generator error: {e}")


@app.get("/stream")
async def stream():
    client_info = queue.add_client()
    client_id = client_info['id']
    client_buffer = client_info['client']
    
    async def stream_with_cleanup():
        try:
            async for chunk in stream_generator(client_buffer):
                yield chunk
        finally:
            queue.remove_client(client_id)
    
    return StreamingResponse(
        stream_with_cleanup(),
        media_type="audio/mp3",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Transfer-Encoding": "chunked"
        }
    )


@app.get("/api/icecast/status")
async def icecast_status():
    status = queue.get_icecast_status()
    return status


app.include_router(router, prefix="/api")


if __name__ == "__main__":
    uvicorn.run(
        socket_app,
        host="0.0.0.0",
        port=PORT,
        log_level="info",
        access_log=True
    )
