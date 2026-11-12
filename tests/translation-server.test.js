'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { requestTranslation, testTranslationConfiguration, TRANSLATION_RESPONSE_MAX_BYTES } = require('../desktop/translation-client');
const configuration = { endpoint: 'https://translation.invalid/v1/chat/completions?api-version=test', model: 'test-model', apiKey: 'synthetic-only-secret', enabled: true, revision: 3 };
const messages = [{ role: 'user', content: 'Translate a synthetic lyric.' }];
function response(content = '1. 测试译文', status = 200, headers = {}) { return new Response(JSON.stringify({ model: 'synthetic-private-upstream-model', choices: [{ message: { content } }] }), { status, headers }); }
test('requests use the configured endpoint/model/key and preserve UTF-8 split across chunks', async () => {
  let request;
  const data = new TextEncoder().encode(JSON.stringify({ choices: [{ message: { content: '测试译文' } }] }));
  const result = await requestTranslation(configuration, messages, { fetch: async (url, options) => {
    request = { url, options };
    return new Response(new ReadableStream({ start(controller) { for (const byte of data) controller.enqueue(new Uint8Array([byte])); controller.close(); } }));
  } });
  assert.equal(result.data.choices[0].message.content, '测试译文');
  assert.equal(request.url, configuration.endpoint); assert.equal(request.options.headers.Authorization, 'Bearer ' + configuration.apiKey);
  const body = JSON.parse(request.options.body); assert.equal(body.model, 'test-model'); assert.equal(body.stream, false);
});
test('unconfigured/disabled sources make no network request and are not retried', async () => {
  for (const config of [null, { ...configuration, enabled: false }, { ...configuration, endpoint: '' }, { ...configuration, model: '' }, { ...configuration, keyUnavailable: true }]) {
    await assert.rejects(requestTranslation(config, messages, { fetch: () => { throw new Error('unexpected request'); } }), error => error.code === 'NOT_CONFIGURED' && error.retryable === false);
  }
});
test('API key is optional for a locally hosted OpenAI-compatible service', async () => {
  await requestTranslation({ ...configuration, apiKey: '' }, messages, { fetch: async (_url, options) => { assert.equal(options.headers.Authorization, undefined); return response(); } });
});
test('oversized chunked replies stop reading and cancel before accumulating the response', async () => {
  let cancelled = false, reads = 0;
  const body = new ReadableStream({ pull(controller) { reads++; controller.enqueue(new Uint8Array(100001)); }, cancel() { cancelled = true; } });
  await assert.rejects(requestTranslation(configuration, messages, { fetch: async () => new Response(body) }), error => error.code === 'UPSTREAM_RESPONSE_TOO_LARGE' && error.retryable === false);
  assert.equal(cancelled, true); assert.ok(reads <= 5);
});
test('oversized declared response is cancelled without reading the body', async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(requestTranslation(configuration, messages, { fetch: async () => new Response(body, { headers: { 'content-length': String(TRANSLATION_RESPONSE_MAX_BYTES + 1) } }) }), error => error.code === 'UPSTREAM_RESPONSE_TOO_LARGE');
  assert.equal(cancelled, true);
});
test('upstream errors redact credentials and URLs while preserving retry information', async () => {
  await assert.rejects(requestTranslation(configuration, messages, { fetch: async () => new Response(JSON.stringify({ error: { message: 'Failed ' + configuration.apiKey + ' ' + configuration.endpoint } }), { status: 429, headers: { 'retry-after': '5' } }) }), error => {
    assert.equal(error.code, 'UPSTREAM_HTTP_429'); assert.equal(error.retryAfterMs, 5000); assert.equal(error.retryable, true);
    assert.ok(!error.message.includes(configuration.apiKey)); assert.ok(!error.message.includes(configuration.endpoint)); return true;
  });
});
test('deadline and client disconnect abort the actual request', async () => {
  const blockedFetch = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('cancel'), { name: 'AbortError' })), { once: true }));
  await assert.rejects(requestTranslation(configuration, messages, { fetch: blockedFetch, timeoutMs: 15 }), error => error.code === 'UPSTREAM_TIMEOUT');
  const controller = new AbortController(); const work = requestTranslation(configuration, messages, { fetch: blockedFetch, signal: controller.signal });
  controller.abort(); await assert.rejects(work, error => error.code === 'UPSTREAM_TIMEOUT');
});
test('a stalled response body is cancelled at the deadline even after headers arrived', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(requestTranslation(configuration, messages, { fetch: async () => new Response(stream), timeoutMs: 15 }), error => error.code === 'UPSTREAM_TIMEOUT');
  assert.equal(cancelled, true);
});
test('testing a saved source validates an actual model reply without returning credentials', async () => {
  assert.deepEqual(await testTranslationConfiguration({ ...configuration, enabled: false }, { fetch: async () => response('OK') }), { ok: true, message: '连接成功，模型可用' });
  assert.equal((await testTranslationConfiguration(configuration, { fetch: async () => response('') })).ok, false);
});
function serverHarness(provider = () => configuration) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = source.indexOf('async function handleLyricTranslateRequest('), end = source.indexOf('// ====================================================================\n//  HTTP Server', start);
  const calls = [], scope = { AbortController, Buffer, console: { warn() {} }, translationSettingsProvider: provider,
    readRequestBody: req => Promise.resolve(req.body), sendJSON: (res, value, status = 200) => { res.result = value; res.status = status; res.writableEnded = true; },
    requestTranslation: (config, content, options) => { calls.push({ config, content, options }); return requestTranslation(config, content, { ...options, fetch: async () => response() }); } };
  vm.runInNewContext(source.slice(start, end), scope);
  return { calls, async call(body = {}) { const res = new EventEmitter(); res.destroyed = false; res.writableEnded = false; await scope.handleLyricTranslateRequest({ method: 'POST', body }, res); return res; } };
}
test('HTTP proxy refuses absent settings and obsolete built-in providers', async () => {
  const none = serverHarness(() => null), missing = await none.call({ messages });
  assert.equal(missing.result.code, 'NOT_CONFIGURED'); assert.equal(missing.result.retryable, false); assert.equal(none.calls.length, 0);
  const configured = serverHarness(), obsolete = await configured.call({ provider: 'mymemory', messages });
  assert.equal(obsolete.status, 400); assert.equal(configured.calls.length, 0);
});
test('HTTP request body cannot replace the saved endpoint, model or credentials', async () => {
  const server = serverHarness(), result = await server.call({ messages, endpoint: 'https://external.invalid', model: 'untrusted', apiKey: 'untrusted' });
  assert.equal(result.result.ok, true); assert.equal(result.result.revision, 3);
  assert.equal(server.calls[0].config, configuration);
});

test('default service responses and errors omit upstream identity and credentials', async () => {
  const builtin = { ...configuration, builtin: true }, server = serverHarness(() => builtin);
  const result = await server.call({ messages });
  assert.equal(result.result.ok, true);
  const body = JSON.parse(result.result.body);
  assert.equal(body.choices[0].message.content, '1. 测试译文');
  assert.equal(body.model, undefined); assert.ok(!result.result.body.includes('synthetic-private-upstream-model'));
  const failed = await testTranslationConfiguration(builtin, { fetch: async () => new Response(JSON.stringify({error:{message:configuration.model+' '+configuration.endpoint+' '+configuration.apiKey}}),{status:401}) });
  for (const value of [configuration.model, configuration.endpoint, configuration.apiKey]) assert.ok(!JSON.stringify(failed).includes(value));
});
