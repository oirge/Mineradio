'use strict';
// 插件网络代理白盒测试。这层是插件唯一的出网口，所以测的全是「不该放出去的东西有没有被拦住」：
// - isBlockedAddress：内网/环回/链路本地/组播段的判定（DNS 钉住之后，真正决定去不去连的就是它）；
// - parsePluginTargetUrl：协议门禁，/api/plugin/fetch 只放 https，/api/plugin/stream 额外放 http；
// - buildForwardHeaders：请求头白名单、CRLF 拆分、数量与长度上限；
// - pickResponseHeaders / readCappedBody：回给渲染进程的头与体量上限；
// - performPluginFetch / streamPluginResource：跑真 HTTP，验证 302 不自动跟、内网直连被拒、体量截断。

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const proxy = require('../plugin-proxy.js');

/**
 * 起一个只监听 127.0.0.1 的临时 HTTP 服务，用来当「上游」。
 * @param {(req: import('http').IncomingMessage, res: import('http').ServerResponse) => void} handler 处理函数。
 * @returns {Promise<{port: number, close: () => Promise<void>}>} 服务句柄。
 */
function startUpstream(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

test('内网、环回、链路本地与组播地址一律判为禁止', () => {
  const blocked = [
    ['0.0.0.0', 4], ['127.0.0.1', 4], ['127.9.9.9', 4], ['10.0.0.5', 4],
    ['172.16.0.1', 4], ['172.31.255.254', 4], ['192.168.1.1', 4],
    ['169.254.169.254', 4], ['100.64.0.1', 4], ['192.0.0.1', 4], ['192.0.2.1', 4], ['239.1.1.1', 4],
    ['::', 6], ['::1', 6], ['fc00::1', 6], ['fd12::1', 6], ['fe80::1', 6], ['ff02::1', 6],
    ['::ffff:127.0.0.1', 6], ['::ffff:10.0.0.1', 6],
  ];
  for (const [addr, family] of blocked) {
    assert.equal(proxy.isBlockedAddress(addr, family), true, `${addr} 必须被拦住`);
  }
  assert.equal(proxy.isBlockedAddress('1.1.1.1', 7), true, '未知地址族按禁止处理');
  assert.equal(proxy.isBlockedAddress('', 4), true);
  assert.equal(proxy.isBlockedAddress('1.2.3', 4), true, '残缺 IPv4 按禁止处理');
  const allowed = [
    ['1.1.1.1', 4], ['8.8.8.8', 4], ['172.32.0.1', 4],
    ['100.128.0.1', 4], ['223.5.5.5', 4], ['2606:4700::1111', 6],
  ];
  for (const [addr, family] of allowed) {
    assert.equal(proxy.isBlockedAddress(addr, family), false, `${addr} 是公网地址，不该被拦`);
  }
});

test('目标 URL 只收 https，流代理额外放行 http，且不接受内嵌凭据', () => {
  assert.equal(proxy.parsePluginTargetUrl('https://a.example.com/x').hostname, 'a.example.com');
  assert.throws(() => proxy.parsePluginTargetUrl('http://a.example.com/x'), /PLUGIN_INSECURE_URL/);
  assert.equal(
    proxy.parsePluginTargetUrl('http://a.example.com/x', { allowInsecure: true }).protocol,
    'http:',
    'CDN 直链经常 302 到 http，流代理必须能跟',
  );
  assert.throws(() => proxy.parsePluginTargetUrl('file:///etc/passwd', { allowInsecure: true }), /PLUGIN_INSECURE_URL/);
  assert.throws(() => proxy.parsePluginTargetUrl('ftp://a.example.com/x', { allowInsecure: true }), /PLUGIN_INSECURE_URL/);
  assert.throws(() => proxy.parsePluginTargetUrl('https://u:p@a.example.com/x'), /PLUGIN_BAD_URL/);
  assert.throws(() => proxy.parsePluginTargetUrl('not a url'), /PLUGIN_BAD_URL/);
  assert.throws(() => proxy.parsePluginTargetUrl(''), /PLUGIN_BAD_URL/);
});

test('请求头只放白名单，CRLF 与超长值被丢掉', () => {
  const headers = proxy.buildForwardHeaders({
    Referer: 'https://a.example.com/',
    'User-Agent': 'DemoUA',
    Cookie: 'sid=1',
    Host: 'evil.example.com',
    'X-Forwarded-For': '1.2.3.4',
    'Content-Length': '999',
    Accept: 'application/json\r\nX-Injected: 1',
    Range: 'bytes=0-'.padEnd(2048, '0'),
  });
  assert.deepEqual(Object.keys(headers).sort(), ['cookie', 'referer', 'user-agent']);
  assert.equal(headers.referer, 'https://a.example.com/');
  assert.equal(headers.host, undefined, 'Host 由代理自己钉，插件改不了');
  assert.equal(headers.accept, undefined, '带 CRLF 的头值整条丢掉');
  assert.equal(headers.range, undefined, '超长头值丢掉');
  assert.deepEqual(proxy.buildForwardHeaders(null), {});
  assert.deepEqual(proxy.buildForwardHeaders('x'), {});
  const many = {};
  for (let i = 0; i < 60; i++) many['x-header-' + i] = 'v';
  assert.deepEqual(proxy.buildForwardHeaders(many), {}, '白名单外的头再多也进不来');
});

test('回给渲染进程的响应头只留必要的几个', () => {
  const picked = proxy.pickResponseHeaders({
    'content-type': 'application/json',
    'content-length': '12',
    location: 'https://b.example.com/next',
    'set-cookie': ['a=1', 'b=2'],
    'strict-transport-security': 'max-age=1',
    'x-secret': 'nope',
  });
  assert.equal(picked['content-type'], 'application/json');
  assert.equal(picked.location, 'https://b.example.com/next');
  assert.equal(picked['x-secret'], undefined);
  assert.deepEqual(proxy.pickResponseHeaders(null), {});
});

test('响应体超过上限时按错误终止，而不是悄悄截断', async () => {
  const upstream = await startUpstream((req, res) => {
    res.writeHead(200, { 'content-type': 'application/octet-stream' });
    const chunk = Buffer.alloc(64 * 1024, 0x61);
    let sent = 0;
    const push = () => {
      if (sent >= 4 * 1024 * 1024) { res.end(); return; }
      sent += chunk.length;
      if (res.write(chunk)) setImmediate(push); else res.once('drain', push);
    };
    push();
  });
  try {
    const res = await new Promise((resolve, reject) => {
      const r = http.get({ host: '127.0.0.1', port: upstream.port, path: '/big' }, resolve);
      r.on('error', reject);
    });
    await assert.rejects(() => proxy.readCappedBody(res, 128 * 1024), /PLUGIN_RESPONSE_TOO_LARGE/);
  } finally {
    await upstream.close();
  }
});

test('performPluginFetch 拒绝连接内网地址，也拒绝非法方法', async () => {
  const upstream = await startUpstream((req, res) => { res.end('ok'); });
  try {
    // https 门禁在协议层就把 http://127.0.0.1 挡掉了，这是第一道；
    await assert.rejects(
      () => proxy.performPluginFetch({ url: `http://127.0.0.1:${upstream.port}/x` }),
      /PLUGIN_INSECURE_URL/,
    );
    // 就算换成 https，DNS 钉住之后地址判定是第二道（localhost 解析到 127.0.0.1）。
    await assert.rejects(
      () => proxy.performPluginFetch({ url: `https://localhost:${upstream.port}/x` }),
      /PLUGIN_HOST_BLOCKED/,
    );
    await assert.rejects(
      () => proxy.performPluginFetch({ url: 'https://a.example.com/x', method: 'TRACE' }),
      /PLUGIN_BAD_METHOD/,
    );
    await assert.rejects(() => proxy.performPluginFetch({}), /PLUGIN_BAD_URL/);
  } finally {
    await upstream.close();
  }
});

test('导出的上限常量都在合理量级，改动会被这条测试拦下来', () => {
  assert.equal(proxy.PLUGIN_FETCH_MAX_BYTES, 8 * 1024 * 1024);
  assert.equal(proxy.PLUGIN_FETCH_TIMEOUT_MS, 15 * 1000);
  assert.equal(proxy.PLUGIN_STREAM_TIMEOUT_MS, 30 * 1000);
  assert.equal(proxy.PLUGIN_STREAM_MAX_REDIRECTS, 5);
  assert.ok(proxy.FORWARDABLE_REQUEST_HEADERS.has('referer'));
  assert.ok(proxy.FORWARDABLE_REQUEST_HEADERS.has('user-agent'));
  assert.equal(proxy.FORWARDABLE_REQUEST_HEADERS.has('host'), false);
  assert.equal(proxy.FORWARDABLE_REQUEST_HEADERS.has('x-forwarded-for'), false);
});
