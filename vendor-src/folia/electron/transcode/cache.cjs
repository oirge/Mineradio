'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Owns deterministic cache paths and atomic publication for complete transcode representations.

const CACHE_VERSION = 'audio-v2-source-rate-stereo';
const CACHE_KEY_PATTERN = /^[a-f0-9]{64}$/;
const CACHE_FORMATS = ['flac', 'wav'];

const getTranscodeCacheDirectory = userDataDirectory => path.join(userDataDirectory, 'transcode-cache');

const buildTranscodeCacheKey = source => crypto
    .createHash('sha256')
    .update(JSON.stringify({
        version: CACHE_VERSION,
        kind: source.kind,
        songKey: source.songKey,
        sourceRevision: source.sourceRevision,
    }))
    .digest('hex');

const getCacheEntryPaths = (cacheDirectory, cacheKey, format) => {
    const directory = path.join(cacheDirectory, cacheKey);
    return {
        directory,
        audioPath: path.join(directory, `audio.${format}`),
        metadataPath: path.join(directory, 'metadata.json'),
    };
};

const readValidCacheEntry = async (cacheDirectory, cacheKey) => {
    for (const format of CACHE_FORMATS) {
        const paths = getCacheEntryPaths(cacheDirectory, cacheKey, format);
        try {
            const [metadataText, stat] = await Promise.all([
                fs.promises.readFile(paths.metadataPath, 'utf8'),
                fs.promises.stat(paths.audioPath),
            ]);
            const metadata = JSON.parse(metadataText);
            if (metadata.cacheVersion === CACHE_VERSION && metadata.format === format && stat.isFile() && stat.size >= 128) {
                const now = new Date();
                await fs.promises.utimes(paths.audioPath, now, now).catch(() => {});
                return { ...paths, format, mimeType: format === 'flac' ? 'audio/flac' : 'audio/wav' };
            }
        } catch {
            // Incomplete or obsolete cache entries are misses and will be atomically replaced.
        }
    }
    return null;
};

const listTranscodeCacheEntries = async cacheDirectory => {
    let entries;
    try {
        entries = await fs.promises.readdir(cacheDirectory, { withFileTypes: true });
    } catch {
        return [];
    }

    const cacheEntries = await Promise.all(entries
        .filter(entry => entry.isDirectory() && CACHE_KEY_PATTERN.test(entry.name))
        .map(async entry => {
            for (const format of CACHE_FORMATS) {
                const paths = getCacheEntryPaths(cacheDirectory, entry.name, format);
                try {
                    const [metadataText, stat] = await Promise.all([
                        fs.promises.readFile(paths.metadataPath, 'utf8'),
                        fs.promises.stat(paths.audioPath),
                    ]);
                    const metadata = JSON.parse(metadataText);
                    if (metadata.cacheVersion === CACHE_VERSION && metadata.format === format && stat.isFile() && stat.size >= 128) {
                        return { name: entry.name, size: stat.size, usedAt: stat.mtimeMs };
                    }
                } catch {
                    // Ignore incomplete and obsolete entries; initialization removes them separately.
                }
            }
            return null;
        }));
    return cacheEntries.filter(Boolean);
};

const removeTranscodeCacheEntry = async (cacheDirectory, cacheKey) => {
    if (!CACHE_KEY_PATTERN.test(String(cacheKey || ''))) return false;
    await fs.promises.rm(path.join(cacheDirectory, cacheKey), { recursive: true, force: true });
    return true;
};

const clearTranscodeCacheEntries = async cacheDirectory => {
    let entries;
    try {
        entries = await fs.promises.readdir(cacheDirectory, { withFileTypes: true });
    } catch {
        return;
    }
    await Promise.allSettled(entries
        .filter(entry => entry.isDirectory() && CACHE_KEY_PATTERN.test(entry.name))
        .map(entry => removeTranscodeCacheEntry(cacheDirectory, entry.name)));
};

const removeInvalidTranscodeCacheEntries = async cacheDirectory => {
    let entries;
    try {
        entries = await fs.promises.readdir(cacheDirectory, { withFileTypes: true });
    } catch {
        return;
    }
    const valid = new Set((await listTranscodeCacheEntries(cacheDirectory)).map(entry => entry.name));
    await Promise.allSettled(entries
        .filter(entry => entry.isDirectory() && CACHE_KEY_PATTERN.test(entry.name) && !valid.has(entry.name))
        .map(entry => removeTranscodeCacheEntry(cacheDirectory, entry.name)));
};

const publishCacheEntry = async ({ cacheDirectory, cacheKey, format, temporaryAudioPath, metadata }) => {
    const paths = getCacheEntryPaths(cacheDirectory, cacheKey, format);
    await fs.promises.mkdir(paths.directory, { recursive: true });
    const stagingAudio = `${paths.audioPath}.publishing`;
    const stagingMetadata = `${paths.metadataPath}.publishing`;
    await fs.promises.copyFile(temporaryAudioPath, stagingAudio);
    await fs.promises.writeFile(stagingMetadata, JSON.stringify({
        ...metadata,
        cacheVersion: CACHE_VERSION,
        format,
    }, null, 2));
    // Every format, not only the one being written: a key republished after a flac/wav switch
    // otherwise keeps the previous audio file, which no listing reports and no prune can reclaim.
    await Promise.all([
        ...CACHE_FORMATS.map(staleFormat => fs.promises.rm(
            getCacheEntryPaths(cacheDirectory, cacheKey, staleFormat).audioPath,
            { force: true },
        )),
        fs.promises.rm(paths.metadataPath, { force: true }),
    ]);
    await fs.promises.rename(stagingAudio, paths.audioPath);
    await fs.promises.rename(stagingMetadata, paths.metadataPath);
    return { ...paths, format, mimeType: format === 'flac' ? 'audio/flac' : 'audio/wav' };
};

module.exports = {
    CACHE_FORMATS,
    CACHE_VERSION,
    buildTranscodeCacheKey,
    getCacheEntryPaths,
    getTranscodeCacheDirectory,
    clearTranscodeCacheEntries,
    listTranscodeCacheEntries,
    publishCacheEntry,
    readValidCacheEntry,
    removeTranscodeCacheEntry,
    removeInvalidTranscodeCacheEntries,
};
