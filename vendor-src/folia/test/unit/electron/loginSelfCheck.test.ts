import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

// test/unit/electron/loginSelfCheck.test.ts
// 自检的每一层都换成可编排的假模块：DNS 应答、按地址决定 TCP / TLS 握手的结局、HTTPS 响应。

const { isFakeIp, maskProxyCredentials, runLoginSelfCheck } = require('../../../electron/loginSelfCheck.cjs') as {
    isFakeIp: (address: string) => boolean;
    maskProxyCredentials: (value: string) => string;
    runLoginSelfCheck: (options: Record<string, unknown>) => Promise<any>;
};

type HandshakeOutcome = 'ok' | { failAt: 'tcp' | 'tls'; code: string; message: string };

const createTlsModule = (outcomes: Record<string, HandshakeOutcome>) => ({
    connect: vi.fn((options: { host: string }) => {
        const socket = Object.assign(new EventEmitter(), { destroy: vi.fn(), getProtocol: () => 'TLSv1.3' });
        const outcome = outcomes[options.host] ?? 'ok';
        setImmediate(() => {
            if (outcome !== 'ok' && outcome.failAt === 'tcp') {
                socket.emit('error', Object.assign(new Error(outcome.message), { code: outcome.code }));
                return;
            }
            socket.emit('connect');
            if (outcome === 'ok') socket.emit('secureConnect');
            else socket.emit('error', Object.assign(new Error(outcome.message), { code: outcome.code }));
        });
        return socket;
    }),
});

const createHttpModule = (respond: (options: any) => { statusCode: number; date?: string; remote?: string } | Error) => ({
    get: vi.fn((options: any, callback: (response: any) => void) => {
        const request = Object.assign(new EventEmitter(), { destroy: vi.fn() });
        setImmediate(() => {
            const result = respond(options);
            if (result instanceof Error) {
                request.emit('error', result);
                return;
            }
            callback({
                statusCode: result.statusCode,
                headers: result.date ? { date: result.date } : {},
                socket: { remoteAddress: result.remote ?? '59.111.181.35', remoteFamily: 'IPv4' },
                resume: vi.fn(),
            });
        });
        return request;
    }),
});

const lookupOf = (answers: Record<string, Array<{ address: string; family: number }> | Error>) => vi.fn(async (host: string) => {
    const answer = answers[host];
    if (answer instanceof Error) throw answer;
    return answer ?? [];
});

const NOW = Date.UTC(2026, 9, 7, 12, 0, 0);

describe('login self-check', () => {
    it('tests IPv4 and IPv6 separately, so an IPv6-only TLS reset stands out', async () => {
        const result = await runLoginSelfCheck({
            providerId: 'netease',
            backend: { status: 'running', port: 4100, error: null },
            hosts: ['interfacepc.music.163.com'],
            env: {},
            now: () => NOW,
            lookup: lookupOf({
                'interfacepc.music.163.com': [
                    { address: '240e:96c:6100::7', family: 6 },
                    { address: '59.111.181.35', family: 4 },
                ],
            }),
            tlsModule: createTlsModule({
                '240e:96c:6100::7': { failAt: 'tls', code: 'ECONNRESET', message: 'read ECONNRESET' },
            }),
            httpsModule: createHttpModule(() => ({ statusCode: 200, date: new Date(NOW).toUTCString() })),
            httpModule: createHttpModule(() => ({ statusCode: 200 })),
        });

        expect(result).toMatchObject({ providerId: 'netease', runtime: 'electron' });
        expect(result.backend).toMatchObject({ status: 'running', port: 4100, probe: { ok: true, httpStatus: 200 } });
        const [host] = result.hosts;
        expect(host.dns).toMatchObject({ fakeIp: false, error: null });
        expect(host.connections).toEqual([
            expect.objectContaining({ address: '59.111.181.35', family: 4, error: null, protocol: 'TLSv1.3' }),
            expect.objectContaining({ address: '240e:96c:6100::7', family: 6, error: { code: 'ECONNRESET', message: 'read ECONNRESET', phase: 'tls' } }),
        ]);
        expect(host.https).toMatchObject({ httpStatus: 200, error: null, clockSkewMs: 0 });
    });

    it('flags a fake-ip answer, masks proxy credentials and reads the system proxy', async () => {
        const resolveSystemProxy = vi.fn().mockResolvedValue('PROXY 127.0.0.1:7890');
        const result = await runLoginSelfCheck({
            providerId: 'qq',
            backend: { status: 'running', port: 4200, error: null },
            hosts: ['u.y.qq.com'],
            env: { https_proxy: 'http://user:secret@10.0.0.2:8080', NO_PROXY: 'localhost' },
            resolveSystemProxy,
            now: () => NOW,
            lookup: lookupOf({ 'u.y.qq.com': [{ address: '198.18.6.203', family: 4 }] }),
            tlsModule: createTlsModule({}),
            httpsModule: createHttpModule(() => ({ statusCode: 404 })),
            httpModule: createHttpModule(() => ({ statusCode: 404 })),
        });

        expect(resolveSystemProxy).toHaveBeenCalledWith('https://u.y.qq.com');
        expect(result.proxy).toEqual({
            env: { HTTPS_PROXY: 'http://***@10.0.0.2:8080', NO_PROXY: 'localhost' },
            system: 'PROXY 127.0.0.1:7890',
        });
        expect(result.hosts[0].dns.fakeIp).toBe(true);
        expect(result.hosts[0].https).toMatchObject({ httpStatus: 404, clockSkewMs: null });
    });

    it('skips the connection probes when DNS fails and does not probe a backend that is not running', async () => {
        const result = await runLoginSelfCheck({
            providerId: 'netease',
            backend: { status: 'error', port: null, error: 'xeapi-key: timed out' },
            hosts: ['interfacepc.music.163.com'],
            env: {},
            now: () => NOW,
            lookup: lookupOf({
                'interfacepc.music.163.com': Object.assign(new Error('getaddrinfo ENOTFOUND interfacepc.music.163.com'), { code: 'ENOTFOUND' }),
            }),
            tlsModule: createTlsModule({}),
            httpsModule: createHttpModule(() => ({ statusCode: 200 })),
            httpModule: createHttpModule(() => ({ statusCode: 200 })),
        });

        expect(result.backend).toEqual({ status: 'error', port: null, error: 'xeapi-key: timed out', probe: null });
        expect(result.hosts[0]).toMatchObject({
            dns: { addresses: [], error: { code: 'ENOTFOUND', phase: 'dns' } },
            connections: [],
            https: null,
        });
    });

    it('reports a TCP failure and an unreachable local backend', async () => {
        const result = await runLoginSelfCheck({
            providerId: 'netease',
            backend: { status: 'running', port: 4100, error: null },
            hosts: ['interfacepc.music.163.com'],
            env: {},
            now: () => NOW,
            lookup: lookupOf({ 'interfacepc.music.163.com': [{ address: '59.111.181.35', family: 4 }] }),
            tlsModule: createTlsModule({ '59.111.181.35': { failAt: 'tcp', code: 'ETIMEDOUT', message: 'connect ETIMEDOUT 59.111.181.35:443' } }),
            httpsModule: createHttpModule(() => Object.assign(new Error('connect ETIMEDOUT 59.111.181.35:443'), { code: 'ETIMEDOUT' })),
            httpModule: createHttpModule(() => Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:4100'), { code: 'ECONNREFUSED' })),
        });

        expect(result.backend.probe).toMatchObject({ ok: false, error: { code: 'ECONNREFUSED' } });
        expect(result.hosts[0].connections[0].error).toEqual({ code: 'ETIMEDOUT', message: 'connect ETIMEDOUT 59.111.181.35:443', phase: 'tcp' });
        expect(result.hosts[0].https.error).toMatchObject({ code: 'ETIMEDOUT', phase: 'http' });
    });

    it('recognizes the fake-ip range and masks credentials only', () => {
        expect(isFakeIp('198.18.0.1')).toBe(true);
        expect(isFakeIp('198.19.255.1')).toBe(true);
        expect(isFakeIp('198.20.0.1')).toBe(false);
        expect(isFakeIp('59.111.181.35')).toBe(false);
        expect(maskProxyCredentials('socks5://alice:pw@127.0.0.1:1080')).toBe('socks5://***@127.0.0.1:1080');
        expect(maskProxyCredentials('http://127.0.0.1:7890')).toBe('http://127.0.0.1:7890');
    });
});
