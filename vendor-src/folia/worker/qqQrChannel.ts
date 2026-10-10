import { createMqttListenOver, type MqttConnect, type QrEvent, type QrEventListener } from '@yakult-green-tea/qq-music-api/mqtt';

// worker/qqQrChannel.ts

/**
 * QQ 扫码登录通道在 Cloudflare 上的宿主：一个 Durable Object，持有一条出向 MQTT WebSocket。
 *
 * 为什么非要 DO 不可：这条通道的 CONNECT 请求的是 clean session、订阅是 unicast，断连期间上游
 * 既不保留也不补送。Worker 的一次调用结束连接就没了，下一次 `/login/qr/check` 重新连上时
 * `scanned`、`cookies` 已经错过——`cookies` 里装的是换凭证用的令牌，漏掉就是死局。所以必须有个
 * 能跨调用活着的东西握住这条连接，Cloudflare 上只有 DO 能做到。
 *
 * 🔴 它只搬运登录阶段的暂态：`qrcodeID`、二维码图、以及到目前为止收到的 MQTT 事件。凭证交换留在
 * 请求侧（后端的 `exchangeQqLogin` 用的是请求作用域的 HTTP client 与 device），所以这里从头到尾
 * 看不到 credential、musickey 或 sealed token，也就没有什么值得长存的东西。
 *
 * 🔴 成本：出向 WebSocket 不支持 hibernation，二维码活着的时候按 wall-clock 计费。所以「一个二维码
 * 只开一条 socket」和「一定关得掉」是硬要求，不是优化——三重保险见 `open` 的幂等、`close` 的显式
 * 释放，以及 `alarm` 的兜底。
 *
 * 平台类型在这里自己声明：仓库没有装 `@cloudflare/workers-types`，而 DO 与出向 WebSocket 都不在
 * DOM lib 里。声明面刻意收到只用得到的那几个成员。
 */

interface DurableObjectStateLike {
    storage: {
        setAlarm(scheduledTime: number): Promise<void>;
        deleteAlarm(): Promise<void>;
    };
}

/** 二维码最长活 3 分钟（后端 `QR_TTL_MS`）；再长的 ttl 一律截断，计费面不能靠调用方自觉。 */
const MAX_TTL_MS = 180_000;

/**
 * Cloudflare 的 `MqttConnect`。
 *
 * Cloudflare 支持标准的出向 WebSocket constructor。这里必须等 `open` 才 resolve：协议层会在
 * `MqttConnect` resolve 后立刻发送 CONNECT，提早 resolve 会把第一帧丢在握手期间。
 */
export const cloudflareMqttConnect: MqttConnect = (url, protocol, handlers) =>
    new Promise((resolve, reject) => {
        const socket = new WebSocket(url, protocol);
        socket.binaryType = 'arraybuffer';
        let opened = false;
        const timer = setTimeout(() => {
            socket.close();
            reject(new Error('MQTT handshake timeout'));
        }, 20_000);
        const onOpen = (): void => {
            opened = true;
            clearTimeout(timer);
            socket.removeEventListener('open', onOpen);
            resolve({
                // 🔴 只发这个视图覆盖的字节，不是它背后的 ArrayBuffer。协议侧的包是 Node `Buffer` 语义的
                // 分配，可能是一块共享池的切片；直接把 `data.buffer` 交出去会把池里无关的内存一起发上线。
                send: data => {
                    const frame = new Uint8Array(data.byteLength);
                    frame.set(data);
                    socket.send(frame.buffer);
                },
                close: () => socket.close(),
            });
        };
        socket.addEventListener('open', onOpen);
        socket.addEventListener('message', event => handlers.message(event.data));
        socket.addEventListener('close', () => {
            clearTimeout(timer);
            if (opened) handlers.close();
            else reject(new Error('MQTT WebSocket closed before opening'));
        });
        socket.addEventListener('error', () => {
            clearTimeout(timer);
            const error = new Error('MQTT WebSocket error');
            if (opened) handlers.error(error);
            else reject(error);
        });
    });

/** 只有这些事件代表「调用方还不知道的状态变化」；`waiting` 是它重建会话时就假定了的。 */
const isStateChange = (event: QrEvent): boolean => event.type !== 'waiting';

const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });

export class QqQrChannel {
    private readonly state: DurableObjectStateLike;
    private readonly connect: MqttConnect;
    private listener: QrEventListener | null = null;
    private opening: Promise<void> | null = null;
    private events: QrEvent[] = [];
    private image = '';
    private waiters: Array<() => void> = [];

    // 第三个参数只有测试会传；Cloudflare 具现化 DO 时只给前两个。
    public constructor(state: DurableObjectStateLike, _env: unknown, connect: MqttConnect = cloudflareMqttConnect) {
        this.state = state;
        this.connect = connect;
    }

    public async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        try {
            if (url.pathname === '/open') {
                const body = (await request.json()) as { qrcodeId?: string; image?: string; ttlMs?: number };
                await this.open(String(body.qrcodeId ?? ''), String(body.image ?? ''), Number(body.ttlMs ?? 0));
                return json({ ok: true });
            }
            if (url.pathname === '/image') {
                // 被回收过的 DO 没有图。如实回 404 让 `/login/qr/create` 变成 502，比回一个空图好：
                // 空图在界面上是一个永远扫不出来的方块。
                if (!this.image) return json({ error: 'no qr image' }, 404);
                return json({ image: this.image });
            }
            if (url.pathname === '/poll') {
                const body = (await request.json()) as { budgetMs?: number };
                return json({ events: await this.poll(Number(body.budgetMs ?? 0)) });
            }
            if (url.pathname === '/close') {
                await this.release();
                return json({ ok: true });
            }
            return json({ error: 'unknown channel operation' }, 404);
        } catch {
            // 不把底层异常对象写进平台日志，避免未来的 transport 错误夹带 URL 或会话细节。
            console.error('[qq-qr-channel] operation failed');
            return json({ error: 'channel operation failed' }, 502);
        }
    }

    /** 兜底：即使 `/close` 没送到、监听器也没能自己收尾，二维码到期时连接一定被释放。 */
    public async alarm(): Promise<void> {
        await this.release();
    }

    /**
     * 连上并订阅，**订阅成功（SUBACK）才返回**。
     *
     * 必须等：二维码显示出去之前订阅就得存在，否则「显示后、订阅前」这一小段时间里被扫，事件不会补送。
     * 同一个二维码重复调用是幂等的——多开一条 socket 就是同一次登录被计两份 wall-clock。
     */
    private async open(qrcodeId: string, image: string, ttlMs: number): Promise<void> {
        if (!qrcodeId) throw new Error('open requires a qrcodeId');
        if (this.opening) return this.opening;
        if (this.listener) return;
        const ttl = Math.min(Math.max(ttlMs, 0), MAX_TTL_MS);
        this.image = image;
        this.opening = (async () => {
            const listener = createMqttListenOver(this.connect)(qrcodeId, event => this.record(event), ttl);
            this.listener = listener;
            // 监听器自己会在 `ttl` 到期时收尾，alarm 只是它没能收尾时的第二道防线。
            void listener.done.catch(() => this.record({ type: 'loginFailed', payload: null }));
            await this.state.storage.setAlarm(Date.now() + ttl);
            await listener.ready;
        })();
        try {
            await this.opening;
        } catch (error) {
            await this.release();
            throw error;
        } finally {
            this.opening = null;
        }
    }

    /**
     * 一次限时观察。
     *
     * 回的是**到目前为止的完整事件列**而不是增量：调用方是无状态的，每次都把会话重建成 `waiting`，
     * 只回新事件会让它永远停在 801。等待条件相应地是「出现了 `waiting` 以外的事件」——那才是它还
     * 不知道的东西，否则没人扫的时候每 2 秒一次的轮询会立刻返回，白白浪费这个预算。
     */
    private async poll(budgetMs: number): Promise<QrEvent[]> {
        // 被回收过的 DO 没有 socket 也没有事件，这个二维码已经废了。如实说「超时」，让用户看到一个
        // 可重试的「已过期」，而不是一个永远转下去的圈。重连没有意义：那是一条新的 MQTT 会话。
        if (!this.listener) return [{ type: 'timeout', payload: null }];
        if (this.events.some(isStateChange)) return [...this.events];
        await this.waitForChange(Math.min(Math.max(budgetMs, 0), MAX_TTL_MS));
        return [...this.events];
    }

    private waitForChange(budgetMs: number): Promise<void> {
        return new Promise<void>(resolve => {
            let settled = false;
            const done = (): void => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                this.waiters = this.waiters.filter(waiter => waiter !== done);
                resolve();
            };
            const timer = setTimeout(done, budgetMs);
            this.waiters.push(done);
        });
    }

    private record(event: QrEvent): void {
        this.events.push(event);
        if (!isStateChange(event)) return;
        for (const waiter of [...this.waiters]) waiter();
    }

    /** 关 socket、清暂态、撤销 alarm。可以重复调用。 */
    private async release(): Promise<void> {
        this.listener?.close();
        this.listener = null;
        this.image = '';
        for (const waiter of [...this.waiters]) waiter();
        await this.state.storage.deleteAlarm().catch(() => undefined);
    }
}
