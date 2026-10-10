import handleRequest, { type QqQrRelay, type QrEvent } from '@yakult-green-tea/qq-music-api/serverless';

// worker/qq.ts

/**
 * QQ 音乐 API 的 serverless 接入层。
 *
 * 后端 3.0.0 的 `./serverless` 导出只认识自己的路径（`/login/status`、`/getMusicPlay/:songmid` …），
 * 不知道宿主把它挂在哪个前缀下。两个平台的前缀都是 `/api/qq`，差别只在怎么把子路径送进来：
 * Cloudflare 由 `run_worker_first` 直接把原始 pathname 交过来，Vercel 则因为 frameworkless 项目
 * 不支持嵌套 catch-all，要先经 `vercel.json` rewrite 成 `?path=` 再还原。
 * 两边最后都收敛到这里的 `handleQqServerlessRequest`，平台差异不外溢到 qqTransport。
 */

export const QQ_API_PREFIX = '/api/qq';

// 后端 `ServerlessEnv` 只读这两个 secret；未设 `QQ_SESSION_SECRET` 时登录路由回 501、曲库路由照常，
// 绝不自动生成（那会让「重启即掉登录」这个 bug 换个地方原样重现）。
export type QqServerlessEnv = {
  QQ_SESSION_SECRET?: string;
  QQ_SESSION_SECRET_PREVIOUS?: string;
  /**
   * QQ 扫码登录通道的 Durable Object namespace。**可选**：没绑定就只有微信，这是能力声明不是错误。
   * binding 不在入库的 `wrangler.jsonc` 里——那个文件是 README 一键部署按钮消费的，DO migration
   * 一旦入库就套用到每一个点按钮的人，而且 migration 有黏性（日后移除得再写一条 delete migration）。
   * 想要这条通道的人按 `deploy/docker/qq-api/README.md` 自己加上 binding。
   */
  QQ_QR_CHANNEL?: DurableObjectNamespaceLike;
};

/** 只声明用得到的那两个成员；仓库没装 `@cloudflare/workers-types`。 */
type DurableObjectNamespaceLike = {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): { fetch(request: Request): Promise<Response> };
};

type DurableObjectIdLike = { toString(): string };

/**
 * 二维码在 DO 命名空间里的名字。
 *
 * 不直接用 `qrcodeID`：它就印在二维码图里，任何扫过的人都知道。虽然对外只有握着合法 `unikey` 的
 * 请求才进得来，但把对象名做成不可猜是零成本的纵深，顺带也不用担心上游哪天换了 ID 的字符集。
 */
const channelName = async (qrcodeId: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`qr:${qrcodeId}`));
  return [...new Uint8Array(mac)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * 把 Durable Object 包成后端认识的中性 `QqQrRelay`。
 *
 * 平台细节（namespace、id 推导、DO 的 fetch 协议）全部留在这一层，包那边只看到四个方法——正是
 * 两个仓库的分工：协议与 codec 在 `qq-music-api`，binding 与 Cloudflare 路由在这里。
 */
const createDurableObjectRelay = (namespace: DurableObjectNamespaceLike, secret: string): QqQrRelay => {
  const call = async (qrcodeId: string, operation: string, body?: unknown): Promise<Response> => {
    const stub = namespace.get(namespace.idFromName(await channelName(qrcodeId, secret)));
    // URL 的 origin 无意义，DO 只看 pathname；用 `https://qq-qr-channel` 让日志里一眼看得出来。
    return stub.fetch(
      new Request(`https://qq-qr-channel${operation}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      }),
    );
  };
  const expectOk = async (response: Response, what: string): Promise<Record<string, unknown>> => {
    if (!response.ok) throw new Error(`QQ QR channel ${what} failed: HTTP ${response.status}`);
    return (await response.json()) as Record<string, unknown>;
  };
  return {
    open: async (qrcodeId, image, ttlMs) => {
      await expectOk(await call(qrcodeId, '/open', { qrcodeId, image, ttlMs }), 'open');
    },
    image: async qrcodeId => String((await expectOk(await call(qrcodeId, '/image'), 'image')).image ?? ''),
    poll: async (qrcodeId, budgetMs) => {
      const body = await expectOk(await call(qrcodeId, '/poll', { budgetMs }), 'poll');
      return Array.isArray(body.events) ? (body.events as QrEvent[]) : [];
    },
    close: async qrcodeId => {
      await expectOk(await call(qrcodeId, '/close'), 'close');
    },
  };
};

/**
 * 有 binding **且**有 secret 才提供 relay。
 *
 * 也要 secret 是因为对象名是用它派生的；而且没有 secret 时登录路由本来就回 501，此时宣告一条
 * 点进去必定失败的通道只会让人白扫一次。
 */
const relayFor = (env: QqServerlessEnv): QqQrRelay | undefined =>
  env.QQ_QR_CHANNEL && env.QQ_SESSION_SECRET
    ? createDurableObjectRelay(env.QQ_QR_CHANNEL, env.QQ_SESSION_SECRET)
    : undefined;

/**
 * 把宿主前缀下的请求还原成后端认识的路径，再交给 3.0.0 的 `handleRequest`。
 * `pathname` 已经是去掉 `/api/qq` 之后的部分（含前导斜杠），`search` 原样透传。
 */
export async function handleQqServerlessRequest(
  request: Request,
  pathname: string,
  search: string,
  env: QqServerlessEnv,
): Promise<Response> {
  const origin = new URL(request.url).origin;
  const target = new URL(`${pathname.startsWith('/') ? pathname : `/${pathname}`}${search}`, origin);
  // 用原请求构造新请求，method / headers / body 全部保留：`X-QQ-Session` 就是靠这里带到后端的。
  // 第三个参数是宿主能力，不是环境变量：`env` 是每个平台都产得出的字符串表，binding 不是字符串。
  return handleRequest(
    new Request(target, request),
    {
      QQ_SESSION_SECRET: env.QQ_SESSION_SECRET,
      QQ_SESSION_SECRET_PREVIOUS: env.QQ_SESSION_SECRET_PREVIOUS,
    },
    { qqRelay: relayFor(env) },
  );
}

/** Cloudflare 入口：`run_worker_first: ["/api/*"]` 会把原始 pathname 原样送到这里。 */
export async function handleQq(request: Request, env: QqServerlessEnv): Promise<Response> {
  const url = new URL(request.url);
  const rest = url.pathname.slice(QQ_API_PREFIX.length);
  return handleQqServerlessRequest(request, rest || '/', url.search, env);
}
