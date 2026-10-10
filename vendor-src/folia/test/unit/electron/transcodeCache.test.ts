import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';

// Covers persistent transcode-cache versioning, LRU timestamps, inventory and clearing.

const require = createRequire(import.meta.url);
const {
    CACHE_VERSION,
    buildTranscodeCacheKey,
    clearTranscodeCacheEntries,
    listTranscodeCacheEntries,
    publishCacheEntry,
    readValidCacheEntry,
    removeInvalidTranscodeCacheEntries,
} = require('../../../electron/transcode/cache.cjs') as typeof import('../../../electron/transcode/cache.cjs');

describe('transcode cache', () => {
    let root: string;
    let temporaryAudioPath: string;
    const source = { kind: 'local', songKey: 'local:1', sourceRevision: '1:8:10' };

    beforeEach(async () => {
        root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'folia-transcode-cache-'));
        temporaryAudioPath = path.join(root, 'output.flac');
        await fs.promises.writeFile(temporaryAudioPath, Buffer.alloc(256));
    });

    afterEach(async () => {
        await fs.promises.rm(root, { recursive: true, force: true });
    });

    it('invalidates the old forced-48k cache generation', () => {
        expect(CACHE_VERSION).toBe('audio-v2-source-rate-stereo');
    });

    it('lists published bytes, refreshes LRU time on reads, and clears entries', async () => {
        const cacheKey = buildTranscodeCacheKey(source);
        const published = await publishCacheEntry({
            cacheDirectory: root,
            cacheKey,
            format: 'flac',
            temporaryAudioPath,
            metadata: { songKey: source.songKey, sourceRevision: source.sourceRevision },
        });
        const old = new Date(1_000);
        await fs.promises.utimes(published.audioPath, old, old);

        expect(await listTranscodeCacheEntries(root)).toEqual([
            expect.objectContaining({ name: cacheKey, size: 256, usedAt: 1_000 }),
        ]);
        await readValidCacheEntry(root, cacheKey);
        expect((await fs.promises.stat(published.audioPath)).mtimeMs).toBeGreaterThan(1_000);

        await clearTranscodeCacheEntries(root);
        expect(await listTranscodeCacheEntries(root)).toEqual([]);
    });

    it('drops the previous format when a key is republished as the other one', async () => {
        const cacheKey = buildTranscodeCacheKey(source);
        const publishOptions = {
            cacheDirectory: root,
            cacheKey,
            temporaryAudioPath,
            metadata: { songKey: source.songKey, sourceRevision: source.sourceRevision },
        };
        const flac = await publishCacheEntry({ ...publishOptions, format: 'flac' });
        const wav = await publishCacheEntry({ ...publishOptions, format: 'wav' });

        // A leftover audio.flac would be invisible to the inventory and unreclaimable by the prune,
        // silently carrying the cache past the ceiling the listener set.
        await expect(fs.promises.stat(flac.audioPath)).rejects.toMatchObject({ code: 'ENOENT' });
        expect((await fs.promises.stat(wav.audioPath)).size).toBe(256);
        expect(await listTranscodeCacheEntries(root)).toEqual([
            expect.objectContaining({ name: cacheKey, size: 256 }),
        ]);
        expect((await readValidCacheEntry(root, cacheKey))?.format).toBe('wav');
    });

    it('removes cache directories from obsolete generations', async () => {
        const cacheKey = buildTranscodeCacheKey(source);
        const obsoleteDirectory = path.join(root, cacheKey);
        await fs.promises.mkdir(obsoleteDirectory);
        await Promise.all([
            fs.promises.writeFile(path.join(obsoleteDirectory, 'audio.flac'), Buffer.alloc(256)),
            fs.promises.writeFile(path.join(obsoleteDirectory, 'metadata.json'), JSON.stringify({
                cacheVersion: 'audio-v1-48k-stereo',
                format: 'flac',
            })),
        ]);

        await removeInvalidTranscodeCacheEntries(root);

        await expect(fs.promises.stat(obsoleteDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
    });
});
