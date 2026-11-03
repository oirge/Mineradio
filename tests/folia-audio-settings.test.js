'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { create } = require('../public/folia-audio-settings');

// tests/folia-audio-settings.test.js
// Exercise bridge validation against the actual host normalization and preset curves.
function setup() {
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const from = source.indexOf('var AUDIO_CHAIN_BAND_FREQUENCIES');
  const to = source.indexOf('function readSavedAudioChainSettings()', from);
  assert.ok(from >= 0 && to > from);
  const context = vm.createContext({ clampRange: (value, min, max) => Math.min(max, Math.max(min, value)) });
  vm.runInContext(source.slice(from, to), context);
  let commits = 0, refreshes = 0;
  context.commitAudioChainSettings = () => { commits++; };
  context.outputDeviceSetting = { deviceId: '', label: '' };
  context.outputDeviceRuntime = { status: 'applied', actualId: 'speaker' };
  context.outputDeviceList = [{ deviceId: '', label: 'System default' }, { deviceId: 'speaker', label: 'Speakers' }];
  context.refreshOutputDevices = async () => { refreshes++; };
  context.outputDeviceSelectionSupported = () => true;
  context.setOutputDevice = async id => { context.outputDeviceSetting.deviceId = id; };
  return { host: context, adapter: create(context), commits: () => commits, refreshes: () => refreshes };
}
test('Folia edits use the host curves, limits and commit path with isolated snapshots', async () => {
  const h = setup();
  const options = await h.adapter.options();
  assert.equal(options.frequencies.length, 10);
  assert.equal(options.presets.length, 7);
  assert.equal(h.refreshes(), 1);
  h.adapter.update({ enabled: true, preset: 'rock', preampDb: 100, widthRatio: -10 });
  assert.equal(h.commits(), 1);
  const state = h.adapter.snapshot();
  assert.equal(state.audioChain.preset, 'rock');
  assert.equal(state.audioChain.preampDb, 12);
  assert.equal(state.audioChain.widthRatio, 0);
  state.audioChain.gains[0] = 99;
  options.frequencies[0] = 99;
  assert.equal(h.adapter.snapshot().audioChain.gains[0], 5);
  assert.equal((await h.adapter.options()).frequencies[0], 31);
  h.adapter.update({ band: { index: 0, gain: 7.2 }, limiterThresholdDb: -99 });
  assert.equal(h.adapter.snapshot().audioChain.preset, 'custom');
  assert.equal(h.adapter.snapshot().audioChain.gains[0], 7);
  assert.equal(h.adapter.snapshot().audioChain.limiterThresholdDb, -12);
});
test('malformed compound edits cannot partly change or commit host audio preferences', () => {
  const h = setup(), before = JSON.stringify(h.host.audioChainSettings);
  for (const params of [{ enabled: true, band: { index: 10, gain: 1 } }, { preset: 'missing', enabled: true },
    { preset: 'custom' }, { enabled: 'true' }, { preampDb: NaN }, { widthRatio: Infinity },
    { band: { index: 0.5, gain: 1 } }, { band: { index: 0, gain: '1' } }]) {
    assert.throws(() => h.adapter.update(params), { code: 'INVALID_AUDIO_CHAIN' });
    assert.equal(JSON.stringify(h.host.audioChainSettings), before);
  }
  assert.equal(h.commits(), 0);
});
test('output selection accepts available or saved devices, rejects unknown devices and respects capability', async () => {
  const h = setup();
  await h.adapter.selectOutput({ deviceId: 'speaker' });
  assert.equal(h.host.outputDeviceSetting.deviceId, 'speaker');
  h.host.outputDeviceList = [{ deviceId: '' }];
  await h.adapter.selectOutput({ deviceId: 'speaker' });
  await assert.rejects(h.adapter.selectOutput({ deviceId: 'arbitrary-device' }), { code: 'INVALID_OUTPUT_DEVICE' });
  await assert.rejects(h.adapter.selectOutput({ deviceId: 1 }), { code: 'INVALID_OUTPUT_DEVICE' });
  h.host.outputDeviceSelectionSupported = () => false;
  await assert.rejects(h.adapter.selectOutput({ deviceId: '' }), { code: 'OUTPUT_DEVICE_UNSUPPORTED' });
  assert.equal(h.host.outputDeviceSetting.deviceId, 'speaker');
});
