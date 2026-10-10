import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

// test/unit/electron/networkRecorder.test.ts
// 连接层记录器对着一个真实的本地 HTTP 服务跑：diagnostics_channel 与 socket 事件都是 Node 自己发的，不打桩。

const { createHostClassifier, createNetworkRecorder } = require('../../../electron/networkRecorder.cjs') as {
    createHostClassifier: (hosts: Record<string, string[]>) => (host: string) => string | null;
    createNetworkRecorder: (options?: Record<string, unknown>) => {
        start: () => void;
        stop: () => void;
        run: <T>(tag: string, fn: () => T) => T;
        entriesForTag: (tag: string) => any[];
        snapshot: (providerId: string) => any[];
    };
};

const servers: http.Server[] = [];
const recorders: Array<{ stop: () => void }> = [];

afterEach(async () => {
    for (const recorder of recorders.splice(0)) recorder.stop();
    await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

const startServer = async (): Promise<number> => {
    const server = http.createServer((request, response) => {
        // 模拟对端在请求发出之后直接断开连接。
        if (request.url?.startsWith('/reset')) {
            request.socket.destroy();
            return;
        }
        response.end('ok');
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    return (server.address() as AddressInfo).port;
};

const get = (url: string) => new Promise<number | string>((resolve) => {
    http.get(url, (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode ?? 0));
    }).on('error', (error: NodeJS.ErrnoException) => resolve(error.code ?? 'error'));
});

const createRecorder = () => {
    const recorder = createNetworkRecorder({ providerHosts: { netease: ['127.0.0.1'] } });
    recorder.start();
    recorders.push(recorder);
    return recorder;
};

describe('network recorder', () => {
    it('attributes hosts to providers by domain suffix', () => {
        const classify = createHostClassifier({ netease: ['163.com'], qq: ['qq.com'] });
        expect(classify('interfacepc.music.163.com')).toBe('netease');
        expect(classify('163.com')).toBe('netease');
        expect(classify('mu.y.qq.com')).toBe('qq');
        expect(classify('evil163.com')).toBeNull();
        expect(classify('example.org')).toBeNull();
        expect(classify('')).toBeNull();
    });

    it('records the connection, the response and the tag of a successful request', async () => {
        const port = await startServer();
        const recorder = createRecorder();

        const status = await recorder.run('login#1', () => get(`http://127.0.0.1:${port}/api/login?key=secret-ish`));

        expect(status).toBe(200);
        const [entry] = recorder.entriesForTag('login#1');
        expect(entry).toMatchObject({
            providerId: 'netease',
            tag: 'login#1',
            method: 'GET',
            host: '127.0.0.1',
            // 只留路径，query 不进记录。
            path: '/api/login',
            remote: { address: '127.0.0.1', family: 4 },
            status: 200,
            error: null,
            settled: 'response',
        });
        expect(entry.connectMs).toEqual(expect.any(Number));
        expect(entry.totalMs).toEqual(expect.any(Number));
        expect(entry).not.toHaveProperty('request');
    });

    it('records where a request that the peer reset failed', async () => {
        const port = await startServer();
        const recorder = createRecorder();

        const status = await get(`http://127.0.0.1:${port}/reset`);

        expect(status).toBe('ECONNRESET');
        const [entry] = recorder.snapshot('netease');
        expect(entry).toMatchObject({
            tag: null,
            status: null,
            settled: 'error',
            // 连上了、请求已经发出，在等响应时被断开。
            error: { code: 'ECONNRESET', phase: 'request' },
        });
    });

    it('ignores hosts that belong to no provider and stops recording after stop()', async () => {
        const port = await startServer();
        const recorder = createNetworkRecorder({ providerHosts: { qq: ['qq.com'] } });
        recorder.start();
        recorders.push(recorder);

        await get(`http://127.0.0.1:${port}/`);
        expect(recorder.snapshot('qq')).toEqual([]);

        const netease = createRecorder();
        netease.stop();
        await get(`http://127.0.0.1:${port}/`);
        expect(netease.snapshot('netease')).toEqual([]);
    });

    it('keeps the most recent entries per provider, so busy traffic of one cannot push out the other', async () => {
        const port = await startServer();
        const recorder = createNetworkRecorder({ providerHosts: { netease: ['127.0.0.1'], qq: ['localhost'] }, maxEntries: 2 });
        recorder.start();
        recorders.push(recorder);

        await get(`http://localhost:${port}/qq-login`);
        for (const path of ['/a', '/b', '/c']) await get(`http://127.0.0.1:${port}${path}`);

        expect(recorder.snapshot('netease').map(entry => entry.path)).toEqual(['/b', '/c']);
        expect(recorder.snapshot('qq').map(entry => entry.path)).toEqual(['/qq-login']);
    });

    it('keeps only the most recent entries', async () => {
        const port = await startServer();
        const recorder = createNetworkRecorder({ providerHosts: { netease: ['127.0.0.1'] }, maxEntries: 2 });
        recorder.start();
        recorders.push(recorder);

        for (const path of ['/a', '/b', '/c']) await get(`http://127.0.0.1:${port}${path}`);

        expect(recorder.snapshot('netease').map(entry => entry.path)).toEqual(['/b', '/c']);
    });
});
