import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise the real typed RPC client with window message events and no Electron privileges.
function browser() {
  const listeners = new Map();
  const sent = [];
  const parent = { postMessage: (message, origin) => sent.push({ message, origin }) };
  const window = {
    parent,
    location: { origin: 'http://127.0.0.1:3018', pathname: '/vendor/folia/index.html', search: '?host=mineradio' },
    addEventListener(name, fn) {
      const callbacks = listeners.get(name) || [];
      callbacks.push(fn); listeners.set(name, callbacks);
    },
  };
  const emit = (data, overrides = {}) => {
    for (const listener of listeners.get('message') || []) listener({ data, source: parent, origin: window.location.origin, ...overrides });
  };
  const lifecycle = name => { for (const listener of listeners.get(name) || []) listener(); };
  return { window, parent, sent, emit, lifecycle };
}

test('Folia client accepts only its parent and exact origin, and correlates replies', async () => {
  const env = browser();
  globalThis.window = env.window;
  const client = await import('../vendor-src/folia/src/mineradio/client.ts?trust');
  assert.equal(client.isMineradioEmbedded(), true);
  const request = client.requestHost('seek', { seconds: 27 });
  const outgoing = env.sent[0];
  assert.equal(outgoing.origin, env.window.location.origin);
  assert.equal(outgoing.message.method, 'seek');
  let resolved = false;
  void request.then(() => { resolved = true; });
  const reply = { ...outgoing.message, type: 'response', ok: true, result: { position: 27 } };
  env.emit(reply, { source: {} });
  env.emit(reply, { origin: 'http://evil.example' });
  env.emit({ ...reply, version: 2 });
  await Promise.resolve();
  assert.equal(resolved, false);
  env.emit(reply);
  assert.deepEqual(await request, { position: 27 });
  delete globalThis.window;
});

test('Folia subscriptions detach and failed operations reject with host error', async () => {
  const env = browser();
  globalThis.window = env.window;
  const client = await import('../vendor-src/folia/src/mineradio/client.ts?events');
  const received = [];
  const unsubscribe = client.subscribeHost('state', value => received.push(value));
  const message = { channel: 'mineradio-folia', version: 1, type: 'event', event: 'state', data: { playing: true } };
  env.emit(message);
  unsubscribe();
  env.emit(message);
  assert.deepEqual(received, [{ playing: true }]);
  const request = client.requestHost('play', { id: 'missing' });
  env.emit({ ...env.sent[0].message, type: 'response', ok: false, error: { code: 'TRACK_NOT_FOUND', message: '歌曲已移除' } });
  await assert.rejects(request, /歌曲已移除/);
  delete globalThis.window;
});

test('Standalone Folia cannot issue host commands', async () => {
  const env = browser();
  env.window.parent = env.window;
  globalThis.window = env.window;
  const client = await import('../vendor-src/folia/src/mineradio/client.ts?standalone');
  assert.equal(client.isMineradioEmbedded(), false);
  await assert.rejects(client.requestHost('pause'), /未连接/);
  assert.equal(env.sent.length, 0);
  delete globalThis.window;
});

test('Folia client clears a request immediately when postMessage fails', async (t) => {
  const env = browser();
  env.parent.postMessage = () => { throw new Error('Cannot clone request'); };
  globalThis.window = env.window;
  const clear = t.mock.method(globalThis, 'clearTimeout');
  try {
    const client = await import('../vendor-src/folia/src/mineradio/client.ts?send-failure');
    await assert.rejects(client.requestHost('seek', { seconds: 12 }), /Cannot clone/);
    assert.equal(clear.mock.callCount(), 1);
    env.lifecycle('pagehide');
    assert.equal(clear.mock.callCount(), 1, 'failed sends must leave no pending request');
  } finally { delete globalThis.window; }
});

test('Closing Folia rejects every pending request and ignores late replies', async () => {
  const env = browser();
  globalThis.window = env.window;
  try {
    const client = await import('../vendor-src/folia/src/mineradio/client.ts?close');
    const pending = [client.requestHost('getState'), client.requestHost('listTracks')];
    const settled = Promise.all(pending.map(request => assert.rejects(request, /界面已关闭/)));
    env.lifecycle('pagehide');
    for (const { message } of env.sent) env.emit({ ...message, type: 'response', ok: true, result: {} });
    await settled;
  } finally { delete globalThis.window; }
});
