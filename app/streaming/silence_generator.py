from app.core import logger

class SilenceGenerator:
    def __init__(self):
        self.bitrate = 128
        self.sample_rate = 44100
    
    def generate_silence(self):
        """Generate infinite silence stream as an iterator"""
        try:
            frame_header = bytes([0xFF, 0xFB, 0x90, 0x00])
            frame_size = int((144 * self.bitrate * 1000) / self.sample_rate)
            
            silence_frame = bytearray(frame_size)
            silence_frame[0:4] = frame_header
            silence_bytes = bytes(silence_frame)
            
            logger.info(f"Starting silence generation (frame size: {frame_size} bytes)")
            
            while True:
                yield silence_bytes
        except Exception as error:
            logger.error(f'Error generating silence: {str(error)}')
            yield bytes([0xFF, 0xFB, 0x90, 0x00])
    
    @staticmethod
    def apply_fade(audio_buffer: bytes, fade_type: str = 'in', duration_ms: int = 50) -> bytes:
        try:
            return audio_buffer
        except Exception as error:
            logger.error(f'Error applying fade: {str(error)}')
            return audio_buffer

silence_generator = SilenceGenerator()
