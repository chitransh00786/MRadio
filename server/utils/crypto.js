import cryptoForge from 'node-forge'
import crypto from 'crypto';

/**
 * Generates a cryptographically secure random 256-bit token
 * @returns {string} A 64-character hexadecimal string representing the 256-bit token
 */
export function generate256BitToken() {
    const randomBytes = crypto.randomBytes(32);
    return randomBytes.toString('hex');
}

export function createDownloadLinks(encryptedMediaUrl) {
    if (!encryptedMediaUrl) return [];

    const qualities = [
        { id: '_12', bitrate: '12kbps' },
        { id: '_48', bitrate: '48kbps' },
        { id: '_96', bitrate: '96kbps' },
        { id: '_160', bitrate: '160kbps' },
        { id: '_320', bitrate: '320kbps' }
    ];

    const key = '38346591';
    const iv = '00000000';

    const encrypted = cryptoForge.util.decode64(encryptedMediaUrl);
    const decipher = cryptoForge.cipher.createDecipher('DES-ECB', cryptoForge.util.createBuffer(key));
    decipher.start({ iv: cryptoForge.util.createBuffer(iv) });
    decipher.update(cryptoForge.util.createBuffer(encrypted));
    decipher.finish();

    const decryptedLink = decipher.output.getBytes();

    return qualities.map((quality) => ({
        quality: quality.bitrate,
        url: decryptedLink.replace('_96', quality.id)
    }));
}