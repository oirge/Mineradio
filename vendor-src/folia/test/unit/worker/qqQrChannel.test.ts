import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MqttConnect, MqttSocketHandlers } from '@yakult-green-tea/qq-music-api/mqtt';
import { QqQrChannel, cloudflareMqttConnect } from '../../../worker/qqQrChannel';

// test/unit/worker/qqQrChannel.test.ts
// QQ 扫码登录通道的 Durable Object。
//
// 它是这条通道在 Cloudflare 上唯一持有 MQTT 连接的地方，所以这里守的是三件会真的出问题的事：
// 订阅要在二维码显示之前就位（clean session + unicast，之前发生的事不会补送）；一个二维码只能有
// 一条 socket（多一条就是同一次登录多一份 wall-clock 计费）；以及连接一定关得掉。
//
// 用的是真的 codec：注入的是一个会按协议应答的假 broker，不是把监听器整个 mock 掉。

const varint = (value: number): Uint8Array => {
    const bytes: number[] = [];
    let rest = value;
    do {
        let digit = rest % 128;
        rest = Math.floor(rest / 128);
        if (rest > 0) digit |= 0x80;
        bytes.push(digit);
    } while (rest > 0);
    return Uint8Array.from(bytes);
};

const concat = (...parts: Uint8Array[]): Uint8Array => {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
};

const utf8 = (value: string): Uint8Array => {
    const data = new TextEncoder().encode(value);
    return concat(Uint8Array.from([data.length >> 8, data.length & 0xff]), data);
};

const properties = (entries: Array<[string, string]> = []): Uint8Array => {
    const body = concat(...entries.map(([key, value]) => concat(Uint8Array.from([0x26]), utf8(key), utf8(value))));
    return concat(varint(body.length), body);
};

const frame = (header: number, body: Uint8Array): Uint8Array =>
    concat(Uint8Array.from([header]), varint(body.length), body);

const CONNACK = frame(0x20, concat(Uint8Array.from([0x00, 0x00]), properties()));
const SUBACK = frame(0x90, concat(Uint8Array.from([0x00, 0x01]), properties(), Uint8Array.from([0x00])));
const publish = (type: string, payload: Record<string, unknown>): Uint8Array =>
    frame(
        0x30,
        concat(utf8('management.qrcode_login/x'), properties([['type', type]]), new TextEncoder().encode(JSON.stringify(payload))),
    );

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/** 一个按协议应答的假 broker：收到 CONNECT 回 CONNACK，收到 SUBSCRIBE 回 SUBACK。 */
const createBroker = () => {
    const sockets: Array<{ handlers: MqttSocketHandlers; closed: boolean }> = [];
    const connect: MqttConnect = async (_url, _protocol, handlers) => {
        const socket = { handlers, closed: false };
        sockets.push(socket);
        return {
            send: data => {
                const kind = data[0] >> 4;
                if (kind === 1) queueMicrotask(() => handlers.message(CONNACK));
                if (kind === 8) queueMicrotask(() => handlers.message(SUBACK));
            },
            close: () => {
                if (socket.closed) return;
                socket.closed = true;
                handlers.close();
            },
        };
    };
    return { connect, sockets, deliver: (bytes: Uint8Array) => sockets[0].handlers.message(bytes) };
};

const createState = () => ({
    storage: { setAlarm: vi.fn().mockResolvedValue(undefined), deleteAlarm: vi.fn().mockResolvedValue(undefined) },
});

const call = async (channel: QqQrChannel, operation: string, body: unknown = {}) =>
    channel.fetch(
        new Request(`https://qq-qr-channel${operation}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        }),
    );

const open = async (channel: QqQrChannel, ttlMs = 60_000) =>
    call(channel, '/open', { qrcodeId: 'qr-fixture', image: 'data:image/png;base64,AAAA', ttlMs });

describe('cloudflareMqttConnect', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('uses the WebSocket constructor and resolves only after the MQTT socket opens', async () => {
        const listeners = new Map<string, Set<(event?: unknown) => void>>();
        const socket = {
            binaryType: 'blob',
            send: vi.fn(),
            close: vi.fn(),
            addEventListener: vi.fn((type: string, listener: (event?: unknown) => void) => {
                const entries = listeners.get(type) ?? new Set();
                entries.add(listener);
                listeners.set(type, entries);
            }),
            removeEventListener: vi.fn((type: string, listener: (event?: unknown) => void) => {
                listeners.get(type)?.delete(listener);
            }),
        };
        const webSocket = vi.fn(function WebSocket() {
            return socket;
        });
        vi.stubGlobal('WebSocket', webSocket);

        let settled = false;
        const connecting = cloudflareMqttConnect('wss://mu.y.qq.com/ws/handshake', 'mqtt', {
            message: vi.fn(),
            close: vi.fn(),
            error: vi.fn(),
        });
        void connecting.then(() => {
            settled = true;
        });

        await Promise.resolve();
        expect(settled).toBe(false);
        expect(webSocket).toHaveBeenCalledWith('wss://mu.y.qq.com/ws/handshake', 'mqtt');

        for (const listener of listeners.get('open') ?? []) listener();
        await connecting;

        expect(socket.binaryType).toBe('arraybuffer');
    });
});

describe('QqQrChannel', () => {
    describe('open', () => {
        it('only resolves once the subscription is live', async () => {
            // 🔴 这条通道全部的正确性都压在这个顺序上：CONNECT 请求的是 clean session、订阅是
            // unicast，订阅之前发生的扫码事件上游不会补送。先把二维码显示出去就等于发了一个可能
            // 永远看不到结果的码。
            const broker = createBroker();
            const channel = new QqQrChannel(createState(), {}, broker.connect);

            const response = await open(channel);

            expect(response.status).toBe(200);
            expect(broker.sockets).toHaveLength(1);
            // 订阅完成后监听器立刻记下 waiting，这就是「已就位」的可观测证据。
            const body = (await (await call(channel, '/poll', { budgetMs: 0 })).json()) as { events: unknown[] };
            expect(body.events).toEqual([{ type: 'waiting', payload: null }]);
        });

        it('never opens a second socket for the same code', async () => {
            // 一个二维码两条连接就是同一次登录被计两份 wall-clock —— 出向 WebSocket 不支持
            // hibernation，二维码活着的时候是按墙上时间收费的。
            const broker = createBroker();
            const channel = new QqQrChannel(createState(), {}, broker.connect);

            await open(channel);
            await open(channel);

            expect(broker.sockets).toHaveLength(1);
        });

        it('does not open a second socket when two opens race', async () => {
            const broker = createBroker();
            const channel = new QqQrChannel(createState(), {}, broker.connect);

            await Promise.all([open(channel), open(channel)]);

            expect(broker.sockets).toHaveLength(1);
        });

        it('arms an alarm as the backstop for releasing the connection', async () => {
            const state = createState();
            const channel = new QqQrChannel(state, {}, createBroker().connect);

            await open(channel, 60_000);

            expect(state.storage.setAlarm).toHaveBeenCalledTimes(1);
        });

        it('caps the lifetime at the upstream QR TTL', async () => {
            // 计费面不能靠调用方自觉：即使有人送来一个荒唐的 ttl，连接也不该活过二维码本身。
            const state = createState();
            const channel = new QqQrChannel(state, {}, createBroker().connect);

            await open(channel, 86_400_000);

            expect(state.storage.setAlarm.mock.calls[0][0] - Date.now()).toBeLessThanOrEqual(180_000);
        });

        it('reports a failure instead of leaving a half-open channel', async () => {
            const failing: MqttConnect = async () => {
                throw new Error('upgrade refused');
            };
            const state = createState();
            const channel = new QqQrChannel(state, {}, failing);

            const response = await open(channel);

            expect(response.status).toBe(502);
            expect(state.storage.deleteAlarm).toHaveBeenCalled();
        });
    });

    describe('poll', () => {
        const eventsOf = async (response: Response) =>
            ((await response.json()) as { events: Array<{ type: string }> }).events.map(event => event.type);

        it('answers with the whole event list, not the new ones', async () => {
            // 🔴 调用方是无状态的：它每次都把会话重建成 `waiting`。只回增量会让它永远停在 801，
            // 用户扫了码界面却毫无反应。
            const broker = createBroker();
            const channel = new QqQrChannel(createState(), {}, broker.connect);
            await open(channel);

            broker.deliver(publish('scanned', {}));
            await tick();

            expect(await eventsOf(await call(channel, '/poll', { budgetMs: 0 }))).toEqual(['waiting', 'scanned']);
        });

        it('holds the request open until something the caller does not know about happens', async () => {
            const broker = createBroker();
            const channel = new QqQrChannel(createState(), {}, broker.connect);
            await open(channel);

            let settled = false;
            const pending = call(channel, '/poll', { budgetMs: 5_000 }).then(response => {
                settled = true;
                return response;
            });
            await tick();
            // `waiting` 已经在列表里，但它正是调用方重建会话时就假定的状态，不值得叫醒它。
            expect(settled).toBe(false);

            broker.deliver(publish('scanned', {}));

            expect(await eventsOf(await pending)).toEqual(['waiting', 'scanned']);
        });

        it('gives up at the budget rather than holding the request forever', async () => {
            const broker = createBroker();
            const channel = new QqQrChannel(createState(), {}, broker.connect);
            await open(channel);

            expect(await eventsOf(await call(channel, '/poll', { budgetMs: 20 }))).toEqual(['waiting']);
        });

        it('reports a timeout for a channel that has no connection', async () => {
            // DO 被回收过就没有 socket 了，这个二维码已经废了。重连没有意义（那是一条新的 MQTT
            // 会话，扫码事件不会重来），所以如实说超时，让用户看到可重试的「已过期」而不是死转。
            const channel = new QqQrChannel(createState(), {}, createBroker().connect);

            expect(await eventsOf(await call(channel, '/poll', { budgetMs: 0 }))).toEqual(['timeout']);
        });

        it('keeps replaying the terminal event until the channel is released', async () => {
            // 交换失败重试时还得能再拿到同一份 payload；停止投递的时机是调用方明确 `/close`。
            const broker = createBroker();
            const channel = new QqQrChannel(createState(), {}, broker.connect);
            await open(channel);
            broker.deliver(publish('cookies', { cookies: {} }));
            await tick();

            expect(await eventsOf(await call(channel, '/poll', { budgetMs: 0 }))).toContain('cookies');
            expect(await eventsOf(await call(channel, '/poll', { budgetMs: 0 }))).toContain('cookies');
        });
    });

    describe('image', () => {
        it('hands back the code the channel was opened with', async () => {
            const channel = new QqQrChannel(createState(), {}, createBroker().connect);
            await open(channel);

            const body = (await (await call(channel, '/image')).json()) as { image: string };

            expect(body.image).toBe('data:image/png;base64,AAAA');
        });

        it('answers 404 rather than an empty code when the channel is gone', async () => {
            const channel = new QqQrChannel(createState(), {}, createBroker().connect);

            expect((await call(channel, '/image')).status).toBe(404);
        });
    });

    describe('release', () => {
        it('closes the socket and disarms the alarm on close', async () => {
            const broker = createBroker();
            const state = createState();
            const channel = new QqQrChannel(state, {}, broker.connect);
            await open(channel);

            await call(channel, '/close');

            expect(broker.sockets[0].closed).toBe(true);
            expect(state.storage.deleteAlarm).toHaveBeenCalled();
        });

        it('wakes a poll that was waiting on the closed channel', async () => {
            const broker = createBroker();
            const channel = new QqQrChannel(createState(), {}, broker.connect);
            await open(channel);
            const pending = call(channel, '/poll', { budgetMs: 30_000 });

            await call(channel, '/close');

            expect((await pending).status).toBe(200);
        });

        it('closes the socket when the alarm fires', async () => {
            // 最后一道防线：`/close` 没送到、监听器也没能自己收尾时，计费仍然停得下来。
            const broker = createBroker();
            const channel = new QqQrChannel(createState(), {}, broker.connect);
            await open(channel);

            await channel.alarm();

            expect(broker.sockets[0].closed).toBe(true);
        });

        it('is safe to call twice', async () => {
            const channel = new QqQrChannel(createState(), {}, createBroker().connect);
            await open(channel);

            await call(channel, '/close');

            expect((await call(channel, '/close')).status).toBe(200);
        });
    });

    it('rejects an unknown operation', async () => {
        const channel = new QqQrChannel(createState(), {}, createBroker().connect);

        expect((await call(channel, '/whatever')).status).toBe(404);
    });
});
