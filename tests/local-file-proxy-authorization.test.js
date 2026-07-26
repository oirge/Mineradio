'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从主进程源码截取真实授权解析实现，避免测试重写造成两处逻辑漂移。
 * @returns {{resolveAuthorizedLocalFile: Function, rememberLocalMusicRoot: Function, roots: Set<string>}}
 */
function loadAuthorizerFromMain() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const start = source.indexOf('function normalizeLocalMusicRoot(');
  const end = source.indexOf('function localLibraryRelativePath(', start);
  assert.ok(start >= 0 && end > start, '未找到主进程授权解析实现');
  const roots = new Set();
  const ctx = { path, fs, authorizedLocalMusicRoots: roots };
  vm.runInNewContext(source.slice(start, end), ctx);
  return { resolveAuthorizedLocalFile: ctx.resolveAuthorizedLocalFile, rememberLocalMusicRoot: ctx.rememberLocalMusicRoot, roots };
}

/**
 * 向本地文件代理发起一次 GET，收集状态码与响应体。
 * @param {number} port 监听端口。
 * @param {string} token 代理令牌。
 * @param {string} filePath 请求的绝对路径。
 * @returns {Promise<{status:number, body:string}>}
 */
function proxyGet(port, token, filePath) {
  const query = 'token=' + encodeURIComponent(token) + '&path=' + encodeURIComponent(filePath);
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/local-file?' + query }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
  });
}

const TOKEN = 'test-local-file-token-abcdef';
let server = null;
let port = 0;
let workDir = '';
let insideFile = '';
let outsideFile = '';
let authorizer = null;

test.before(async () => {
  // 令牌必须在 require server.js 之前写入环境，模块加载时即读取。
  process.env.MINERADIO_LOCAL_FILE_TOKEN = TOKEN;
  process.env.HOST = '127.0.0.1';
  process.env.PORT = '0';

  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnr-localfile-'));
  const root = path.join(workDir, 'library');
  fs.mkdirSync(root, { recursive: true });
  insideFile = path.join(root, 'song.mp3');
  fs.writeFileSync(insideFile, 'INSIDE-AUDIO-BYTES');
  outsideFile = path.join(workDir, 'secret.txt');
  fs.writeFileSync(outsideFile, 'OUTSIDE-SECRET');

  const loaded = loadAuthorizerFromMain();
  loaded.rememberLocalMusicRoot(root);
  authorizer = loaded.resolveAuthorizedLocalFile;

  server = require(path.join(__dirname, '..', 'server.js'));
  if (!server.listening) await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  port = server.address().port;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
});

test('未注入授权函数时代理默认拒绝（Fail-Closed）', async () => {
  const res = await proxyGet(port, TOKEN, insideFile);
  assert.equal(res.status, 403, '缺省未授权应拒绝，不能退化为开放代理');
});

test('注入授权函数后放行授权根目录内文件', async () => {
  server.setLocalFileAuthorizer(authorizer);
  const res = await proxyGet(port, TOKEN, insideFile);
  assert.equal(res.status, 200);
  assert.equal(res.body, 'INSIDE-AUDIO-BYTES');
});

test('拒绝授权根目录外的绝对路径', async () => {
  const res = await proxyGet(port, TOKEN, outsideFile);
  assert.equal(res.status, 403, '授权目录外文件必须拒绝');
});

test('拒绝借助 .. 逃逸授权根目录的路径穿越', async () => {
  const traversal = path.join(workDir, 'library', '..', 'secret.txt');
  const res = await proxyGet(port, TOKEN, traversal);
  assert.equal(res.status, 403, '路径穿越必须拒绝');
});

test('令牌错误时仍然拒绝（保留既有令牌校验）', async () => {
  const res = await proxyGet(port, 'wrong-token', insideFile);
  assert.equal(res.status, 403);
});
