'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { authorizeApiMutation } = require('../desktop/api-session-authorization');
const token = 'test-only-session-' + 'x'.repeat(32), port = 34567;
function request(changes = {}) { return { method: 'POST', headers: { host: '127.0.0.1:' + port, origin: 'http://127.0.0.1:' + port, 'x-mineradio-session': token }, ...changes }; }
test('session authorization accepts only POST with the current token and trusted origin', () => {
  assert.equal(authorizeApiMutation(request(), token, port), null);
  const native = request(); delete native.headers.origin;
  assert.equal(authorizeApiMutation(native, token, port), null);
  assert.equal(authorizeApiMutation(request({ method: 'GET' }), token, port).status, 405);
  assert.equal(authorizeApiMutation(request(), '', port).status, 403);
  assert.equal(authorizeApiMutation(request(), token + '-different-run', port).status, 403);
  const missing = request(); delete missing.headers['x-mineradio-session'];
  assert.equal(authorizeApiMutation(missing, token, port).error, 'API_SESSION_REQUIRED');
});
test('external/null origins, wrong hosts and cross-site requests fail closed', () => {
  for (const origin of ['https://external.invalid', 'null', 'http://127.0.0.1:3000']) {
    const req = request(); req.headers.origin = origin;
    assert.equal(authorizeApiMutation(req, token, port).error, 'API_ORIGIN_FORBIDDEN');
  }
  const host = request(); host.headers.host = 'external.invalid:' + port;
  assert.equal(authorizeApiMutation(host, token, port).status, 403);
  const crossSite = request(); delete crossSite.headers.origin; crossSite.headers['sec-fetch-site'] = 'cross-site';
  assert.equal(authorizeApiMutation(crossSite, token, port).status, 403);
});
test('the default HTTP port accepts canonical same-origin headers without opening other hosts', () => {
  const req = request(); req.headers.host = '127.0.0.1'; req.headers.origin = 'http://127.0.0.1';
  assert.equal(authorizeApiMutation(req, token, 80), null);
  req.headers.host = '127.0.0.1:80'; assert.equal(authorizeApiMutation(req, token, 80), null);
  req.headers.host = 'localhost'; assert.equal(authorizeApiMutation(req, token, 80).status, 403);
});
test('all mutating HTTP routes share authorization and tokens are exposed only by trusted IPC', () => {
  const root = path.join(__dirname, '..'), server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'desktop/main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'desktop/preload.js'), 'utf8');
  assert.match(server, /\['\/api\/update\/download', '\/api\/update\/cancel', '\/api\/update\/patch', '\/api\/lyric-translate'\]\.includes\(pn\)/);
  assert.match(server, /authorizeApiMutation\(req, apiSessionToken, server.address\(\).port\)/);
  assert.match(main, /API_SESSION_TOKEN = crypto.randomBytes\(32\)/);
  for (const channel of ['mineradio-api-session-token', 'mineradio-translation-settings-get', 'mineradio-translation-settings-save', 'mineradio-translation-settings-test']) {
    assert.ok(main.includes("ipcMain.handle('" + channel + "', trustedMainFrameHandler("));
    assert.ok(preload.includes("ipcRenderer.invoke('" + channel + "'"));
  }
  assert.ok(!server.includes("pn === '/api/session"));
  assert.ok(main.includes('localServer.setApiSessionToken(API_SESSION_TOKEN)'));
  assert.ok(main.includes('localServer.setTranslationSettingsProvider(() => translationSettings.configuration())'));
});
