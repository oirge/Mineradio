'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const { once } = require('node:events');
const { test } = require('node:test');
const { listenOnLoopback } = require('../desktop/local-server-listener');

test('starts the real HTTP listener on an available loopback port with one bind', async (context) => {
  const server = http.createServer((_request, response) => response.end('ok'));
  context.after(() => server.close());
  const calls = context.mock.method(server, 'listen');
  const port = await listenOnLoopback(server, 0);
  assert.equal(calls.mock.callCount(), 1);
  assert.equal(server.address().address, '127.0.0.1');
  const response = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(await response.text(), 'ok');
  assert.equal(await listenOnLoopback(server, 0), port);
  assert.equal(calls.mock.callCount(), 1);
});

test('continues on the next available port when the preferred one is occupied', async (context) => {
  const blocker = net.createServer().listen(0, '127.0.0.1');
  context.after(() => blocker.close());
  await once(blocker, 'listening');
  const preferred = blocker.address().port;
  const server = http.createServer();
  const originalListening = server.listeners('listening');
  context.after(() => server.close());
  const calls = context.mock.method(server, 'listen');
  const port = await listenOnLoopback(server, preferred);
  assert.ok(port > preferred);
  assert.deepEqual(calls.mock.calls.map(call => call.arguments[0]),
    Array.from({ length: port - preferred + 1 }, (_, index) => preferred + index));
  assert.equal(server.listenerCount('error'), 0);
  assert.deepEqual(server.listeners('listening'), originalListening);
});

test('does not retry unrelated errors or overrun the last valid port', async (context) => {
  const server = http.createServer();
  const originalListening = server.listeners('listening');
  const listen = context.mock.method(server, 'listen', () => { throw Object.assign(new Error('bind failed'), { code: 'EACCES' }); });
  await assert.rejects(listenOnLoopback(server, 65535), { code: 'EACCES' });
  assert.equal(listen.mock.callCount(), 1);
  await assert.rejects(listenOnLoopback(server, 65536), /INVALID_LOCAL_SERVER_PORT/);
  assert.equal(listen.mock.callCount(), 1);
  listen.mock.mockImplementation(() => { throw Object.assign(new Error('unexpected'), { code: 'EINVAL' }); });
  await assert.rejects(listenOnLoopback(server, 3000), { code: 'EINVAL' });
  assert.equal(listen.mock.callCount(), 2);
  assert.equal(server.listenerCount('error'), 0);
  assert.deepEqual(server.listeners('listening'), originalListening);
});

test('desktop startup leaves the packaged server stopped until explicitly started and coalesces callers', async (context) => {
  context.mock.method(console, 'log', () => {});
  process.env.MINERADIO_DESKTOP_MANUAL_LISTEN = '1';
  const server = require('../server');
  delete process.env.MINERADIO_DESKTOP_MANUAL_LISTEN;
  context.after(() => server.close());
  assert.equal(server.listening, false);
  const first = server.startDesktopListening(0);
  assert.equal(first, server.startDesktopListening(0));
  const port = await first;
  const response = await fetch(`http://127.0.0.1:${port}/api/app/version`);
  assert.equal((await response.json()).version, require('../package.json').version);
});
