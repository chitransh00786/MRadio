import asyncio
import subprocess
import os
from typing import Dict, Optional, List
from io import BytesIO
import uuid
from datetime import datetime
from app.core import logger
from app.core.utils import get_ffmpeg_path, duration_formatter
from app.core.constants import DEFAULT_QUEUE_SIZE, DEFAULT_TRACKS_LOCATION
from app.streaming.cache_manager import cache_manager
from app.streaming.icecast_streamer import IcecastStreamer
from app.streaming.silence_generator import SilenceGenerator
from app.services.next_track_fetcher import fetch_next_track
from app.streaming.socket_manager import socket_manager


class PassThrough:
    def __init__(self):
        self.readers = []
        self.closed = False
    
    def add_reader(self):
        reader = BytesIO()
        self.readers.append(reader)
        return reader
    
    def write(self, data):
        if not self.closed:
            for reader in self.readers:
                try:
                    reader.write(data)
                except:
                    pass
    
    def remove_reader(self, reader):
        if reader in self.readers:
            self.readers.remove(reader)
    
    def close(self):
        self.closed = True
        self.readers = []


class Queue:
    def __init__(self):
        self.tracks: List[Dict] = []
        self.index = 0
        self.clients: Dict[str, any] = {}
        self.current_track: Optional[Dict] = None
        self.playing = False
        self.stream = None
        self.throttle = None
        self.ffmpeg_process: Optional[subprocess.Popen] = None
        self.is_downloading = False
        self.min_queue_size = DEFAULT_QUEUE_SIZE
        self.previous_track: Optional[Dict] = None
        self.start_time: Optional[float] = None
        self.progress_interval = None
        self.icecast_streamer: Optional[IcecastStreamer] = None
        self.use_icecast = False
        self.is_transitioning = False
        self.buffer_header = None
        self.silence_generator = SilenceGenerator()
    
    def initialize_icecast(self, config: dict) -> bool:
        if not config or not config.get('host') or not config.get('port') or not config.get('password'):
            logger.error('Invalid Icecast configuration')
            return False
        
        try:
            self.icecast_streamer = IcecastStreamer(config)
            self.use_icecast = True
            
            asyncio.create_task(self._connect_icecast())
            
            return True
        except Exception as error:
            logger.error(f'Failed to initialize Icecast streamer: {error}')
            self.use_icecast = False
            return False
    
    async def _connect_icecast(self):
        try:
            await self.icecast_streamer.connect()
            logger.info('Successfully initialized Icecast streaming')
        except Exception as err:
            logger.error(f'Failed to connect to Icecast on initialization: {err}')
    
    async def previous(self):
        if not self.previous_track or self.is_transitioning:
            logger.info("No previous track available")
            return
        
        self.is_transitioning = True
        
        try:
            self.playing = False
            logger.info(f"Going to previous track: {self.previous_track.get('title', 'Unknown')}")
            
            await self.cleanup_current_stream()
            
            if self.previous_track.get('url'):
                if self.previous_track['url'].startswith(f"{DEFAULT_TRACKS_LOCATION}/"):
                    cached_path = cache_manager.get_from_cache(self.previous_track.get('title'))
                    if cached_path:
                        self.previous_track['url'] = cached_path
                    else:
                        logger.info(f"Previous track {self.previous_track.get('title', 'Unknown')} not found in cache")
                        return
            else:
                logger.info("Previous track URL is missing")
                return
            
            temp = self.current_track
            self.current_track = self.previous_track
            self.previous_track = temp
            
            self.playing = True
            await self.play(False)
        
        except Exception as error:
            logger.error(f'Error during previous: {error}')
            self.playing = False
        finally:
            self.is_transitioning = False
    
    async def ensure_queue_size(self):
        if self.is_downloading:
            return
        
        self.is_downloading = True
        
        try:
            while len(self.tracks) < self.min_queue_size:
                song = await fetch_next_track()
                if len(self.tracks) < self.min_queue_size:
                    song_bitrate = await self.get_track_bitrate(song['url'])
                    self.tracks.append({
                        'url': song['url'],
                        'bitrate': song_bitrate,
                        'title': song['title'],
                        'duration': duration_formatter(song.get('duration', 0)),
                        'requestedBy': song.get('requestedBy', 'anonymous')
                    })
                    logger.info(f"Added track: {song['title']}")
        finally:
            self.is_downloading = False
    
    async def get_track_bitrate(self, file_path: str) -> int:
        try:
            if not os.path.exists(file_path):
                logger.warn(f"File not found for bitrate detection: {file_path}")
                return 128000
            
            process = await asyncio.create_subprocess_exec(
                get_ffmpeg_path(),
                '-i', file_path,
                '-f', 'null',
                '-',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            _, stderr = await process.communicate()
            stderr_text = stderr.decode('utf-8')
            
            for line in stderr_text.split('\n'):
                if 'Audio:' in line and 'kb/s' in line:
                    parts = line.split('kb/s')
                    if len(parts) > 0:
                        bitrate_part = parts[0].split()[-1]
                        try:
                            bitrate = int(bitrate_part) * 1000
                            logger.info(f"Detected bitrate: {bitrate}")
                            return bitrate
                        except:
                            pass
            
            logger.warn(f"Could not detect bitrate for {file_path}, using default 128kbps")
            return 128000
        
        except Exception as error:
            logger.error(f"Error detecting bitrate: {error}")
            return 128000
    
    async def load_tracks(self, directory: str):
        try:
            if not os.path.exists(directory):
                logger.warn(f"Directory not found: {directory}")
                return
            
            files = [f for f in os.listdir(directory) if f.endswith('.mp3')]
            
            for file in files:
                file_path = os.path.join(directory, file)
                bitrate = await self.get_track_bitrate(file_path)
                
                self.tracks.append({
                    'url': file_path,
                    'bitrate': bitrate,
                    'title': file.replace('.mp3', ''),
                    'duration': '00:00',
                    'requestedBy': 'system'
                })
            
            logger.info(f"Loaded {len(files)} tracks from {directory}")
        except Exception as error:
            logger.error(f"Error loading tracks: {error}")
    
    async def play(self, advance: bool = True):
        await self.ensure_queue_size()
        
        if not self.tracks:
            logger.warn("No tracks available")
            await self.play_silence()
            return
        
        if advance:
            self.previous_track = self.current_track
            self.index = (self.index + 1) % len(self.tracks)
        
        self.current_track = self.tracks[self.index]
        logger.info(f"Now playing: {self.current_track.get('title', 'Unknown')}")
        
        await socket_manager.emit('trackChanged', {
            'title': self.current_track.get('title', 'Unknown'),
            'duration': self.current_track.get('duration', '00:00'),
            'requestedBy': self.current_track.get('requestedBy', 'anonymous')
        })
        
        await self.cleanup_current_stream()
        
        self.stream = PassThrough()
        self.playing = True
        self.start_time = asyncio.get_event_loop().time()
        
        self.start_progress_update()
        
        await self.stream_audio()
    
    async def play_silence(self):
        logger.info("Playing silence...")
        
        await socket_manager.emit('trackChanged', {
            'title': 'Silence',
            'duration': '00:00',
            'requestedBy': 'system'
        })
        
        await self.cleanup_current_stream()
        
        self.stream = PassThrough()
        self.playing = True
        
        silence_stream = self.silence_generator.generate_silence()
        
        ffmpeg_args = [
            get_ffmpeg_path(),
            '-f', 's16le',
            '-ar', '44100',
            '-ac', '2',
            '-i', 'pipe:0',
            '-f', 'mp3',
            '-ab', '128k',
            '-'
        ]
        
        self.ffmpeg_process = subprocess.Popen(
            ffmpeg_args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        asyncio.create_task(self._stream_silence(silence_stream))
    
    async def _stream_silence(self, silence_stream):
        try:
            loop = asyncio.get_event_loop()
            
            async def write_silence():
                for chunk in silence_stream:
                    if not self.playing or not self.ffmpeg_process:
                        break
                    try:
                        self.ffmpeg_process.stdin.write(chunk)
                        await asyncio.sleep(0.01)
                    except:
                        break
            
            async def read_output():
                while self.playing and self.ffmpeg_process:
                    try:
                        chunk = await loop.run_in_executor(
                            None,
                            self.ffmpeg_process.stdout.read,
                            4096
                        )
                        if not chunk:
                            break
                        
                        self.stream.write(chunk)
                        
                        if self.use_icecast and self.icecast_streamer:
                            self.icecast_streamer.write(chunk)
                        
                        for client in self.clients.values():
                            try:
                                await client.write(chunk)
                            except:
                                pass
                        
                        await socket_manager.emit('stream', chunk)
                    except:
                        break
            
            await asyncio.gather(write_silence(), read_output())
        
        except Exception as error:
            logger.error(f"Error streaming silence: {error}")
    
    async def stream_audio(self):
        file_path = self.current_track.get('url')
        
        if not os.path.exists(file_path):
            logger.error(f"Track file not found: {file_path}")
            await self.skip()
            return
        
        bitrate = self.current_track.get('bitrate', 128000)
        
        ffmpeg_args = [
            get_ffmpeg_path(),
            '-re',
            '-i', file_path,
            '-f', 'mp3',
            '-ab', f"{bitrate // 1000}k",
            '-'
        ]
        
        try:
            self.ffmpeg_process = subprocess.Popen(
                ffmpeg_args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            asyncio.create_task(self._read_ffmpeg_output())
        
        except Exception as error:
            logger.error(f"Error starting FFmpeg: {error}")
            await self.skip()
    
    async def _read_ffmpeg_output(self):
        try:
            loop = asyncio.get_event_loop()
            
            while self.playing and self.ffmpeg_process:
                try:
                    chunk = await loop.run_in_executor(
                        None,
                        self.ffmpeg_process.stdout.read,
                        4096
                    )
                    
                    if not chunk:
                        logger.info("Track finished playing")
                        await self.skip()
                        break
                    
                    self.stream.write(chunk)
                    
                    if self.use_icecast and self.icecast_streamer:
                        self.icecast_streamer.write(chunk)
                    
                    for client in self.clients.values():
                        try:
                            await client.write(chunk)
                        except:
                            pass
                    
                    await socket_manager.emit('stream', chunk)
                
                except Exception as error:
                    if self.playing:
                        logger.error(f"Error reading FFmpeg output: {error}")
                    break
        
        except Exception as error:
            logger.error(f"Fatal error in FFmpeg output reader: {error}")
    
    async def skip(self):
        if self.is_transitioning:
            logger.info("Already transitioning")
            return
        
        self.is_transitioning = True
        
        try:
            logger.info("Skipping track")
            self.playing = False
            
            await self.cleanup_current_stream()
            
            self.playing = True
            await self.play()
        
        except Exception as error:
            logger.error(f"Error during skip: {error}")
            self.playing = False
        finally:
            self.is_transitioning = False
    
    async def seek(self, seconds: int):
        logger.info(f"Seeking to {seconds} seconds")
        
        if not self.current_track:
            logger.warn("No current track to seek")
            return
        
        file_path = self.current_track.get('url')
        
        if not os.path.exists(file_path):
            logger.error(f"Track file not found: {file_path}")
            return
        
        await self.cleanup_current_stream()
        
        self.stream = PassThrough()
        self.playing = True
        self.start_time = asyncio.get_event_loop().time() - seconds
        
        bitrate = self.current_track.get('bitrate', 128000)
        
        ffmpeg_args = [
            get_ffmpeg_path(),
            '-ss', str(seconds),
            '-i', file_path,
            '-f', 'mp3',
            '-ab', f"{bitrate // 1000}k",
            '-'
        ]
        
        try:
            self.ffmpeg_process = subprocess.Popen(
                ffmpeg_args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            asyncio.create_task(self._read_ffmpeg_output())
        
        except Exception as error:
            logger.error(f"Error seeking: {error}")
    
    async def cleanup_current_stream(self):
        self.stop_progress_update()
        
        if self.ffmpeg_process:
            try:
                self.ffmpeg_process.terminate()
                self.ffmpeg_process.wait(timeout=2)
            except:
                try:
                    self.ffmpeg_process.kill()
                except:
                    pass
            self.ffmpeg_process = None
        
        if self.stream:
            self.stream.close()
            self.stream = None
    
    def start_progress_update(self):
        self.stop_progress_update()
        
        async def update_progress():
            while self.playing and self.current_track:
                await asyncio.sleep(5)
                
                if self.start_time:
                    elapsed = int(asyncio.get_event_loop().time() - self.start_time)
                    await socket_manager.emit('progress', {
                        'title': self.current_track.get('title', 'Unknown'),
                        'elapsed': elapsed
                    })
        
        self.progress_interval = asyncio.create_task(update_progress())
    
    def stop_progress_update(self):
        if self.progress_interval:
            self.progress_interval.cancel()
            self.progress_interval = None
    
    def add_client(self):
        client_id = str(uuid.uuid4())
        stream_buffer = BytesIO()
        
        self.clients[client_id] = stream_buffer
        logger.info(f"Client connected: {client_id}, Total: {len(self.clients)}")
        
        return {'id': client_id, 'client': stream_buffer}
    
    def remove_client(self, client_id: str):
        if client_id in self.clients:
            del self.clients[client_id]
            logger.info(f"Client disconnected: {client_id}, Remaining: {len(self.clients)}")
    
    def get_icecast_status(self):
        if not self.use_icecast:
            return {
                'enabled': False,
                'connected': False,
                'message': 'Icecast not configured'
            }
        
        return {
            'enabled': True,
            'connected': self.icecast_streamer.is_connected if self.icecast_streamer else False,
            'config': {
                'host': self.icecast_streamer.config.get('host') if self.icecast_streamer else None,
                'port': self.icecast_streamer.config.get('port') if self.icecast_streamer else None,
                'mount': self.icecast_streamer.config.get('mount') if self.icecast_streamer else None
            }
        }


queue = Queue()
