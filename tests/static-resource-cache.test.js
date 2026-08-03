'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

function loadServeStatic() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = source.indexOf('function serveStatic(req, res, filePath) {');
  assert.ok(start >= 0, 'serveStatic implementation missing');
  let depth = 0;
  let end = -1;
  const brace = source.indexOf('{', start);
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  assert.ok(end > start, 'serveStatic function is unbalanced');
  const context = { fs, path, MIME: {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.txt': 'text/plain',
  } };
  vm.runInNewContext(source.slice(start, end) + '\nthis.serveStatic = serveStatic;', context);
  return context.serveStatic;
}

function request(port, headers) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/asset.js', headers: headers || {} }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
  });
}

test('静态 renderer 资源支持 ETag 条件请求并返回 304', async () => {
  const serveStatic = loadServeStatic();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-static-cache-'));
  const asset = path.join(tempDir, 'asset.js');
  fs.writeFileSync(asset, 'console.log("cached");', 'utf8');
  const server = http.createServer((req, res) => serveStatic(req, res, asset));
  try {
    await new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', resolve);
      server.once('error', reject);
    });
    const port = server.address().port;
    const first = await request(port);
    assert.equal(first.status, 200);
    assert.equal(first.body.toString('utf8'), 'console.log("cached");');
    assert.match(first.headers.etag || '', /^"[0-9a-f]+-[0-9a-f]+"$/);
    assert.equal(first.headers['cache-control'], 'no-cache');

    const second = await request(port, { 'If-None-Match': first.headers.etag });
    assert.equal(second.status, 304);
    assert.equal(second.body.length, 0);
    assert.equal(second.headers.etag, first.headers.etag);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
