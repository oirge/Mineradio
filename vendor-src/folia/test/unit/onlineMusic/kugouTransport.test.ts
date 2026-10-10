import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// test/unit/onlineMusic/kugouTransport.test.ts

const storage = new Map<string, string>();

describe('KuGou Web transport', () => {
    beforeEach(() => {
        vi.resetModules();
        storage.clear();
        vi.stubEnv('VITE_KUGOU_API_BASE', 'https://kugou.example.test');
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
            removeItem: (key: string) => storage.delete(key),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('prefers Electron IPC without copying credentials into renderer storage', async () => {
        storage.set('online_provider:kugou:cookie', 'token=legacy;userid=7;dfid=legacy-device');
        storage.set('online_provider:kugou:token', 'legacy');
        storage.set('online_provider:kugou:userid', '7');
        storage.set('online_provider:kugou:dfid', 'legacy-device');
        const kugouRequest = vi.fn().mockResolvedValue({
            data: { status: 4, token: 'must-not-persist', userid: '123', dfid: 'private-device' },
        });
        vi.stubGlobal('window', { electron: { kugouRequest } });
        const { requestKugou } = await import('@/services/onlineMusic/kugouTransport');

        await expect(requestKugou('login_qr_check', {
            key: 'qr', token: 'legacy-param', dfid: 'legacy-device',
        })).resolves.toEqual({
            data: { status: 4, token: 'must-not-persist', userid: '123', dfid: 'private-device' },
        });
        expect(kugouRequest).toHaveBeenCalledWith('login_qr_check', { key: 'qr' });
        expect(storage.get('online_provider:kugou:cookie')).toBeUndefined();
        expect(storage.get('online_provider:kugou:token')).toBeUndefined();
        expect(storage.get('online_provider:kugou:dfid')).toBeUndefined();
        expect(storage.get('online_provider:kugou:userid')).toBe('123');
    });

    it('keeps Web login persistence unchanged', async () => {
        vi.stubGlobal('window', undefined);
        const fetchMock = vi.fn().mockResolvedValue(Response.json({
            data: { status: 4, token: 'web-token', userid: '9', dfid: 'web-device' },
            cookie: ['token=web-token', 'userid=9', 'dfid=web-device'],
        }));
        vi.stubGlobal('fetch', fetchMock);
        const { requestKugou } = await import('@/services/onlineMusic/kugouTransport');

        await requestKugou('login_qr_check', { key: 'qr' });

        expect(storage.get('online_provider:kugou:token')).toBe('web-token');
        expect(storage.get('online_provider:kugou:userid')).toBe('9');
        expect(storage.get('online_provider:kugou:dfid')).toBe('web-device');
        expect(storage.get('online_provider:kugou:cookie')).toBe(
            'token=web-token; userid=9; dfid=web-device',
        );
    });

    it('registers a fresh dfid and retries when an audio URL request requires verification', async () => {
        vi.stubGlobal('window', undefined);
        const { requestKugou } = await import('@/services/onlineMusic/kugouTransport');
        storage.set('online_provider:kugou:dfid', 'stale-dfid');
        storage.set('online_provider:kugou:token', 'token');
        storage.set('online_provider:kugou:userid', '9');
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(Response.json({ status: 0, errcode: 20028, error: '本次请求需要验证' }))
            .mockResolvedValueOnce(Response.json({ status: 1, data: { dfid: 'fresh-dfid' } }))
            .mockResolvedValueOnce(Response.json({ status: 1, url: ['https://example.test/song.mp3'] }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(requestKugou('song_url', { hash: 'HASH' })).resolves.toEqual({
            status: 1,
            url: ['https://example.test/song.mp3'],
        });

        expect(new URL(fetchMock.mock.calls[1][0]).pathname).toBe('/register/dev');
        const retriedUrl = new URL(fetchMock.mock.calls[2][0]);
        expect(retriedUrl.pathname).toBe('/song/url');
        expect(retriedUrl.searchParams.get('cookie')).toBe('dfid=fresh-dfid;token=token;userid=9');
    });

    it('uses the dedicated KRM metadata endpoint on Web', async () => {
        vi.stubGlobal('window', undefined);
        storage.set('online_provider:kugou:dfid', 'device');
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 1, data: [] }));
        vi.stubGlobal('fetch', fetchMock);
        const { requestKugou } = await import('@/services/onlineMusic/kugouTransport');

        await requestKugou('krm_audio', {
            album_audio_id: '42', fields: 'album_info,authors.base,base,audio_info',
        });

        const requestUrl = new URL(fetchMock.mock.calls[0][0]);
        expect(requestUrl.pathname).toBe('/krm/audio');
        expect(requestUrl.searchParams.get('album_audio_id')).toBe('42');
    });

    it('routes concept recommendation cards to the youth card endpoint', async () => {
        vi.stubGlobal('window', undefined);
        storage.set('online_provider:kugou:dfid', 'device');
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 1, data: { song_list: [] } }));
        vi.stubGlobal('fetch', fetchMock);
        const { requestKugou } = await import('@/services/onlineMusic/kugouTransport');

        await requestKugou('top_card_youth', { card_id: 3006, pagesize: 30 });

        const requestUrl = new URL(fetchMock.mock.calls[0][0]);
        expect(requestUrl.pathname).toBe('/top/card/youth');
        expect(requestUrl.searchParams.get('card_id')).toBe('3006');
        expect(requestUrl.searchParams.get('pagesize')).toBe('30');
    });

    it('routes song climax lookups to the documented endpoint', async () => {
        vi.stubGlobal('window', undefined);
        storage.set('online_provider:kugou:dfid', 'device');
        const fetchMock = vi.fn().mockResolvedValue(Response.json({
            status: 1,
            data: [{ start_time: '84170', end_time: '142170' }],
        }));
        vi.stubGlobal('fetch', fetchMock);
        const { requestKugou } = await import('@/services/onlineMusic/kugouTransport');

        await expect(requestKugou('song_climax', { hash: 'HASH' })).resolves.toMatchObject({ status: 1 });

        const requestUrl = new URL(fetchMock.mock.calls[0][0]);
        expect(requestUrl.pathname).toBe('/song/climax');
        expect(requestUrl.searchParams.get('hash')).toBe('HASH');
    });

    it('requires token, userid, and dfid before using authenticated search', async () => {
        vi.stubGlobal('window', undefined);
        const { hasKugouAuthenticatedSearchSession } = await import('@/services/onlineMusic/kugouTransport');

        storage.set('online_provider:kugou:dfid', 'device');
        expect(hasKugouAuthenticatedSearchSession()).toBe(false);

        storage.set('online_provider:kugou:token', 'token');
        storage.set('online_provider:kugou:userid', '9');
        expect(hasKugouAuthenticatedSearchSession()).toBe(true);
    });

    it('uses only the non-secret account id as the Electron authenticated-search hint', async () => {
        vi.stubGlobal('window', { electron: { kugouRequest: vi.fn() } });
        storage.set('online_provider:kugou:userid', '9');
        const { hasKugouAuthenticatedSearchSession } = await import('@/services/onlineMusic/kugouTransport');

        expect(hasKugouAuthenticatedSearchSession()).toBe(true);
        expect(storage.get('online_provider:kugou:token')).toBeUndefined();
        expect(storage.get('online_provider:kugou:dfid')).toBeUndefined();
    });

    it('builds the anonymous signed search request without provider cookies', async () => {
        vi.stubGlobal('window', undefined);
        const fetchMock = vi.fn().mockResolvedValue(Response.json({
            error_code: 0,
            data: { lists: [] },
        }));
        vi.stubGlobal('fetch', fetchMock);
        const { requestKugouAnonymousSearch } = await import('@/services/onlineMusic/kugouTransport');

        await requestKugouAnonymousSearch('爱河', 1, 50);

        const proxyUrl = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
        const targetUrl = new URL(proxyUrl.searchParams.get('url') || '');
        expect(targetUrl.hostname).toBe('complexsearch.kugou.com');
        expect(targetUrl.pathname).toBe('/v2/search/song');
        expect(targetUrl.searchParams.get('keyword')).toBe('爱河');
        expect(targetUrl.searchParams.get('pagesize')).toBe('50');
        expect(targetUrl.searchParams.get('token')).toBe('');
        expect(targetUrl.searchParams.get('signature')).toMatch(/^[a-f0-9]{32}$/);
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
    });

    it('uses the same anonymous signed search directly in Electron', async () => {
        const kugouRequest = vi.fn();
        vi.stubGlobal('window', { electron: { kugouRequest } });
        const fetchMock = vi.fn().mockResolvedValue(Response.json({
            error_code: 0,
            data: { lists: [] },
        }));
        vi.stubGlobal('fetch', fetchMock);
        const { requestKugouAnonymousSearch } = await import('@/services/onlineMusic/kugouTransport');

        await requestKugouAnonymousSearch('爱河', 1, 50);

        const targetUrl = new URL(String(fetchMock.mock.calls[0][0]));
        expect(targetUrl.hostname).toBe('complexsearch.kugou.com');
        expect(targetUrl.searchParams.get('signature')).toMatch(/^[a-f0-9]{32}$/);
        expect(kugouRequest).not.toHaveBeenCalled();
    });

    it('builds the legacy mobile playInfo request through the Web lyric proxy', async () => {
        vi.stubGlobal('window', undefined);
        const fetchMock = vi.fn().mockResolvedValue(Response.json({
            status: 1,
            url: 'https://example.test/song.mp3',
            backup_url: 'https://example.test/backup.mp3',
        }));
        vi.stubGlobal('fetch', fetchMock);
        const { requestKugouLegacyPlayInfo } = await import('@/services/onlineMusic/kugouTransport');

        const body = await requestKugouLegacyPlayInfo('B18B946D9B510FC72AB848FA17D06AFB');

        expect(body).toMatchObject({ status: 1, url: 'https://example.test/song.mp3' });
        const proxyUrl = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
        const targetUrl = new URL(proxyUrl.searchParams.get('url') || '');
        expect(targetUrl.hostname).toBe('m.kugou.com');
        expect(targetUrl.pathname).toBe('/app/i/getSongInfo.php');
        expect(targetUrl.searchParams.get('cmd')).toBe('playInfo');
        expect(targetUrl.searchParams.get('hash')).toBe('B18B946D9B510FC72AB848FA17D06AFB');
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
    });

    it('calls the legacy mobile playInfo directly in Electron', async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({
            status: 1,
            url: 'https://example.test/song.mp3',
        }));
        vi.stubGlobal('window', { electron: { kugouRequest: vi.fn() } });
        vi.stubGlobal('fetch', fetchMock);
        const { requestKugouLegacyPlayInfo } = await import('@/services/onlineMusic/kugouTransport');

        await requestKugouLegacyPlayInfo('HASH');

        const targetUrl = new URL(String(fetchMock.mock.calls[0][0]));
        expect(targetUrl.hostname).toBe('m.kugou.com');
        expect(targetUrl.searchParams.get('cmd')).toBe('playInfo');
        expect(targetUrl.searchParams.get('hash')).toBe('HASH');
    });

    it('uses the Electron main-process proxy when the legacy mobile playInfo is fetched in desktop', async () => {
        const fetchLyricProxy = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            bodyText: JSON.stringify({ status: 1, url: 'https://example.test/song.mp3' }),
        });
        vi.stubGlobal('window', { electron: { kugouRequest: vi.fn(), fetchLyricProxy } });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const { requestKugouLegacyPlayInfo } = await import('@/services/onlineMusic/kugouTransport');

        const body = await requestKugouLegacyPlayInfo('HASH');

        expect(body).toMatchObject({ status: 1, url: 'https://example.test/song.mp3' });
        const targetUrl = new URL(String(fetchLyricProxy.mock.calls[0][0]));
        expect(targetUrl.hostname).toBe('m.kugou.com');
        expect(targetUrl.searchParams.get('cmd')).toBe('playInfo');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not fall back to Web after an Electron IPC failure', async () => {
        const ipcError = new Error('ipc failed');
        const kugouRequest = vi.fn().mockRejectedValue(ipcError);
        const fetchMock = vi.fn();
        vi.stubGlobal('window', { electron: { kugouRequest } });
        vi.stubGlobal('fetch', fetchMock);
        const { requestKugou } = await import('@/services/onlineMusic/kugouTransport');

        await expect(requestKugou('search', { keywords: 'song' })).rejects.toMatchObject({
            name: 'OnlineProviderError',
            code: 'network',
            providerId: 'kugou',
            cause: ipcError,
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('wraps a bridge-normalized Electron rejection into a network OnlineProviderError', async () => {
        // Electron prefixes the message with the IPC channel; the transport must still read the bridge fields.
        const ipcError = new Error(
            "Error invoking remote method 'kugou-api-request': KuGouApiError: "
            + 'KuGouApi[operation=user_detail status=502 error_code=20028]: upstream busy',
        );
        vi.stubGlobal('window', { electron: { kugouRequest: vi.fn().mockRejectedValue(ipcError) } });
        const { requestKugou } = await import('@/services/onlineMusic/kugouTransport');

        const error = (await requestKugou('user_detail', {}).catch((caught: unknown) => caught)) as Error;

        expect(error).toMatchObject({ name: 'OnlineProviderError', code: 'network', providerId: 'kugou' });
        expect(error.message).toContain('operation=user_detail');
        expect(error.message).toContain('status=502');
        expect(error.message).toContain('error_code=20028');
        expect(error.message).not.toContain('[object Object]');
    });

    it.each([
        ['an HTTP 401 status', 'KuGouApi[operation=user_detail status=401]: unauthorized'],
        ['an HTTP 403 status', 'KuGouApi[operation=user_detail status=403]'],
        ['the documented missing-credentials error_code 152', 'KuGouApi[operation=search status=502 error_code=152]'],
    ])('maps %s from the Electron bridge to auth-required', async (_label, bridgeMessage) => {
        const ipcError = new Error(`Error invoking remote method 'kugou-api-request': Error: ${bridgeMessage}`);
        vi.stubGlobal('window', { electron: { kugouRequest: vi.fn().mockRejectedValue(ipcError) } });
        const { requestKugou } = await import('@/services/onlineMusic/kugouTransport');

        await expect(requestKugou('user_detail', {})).rejects.toMatchObject({
            name: 'OnlineProviderError',
            code: 'auth-required',
            providerId: 'kugou',
        });
    });

    it('classifies a raw answer-object rejection from an unpatched main process', async () => {
        vi.stubGlobal('window', {
            electron: {
                kugouRequest: vi.fn().mockRejectedValue({ status: 502, body: { status: 0, error_code: 20028 } }),
            },
        });
        const { requestKugou } = await import('@/services/onlineMusic/kugouTransport');

        const error = (await requestKugou('user_detail', {}).catch((caught: unknown) => caught)) as Error;

        expect(error).toMatchObject({ code: 'network', providerId: 'kugou' });
        expect(error.message).toContain('status=502');
        expect(error.message).toContain('error_code=20028');
    });

    it('treats a message-less IPC failure as a network error, not a logout signal', async () => {
        vi.stubGlobal('window', {
            electron: { kugouRequest: vi.fn().mockRejectedValue(new Error('[object Object]')) },
        });
        const { requestKugou } = await import('@/services/onlineMusic/kugouTransport');

        await expect(requestKugou('user_detail', {})).rejects.toMatchObject({ code: 'network' });
    });

    it('maps Web 401/403 responses to auth-required and other failures to network', async () => {
        vi.stubGlobal('window', undefined);
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('{}', { status: 401 }))
            .mockResolvedValueOnce(new Response('{}', { status: 502 }));
        vi.stubGlobal('fetch', fetchMock);
        const { requestKugou } = await import('@/services/onlineMusic/kugouTransport');

        await expect(requestKugou('user_detail', {})).rejects.toMatchObject({ code: 'auth-required' });
        await expect(requestKugou('user_detail', {})).rejects.toMatchObject({ code: 'network' });
    });

    it('reports unavailable when neither transport is configured', async () => {
        vi.stubGlobal('window', undefined);
        vi.stubEnv('VITE_KUGOU_API_BASE', '');
        const { getKugouTransportAvailability, requestKugou } = await import('@/services/onlineMusic/kugouTransport');

        expect(getKugouTransportAvailability()).toEqual({ configured: false, reason: 'not-configured' });
        await expect(requestKugou('search', { keywords: 'song' })).rejects.toMatchObject({ code: 'unavailable' });
    });
});
