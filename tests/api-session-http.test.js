'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
let server, port, directory;
const sessionToken = 'synthetic-http-session-' + 'x'.repeat(32);
test.before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mnr-api-session-'));
  process.env.HOST = '127.0.0.1'; process.env.PORT = '0'; process.env.MINERADIO_UPDATE_DIR = directory;
  server = require('../server');
  if (!server.listening) await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  port = server.address().port;
});
test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (directory) {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir())); assert.ok(path.basename(directory).startsWith('mnr-api-session-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
function request(route, method = 'POST', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method, headers }, response => {
      const chunks = []; response.on('data', value => chunks.push(value));
      response.on('end', () => resolve({ status: response.statusCode, text: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end();
  });
}
test('the running HTTP server denies all four mutations before session injection', async () => {
  for (const route of ['/api/update/download', '/api/update/cancel', '/api/update/patch', '/api/lyric-translate']) {
    const result = await request(route, 'POST', { 'X-Mineradio-Session': sessionToken });
    assert.equal(result.status, 403); assert.equal(JSON.parse(result.text).error, 'API_SESSION_REQUIRED');
  }
});
test('HTTP mutation gate rejects GET, wrong tokens, and external origins even with a valid token', async () => {
  server.setApiSessionToken(sessionToken);
  for (const route of ['/api/update/download', '/api/update/cancel', '/api/update/patch', '/api/lyric-translate']) {
    assert.equal((await request(route, 'GET', { 'X-Mineradio-Session': sessionToken })).status, 405);
    assert.equal((await request(route, 'POST', { 'X-Mineradio-Session': 'wrong-run' })).status, 403);
    assert.equal((await request(route, 'POST', { 'X-Mineradio-Session': sessionToken, Origin: 'https://external.invalid' })).status, 403);
  }
});
test('authorized requests reach handlers without providing a built-in translation service', async () => {
  const headers = { 'X-Mineradio-Session': sessionToken, Origin: 'http://127.0.0.1:' + port };
  const translation = await request('/api/lyric-translate', 'POST', headers);
  assert.equal(translation.status, 400); assert.equal(JSON.parse(translation.text).code, 'NOT_CONFIGURED');
  const cancellation = await request('/api/update/cancel', 'POST', headers);
  assert.equal(cancellation.status, 404); assert.equal(JSON.parse(cancellation.text).error, 'UPDATE_JOB_NOT_FOUND');
  const version = await request('/api/app/version', 'GET');
  assert.equal(version.status, 200); assert.ok(!version.text.includes(sessionToken));
});
