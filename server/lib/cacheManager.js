import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import fsHelper from '../utils/helper/fs-helper.js';

class CacheManager {
    constructor(cacheDir = 'tracks/cache', maxCacheSize = 1024 * 1024 * 1024) {
        this.cacheDir = cacheDir.replace(/\\/g, '/');
        this.maxCacheSize = maxCacheSize;
        this.ensureCacheDirectory();
    }

    ensureCacheDirectory() {
        if (!fsHelper.exists(this.cacheDir)) {
            fsHelper.createDirectory(this.cacheDir);
            logger.info(`Created cache directory at ${this.cacheDir}`);
        }
    }

    getCachedPath(title) {
        const safeTitle = title.replace(/[<>:"/\\|?*]/g, '');
        return path.join(this.cacheDir, `${safeTitle}.mp3`).replace(/\\/g, '/');
    }

    getOriginalPath(title) {
        const safeTitle = title.replace(/[<>:"/\\|?*]/g, '');
        return path.join('tracks', `${safeTitle}.mp3`).replace(/\\/g, '/');
    }

    isCached(title) {
        const cachedPath = this.getCachedPath(title);
        const exists = fsHelper.exists(cachedPath);
        if (exists) {
            logger.info(`Found ${title} in cache`);
        }
        return exists;
    }

    moveToCache(sourcePath, title) {
        try {
            sourcePath = sourcePath.replace(/\\/g, '/');
            const cachedPath = this.getCachedPath(title);
            
            logger.info(`Attempting to move ${sourcePath} to ${cachedPath}`);
            
            this.ensureCacheDirectory();

            if (fsHelper.exists(sourcePath)) {
                fsHelper.copy(sourcePath, cachedPath);
                logger.info(`Successfully copied file to cache at ${cachedPath}`);

                try {
                    fsHelper.delete(sourcePath);
                    logger.info(`Successfully deleted original file at ${sourcePath}`);
                } catch (deleteError) {
                    logger.error(`Failed to delete original file: ${deleteError.message}`);
                }

                this.cleanupIfNeeded();
                return true;
            }
            logger.info(`Source file not found at ${sourcePath}`);
            return false;
        } catch (error) {
            logger.error(`Error moving file to cache: ${error.message}`);
            return false;
        }
    }

    getFromCache(title) {
        const cachedPath = this.getCachedPath(title);
        if (this.isCached(title)) {
            logger.info(`Using cached version of ${title} from ${cachedPath}`);
            return cachedPath;
        }
        logger.info(`${title} not found in cache`);
        return null;
    }

    cleanupIfNeeded() {
        try {
            this.ensureCacheDirectory();

            const files = fsHelper.listFiles(this.cacheDir);
            logger.info(`Found ${files.length} files in cache`);
            
            if (files.length === 0) {
                return;
            }

            let totalSize = 0;
            const fileDetails = files.map(file => {
                const filePath = path.join(this.cacheDir, file);
                const stats = fs.statSync(filePath);
                return {
                    path: filePath,
                    size: stats.size,
                    lastAccessed: stats.atime.getTime()
                };
            }).sort((a, b) => a.lastAccessed - b.lastAccessed);

            totalSize = fileDetails.reduce((sum, file) => sum + file.size, 0);
            logger.info(`Current cache size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

            while (totalSize > this.maxCacheSize && fileDetails.length > 0) {
                const oldestFile = fileDetails.shift();
                if (oldestFile) {
                    try {
                        fsHelper.delete(oldestFile.path);
                        totalSize -= oldestFile.size;
                        logger.info(`Removed ${path.basename(oldestFile.path)} from cache due to size limit`);
                    } catch (error) {
                        logger.error(`Failed to remove old cache file ${oldestFile.path}: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            logger.error(`Error cleaning cache: ${error.message}`);
        }
    }
}

const cacheManager = new CacheManager();
export default cacheManager;
