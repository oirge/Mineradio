import express from 'express';
import generateTheme from '/app/api/generate-theme.js';
import generateOpenAiTheme from '/app/api/generate-theme_openai.js';
import lyricProxy from '/app/api/lyric-proxy.js';
import segmentLyrics from '/app/api/segment-lyrics.js';

// 当前文件：把现有 Vercel 风格处理器装配为 Docker 常驻 HTTP 服务。
//
// api-ts/ 下的处理器有两种调用约定，编译进 api/ 之后依然并存，这里必须分开对待：
//   - Node 风格 `(req, res)` —— generate-theme、lyric-proxy，Express 可以直接挂。
//   - Edge 风格 `(Request) => Response` —— generate-theme_openai、segment-lyrics，
//     必须经 `fromEdge` 适配。直接挂的话处理器会去调 Express 上不存在的 `req.json()`，
//     而它返回的 Response 也没有人写回响应。
// body 解析器因此按路由挂而不是全局 `app.use`：Edge 路由要的是没被解析过的原始字节。

const REQUEST_BODY_LIMIT = '4mb';

// 逐跳头由 Node 自己管理，转成 fetch Request / 写回 Express 时都要丢掉。
const HOP_BY_HOP_HEADERS = new Set([
    'connection',
    'keep-alive',
    'transfer-encoding',
    'upgrade',
    'content-length',
    'host',
]);

const toFetchHeaders = (nodeHeaders) => {
    const headers = new Headers();

    for (const [key, value] of Object.entries(nodeHeaders)) {
        if (value === undefined || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
        for (const item of Array.isArray(value) ? value : [value]) {
            headers.append(key, item);
        }
    }

    return headers;
};

const fromEdge = (handler) => async (req, res, next) => {
    try {
        const origin = `${req.protocol}://${req.get('host') ?? 'localhost'}`;
        // express.raw 在没有 body 时给出空 Buffer，而给 GET/HEAD 带 body 构造 Request 会直接抛。
        const body = Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : undefined;
        const response = await handler(new Request(new URL(req.originalUrl, origin), {
            method: req.method,
            headers: toFetchHeaders(req.headers),
            body,
        }));

        res.status(response.status);
        response.headers.forEach((value, key) => {
            if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });
        res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
        next(error);
    }
};

// Navidrome 预置凭据：三项都填才生效。只缺一两项多半是填漏了，启动时报出来，端点照常返回未配置。
const readNavidromePreset = () => {
    const serverUrl = (process.env.NAVIDROME_URL || '').trim().replace(/\/+$/, '');
    const username = (process.env.NAVIDROME_USERNAME || '').trim();
    const password = process.env.NAVIDROME_PASSWORD || '';
    const filled = [serverUrl, username, password].filter(Boolean).length;
    if (filled === 0) return null;
    if (filled < 3) {
        console.warn('[folia-web-api] NAVIDROME_URL / NAVIDROME_USERNAME / NAVIDROME_PASSWORD must all be set; Navidrome preset disabled.');
        return null;
    }
    // 浏览器拿它直接发请求，漏写协议会变成相对路径，每个请求都悄悄失败。
    let protocol = '';
    try {
        protocol = new URL(serverUrl).protocol;
    } catch {
        // 解析失败按无效处理
    }
    if (protocol !== 'http:' && protocol !== 'https:') {
        console.warn(`[folia-web-api] NAVIDROME_URL must be an absolute http(s) URL, got "${serverUrl}"; Navidrome preset disabled.`);
        return null;
    }
    return { serverUrl, username, password };
};
const navidromePreset = readNavidromePreset();

const app = express();
const port = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.set('trust proxy', true);

const jsonBody = express.json({ limit: REQUEST_BODY_LIMIT });
const textBody = express.text({ type: ['text/*', 'application/xml'], limit: REQUEST_BODY_LIMIT });
const rawBody = express.raw({ type: () => true, limit: REQUEST_BODY_LIMIT });

app.get('/api/healthz', (_req, res) => {
    res.json({ ok: true, service: 'folia-web-api' });
});
// 能访问 gateway 的人都能读到这组凭据：Subsonic 的 token 要在浏览器里用明文密码算，没法只下发哈希。
// 来源限制在 gateway；这里只认一种精确写法（区分大小写、不吃结尾斜杠），不给路径变体留绕过的口子。
const navidromePresetRouter = express.Router({ caseSensitive: true, strict: true });
navidromePresetRouter.get('/api/navidrome-preset', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(navidromePreset ? { configured: true, ...navidromePreset } : { configured: false });
});
app.use(navidromePresetRouter);
app.all('/api/generate-theme', jsonBody, generateTheme);
app.all('/api/generate-theme_openai', rawBody, fromEdge(generateOpenAiTheme));
app.all('/api/segment-lyrics', rawBody, fromEdge(segmentLyrics));
app.all('/api/lyric-proxy', jsonBody, textBody, lyricProxy);

app.use((error, _req, res, _next) => {
    console.error('[folia-web-api] Unhandled request error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`[folia-web-api] listening on 0.0.0.0:${port}`);
});
