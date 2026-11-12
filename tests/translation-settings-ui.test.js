'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../public/translation-settings.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
async function settle() { for (let i = 0; i < 80; i++) await Promise.resolve(); }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function classes() {
  const values = new Set();
  return { add: name => values.add(name), remove: name => values.delete(name), contains: name => values.has(name),
    toggle(name, enabled) { const on = enabled == null ? !values.has(name) : !!enabled; if (on) values.add(name); else values.delete(name); return on; } };
}
function harness(options = {}) {
  let settings = options.settings || { endpoint: '', model: '', configured: false, enabled: false, revision: 0, hasApiKey: false, keyPersistent: false };
  let tokenReads = 0, storageWrites = 0, schedules = 0;
  const requests = [], saves = [], nodes = new Map(), document = { documentElement: { lang: 'zh-CN' }, activeElement: null };
  const ids = ['modal', 'endpoint', 'model', 'key', 'enabled', 'save', 'test', 'clear-key', 'close', 'status', 'summary', 'storage', 'open'];
  for (const suffix of ids) {
    const events = new Map(), attributes = {};
    const node = { id: 'translation-source-' + suffix, value: '', checked: false, disabled: false, textContent: '', placeholder: '',
      classList: classes(), isConnected: true, events,
      addEventListener(type, listener) { events.set(type, listener); },
      getAttribute(name) { return attributes[name]; }, setAttribute(name, value) { attributes[name] = value; },
      focus() { document.activeElement = node; },
      querySelectorAll(selector) { return selector === 'input,button' ? ids.filter(id => ['endpoint', 'model', 'key', 'enabled', 'save', 'test', 'clear-key', 'close'].includes(id)).map(id => nodes.get('translation-source-' + id)) : []; }
    };
    nodes.set(node.id, node);
  }
  document.getElementById = id => nodes.get(id) || null;
  const bridge = options.bridge === null ? null : {
    getTranslationSettings: () => options.get ? options.get() : Promise.resolve(clone(settings)),
    getApiSessionToken: () => { tokenReads++; return options.token ? options.token(tokenReads) : Promise.resolve('synthetic-ui-session'); },
    saveTranslationSettings: async payload => {
      saves.push(clone(payload));
      if (options.save) return options.save(payload);
      settings = { endpoint: payload.endpoint, model: payload.model, enabled: payload.enabled, configured: !!(payload.endpoint && payload.model),
        revision: settings.revision + 1, hasApiKey: payload.clearApiKey ? false : !!payload.apiKey || settings.hasApiKey, keyPersistent: true };
      return { ok: true, ...settings };
    },
    testTranslationSettings: () => options.test ? options.test() : Promise.resolve({ ok: true, message: 'Connected' }),
  };
  const global = { document, desktopWindow: bridge, location: { href: 'http://127.0.0.1:34567/index.html', origin: 'http://127.0.0.1:34567' },
    uiLanguage: 'zh', scheduleLyricLlmTranslation: () => schedules++,
    localStorage: { setItem() { storageWrites++; throw new Error('Credentials must not enter renderer storage'); } },
    sessionStorage: { setItem() { storageWrites++; throw new Error('Credentials must not enter renderer storage'); } },
    fetch: async (url, fetchOptions) => { requests.push({ url, options: fetchOptions }); return { ok: true, status: 200 }; } };
  const scope = { window: global, URL, Headers, AbortController, setTimeout, clearTimeout };
  vm.runInNewContext(code, scope);
  return { global, bridge, nodes, requests, saves, node: suffix => nodes.get('translation-source-' + suffix),
    tokenReads: () => tokenReads, storageWrites: () => storageWrites, schedules: () => schedules,
    setSettings(value) { settings = value; }, async open() { global.openTranslationSourceSettings(); await settle(); },
    async click(suffix) { const node = nodes.get('translation-source-' + suffix); node.events.get('click').call(node, { target: node }); await settle(); } };
}
test('only exact same-origin mutation paths receive the session header', async () => {
  const h = harness(); await settle();
  for (const url of ['/api/lyric-translate', '/api/update/download?route=direct', '/api/update/cancel?id=x', '/api/update/patch']) {
    await h.global.mineradioAuthorizedFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const request = h.requests.at(-1);
    assert.equal(request.options.headers.get('X-Mineradio-Session'), 'synthetic-ui-session');
    assert.equal(request.options.headers.get('Content-Type'), 'application/json');
  }
  assert.equal(h.tokenReads(), 1, 'The token should remain scoped to this renderer session');
  for (const url of ['https://external.invalid/api/update/download', 'http://127.0.0.1:34568/api/lyric-translate', '/api/update/download/status', '/api/update/latest', '/api/lyric-translate/extra', '/api/update/patch-extra']) {
    await h.global.mineradioAuthorizedFetch(url, { method: 'GET' });
    assert.equal(h.requests.at(-1).options.headers, undefined, 'Do not attach credentials outside the exact protected route');
  }
  assert.equal(h.tokenReads(), 1);
});
test('session IPC failure does not issue HTTP and allows a fresh token request', async () => {
  const h = harness({ token: count => count === 1 ? Promise.reject(new Error('IPC unavailable')) : Promise.resolve('fresh-session') }); await settle();
  await assert.rejects(h.global.mineradioAuthorizedFetch('/api/lyric-translate', { method: 'POST' })); assert.equal(h.requests.length, 0);
  await h.global.mineradioAuthorizedFetch('/api/lyric-translate', { method: 'POST' });
  assert.equal(h.tokenReads(), 2); assert.equal(h.requests[0].options.headers.get('X-Mineradio-Session'), 'fresh-session');
});
test('empty session tokens never trigger HTTP or retryable translation errors', async () => {
  const h = harness({ token: () => Promise.resolve('') }); await settle();
  await assert.rejects(h.global.mineradioAuthorizedFetch('/api/lyric-translate', { method: 'POST' }), error => error.retryable === false);
  assert.equal(h.requests.length, 0);
});
test('aborted token acquisition never sends a late mutation request', async () => {
  const token = deferred(), h = harness({ token: () => token.promise }); await settle();
  const abort = new AbortController(), work = h.global.mineradioAuthorizedFetch('/api/update/cancel', { method: 'POST', signal: abort.signal });
  abort.abort(); token.resolve('late-session'); await assert.rejects(work, error => error.name === 'AbortError'); assert.equal(h.requests.length, 0);
});
test('browser-only environments cannot call mutating APIs and remain unconfigured', async () => {
  const h = harness({ bridge: null }); await settle();
  assert.equal(h.global.isCustomTranslationReady(), false);
  await assert.rejects(h.global.mineradioAuthorizedFetch('/api/lyric-translate', { method: 'POST' }), error => error.retryable === false);
  assert.equal(h.requests.length, 0);
});
test('renderer state whitelists public metadata and never echoes a credential into the password field', async () => {
  const h = harness({ settings: { endpoint: 'https://translation.invalid/v1/chat/completions', model: 'user-model', configured: true, enabled: true,
    hasApiKey: true, keyPersistent: true, revision: 4, apiKey: 'unexpected-private-field', encryptedApiKey: 'unexpected-ciphertext' } });
  await h.open();
  const publicState = h.global.MineradioTranslationSettings.getState();
  assert.equal('apiKey' in publicState, false); assert.equal('encryptedApiKey' in publicState, false); assert.equal(h.node('key').value, '');
  assert.equal(h.node('endpoint').value, 'https://translation.invalid/v1/chat/completions');
  assert.equal(h.storageWrites(), 0); assert.ok(!JSON.stringify(publicState).includes('unexpected-private-field'));
});

test('private default availability enables translation while all custom input fields stay empty', async () => {
  const h = harness({ settings: { endpoint: '', model: '', enabled: false, configured: false, revision: 0,
    hasApiKey: false, defaultAvailable: true, translationReady: true } });
  await h.open();
  assert.equal(h.global.isCustomTranslationReady(), true);
  assert.equal(h.node('endpoint').value, ''); assert.equal(h.node('model').value, ''); assert.equal(h.node('key').value, '');
  assert.equal(h.storageWrites(), 0);
});
test('save and explicit key clearing use IPC only and remove the typed password', async () => {
  const h = harness(); await h.open(); h.node('endpoint').value = 'https://translation.invalid/v1'; h.node('model').value = 'user-model'; h.node('enabled').checked = true;
  h.node('key').value = 'synthetic-user-key'; await h.click('save');
  assert.equal(h.saves[0].apiKey, 'synthetic-user-key'); assert.equal(h.node('key').value, ''); assert.equal(h.global.isCustomTranslationReady(), true);
  assert.equal(h.requests.length, 0); assert.equal(h.storageWrites(), 0); assert.equal('apiKey' in h.global.MineradioTranslationSettings.getState(), false);
  await h.click('clear-key'); assert.equal(h.saves[1].clearApiKey, true); assert.equal(h.saves[1].apiKey, ''); assert.equal(h.global.MineradioTranslationSettings.getState().hasApiKey, false);
  h.node('key').value = 'another-unsaved-key'; await h.click('close'); assert.equal(h.node('key').value, '');
});
test('unchanged settings refreshes do not restart translation and stale IPC cannot overwrite a newer save', async () => {
  const h = harness({ settings: { endpoint: 'https://translation.invalid/v1', model: 'model', configured: true, enabled: true, revision: 5 } }); await settle();
  const before = h.schedules(); await h.global.MineradioTranslationSettings.refresh(); assert.equal(h.schedules(), before);
  h.setSettings({ endpoint: '', model: '', configured: false, enabled: false, revision: 4 });
  await h.global.MineradioTranslationSettings.refresh(); assert.equal(h.global.customTranslationRevision(), 5); assert.equal(h.global.isCustomTranslationReady(), true);
});
test('save-and-test keeps automatic translation paused until the connection test completes', async () => {
  const pending = deferred(), h = harness({ test: () => pending.promise }); await h.open();
  h.node('endpoint').value = 'https://translation.invalid/v1'; h.node('model').value = 'model'; h.node('enabled').checked = true;
  await h.click('test'); assert.equal(h.global.isCustomTranslationReady(), false); assert.equal(h.node('test').disabled, true);
  pending.resolve({ ok: true, message: 'Connected' }); await settle();
  assert.equal(h.global.isCustomTranslationReady(), true); assert.equal(h.node('test').disabled, false);
});
test('closing while an IPC refresh is pending does not reopen the modal or restore its password', async () => {
  const pending = deferred(), h = harness({ get: () => pending.promise });
  h.global.openTranslationSourceSettings(); assert.equal(h.node('modal').classList.contains('show'), true);
  h.node('key').value = 'unsaved'; await h.click('close'); pending.resolve({ configured: false, enabled: false, revision: 0 }); await settle();
  assert.equal(h.node('modal').classList.contains('show'), false); assert.equal(h.node('key').value, '');
});
