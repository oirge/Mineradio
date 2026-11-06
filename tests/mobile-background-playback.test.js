'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createController = require('../public/mobile-playback.js');

function fixture(overrides = {}) {
  const calls = [], errors = [];
  const state = { playing: true, resumePlaying: true, index: 0, position: 12, queue: [{uri:'content://test/one'}, {uri:'content://test/two'}] };
  const audio = { web: true, native: false };
  const dependencies = {
    capture() { return {...state, playing: audio.web}; },
    async getNative() { return {nativeActive: false}; },
    async pauseWeb() { calls.push('pause-web'); audio.web = false; },
    async startNative() { assert.equal(audio.web, false); calls.push('start-native'); audio.native = true; },
    async takeNative() { calls.push('stop-native'); audio.native = false; return {...state, position: 57, index: 1}; },
    async restoreWeb(value) { assert.equal(audio.native, false); calls.push(['restore-web', value.index, value.position]); audio.web = value.resumePlaying; },
    report(error) { errors.push(error.message); },
    ...overrides,
  };
  return {calls, errors, state, audio, dependencies, controller: createController(dependencies)};
}

test('background audio starts only after the visible engine has stopped', async () => {
  const item = fixture(); await item.controller.initialize();
  await item.controller.setBackground(true);
  assert.deepEqual(item.calls, ['pause-web', 'start-native']);
  assert.deepEqual(item.audio, {web:false, native:true});
});

test('foreground restoration stops native output before restoring its song and position', async () => {
  const item = fixture(); await item.controller.initialize(); await item.controller.setBackground(true);
  await item.controller.setBackground(false);
  assert.deepEqual(item.calls.slice(-2), ['stop-native', ['restore-web', 1, 57]]);
  assert.deepEqual(item.audio, {web:true, native:false});
});

test('paused music is not started by putting the app in the background', async () => {
  const item = fixture(); item.audio.web = false;
  await item.controller.initialize(); await item.controller.setBackground(true);
  assert.deepEqual(item.calls, []); assert.equal(item.audio.native, false);
});

test('a fast hide/show during native startup returns to a single foreground owner', async () => {
  let finish;
  const item = fixture({startNative: async () => { item.calls.push('start-native'); await new Promise(resolve => { finish = resolve; }); item.audio.native = true; }});
  await item.controller.initialize();
  const hidden = item.controller.setBackground(true);
  for (let attempt = 0; attempt < 100 && !finish; attempt++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof finish, 'function');
  const visible = item.controller.setBackground(false); finish();
  await Promise.all([hidden, visible]);
  assert.deepEqual(item.audio, {web:true, native:false});
  assert.equal(item.calls.filter(value => value === 'stop-native').length, 1);
});

test('native startup failure releases any partial native owner before resuming WebAudio', async () => {
  const item = fixture({startNative: async () => { item.audio.native = true; throw new Error('prepare failed'); }});
  await item.controller.initialize(); await item.controller.setBackground(true);
  assert.deepEqual(item.audio, {web:true, native:false});
  assert.equal(item.errors[0], 'prepare failed');
});

test('a native release failure does not allow duplicate foreground output', async () => {
  const item = fixture(); await item.controller.initialize(); await item.controller.setBackground(true);
  item.dependencies.takeNative = async () => { throw new Error('release failed'); };
  await assert.rejects(item.controller.setBackground(false), /release failed/);
  assert.deepEqual(item.audio, {web:false, native:true}); assert.equal(item.controller.ownsAudio(), true);
});

test('reopening the app takes over an existing native session before allowing frontend audio', async () => {
  const item = fixture({getNative: async () => ({nativeActive:true, queue:[{uri:'content://test/one'}]})});
  item.audio.web = false; item.audio.native = true;
  await item.controller.initialize(); await item.controller.ready;
  assert.deepEqual(item.calls, ['pause-web', 'stop-native', ['restore-web', 1, 57]]);
  assert.deepEqual(item.audio, {web:true, native:false});
});

test('a notification pause remains paused when the UI returns', async () => {
  const item = fixture({takeNative: async () => { item.audio.native = false; return {...item.state, resumePlaying:false}; }});
  await item.controller.initialize(); await item.controller.setBackground(true); await item.controller.setBackground(false);
  assert.deepEqual(item.audio, {web:false, native:false});
});

test('a failed startup probe keeps frontend output blocked until ownership can be checked', async () => {
  const item = fixture({getNative: async () => { throw new Error('bridge unavailable'); }});
  item.audio.web = false;
  await item.controller.initialize(); await item.controller.ready;
  assert.equal(item.controller.ownsAudio(), true); assert.equal(item.audio.web, false);
  item.dependencies.getNative = async () => ({nativeActive:false});
  await item.controller.setBackground(false);
  assert.equal(item.controller.ownsAudio(), false);
});
