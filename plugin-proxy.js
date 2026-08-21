'use strict';
// Mineradio 插件网络代理：插件自己不能发请求，所有出网都由这里代发。
// 放在本地 HTTP 服务里而不是渲染进程，是因为音乐 API 基本不带 CORS 头，渲染进程直连会被浏览器拦掉。
// 三道门：token（服务监听 0.0.0.0，没有 token 局域网任何人都能拿它当开放中继）、
// 只允许 https、DNS 结果钉死到公网地址（挡住 DNS rebinding 打内网）。
const https = require('https');
const http = require('http');
const dns = require('dns');

const PLUGIN_FETCH_MAX_BYTES = 8 * 1024 * 1024;
const PLUGIN_FETCH_TIMEOUT_MS = 15 * 1000;
const PLUGIN_STREAM_TIMEOUT_MS = 30 * 1000;
const PLUGIN_STREAM_MAX_REDIRECTS = 5;
const PLUGIN_MAX_REQUEST_HEADERS = 24;
const PLUGIN_MAX_HEADER_VALUE = 1024;

// 插件可以自定义的请求头。音乐 API 普遍靠 Referer / User-Agent 做来源校验，不放行等于不可用。
const FORWARDABLE_REQUEST_HEADERS = new Set([
  'accept', 'accept-language', 'authorization', 'content-type', 'cookie',
  'origin', 'referer', 'user-agent', 'range', 'x-requested-with',
]);

/**
 * 判断一个已解析出的 IP 是否属于禁止访问的网段。
 * 只要不能确定是公网地址就拒绝，宁可挡住冷门场景也不放过内网探测。
 * @param {string} address 点分十进制或 IPv6 地址。
 * @param {number} family 4 或 6。
 * @returns {boolean} 是否禁止访问。
 */
function isBlockedAddress(address, family) {
  const ip = String(address || '').toLowerCase();
  if (!ip) return true;
  if (family === 4) {
    const parts = ip.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0) return true;
    if (a >= 224) return true;
    return false;
  }
  if (family === 6) {
    if (ip === '::' || ip === '::1') return true;
    // IPv4-mapped（::ffff:10.0.0.1 这类）必须按内层 IPv4 判定，否则等于开了后门。
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
    if (mapped) return isBlockedAddress(mapped[1], 4);
    if (/^f[cd]/.test(ip)) return true;
    if (/^fe[89ab]/.test(ip)) return true;
    if (/^ff/.test(ip)) return true;
    return false;
  }
  return true;
}

/**
 * 解析目标主机并钉死到一个公网地址。
 * 后续请求直连这个 IP 并用 servername/Host 保留 TLS 与虚拟主机语义，
 * 这样「校验时解析到公网、连接时解析到内网」的重绑定攻击就不成立了。
 * @param {string} hostname 目标主机名。
 * @returns {Promise<{address: string, family: number}>} 已通过校验的地址。
 */
async function resolvePinnedAddress(hostname) {
  let records;
  try {
    records = await dns.promises.lookup(String(hostname || ''), { all: true, verbatim: true });
  } catch (e) {
    const err = new Error('PLUGIN_HOST_UNRESOLVED');
    err.code = 'PLUGIN_HOST_UNRESOLVED';
    throw err;
  }
  const usable = (records || []).filter((r) => !isBlockedAddress(r.address, r.family));
  if (!usable.length) {
    const err = new Error('PLUGIN_HOST_BLOCKED');
    err.code = 'PLUGIN_HOST_BLOCKED';
    throw err;
  }
  return { address: usable[0].address, family: usable[0].family };
}
/**
 * 校验插件给出的目标 URL。默认只放行 https，并拒绝带凭据的 URL。
 * allowInsecure 仅供媒体流使用：音源直链（网易云 outer/url 这类）会 302 到 http CDN，
 * 一刀切禁 http 等于放不出声。API 调用不放开，因为那条路上会带 Cookie / Authorization。
 * 放开的只有协议这一项，token、公网地址钉死、逐跳复检都还在。
 * @param {unknown} raw 原始 URL 文本。
 * @param {object} [opts] 选项：allowInsecure 是否允许 http。
 * @returns {URL} 解析后的 URL 对象。
 */
function parsePluginTargetUrl(raw, opts) {
  let parsed;
  try { parsed = new URL(String(raw || '')); } catch (e) {
    const err = new Error('PLUGIN_BAD_URL');
    err.code = 'PLUGIN_BAD_URL';
    throw err;
  }
  const allowInsecure = !!(opts && opts.allowInsecure);
  const okProtocol = parsed.protocol === 'https:' || (allowInsecure && parsed.protocol === 'http:');
  if (!okProtocol) {
    const err = new Error('PLUGIN_INSECURE_URL');
    err.code = 'PLUGIN_INSECURE_URL';
    throw err;
  }
  // URL 里内嵌 user:pass 只会把凭据带进日志，插件想带认证就走 Authorization 头。
  if (parsed.username || parsed.password) {
    const err = new Error('PLUGIN_BAD_URL');
    err.code = 'PLUGIN_BAD_URL';
    throw err;
  }
  return parsed;
}

/**
 * 归一化插件自定义请求头。只保留白名单里的头，并限制数量与长度。
 * @param {unknown} raw 原始头表。
 * @returns {object} 可以直接交给 https.request 的头表。
 */
function buildForwardHeaders(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  let count = 0;
  for (const key of Object.keys(raw)) {
    if (count >= PLUGIN_MAX_REQUEST_HEADERS) break;
    const name = String(key || '').toLowerCase().trim();
    if (!FORWARDABLE_REQUEST_HEADERS.has(name)) continue;
    const value = String(raw[key] == null ? '' : raw[key]);
    // 头值里出现 CR/LF 就是响应/请求拆分，直接丢掉这一条。
    if (!value || /[\r\n]/.test(value) || value.length > PLUGIN_MAX_HEADER_VALUE) continue;
    out[name] = value;
    count++;
  }
  return out;
}
/**
 * 向一个已校验的 https URL 发起请求，连接地址钉死在公网 IP 上。
 * @param {URL} target 目标 URL。
 * @param {object} opts 选项：method / headers / body / timeoutMs。
 * @returns {Promise<import('http').IncomingMessage>} 上游响应。
 */
async function openPinnedRequest(target, opts) {
  const pinned = await resolvePinnedAddress(target.hostname);
  const method = String((opts && opts.method) || 'GET').toUpperCase();
  const headers = Object.assign({}, (opts && opts.headers) || {});
  // 直连 IP 时必须自己补 Host，否则虚拟主机会返回错站点；servername 保证 SNI 与证书校验仍按域名走。
  headers.host = target.host;
  if (!headers['accept-encoding']) headers['accept-encoding'] = 'identity';
  const body = opts && opts.body != null ? opts.body : null;
  if (body != null && !headers['content-length']) headers['content-length'] = String(Buffer.byteLength(body));
  const secure = target.protocol === 'https:';
  const transport = secure ? https : http;
  const requestOptions = {
    host: pinned.address,
    family: pinned.family,
    port: target.port || (secure ? 443 : 80),
    path: `${target.pathname}${target.search}`,
    method,
    headers,
    timeout: (opts && opts.timeoutMs) || PLUGIN_FETCH_TIMEOUT_MS,
  };
  if (secure) requestOptions.servername = target.hostname;
  return await new Promise((resolve, reject) => {
    let settled = false;
    const req = transport.request(requestOptions, (res) => {
      if (settled) { res.resume(); return; }
      settled = true;
      resolve(res);
    });
    req.on('timeout', () => {
      if (settled) return;
      settled = true;
      req.destroy();
      const err = new Error('PLUGIN_UPSTREAM_TIMEOUT');
      err.code = 'PLUGIN_UPSTREAM_TIMEOUT';
      reject(err);
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
    if (body != null) req.end(body);
    else req.end();
  });
}
/**
 * 读取上游响应体并在超过上限时中断连接。
 * 先看 content-length 只是快路径；真正的门是累加时的检查，上游可以谎报长度。
 * @param {import('http').IncomingMessage} res 上游响应。
 * @param {number} maxBytes 上限字节数。
 * @returns {Promise<Buffer>} 完整响应体。
 */
function readCappedBody(res, maxBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(res.headers['content-length'] || 0);
    if (declared > maxBytes) {
      res.destroy();
      const err = new Error('PLUGIN_RESPONSE_TOO_LARGE');
      err.code = 'PLUGIN_RESPONSE_TOO_LARGE';
      reject(err);
      return;
    }
    const chunks = [];
    let total = 0;
    let settled = false;
    /**
     * 单次结算门，destroy 之后 error/close 还会来，重复结算会让上层拿到错误的结论。
     * @param {Error|null} err 错误对象。
     * @param {Buffer|null} value 响应体。
     * @returns {void}
     */
    const settle = (err, value) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(value);
    };
    res.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        res.destroy();
        const err = new Error('PLUGIN_RESPONSE_TOO_LARGE');
        err.code = 'PLUGIN_RESPONSE_TOO_LARGE';
        settle(err, null);
        return;
      }
      chunks.push(chunk);
    });
    res.on('end', () => settle(null, Buffer.concat(chunks, total)));
    res.on('error', (err) => settle(err, null));
    res.on('close', () => settle(new Error('PLUGIN_UPSTREAM_ABORTED'), null));
  });
}
/**
 * 挑出回给插件的响应头。全量透传没必要，也会把上游的内网提示带出来。
 * @param {object} headers 上游响应头。
 * @returns {object} 精简后的响应头。
 */
function pickResponseHeaders(headers) {
  const out = {};
  const src = headers || {};
  for (const name of ['content-type', 'content-length', 'location', 'content-range', 'accept-ranges']) {
    if (src[name] != null) out[name] = String(src[name]);
  }
  if (src['set-cookie']) {
    const raw = Array.isArray(src['set-cookie']) ? src['set-cookie'] : [String(src['set-cookie'])];
    out['set-cookie'] = raw.map((v) => String(v).slice(0, PLUGIN_MAX_HEADER_VALUE)).slice(0, 8);
  }
  return out;
}

/**
 * 代发一次插件请求并把完整响应读回来。
 * 故意不跟随 3xx：URL 白名单在渲染进程侧，跟随重定向等于替插件访问一个没过白名单的地址。
 * 这里把 location 原样回给插件，插件再发一次，就还是每个 URL 都过一遍白名单。
 * @param {object} payload 请求描述：url / method / headers / body / responseType。
 * @returns {Promise<object>} 给插件的响应包。
 */
async function performPluginFetch(payload) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const target = parsePluginTargetUrl(input.url);
  const method = String(input.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const err = new Error('PLUGIN_BAD_METHOD');
    err.code = 'PLUGIN_BAD_METHOD';
    throw err;
  }
  let body = null;
  if (input.body != null && method !== 'GET' && method !== 'HEAD') {
    body = typeof input.body === 'string' ? input.body : JSON.stringify(input.body);
    if (Buffer.byteLength(body) > PLUGIN_FETCH_MAX_BYTES) {
      const err = new Error('PLUGIN_REQUEST_TOO_LARGE');
      err.code = 'PLUGIN_REQUEST_TOO_LARGE';
      throw err;
    }
  }
  const res = await openPinnedRequest(target, {
    method,
    headers: buildForwardHeaders(input.headers),
    body,
    timeoutMs: PLUGIN_FETCH_TIMEOUT_MS,
  });
  const buffer = await readCappedBody(res, PLUGIN_FETCH_MAX_BYTES);
  const wantsBinary = String(input.responseType || '') === 'arraybuffer' || String(input.responseType || '') === 'base64';
  return {
    status: res.statusCode || 0,
    headers: pickResponseHeaders(res.headers),
    encoding: wantsBinary ? 'base64' : 'utf8',
    body: wantsBinary ? buffer.toString('base64') : buffer.toString('utf8'),
  };
}
/**
 * 把插件给出的远程资源（音频流、封面图）转成本地响应流。
 * 与 performPluginFetch 不同，这里必须跟随重定向：音频直链几乎都会跳到 CDN 的另一个域名，
 * 不跟随就等于放不出声。安全性靠每一跳都重新走 https 校验 + DNS 钉死来保证。
 * @param {string} url 首跳地址。
 * @param {import('http').IncomingMessage} req 本地请求，用来感知客户端断开。
 * @param {import('http').ServerResponse} res 本地响应。
 * @param {object} [opts] 选项：headers（Range / Referer / User-Agent）。
 * @returns {Promise<void>} 流结束或失败。
 */
async function streamPluginResource(url, req, res, opts) {
  const headers = buildForwardHeaders((opts && opts.headers) || {});
  const scheme = { allowInsecure: true };
  let current = parsePluginTargetUrl(url, scheme);
  for (let hop = 0; hop <= PLUGIN_STREAM_MAX_REDIRECTS; hop++) {
    const upstream = await openPinnedRequest(current, {
      method: 'GET',
      headers,
      timeoutMs: PLUGIN_STREAM_TIMEOUT_MS,
    });
    const status = upstream.statusCode || 0;
    const location = upstream.headers && upstream.headers.location;
    if (status >= 300 && status < 400 && location && hop < PLUGIN_STREAM_MAX_REDIRECTS) {
      upstream.resume();
      let next;
      try { next = new URL(String(location), current); } catch (e) {
        const err = new Error('PLUGIN_BAD_REDIRECT');
        err.code = 'PLUGIN_BAD_REDIRECT';
        throw err;
      }
      // 重定向目标同样只允许 http/https，并在下一轮重新做 DNS 钉死，跳到内网或别的协议都会在这里断掉。
      current = parsePluginTargetUrl(next.toString(), scheme);
      continue;
    }
    const outHeaders = {
      'Cache-Control': 'no-store',
      // 与 /api/local-file 保持一致：<audio crossOrigin="anonymous"> 要靠这两个头才能进 Web Audio 分析器。
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    };
    const picked = pickResponseHeaders(upstream.headers);
    if (picked['content-type']) outHeaders['Content-Type'] = picked['content-type'];
    if (picked['content-length']) outHeaders['Content-Length'] = picked['content-length'];
    if (picked['content-range']) outHeaders['Content-Range'] = picked['content-range'];
    outHeaders['Accept-Ranges'] = picked['accept-ranges'] || 'bytes';
    res.writeHead(status || 502, outHeaders);
    // 客户端提前关掉（切歌、拖进度条）时要主动断开上游，否则 socket 会一直挂着把连接数吃满。
    const abort = () => { upstream.destroy(); };
    req.on('close', abort);
    upstream.on('error', () => { if (!res.writableEnded) res.end(); });
    upstream.pipe(res);
    return;
  }
  const err = new Error('PLUGIN_TOO_MANY_REDIRECTS');
  err.code = 'PLUGIN_TOO_MANY_REDIRECTS';
  throw err;
}
// __PLUGIN_PROXY_TAIL__

module.exports = {
  PLUGIN_FETCH_MAX_BYTES,
  PLUGIN_FETCH_TIMEOUT_MS,
  PLUGIN_STREAM_TIMEOUT_MS,
  PLUGIN_STREAM_MAX_REDIRECTS,
  FORWARDABLE_REQUEST_HEADERS,
  isBlockedAddress,
  resolvePinnedAddress,
  parsePluginTargetUrl,
  buildForwardHeaders,
  pickResponseHeaders,
  readCappedBody,
  performPluginFetch,
  streamPluginResource,
};
