'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

/**
 * 从 server.js 截取真实的 readRequestBody 实现，避免测试复制生产逻辑。
 * @returns {Function} readRequestBody 函数。
 */
function loadReadRequestBody() {
  const file = path.join(__dirname, '..', 'server.js');
  const source = fs.readFileSync(file, 'utf8');
  const decl = 'function readRequestBody(req) {';
  const start = source.indexOf(decl);
  assert.ok(start >= 0, '未找到 readRequestBody 接缝');
  let brace = source.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let k = brace; k < source.length; k++) {
    if (source[k] === '{') depth++;
    else if (source[k] === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  assert.ok(end > start, 'readRequestBody 花括号不平衡');
  const fnSrc = source.slice(start, end);
  const tmp = path.join(os.tmpdir(), `mineradio-rrb-${process.pid}-${Date.now()}.cjs`);
  fs.writeFileSync(tmp, `${fnSrc}\nmodule.exports = { readRequestBody };\n`, 'utf8');
  try {
    return require(tmp).readRequestBody;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/**
 * 用真实 HTTP server 跑一个请求场景，返回处理器是否结算及结算方式。
 * 关键：处理器 `await readRequestBody(req)`；若 promise 永不结算，处理器不会响应，
 * 客户端在超时守卫后判定为挂起（这正是被修复的 bug 特征）。
 * @param {Function} readRequestBody 被测函数。
 * @param {(req: import('http').ClientRequest) => void} writeBody 构造请求体。
 * @returns {Promise<{settled: boolean, kind: string}>} 结算结果。
 */
function runScenario(readRequestBody, writeBody) {
  return new Promise((resolve) => {
    const outcome = { settled: false, kind: '' };
    const server = http.createServer(async (req, res) => {
      try {
        await readRequestBody(req);
        outcome.settled = true;
        outcome.kind = 'resolve';
      } catch (err) {
        outcome.settled = true;
        outcome.kind = 'reject:' + (err && (err.code || err.message));
      }
      try { res.writeHead(200); res.end('ok'); } catch (_e) { /* 连接可能已关闭 */ }
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const req = http.request({ host: '127.0.0.1', port, method: 'POST' }, (res) => {
        res.on('data', () => {});
        res.on('end', finish);
      });
      req.on('error', finish);
      writeBody(req);
    });
    let done = false;
    /** @returns {void} 关闭 server 并回传结果，超时守卫与正常结束共用。 */
    function finish() {
      if (done) return;
      done = true;
      setTimeout(() => { server.close(() => resolve(outcome)); }, 120);
    }
    // 超时守卫：若处理器挂起（promise 永不结算），此处兜底判定失败。
    setTimeout(finish, 4000);
  });
}

/**
 * 验证：超过 8MB 上限的请求体以 REQUEST_BODY_TOO_LARGE 拒绝，处理器仍能结算并响应，不挂起。
 * @returns {void}
 */
async function testOversizedBodyRejectsAndSettles() {
  const readRequestBody = loadReadRequestBody();
  const outcome = await runScenario(readRequestBody, (req) => {
    req.write('x'.repeat(9 * 1024 * 1024));
    req.end();
  });
  assert.equal(outcome.settled, true, '超大请求体必须结算，不能让处理器永久挂起');
  assert.equal(outcome.kind, 'reject:REQUEST_BODY_TOO_LARGE', '超限必须以 REQUEST_BODY_TOO_LARGE 拒绝');
}

/**
 * 验证：正常 JSON、空体、客户端中断三条路径都能结算，避免连接悬挂。
 * @returns {void}
 */
async function testNormalPathsSettle() {
  const readRequestBody = loadReadRequestBody();

  const normal = await runScenario(readRequestBody, (req) => { req.end('{"key":"abc"}'); });
  assert.equal(normal.settled, true);
  assert.equal(normal.kind, 'resolve');

  const empty = await runScenario(readRequestBody, (req) => { req.end(); });
  assert.equal(empty.settled, true);
  assert.equal(empty.kind, 'resolve');

  const aborted = await runScenario(readRequestBody, (req) => {
    req.write('partial');
    setTimeout(() => req.destroy(), 40);
  });
  assert.equal(aborted.settled, true, '客户端中断时处理器必须结算');
}

test('请求体超过 8MB 上限时拒绝且处理器不挂起', testOversizedBodyRejectsAndSettles);
test('正常、空体与客户端中断请求体均结算', testNormalPathsSettle);
