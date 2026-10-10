import { describe, expect, it, vi } from 'vitest';

// test/unit/electron/neteaseApiStartup.test.ts

const {
    createLoginQrCheck,
    refreshAnonymousToken,
    resolveXeapiPublicKey,
    withQrNetworkRetry,
    withoutImplicitClientIp,
} = require('../../../electron/neteaseApiStartup.cjs') as {
    withQrNetworkRetry: (
        request: (uri: string, data: any, options: any) => Promise<unknown>,
        options?: Record<string, unknown>,
    ) => (uri: string, data?: any, options?: any) => Promise<unknown>;
    createLoginQrCheck: (
        createOption: (query: Record<string, unknown>) => Record<string, unknown>,
    ) => (
        query: Record<string, unknown>,
        request: (uri: string, data: unknown, options: Record<string, unknown>) => Promise<any>,
    ) => Promise<unknown>;
    withoutImplicitClientIp: (
        request: (uri: string, data: unknown, options: Record<string, unknown>) => unknown,
    ) => (uri: string, data: unknown, options?: Record<string, unknown>) => unknown;
    refreshAnonymousToken: (options: Record<string, unknown>) => Promise<boolean>;
    resolveXeapiPublicKey: (options: Record<string, unknown>) => Promise<{
        publicKey: Record<string, unknown>;
        refreshed: boolean;
    }>;
};

// 上游 axios 请求没有超时，网络黑洞时会一直挂住；这里用一个永不 settle 的 promise 模拟。
const neverSettles = () => new Promise(() => {});

const quietLogger = {
    warn: vi.fn(),
};

const immediateRetryOptions = () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
    random: () => 0,
});

describe('NetEase API startup recovery', () => {
    it('retries xeapi key refresh with exponential backoff', async () => {
        const getXeapiPublicKey = vi.fn()
            .mockRejectedValueOnce(new Error('temporary one'))
            .mockResolvedValueOnce({ version: 'invalid-response' })
            .mockResolvedValue({ sk: 'fresh-key', version: '2' });
        const retryOptions = immediateRetryOptions();

        const result = await resolveXeapiPublicKey({
            currentPublicKey: { sk: 'cached-key', version: '1' },
            deviceId: 'device-id',
            getXeapiPublicKey,
            logger: quietLogger,
            retryOptions,
        });

        expect(result).toEqual({
            publicKey: { sk: 'fresh-key', version: '2' },
            refreshed: true,
        });
        expect(getXeapiPublicKey).toHaveBeenCalledTimes(3);
        expect(retryOptions.sleep).toHaveBeenNthCalledWith(1, 250);
        expect(retryOptions.sleep).toHaveBeenNthCalledWith(2, 500);
    });

    it('uses a valid cached xeapi key after refresh attempts fail', async () => {
        const cachedKey = { sk: 'cached-key', version: '1' };
        const getXeapiPublicKey = vi.fn().mockRejectedValue(new Error('offline'));

        const result = await resolveXeapiPublicKey({
            currentPublicKey: cachedKey,
            deviceId: 'device-id',
            getXeapiPublicKey,
            logger: quietLogger,
            retryOptions: immediateRetryOptions(),
        });

        expect(result).toEqual({ publicKey: cachedKey, refreshed: false });
        expect(getXeapiPublicKey).toHaveBeenCalledTimes(3);
    });

    it('still rejects when refresh fails and no usable cached xeapi key exists', async () => {
        const getXeapiPublicKey = vi.fn().mockRejectedValue(new Error('offline'));

        await expect(resolveXeapiPublicKey({
            currentPublicKey: { version: '1' },
            deviceId: 'device-id',
            getXeapiPublicKey,
            logger: quietLogger,
            retryOptions: immediateRetryOptions(),
        })).rejects.toThrow('offline');
        expect(getXeapiPublicKey).toHaveBeenCalledTimes(3);
    });

    it('retries anonymous registration and persists a valid token', async () => {
        const registerAnonymous = vi.fn()
            .mockRejectedValueOnce(new Error('temporary'))
            .mockResolvedValue({ body: { cookie: 'MUSIC_A=anonymous-token' } });
        const persistToken = vi.fn();

        const refreshed = await refreshAnonymousToken({
            registerAnonymous,
            cookieToJson: () => ({ MUSIC_A: 'anonymous-token' }),
            persistToken,
            logger: quietLogger,
            retryOptions: immediateRetryOptions(),
        });

        expect(refreshed).toBe(true);
        expect(registerAnonymous).toHaveBeenCalledTimes(2);
        expect(persistToken).toHaveBeenCalledWith('anonymous-token');
    });

    it('accepts anonymous cookies returned in the top-level cookie array', async () => {
        const registerAnonymous = vi.fn().mockResolvedValue({
            status: 200,
            body: { code: 200 },
            cookie: ['MUSIC_A=anonymous-token', '__csrf=csrf-token'],
        });
        const cookieToJson = vi.fn().mockReturnValue({ MUSIC_A: 'anonymous-token' });
        const persistToken = vi.fn();

        const refreshed = await refreshAnonymousToken({
            registerAnonymous,
            cookieToJson,
            persistToken,
            logger: quietLogger,
            retryOptions: immediateRetryOptions(),
        });

        expect(refreshed).toBe(true);
        expect(cookieToJson).toHaveBeenCalledWith(
            'MUSIC_A=anonymous-token;__csrf=csrf-token',
        );
        expect(persistToken).toHaveBeenCalledWith('anonymous-token');
    });

    it('includes the upstream response status when anonymous registration fails', async () => {
        const logger = { warn: vi.fn() };
        const registerAnonymous = vi.fn().mockResolvedValue({
            status: 503,
            body: { code: 503, msg: 'service unavailable' },
            cookie: [],
        });

        const refreshed = await refreshAnonymousToken({
            registerAnonymous,
            cookieToJson: vi.fn(),
            persistToken: vi.fn(),
            logger,
            retryOptions: immediateRetryOptions(),
        });

        expect(refreshed).toBe(false);
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining(
                'status=503, code=503, message=service unavailable',
            ),
        );
    });

    it('keeps the existing anonymous token when all refresh attempts fail', async () => {
        const registerAnonymous = vi.fn().mockRejectedValue(new Error('offline'));
        const persistToken = vi.fn();

        const refreshed = await refreshAnonymousToken({
            registerAnonymous,
            cookieToJson: vi.fn(),
            persistToken,
            logger: quietLogger,
            retryOptions: immediateRetryOptions(),
        });

        expect(refreshed).toBe(false);
        expect(registerAnonymous).toHaveBeenCalledTimes(3);
        expect(persistToken).not.toHaveBeenCalled();
    });

    it('times out a hung xeapi refresh instead of stalling startup', async () => {
        const cachedKey = { sk: 'cached-key', version: '1' };
        const getXeapiPublicKey = vi.fn(neverSettles);

        const result = await resolveXeapiPublicKey({
            currentPublicKey: cachedKey,
            deviceId: 'device-id',
            getXeapiPublicKey,
            logger: quietLogger,
            retryOptions: immediateRetryOptions(),
            timeoutMs: 5,
        });

        expect(result).toEqual({ publicKey: cachedKey, refreshed: false });
        expect(getXeapiPublicKey).toHaveBeenCalledTimes(3);
    });

    it('times out a hung anonymous registration instead of stalling startup', async () => {
        const registerAnonymous = vi.fn(neverSettles);
        const persistToken = vi.fn();

        const refreshed = await refreshAnonymousToken({
            registerAnonymous,
            cookieToJson: vi.fn(),
            persistToken,
            logger: quietLogger,
            retryOptions: immediateRetryOptions(),
            timeoutMs: 5,
        });

        expect(refreshed).toBe(false);
        expect(registerAnonymous).toHaveBeenCalledTimes(3);
        expect(persistToken).not.toHaveBeenCalled();
    });
});

describe('NetEase API client IP policy', () => {
    it('drops the implicit client IP so NetEase sees the real egress address', () => {
        const request = vi.fn();
        withoutImplicitClientIp(request)('/api/login/qrcode/client/login', { key: 'k' }, { ip: '116.1.2.3', cookie: 'c' });
        expect(request).toHaveBeenCalledWith('/api/login/qrcode/client/login', { key: 'k' }, { ip: '', cookie: 'c' });
    });

    it('keeps the random CN IP when a request opts into randomCNIP', () => {
        const request = vi.fn();
        const options = { ip: '116.1.2.3', randomCNIP: true };
        withoutImplicitClientIp(request)('/api/song/enhance/player/url/v1', {}, options);
        expect(request).toHaveBeenCalledWith('/api/song/enhance/player/url/v1', {}, options);
    });
});

describe('NetEase QR check module', () => {
    const createOption = (query: Record<string, unknown>) => ({ cookie: query.cookie });
    const upstreamLoginQrCheck = require('@neteasecloudmusicapienhanced/api/module/login_qr_check') as (
        query: Record<string, unknown>,
        request: (uri: string, data: unknown, options: Record<string, unknown>) => Promise<any>,
    ) => Promise<unknown>;
    const upstreamCreateOption = require('@neteasecloudmusicapienhanced/api/util/option') as (
        query: Record<string, unknown>,
    ) => Record<string, unknown>;

    // 上游一旦修好这个 bug，这条会失败：届时删掉 main.cjs 里的替换和 createLoginQrCheck。
    it('is still needed: the upstream module throws a ReferenceError on a rejected poll', async () => {
        const request = vi.fn().mockRejectedValue({ status: 502, body: { code: 502, msg: 'read ECONNRESET' }, cookie: [] });
        await expect(upstreamLoginQrCheck({ key: 'k' }, request)).rejects.toBeInstanceOf(ReferenceError);
    });

    it('matches the upstream module on success', async () => {
        const answer = { status: 200, body: { code: 802, message: '授权中' }, cookie: ['NMTID=b'] };
        const upstreamRequest = vi.fn().mockResolvedValue(answer);
        const ownRequest = vi.fn().mockResolvedValue(answer);
        const query = { key: 'k', cookie: 'os=pc', timestamp: '1' };

        await expect(createLoginQrCheck(upstreamCreateOption)(query, ownRequest))
            .resolves.toEqual(await upstreamLoginQrCheck(query, upstreamRequest));
        expect(ownRequest.mock.calls).toEqual(upstreamRequest.mock.calls);
    });

    it('returns the poll result with the cookie joined into the body', async () => {
        const request = vi.fn().mockResolvedValue({ status: 200, body: { code: 803, message: 'ok' }, cookie: ['MUSIC_U=a', 'NMTID=b'] });
        await expect(createLoginQrCheck(createOption)({ key: 'k', cookie: 'c' }, request)).resolves.toEqual({
            status: 200,
            body: { code: 803, message: 'ok', cookie: 'MUSIC_U=a;NMTID=b' },
            cookie: ['MUSIC_U=a', 'NMTID=b'],
        });
        expect(request).toHaveBeenCalledWith('/api/login/qrcode/client/login', { key: 'k', type: 3 }, { cookie: 'c' });
    });

    // 上游原版在这里抛 ReferenceError，server 只能回 404；现在 server 拿到的是 request 的 answer。
    it.each([
        { status: 502, body: { code: 502, msg: 'read ECONNRESET' }, cookie: [] },
        { status: 400, body: { code: 8821, message: '需要行为验证码验证' }, cookie: [] },
    ])('rethrows the rejected answer $body.code so the server can relay it', async answer => {
        const request = vi.fn().mockRejectedValue(answer);
        await expect(createLoginQrCheck(createOption)({ key: 'k' }, request)).rejects.toBe(answer);
    });
});

describe('NetEase QR network retry', () => {
    const RESET = { status: 502, body: { code: 502, msg: 'read ECONNRESET' }, cookie: [] };
    const retryOptions = () => ({ sleep: vi.fn().mockResolvedValue(undefined), logger: { warn: vi.fn() } });

    it.each(['/api/login/qrcode/unikey', '/api/login/qrcode/client/login'])('sends %s once more after a network-level failure', async (uri) => {
        const ok = { status: 200, body: { code: 801 }, cookie: [] };
        const request = vi.fn().mockRejectedValueOnce(RESET).mockResolvedValueOnce(ok);
        const options = retryOptions();

        await expect(withQrNetworkRetry(request, options)(uri, { key: 'k' }, { cookie: { os: 'pc' } })).resolves.toBe(ok);

        expect(request).toHaveBeenCalledTimes(2);
        expect(options.sleep).toHaveBeenCalledWith(300);
        // 每次都是新的 data / cookie 对象：上游会往 data 上写字段，重发不能带着上一次的改动。
        const [[, firstData, firstOptions], [, secondData, secondOptions]] = request.mock.calls;
        expect(secondData).toEqual({ key: 'k' });
        expect(secondData).not.toBe(firstData);
        expect(secondOptions.cookie).not.toBe(firstOptions.cookie);
    });

    it('gives up after the second failure and hands back that answer', async () => {
        const second = { status: 502, body: { code: 502, msg: 'connect ETIMEDOUT 59.111.181.35:443' }, cookie: [] };
        const request = vi.fn().mockRejectedValueOnce(RESET).mockRejectedValueOnce(second);

        await expect(withQrNetworkRetry(request, retryOptions())('/api/login/qrcode/client/login')).rejects.toBe(second);
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('does not retry a NetEase rejection or a request outside the QR flow', async () => {
        const riskControl = { status: 400, body: { code: 8821, message: '需要行为验证码验证' }, cookie: [] };
        const rejected = vi.fn().mockRejectedValue(riskControl);
        await expect(withQrNetworkRetry(rejected, retryOptions())('/api/login/qrcode/client/login')).rejects.toBe(riskControl);
        expect(rejected).toHaveBeenCalledTimes(1);

        const other = vi.fn().mockRejectedValue(RESET);
        await expect(withQrNetworkRetry(other, retryOptions())('/api/song/enhance/player/url/v1')).rejects.toBe(RESET);
        expect(other).toHaveBeenCalledTimes(1);
    });
});
