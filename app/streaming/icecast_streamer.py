import asyncio
import subprocess
from app.core import logger
from app.core.utils import get_ffmpeg_path

class IcecastStreamer:
    def __init__(self, config: dict):
        self.config = {
            'host': config.get('host'),
            'port': config.get('port'),
            'password': config.get('password'),
            'mount': config.get('mount', '/radio.mp3'),
            'name': config.get('name', 'MRadio'),
            'description': config.get('description', 'MRadio Stream'),
            'genre': config.get('genre', 'Various'),
            'bitrate': config.get('bitrate', '128'),
            'sampleRate': config.get('sampleRate', '44100'),
            'channels': config.get('channels', '2')
        }
        
        self.ffmpeg_process = None
        self.is_connected = False
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        self.reconnect_delay = 5
        self.reconnect_timer = None
        self.is_reconnecting = False
        self.buffer = []
        self.buffer_size = 0
        self.max_buffer_size = 1024 * 1024
        self.connection_promise = None
    
    async def connect(self):
        if self.connection_promise:
            return await self.connection_promise
        
        if self.is_connected:
            logger.info('Already connected to Icecast server')
            return
        
        if self.is_reconnecting:
            logger.info('Already attempting to reconnect to Icecast server')
            return
        
        icecast_url = f"icecast://source:{self.config['password']}@{self.config['host']}:{self.config['port']}{self.config['mount']}"
        
        logger.info(f"Connecting to Icecast server at {self.config['host']}:{self.config['port']}{self.config['mount']}")
        
        ffmpeg_args = [
            get_ffmpeg_path(),
            '-hide_banner',
            '-loglevel', 'warning',
            '-f', 'mp3',
            '-i', 'pipe:0',
            '-err_detect', 'ignore_err',
            '-fflags', '+genpts+discardcorrupt',
            '-max_error_rate', '1.0',
            '-acodec', 'libmp3lame',
            '-ab', f"{self.config['bitrate']}k",
            '-ar', self.config['sampleRate'],
            '-ac', self.config['channels'],
            '-metadata', f"title={self.config['name']}",
            '-metadata', f"artist={self.config['description']}",
            '-metadata', f"genre={self.config['genre']}",
            '-f', 'mp3',
            '-content_type', 'audio/mpeg',
            '-ice_name', self.config['name'],
            '-ice_description', self.config['description'],
            '-ice_genre', self.config['genre'],
            '-ice_public', '1',
            icecast_url
        ]
        
        try:
            self.ffmpeg_process = subprocess.Popen(
                ffmpeg_args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            self.flush_buffer()
            
            await asyncio.sleep(2)
            
            if self.ffmpeg_process and self.ffmpeg_process.poll() is None:
                self.is_connected = True
                self.is_reconnecting = False
                self.reconnect_attempts = 0
                logger.info('FFmpeg Icecast streaming initialized')
            
        except Exception as error:
            logger.error(f'FFmpeg process error: {str(error)}')
            if not self.is_reconnecting:
                await self.handle_connection_error()
    
    async def handle_connection_error(self):
        if self.is_reconnecting:
            return
        
        self.is_connected = False
        
        if self.reconnect_attempts < self.max_reconnect_attempts:
            await self.schedule_reconnect()
        else:
            logger.error('Max reconnection attempts reached for Icecast')
    
    async def schedule_reconnect(self):
        if self.is_reconnecting:
            return
        
        self.is_reconnecting = True
        self.reconnect_attempts += 1
        delay = min(self.reconnect_delay * self.reconnect_attempts, 30)
        
        logger.info(f"Scheduling Icecast reconnection attempt {self.reconnect_attempts}/{self.max_reconnect_attempts} in {delay}s")
        
        await asyncio.sleep(delay)
        
        self.is_reconnecting = False
        self.cleanup()
        
        try:
            await self.connect()
        except Exception as err:
            logger.error(f'Icecast reconnection failed: {str(err)}')
            self.is_reconnecting = False
    
    def flush_buffer(self):
        if len(self.buffer) > 0 and self.ffmpeg_process and self.ffmpeg_process.stdin:
            try:
                for chunk in self.buffer:
                    self.ffmpeg_process.stdin.write(chunk)
                self.ffmpeg_process.stdin.flush()
                self.buffer = []
                self.buffer_size = 0
                logger.debug('Flushed audio buffer to stream')
            except Exception as error:
                logger.error(f'Error flushing buffer: {str(error)}')
    
    def write(self, chunk: bytes):
        if not chunk or len(chunk) == 0:
            return
        
        if self.is_connected and self.ffmpeg_process and self.ffmpeg_process.stdin:
            try:
                if len(self.buffer) > 0:
                    self.flush_buffer()
                
                self.ffmpeg_process.stdin.write(chunk)
                self.ffmpeg_process.stdin.flush()
            except Exception as error:
                logger.error(f'Error writing to Icecast stream: {str(error)}')
                self.add_to_buffer(chunk)
                if not self.is_reconnecting:
                    asyncio.create_task(self.handle_connection_error())
        else:
            self.add_to_buffer(chunk)
            
            if not self.is_connected and not self.is_reconnecting and self.reconnect_attempts == 0:
                asyncio.create_task(self.connect())
    
    def add_to_buffer(self, chunk: bytes):
        if self.buffer_size + len(chunk) <= self.max_buffer_size:
            self.buffer.append(chunk)
            self.buffer_size += len(chunk)
        else:
            while self.buffer_size + len(chunk) > self.max_buffer_size and len(self.buffer) > 0:
                removed = self.buffer.pop(0)
                self.buffer_size -= len(removed)
            self.buffer.append(chunk)
            self.buffer_size += len(chunk)
    
    def cleanup(self):
        if self.ffmpeg_process:
            try:
                if self.ffmpeg_process.stdin:
                    self.ffmpeg_process.stdin.close()
                self.ffmpeg_process.terminate()
                self.ffmpeg_process.wait(timeout=5)
            except Exception as error:
                logger.debug(f'Error cleaning up FFmpeg process: {str(error)}')
            self.ffmpeg_process = None
    
    def disconnect(self):
        if self.reconnect_timer:
            self.reconnect_timer = None
        
        self.cleanup()
        
        self.is_connected = False
        self.is_reconnecting = False
        self.reconnect_attempts = 0
        self.buffer = []
        self.buffer_size = 0
        
        logger.info('Disconnected from Icecast server')
    
    def get_status(self):
        return {
            'connected': self.is_connected,
            'reconnecting': self.is_reconnecting,
            'reconnectAttempts': self.reconnect_attempts,
            'bufferSize': self.buffer_size,
            'config': {
                'host': self.config['host'],
                'port': self.config['port'],
                'mount': self.config['mount'],
                'name': self.config['name']
            }
        }
