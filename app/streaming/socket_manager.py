import socketio
import asyncio
from typing import Optional
from app.core import logger

sio_server: Optional[socketio.AsyncServer] = None

class SocketManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.heartbeat_interval = 30
            cls._instance.heartbeat_timeout = 5
            cls._instance.connected_clients = {}
            cls._instance.buffer_header = None
            cls._instance.queue = None
        return cls._instance
    
    def initialize(self, app, queue_instance):
        global sio_server
        
        if sio_server is None:
            sio_server = socketio.AsyncServer(
                async_mode='asgi',
                cors_allowed_origins='*',
                logger=False,
                engineio_logger=False
            )
            self.queue = queue_instance
            self._setup_socket_events()
        
        return sio_server
    
    def _setup_socket_events(self):
        global sio_server
        
        @sio_server.event
        async def connect(sid, environ):
            logger.info(f'Client connected: {sid}')
            self.connected_clients[sid] = {
                'lastHeartbeat': asyncio.get_event_loop().time(),
                'isAlive': True
            }
            
            asyncio.create_task(self._heartbeat_checker(sid))
            
            if self.queue and self.queue.buffer_header:
                await sio_server.emit('bufferHeader', self.queue.buffer_header, room=sid)
        
        @sio_server.event
        async def disconnect(sid):
            logger.info(f'Client disconnected: {sid}')
            if sid in self.connected_clients:
                del self.connected_clients[sid]
        
        @sio_server.event
        async def pong(sid):
            if sid in self.connected_clients:
                self.connected_clients[sid]['lastHeartbeat'] = asyncio.get_event_loop().time()
                self.connected_clients[sid]['isAlive'] = True
        
        @sio_server.event
        async def ping(sid):
            await sio_server.emit('pong', room=sid)
        
        @sio_server.event
        async def bufferHeader(sid, header):
            if self.queue:
                self.queue.buffer_header = header
            await sio_server.emit('bufferHeader', header, skip_sid=sid)
        
        @sio_server.event
        async def stream(sid, packet):
            if self.queue and self.queue.buffer_header:
                await sio_server.emit('stream', packet, skip_sid=sid)
    
    async def _heartbeat_checker(self, sid):
        while sid in self.connected_clients:
            await asyncio.sleep(self.heartbeat_interval)
            
            if sid not in self.connected_clients:
                break
            
            client = self.connected_clients[sid]
            
            if not client['isAlive']:
                logger.info(f'Client unresponsive, terminating: {sid}')
                await sio_server.disconnect(sid)
                if sid in self.connected_clients:
                    del self.connected_clients[sid]
                break
            
            client['isAlive'] = False
            await sio_server.emit('ping', room=sid)
    
    def get_io(self):
        global sio_server
        if sio_server is None:
            raise Exception('Socket.io not initialized. Call initialize() first.')
        return sio_server
    
    def get_connected_clients(self):
        return list(self.connected_clients.keys())
    
    def is_client_connected(self, socket_id):
        return socket_id in self.connected_clients
    
    async def emit(self, event, data):
        global sio_server
        if sio_server is None:
            raise Exception('Socket.io not initialized. Call initialize() first.')
        await sio_server.emit(event, data)
    
    async def emit_to_client(self, socket_id, event, data):
        global sio_server
        if sio_server is None:
            raise Exception('Socket.io not initialized. Call initialize() first.')
        await sio_server.emit(event, data, room=socket_id)
    
    async def broadcast(self, socket_id, event, data):
        global sio_server
        if sio_server is None:
            raise Exception('Socket.io not initialized. Call initialize() first.')
        await sio_server.emit(event, data, skip_sid=socket_id)

socket_manager = SocketManager()
