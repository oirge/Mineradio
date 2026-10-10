import net from 'node:net';
import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';

// test/unit/electron/lyricApi.test.ts
// Verifies the public lyric shape and unauthenticated loopback HTTP contract.

const { createLyricApi, sanitizeLyricData } = require('../../../electron/lyricApi.cjs') as {
    createLyricApi: (options: Record<string, unknown>) => {
        buildStatus: () => { running: boolean };
        publishLyricData: (lyrics: unknown, offset?: number) => boolean;
        setEnabled: (enabled: boolean) => Promise<{ enabled: boolean; running: boolean; url: string | null }>;
        stop: () => Promise<unknown>;
    };
    sanitizeLyricData: (lyrics: unknown) => unknown;
};

const activeApis: Array<{ stop: () => Promise<unknown> }> = [];

afterEach(async () => {
    await Promise.all(activeApis.splice(0).map(api => api.stop()));
});

const getFreePort = () => new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
            reject(new Error('Failed to resolve a free port.'));
            return;
        }
        server.close(error => error ? reject(error) : resolve(address.port));
    });
    server.on('error', reject);
});

const createStore = () => {
    const values = new Map<string, unknown>();
    return {
        get: (key: string) => values.get(key),
        set: (key: string, value: unknown) => values.set(key, value),
    };
};

const getJson = (url: string) => new Promise<{ body: unknown; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
    http.get(url, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => resolve({ body: JSON.parse(body), headers: response.headers }));
    }).on('error', reject);
});

describe('desktop lyric API', () => {
    it('removes renderer-only fields and renames the public fields', () => {
        expect(sanitizeLyricData({
            title: 'Song',
            artist: 'Artist',
            isWordByWord: true,
            ttml: { timingMode: 'Word', agents: { v1: { id: 'v1' } } },
            lines: [{
                id: 'line-1',
                fullText: 'Hello',
                startTime: 1,
                endTime: 2,
                renderHints: { fastReveal: true },
                translation: '你好',
                words: [{ text: 'Hello', startTime: 1, endTime: 2, syllables: [{ text: 'Hel' }] }],
            }],
        })).toEqual({
            title: 'Song',
            artist: 'Artist',
            wordByWord: true,
            offset: 0,
            lines: [{
                text: 'Hello',
                startTime: 1,
                endTime: 2,
                translation: '你好',
                words: [{ text: 'Hello', startTime: 1, endTime: 2 }],
            }],
        });
    });

    it('serves the latest snapshot without authentication and returns null before publication', async () => {
        const port = await getFreePort();
        const api = createLyricApi({
            store: createStore(),
            getMainWindow: () => null,
            enabledSettingKey: 'TEST_LYRIC_API_ENABLED',
            port,
        });
        activeApis.push(api);

        const status = await api.setEnabled(true);
        expect(status).toMatchObject({ enabled: true, running: true });
        expect((await getJson(`${status.url}`)).body).toBeNull();

        api.publishLyricData({
            lines: [{ fullText: 'Line', startTime: 0, endTime: 1, words: [] }],
        }, -250);
        const response = await getJson(`${status.url}`);
        expect(response.headers['access-control-allow-origin']).toBe('*');
        expect(response.body).toEqual({
            offset: -250,
            lines: [{ text: 'Line', startTime: 0, endTime: 1, words: [] }],
            wordByWord: false,
        });
    });
});
