import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Covers the main-process trust boundary and the intentionally narrow WAV capability fallback.

const require = createRequire(import.meta.url);
const { createTranscodeService, safeExtension, shouldUseWavFallback, validateSource } = require('../../../electron/transcode/service.cjs') as {
    createTranscodeService: (options: unknown) => {
        request: (payload: unknown) => Promise<unknown>;
        resolveEntry: (cacheKey: string, format: string) => Promise<unknown>;
        removeCacheEntry: (cacheKey: string) => Promise<boolean>;
        getPinnedCacheKeys: () => string[];
    };
    safeExtension: (name: string) => string;
    shouldUseWavFallback: (error: Error) => boolean;
    validateSource: (source: unknown) => boolean;
};
const { buildTranscodeCacheKey, publishCacheEntry } = require('../../../electron/transcode/cache.cjs') as typeof import('../../../electron/transcode/cache.cjs');

describe('transcode service request validation', () => {
    it('requires local bytes and never accepts a renderer-provided path by itself', () => {
        const common = { kind: 'local', songKey: 'local:1', sourceRevision: '1:2:3', fileName: 'song.ape' };
        expect(validateSource({ ...common, filePath: 'C:\\secret.txt' })).toBe(false);
        expect(validateSource({ ...common, data: new ArrayBuffer(8) })).toBe(true);
    });

    it('accepts Navidrome bytes or HTTP(S), but rejects other schemes', () => {
        const common = { kind: 'navidrome', songKey: 'navidrome:1', sourceRevision: 'server:1' };
        expect(validateSource({ ...common, data: new Uint8Array(8) })).toBe(true);
        expect(validateSource({ ...common, url: 'https://music.test/rest/stream?id=1' })).toBe(true);
        expect(validateSource({ ...common, url: 'file:///etc/passwd' })).toBe(false);
        expect(validateSource({ ...common, url: 'blob:renderer-only' })).toBe(false);
    });

    it('sanitizes source extensions instead of treating names as paths', () => {
        expect(safeExtension('../../music.APE')).toBe('.ape');
        expect(safeExtension('music.bad-extension-too-long')).toBe('.audio');
    });

    it('uses WAV only when the FLAC encoder or muxer is unavailable', () => {
        expect(shouldUseWavFallback(new Error("Unknown encoder 'flac'"))).toBe(true);
        expect(shouldUseWavFallback(new Error('Invalid data found when processing input'))).toBe(false);
    });

    it('logs rejected requests without echoing untrusted request ids', async () => {
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const service = createTranscodeService({
            app: { getPath: () => 'unused' },
            protocol: {},
            net: {},
        });

        await service.request({ requestId: '../../secret', priority: 'playback', source: null });

        expect(warning).toHaveBeenCalledWith('[TranscodeFallback]', 'invalid-request', { requestId: 'invalid' });
        warning.mockRestore();
    });
});

// A media element that has finished buffering stops reading its file, so the entry it is playing
// goes stale under LRU. These pins are what keeps an unrelated cache write from evicting it.
describe('transcode cache pinning', () => {
    let userData: string;
    let service: ReturnType<typeof createTranscodeService>;

    const publish = async (songKey: string) => {
        const cacheKey = buildTranscodeCacheKey({ kind: 'local', songKey, sourceRevision: '1:8:10' });
        const cacheDirectory = path.join(userData, 'transcode-cache');
        const temporaryAudioPath = path.join(userData, `${songKey.replace(/:/g, "-")}.flac`);
        await fs.promises.writeFile(temporaryAudioPath, Buffer.alloc(256));
        await publishCacheEntry({
            cacheDirectory,
            cacheKey,
            format: 'flac',
            temporaryAudioPath,
            metadata: { songKey, sourceRevision: '1:8:10' },
        });
        return cacheKey;
    };

    beforeEach(async () => {
        userData = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'folia-transcode-pin-'));
        service = createTranscodeService({ app: { getPath: () => userData }, protocol: {}, net: {} });
    });

    afterEach(async () => {
        await fs.promises.rm(userData, { recursive: true, force: true });
    });

    it('pins an entry once the protocol serves it and unpins it when it is removed', async () => {
        const cacheKey = await publish('local:1');
        expect(service.getPinnedCacheKeys()).toEqual([]);

        expect(await service.resolveEntry(cacheKey, 'flac')).not.toBeNull();
        expect(service.getPinnedCacheKeys()).toEqual([cacheKey]);

        await service.removeCacheEntry(cacheKey);
        expect(service.getPinnedCacheKeys()).toEqual([]);
    });

    it('keeps only the most recently served keys so the pin set cannot pin the whole cache', async () => {
        const keys = [];
        for (const songKey of ['local:1', 'local:2', 'local:3', 'local:4', 'local:5']) {
            const cacheKey = await publish(songKey);
            keys.push(cacheKey);
            await service.resolveEntry(cacheKey, 'flac');
        }

        expect(service.getPinnedCacheKeys()).toEqual(keys.slice(1));
    });

    it('does not pin a format the caller did not ask for', async () => {
        const cacheKey = await publish('local:1');

        expect(await service.resolveEntry(cacheKey, 'wav')).toBeNull();
        expect(service.getPinnedCacheKeys()).toEqual([]);
    });
});
