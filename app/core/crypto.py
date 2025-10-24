import secrets
import base64
from Crypto.Cipher import DES
from Crypto.Util.Padding import unpad

def generate_256bit_token() -> str:
    random_bytes = secrets.token_bytes(32)
    return random_bytes.hex()

def create_download_links(encrypted_media_url: str):
    if not encrypted_media_url:
        return []
    
    qualities = [
        {'id': '_12', 'bitrate': '12kbps'},
        {'id': '_48', 'bitrate': '48kbps'},
        {'id': '_96', 'bitrate': '96kbps'},
        {'id': '_160', 'bitrate': '160kbps'},
        {'id': '_320', 'bitrate': '320kbps'}
    ]
    
    key = b'38346591'
    
    try:
        encrypted_data = base64.b64decode(encrypted_media_url)
        cipher = DES.new(key, DES.MODE_ECB)
        decrypted = cipher.decrypt(encrypted_data)
        
        try:
            decrypted_link = unpad(decrypted, DES.block_size).decode('utf-8')
        except:
            decrypted_link = decrypted.decode('utf-8', errors='ignore').rstrip('\x00')
        
        return [
            {
                'quality': quality['bitrate'],
                'url': decrypted_link.replace('_96', quality['id'])
            }
            for quality in qualities
        ]
    except Exception as e:
        return []
