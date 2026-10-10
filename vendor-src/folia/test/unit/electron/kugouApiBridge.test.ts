import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { KUGOU_OPERATIONS } from '../../../src/services/onlineMusic/kugouTransport';

// test/unit/electron/kugouApiBridge.test.ts

const require = createRequire(import.meta.url);
const {
    LEGACY_SESSION_KEY,
    SESSION_KEY,
    createKugouApiBridge,
    OPERATION_MODULES,
} = require('../../../electron/kugouApiBridge.cjs');

const createStore = () => {
    const values = new Map<string, unknown>();
    return {
        values,
        get: (key: string) => values.get(key),
        set: (key: string, value: unknown) => values.set(key, value),
        delete: (key: string) => values.delete(key),
    };
};

// Reversible test cipher: only the fake safeStorage sees plaintext; electron-store receives bytes
// transformed before base64 encoding, matching the real ownership boundary without OS key access.
const createSafeStorage = (backend = 'dpapi') => ({
    isEncryptionAvailable: vi.fn(() => true),
    getSelectedStorageBackend: vi.fn(() => backend),
    encryptString: vi.fn((plaintext: string): Buffer =>
        Buffer.from(Buffer.from(plaintext, 'utf8').map(byte => byte ^ 0xa5))),
    decryptString: vi.fn((ciphertext: Buffer) =>
        Buffer.from(Buffer.from(ciphertext).map(byte => byte ^ 0xa5)).toString('utf8')),
});

const readEncryptedCookies = (store: ReturnType<typeof createStore>, safeStorage: ReturnType<typeof createSafeStorage>) => {
    const encoded = store.get(SESSION_KEY);
    const plaintext = safeStorage.decryptString(Buffer.from(String(encoded), 'base64'));
    return JSON.parse(plaintext).cookies as Record<string, string>;
};

const seedEncryptedCookies = (
    store: ReturnType<typeof createStore>,
    safeStorage: ReturnType<typeof createSafeStorage>,
    cookies: Record<string, string>,
) => {
    const encrypted = safeStorage.encryptString(JSON.stringify({ version: 2, cookies }));
    store.set(SESSION_KEY, encrypted.toString('base64'));
};

describe('Electron KuGou API bridge', () => {
    it('absorbs credentials, returns a sanitized body, and reuses the session', async () => {
        const store = createStore();
        const safeStorage = createSafeStorage();
        const userDetail = vi.fn(async (params: any) => ({
            body: { data: { nickname: 'Kugou User' } },
            cookie: [],
        }));
        const api = {
            register_dev: async () => ({ body: { status: 1 }, cookie: ['dfid=device-dfid'] }),
            login_qr_check: async () => ({
                body: { data: { status: 4, token: 'secret-token', userid: '123' } },
                cookie: ['token=secret-token', 'userid=123'],
            }),
            user_detail: userDetail,
        };
        const bridge = createKugouApiBridge({ store, safeStorage, apiLoader: () => api });

        const login = await bridge.request('login_qr_check', { key: 'qr' });
        expect(login).toEqual({ data: { status: 4, userid: '123' } });
        const profile = await bridge.request('user_detail', { userid: 'renderer-user-id' });
        expect(profile).toEqual({ data: { nickname: 'Kugou User', userid: '123' } });
        expect(userDetail.mock.calls[0][0].userid).toBe('123');
        expect(userDetail.mock.calls[0][0].cookie).toEqual(expect.objectContaining({
            token: 'secret-token', userid: '123', dfid: 'device-dfid',
        }));
        const persisted = store.get(SESSION_KEY);
        expect(persisted).toEqual(expect.any(String));
        expect(persisted).not.toContain('secret-token');
        expect(readEncryptedCookies(store, safeStorage)).toEqual(expect.objectContaining({
            token: 'secret-token', userid: '123', dfid: 'device-dfid',
        }));
    });

    it('clears account credentials without deleting the device identity', async () => {
        const store = createStore();
        const safeStorage = createSafeStorage();
        const bridge = createKugouApiBridge({ store, safeStorage, apiLoader: () => ({
            register_dev: async () => ({ body: {}, cookie: ['dfid=device'] }),
            login_qr_check: async () => ({ body: { data: { status: 4 } }, cookie: ['token=secret', 'userid=9'] }),
        }) });
        await bridge.request('login_qr_check', {});
        await expect(bridge.request('logout')).resolves.toEqual({ code: 200 });
        const stored = readEncryptedCookies(store, safeStorage);
        expect(stored.token).toBeUndefined();
        expect(stored.userid).toBeUndefined();
        expect(stored.KUGOU_API_GUID).toBeTruthy();
    });

    it('refreshes an invalid dfid and retries an audio URL request once', async () => {
        const store = createStore();
        const safeStorage = createSafeStorage();
        store.set(LEGACY_SESSION_KEY, { dfid: 'stale-dfid', token: 'token', userid: '9' });
        const registerDev = vi.fn(async () => ({ body: { status: 1 }, cookie: ['dfid=fresh-dfid'] }));
        const songUrl = vi.fn(async (params: any) => (
            params.cookie.dfid === 'fresh-dfid'
                ? { body: { status: 1, url: ['https://example.test/song.mp3'] }, cookie: [] }
                : { body: { status: 0, errcode: 20028, error: '本次请求需要验证' }, cookie: [] }
        ));
        const bridge = createKugouApiBridge({
            store,
            safeStorage,
            apiLoader: () => ({ register_dev: registerDev, song_url: songUrl }),
        });

        await expect(bridge.request('song_url', { hash: 'HASH', quality: '128' })).resolves.toEqual({
            status: 1,
            url: ['https://example.test/song.mp3'],
        });
        expect(registerDev).toHaveBeenCalledTimes(1);
        expect(songUrl).toHaveBeenCalledTimes(2);
        expect(songUrl.mock.calls[1][0].cookie).toEqual(expect.objectContaining({
            dfid: 'fresh-dfid', token: 'token', userid: '9',
        }));
        expect(store.get(LEGACY_SESSION_KEY)).toBeUndefined();
        expect(store.get(SESSION_KEY)).toEqual(expect.any(String));
    });

    it('rejects operations outside the fixed allowlist', async () => {
        const bridge = createKugouApiBridge({
            store: createStore(), safeStorage: createSafeStorage(), apiLoader: () => ({}),
        });
        await expect(bridge.request('arbitrary_url', {})).rejects.toThrow('Unsupported KuGou operation');
    });

    it('keeps Electron and renderer operation allowlists aligned', () => {
        expect(Object.keys(OPERATION_MODULES).sort()).toEqual([...KUGOU_OPERATIONS].sort());
    });

    it('routes KRM catalog metadata through the authenticated bridge session', async () => {
        const store = createStore();
        const safeStorage = createSafeStorage();
        seedEncryptedCookies(store, safeStorage, { dfid: 'device', token: 'token', userid: '9' });
        const krmAudio = vi.fn(async () => ({ body: { data: [{ base: { album_id: 7 } }] }, cookie: [] }));
        const bridge = createKugouApiBridge({
            store,
            safeStorage,
            apiLoader: () => ({ krm_audio: krmAudio }),
        });

        await expect(bridge.request('krm_audio', {
            album_audio_id: '42', fields: 'album_info,authors.base,base,audio_info',
        })).resolves.toEqual({ data: [{ base: { album_id: 7 } }] });
        expect(krmAudio).toHaveBeenCalledWith(expect.objectContaining({
            album_audio_id: '42',
            cookie: expect.objectContaining({ dfid: 'device', token: 'token', userid: '9' }),
        }));
    });

    it('restores an encrypted account session after the bridge is recreated', async () => {
        const store = createStore();
        const safeStorage = createSafeStorage();
        seedEncryptedCookies(store, safeStorage, {
            dfid: 'device', token: 'secret-token', userid: '9',
        });
        const userDetail = vi.fn(async () => ({ body: { data: { nickname: 'Restored User' } }, cookie: [] }));

        const restarted = createKugouApiBridge({
            store,
            safeStorage,
            apiLoader: () => ({ user_detail: userDetail }),
        });

        await expect(restarted.request('user_detail', {})).resolves.toEqual({
            data: { nickname: 'Restored User', userid: '9' },
        });
        expect(userDetail).toHaveBeenCalledWith(expect.objectContaining({
            token: 'secret-token',
            userid: '9',
            cookie: expect.objectContaining({ token: 'secret-token', userid: '9' }),
        }));
        expect(restarted.getStatus()).toEqual({ available: true, authenticated: true, error: null });
    });

    it('removes legacy plaintext even when Linux only offers basic_text', async () => {
        const store = createStore();
        store.set(LEGACY_SESSION_KEY, { dfid: 'device', token: 'secret-token', userid: '9' });
        const safeStorage = createSafeStorage('basic_text');
        const warn = vi.fn();
        const userDetail = vi.fn(async () => ({ body: { data: { nickname: 'Memory User' } }, cookie: [] }));
        const bridge = createKugouApiBridge({
            store,
            safeStorage,
            platform: 'linux',
            warn,
            apiLoader: () => ({ user_detail: userDetail }),
        });

        // The migrated session remains usable for this run, but is never written back unencrypted.
        await expect(bridge.request('user_detail', {})).resolves.toMatchObject({
            data: { nickname: 'Memory User', userid: '9' },
        });
        expect(store.get(LEGACY_SESSION_KEY)).toBeUndefined();
        expect(store.get(SESSION_KEY)).toBeUndefined();
        expect(warn).toHaveBeenCalledWith('[KuGouSession] save-failed', { name: 'Error' });
    });

    describe('error normalization', () => {
        const createBridge = (api: Record<string, (...args: any[]) => Promise<unknown>>) => createKugouApiBridge({
            store: createStore(),
            safeStorage: createSafeStorage(),
            apiLoader: () => ({ register_dev: async () => ({ body: { status: 1 }, cookie: ['dfid=d'] }), ...api }),
        });

        it('turns the library answer-object rejection into an Error carrying operation, status and error_code', async () => {
            const bridge = createBridge({
                user_detail: async () => {
                    // Shape produced by kugoumusicapi's createRequest on an upstream failure.
                    throw {
                        status: 502,
                        body: { status: 0, error_code: 20028, msg: 'upstream busy', token: 'must-not-leak' },
                        cookie: ['token=must-not-leak'],
                        headers: {},
                    };
                },
            });

            const error = await bridge.request('user_detail', {}).catch((caught: unknown) => caught);

            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toBe('KuGouApi[operation=user_detail status=502 error_code=20028]: upstream busy');
            expect(error).toMatchObject({ operation: 'user_detail', status: 502, errorCode: 20028 });
            expect((error as Error).message).not.toContain('[object Object]');
            expect((error as Error).message).not.toContain('must-not-leak');
        });

        it('reports a network-level failure (status 502, no error_code) with its error code instead of [object Object]', async () => {
            const networkError = Object.assign(new Error('connect ETIMEDOUT 1.2.3.4:443'), { code: 'ETIMEDOUT' });
            const bridge = createBridge({
                user_detail: async () => {
                    throw { status: 502, body: { status: 0, msg: networkError }, cookie: [], headers: {} };
                },
            });

            const error = await bridge.request('user_detail', {}).catch((caught: unknown) => caught);

            expect((error as Error).message).toContain('operation=user_detail');
            expect((error as Error).message).toContain('status=502');
            expect((error as Error).message).not.toContain('error_code');
            expect((error as Error).message).toContain('ETIMEDOUT');
            expect((error as Error).message).not.toContain('[object Object]');
        });

        it('keeps the message of an ordinary Error and tags it with the operation', async () => {
            const bridge = createBridge({
                user_detail: async () => { throw new Error('boom'); },
            });

            const error = await bridge.request('user_detail', {}).catch((caught: unknown) => caught);

            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toBe('KuGouApi[operation=user_detail]: boom');
        });

        it('normalizes unsupported operations too', async () => {
            const bridge = createBridge({});

            const error = await bridge.request('not_an_operation', {}).catch((caught: unknown) => caught);

            expect((error as Error).message).toContain('Unsupported KuGou operation');
            expect((error as Error).message).toContain('operation=not_an_operation');
        });
    });
});
