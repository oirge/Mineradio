'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createNativeAudio = require('../public/mobile-native-audio.js');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.ok(predicate(), 'The expected native operation did not run');
}

function fixture(options = {}) {
  const uri = options.uri || 'content://fixture/one';
  const source = value => 'https://localhost/_capacitor_content_/' + value.replace(/^content:\/\//, '');
  const calls = [], errors = [], observed = [];
  const root = {Event, EventTarget, setTimeout(callback) { return setTimeout(callback, 0); }, audio: null};
  const item = {
    root, calls, errors, observed, source,
    native: {nativeActive: false, backend: 'native', uri, index: 0, position: 12,
      duration: 240, rate: 1, playing: false, preparing: false, snapshotAt: Date.now(),
      analysis: {frequency: [3,23], beatFrequency: [8,9,10], timeDomain: [101,131]}},
  };
  const snapshot = () => ({...structuredClone(item.native), snapshotAt: Date.now()});
  const plugin = {
    async getPlaybackState() {
      calls.push(['state']);
      return options.getState ? options.getState(item, snapshot) : snapshot();
    },
    async startBackground(request) {
      calls.push(['start', structuredClone(request)]);
      if (options.start) return options.start(item, request);
      item.native = {...item.native, ...request, uri: request.queue[request.index].uri, nativeActive: true, playing: true, preparing: false};
      return snapshot();
    },
    async commandPlayback(request) {
      calls.push(['command', {...request}]);
      if (options.command) return options.command(item, request);
      if (request.action === 'pause') item.native.playing = false;
      else if (request.action === 'play') item.native.playing = true;
      else if (request.action === 'seek') item.native.position = request.position;
      return snapshot();
    },
    async masterGain(request) { calls.push(['master', {...request}]); return snapshot(); },
  };
  item.facade = createNativeAudio({
    root, plugin,
    capture(media) {
      return {queue: [{uri}, {uri: 'content://fixture/two'}], index: media.src.endsWith('/two') ? 1 : 0,
        uri: item.facade.uriOf(media.src),
        position: media.currentTime, duration: 240, rate: media.playbackRate,
        resumePlaying: true, volume: .8, effects: {enabled: false}};
    },
    async configure() { calls.push(['configure']); return options.configure ? options.configure(item, snapshot) : snapshot(); },
    async onState(value) {
      observed.push(structuredClone(value));
      if (options.onState) await options.onState(item, value);
    },
    report(error) { errors.push(error.message); },
  });
  item.media = new item.facade.Media();
  root.audio = item.media;
  item.media.src = source(uri);
  item.commands = () => calls.filter(call => call[0] !== 'state');
  return item;
}

test('foreground/background refresh keeps the running native session and never loads or pauses it', async () => {
  const item = fixture();
  item.native.nativeActive = true; item.native.playing = true;
  const playingEvents = [];
  item.media.addEventListener('playing', () => playingEvents.push('playing'));
  await item.facade.initialize();
  item.native.position = 24;
  await item.facade.setBackground(true);
  await item.facade.setBackground(false);
  await item.facade.context.suspend();
  await item.facade.context.resume();
  assert.deepEqual(item.commands(), []);
  assert.equal(item.facade.mode, 'single-native');
  assert.equal(item.facade.phase(), 'native');
  assert.equal(item.facade.context.state, 'running');
  assert.equal(item.media.paused, false);
  assert.ok(item.media.currentTime >= 24 && item.media.currentTime < 25);
  assert.deepEqual(playingEvents, ['playing']);
});

test('synchronizing a native queue change updates the facade without restarting sound', async () => {
  const item = fixture({onState: async (current, state) => {
    current.media.pause();
    current.media.src = current.source(state.uri);
    current.media.currentTime = state.position;
    current.media.playbackRate = state.rate;
    current.media.load();
  }});
  item.native = {...item.native, nativeActive: true, playing: true, uri: 'content://fixture/two', index: 1, position: 6, rate: 1.5};
  const updates = [];
  item.media.addEventListener('timeupdate', () => updates.push(item.media.currentSrc));
  await item.facade.refresh();
  assert.deepEqual(item.commands(), []);
  assert.equal(item.media.currentSrc, item.source('content://fixture/two'));
  assert.equal(item.media.paused, false);
  assert.equal(item.media.playbackRate, 1.5);
  assert.ok(item.media.currentTime >= 6 && item.media.currentTime < 7);
  assert.deepEqual(updates, [item.media.currentSrc]);
});

test('play waits for actual decoded native playback and emits play before one playing event', async () => {
  const decoded = deferred();
  let polls = 0;
  const item = fixture({
    start: async (current, request) => { current.native = {...current.native, ...request, nativeActive: true, playing: false, preparing: true}; },
    getState: (current, snapshot) => ++polls === 1 ? snapshot() : decoded.promise,
  });
  const events = [];
  item.media.addEventListener('play', () => events.push('play'));
  item.media.addEventListener('playing', () => events.push('playing'));
  let settled = false;
  const playing = item.media.play().then(() => { settled = true; });
  await until(() => polls >= 2);
  assert.equal(settled, false);
  assert.equal(item.media.paused, true);
  assert.deepEqual(events, []);
  decoded.resolve({...item.native, nativeActive: true, playing: true, preparing: false, position: 1, snapshotAt: Date.now()});
  await playing;
  assert.equal(item.commands().filter(call => call[0] === 'start').length, 1);
  assert.equal(item.media.paused, false);
  assert.equal(item.media.readyState, 4);
  assert.deepEqual(events, ['play', 'playing']);
});

test('resuming the same native track uses its play command and never opens another source', async () => {
  const item = fixture();
  item.native.nativeActive = true;
  await item.facade.initialize();
  await item.media.play();
  assert.deepEqual(item.commands(), [['command', {action: 'play'}]]);
  assert.equal(item.media.paused, false);
});

test('Android converted SAF addresses preserve the provider URI through start, refresh, seek and resume', async () => {
  const uri = 'content://com.android.providers.downloads.documents/document/msf%3A1000000016';
  const item = fixture({uri});
  item.media.src = item.source(uri);
  assert.equal(item.media.src, 'https://localhost/_capacitor_content_/com.android.providers.downloads.documents/document/msf%3A1000000016');
  await item.media.play();
  assert.equal(item.commands()[0][1].uri, uri);
  assert.equal(item.commands()[0][1].queue[item.commands()[0][1].index].uri, uri);
  assert.equal(item.media.paused, false);
  item.native.position = 18;
  await item.facade.refresh();
  assert.ok(item.media.currentTime >= 18 && item.media.currentTime < 19);
  item.media.currentTime = 32;
  await until(() => !item.facade.busy());
  assert.equal(item.native.position, 32);
  item.media.pause();
  await until(() => !item.facade.busy());
  await item.media.play();
  assert.equal(item.commands().filter(call => call[0] === 'start').length, 1);
  assert.deepEqual(item.commands().filter(call => call[0] === 'command').map(call => call[1]), [
    {action: 'seek', position: 32}, {action: 'pause'}, {action: 'play'},
  ]);
  assert.equal(item.media.paused, false);
});

test('an old poll cannot overwrite a UI setting while its native configuration is in flight', async () => {
  const late = deferred(), configured = deferred();
  let delayNext = false;
  const item = fixture({
    getState: (current, snapshot) => delayNext ? (delayNext = false, late.promise) : snapshot(),
    configure: async current => { await configured.promise; current.native.rate = 1; },
    onState: (current, state) => { current.root.settingRate = state.rate; },
  });
  item.native.nativeActive = true; item.native.playing = true; item.native.rate = 1.5;
  await item.facade.initialize();
  const stale = {...structuredClone(item.native), snapshotAt: Date.now()};
  delayNext = true;
  const oldRefresh = item.facade.refresh();
  item.root.settingRate = 1;
  const applying = item.facade.configure();
  await until(() => item.commands().some(call => call[0] === 'configure'));
  late.resolve(stale);
  await oldRefresh;
  assert.equal(item.root.settingRate, 1);
  assert.equal(item.observed.length, 1);
  configured.resolve();
  await applying;
  await item.facade.refresh();
  assert.equal(item.root.settingRate, 1);
  assert.equal(item.media.playbackRate, 1);
});

test('native UI configurations are serialized with playback commands', async () => {
  const configured = deferred();
  const item = fixture({configure: () => configured.promise});
  item.native.nativeActive = true; item.native.playing = true;
  await item.facade.initialize();
  const applying = item.facade.configure();
  item.media.pause();
  await until(() => item.commands().length > 0);
  assert.deepEqual(item.commands(), [['configure']]);
  configured.resolve();
  await applying;
  await until(() => !item.facade.busy());
  assert.deepEqual(item.commands(), [['configure'], ['command', {action: 'pause'}]]);
  assert.equal(item.native.playing, false);
});

test('direct and scheme-retaining content addresses refer to the same native media', async () => {
  const item = fixture();
  item.media.src = 'https://localhost/_capacitor_content_/content://fixture/one';
  item.native.nativeActive = true; item.native.playing = true;
  await item.facade.refresh();
  assert.equal(item.media.paused, false);
  item.media.src = 'content://fixture/one';
  await item.facade.refresh();
  assert.equal(item.media.paused, false);
  await item.media.play();
  assert.deepEqual(item.commands(), [['command', {action: 'play'}]]);
});

test('pausing an idle facade cannot stop the active native track', async () => {
  const item = fixture();
  item.native.nativeActive = true; item.native.playing = true;
  await item.facade.initialize();
  const idle = new item.facade.Media();
  idle.src = item.source('content://fixture/two');
  idle.pause();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(item.commands(), []);
  item.media.pause();
  await until(() => !item.facade.busy());
  assert.deepEqual(item.commands(), [['command', {action: 'pause'}]]);
  assert.equal(item.media.paused, true);
});

test('a metadata resume seek remains in the native start request', async () => {
  const item = fixture();
  item.media.addEventListener('loadedmetadata', () => { item.media.currentTime = 37.25; }, {once: true});
  item.media.load();
  await item.media.play();
  const request = item.commands().find(call => call[0] === 'start')[1];
  assert.equal(request.position, 37.25);
  assert.equal(request.uri, 'content://fixture/one');
  assert.equal(item.commands().filter(call => call[0] === 'command').length, 0);
});

test('a late native poll cannot undo a completed manual pause', async () => {
  const late = deferred();
  let delayNext = false;
  const item = fixture({getState: (current, snapshot) => delayNext ? (delayNext = false, late.promise) : snapshot()});
  item.native.nativeActive = true; item.native.playing = true;
  await item.facade.initialize();
  const stale = {...structuredClone(item.native), playing: true, position: 3, snapshotAt: Date.now()};
  delayNext = true;
  const oldRefresh = item.facade.refresh();
  item.media.pause();
  await until(() => !item.facade.busy());
  await item.facade.refresh();
  assert.equal(item.media.paused, true);
  late.resolve(stale);
  await oldRefresh;
  assert.equal(item.media.paused, true);
  assert.equal(item.facade.state().playing, false);
  assert.ok(item.media.currentTime >= 12 && item.media.currentTime < 13);
});

test('out-of-order native polls retain the newest requested snapshot', async () => {
  const first = deferred(), second = deferred();
  let polls = 0;
  const item = fixture({getState: () => ++polls === 1 ? first.promise : second.promise});
  const older = item.facade.refresh(), newer = item.facade.refresh();
  second.resolve({...item.native, nativeActive: true, playing: true, position: 30, snapshotAt: Date.now()});
  await newer;
  first.resolve({...item.native, nativeActive: true, playing: true, position: 15, snapshotAt: Date.now()});
  await older;
  assert.equal(item.facade.state().position, 30);
  assert.ok(item.media.currentTime >= 30 && item.media.currentTime < 31);
});

test('a rejected native start does not prevent a later playback operation', async () => {
  let attempts = 0;
  const item = fixture({start: async (current, request) => {
    if (++attempts === 1) throw new Error('decoder unavailable');
    current.native = {...current.native, ...request, nativeActive: true, playing: true, preparing: false};
  }});
  await assert.rejects(item.media.play(), /decoder unavailable/);
  await item.media.play();
  assert.equal(attempts, 2);
  assert.equal(item.media.paused, false);
  assert.equal(item.facade.busy(), false);
  assert.ok(item.errors.includes('decoder unavailable'));
});

test('a rejected native command can be followed by a successful resume', async () => {
  let attempts = 0;
  const item = fixture({command: async (current, request) => {
    assert.equal(request.action, 'play');
    if (++attempts === 1) throw new Error('audio focus denied');
    current.native.playing = true;
  }});
  item.native.nativeActive = true;
  await item.facade.initialize();
  await assert.rejects(item.media.play(), /audio focus denied/);
  await item.media.play();
  assert.equal(attempts, 2);
  assert.equal(item.commands().filter(call => call[0] === 'start').length, 0);
  assert.equal(item.media.paused, false);
  assert.ok(item.errors.includes('audio focus denied'));
});

test('a rejected seek clears its pending flag and a later seek still completes', async () => {
  let seeks = 0;
  const item = fixture({command: async (current, request) => {
    assert.equal(request.action, 'seek');
    if (++seeks === 1) throw new Error('seek failed');
    current.native.position = request.position;
  }});
  item.native.nativeActive = true; item.native.playing = true;
  await item.facade.initialize();
  item.media.currentTime = 40;
  await until(() => !item.facade.busy() && item.errors.length > 0);
  assert.equal(item.media.seeking, false);
  await item.facade.refresh();
  assert.ok(item.media.currentTime >= 12 && item.media.currentTime < 13);
  const events = [];
  item.media.addEventListener('seeked', () => events.push('seeked'));
  item.media.currentTime = 60;
  await until(() => !item.facade.busy());
  assert.equal(item.media.seeking, false);
  assert.equal(seeks, 2);
  assert.deepEqual(events, ['seeked']);
  assert.ok(item.media.currentTime >= 60 && item.media.currentTime < 61);
});

test('native analyser arrays are copied with correct spectrum and waveform defaults', async () => {
  const item = fixture();
  item.native.nativeActive = true; item.native.playing = true;
  await item.facade.refresh();
  const main = item.facade.analyser(false), beat = item.facade.analyser(true);
  const frequency = new Uint8Array(6), beatFrequency = new Uint8Array(2), waveform = new Uint8Array(6);
  main.getByteFrequencyData(frequency);
  beat.getByteFrequencyData(beatFrequency);
  main.getByteTimeDomainData(waveform);
  assert.deepEqual([...frequency], [3,23,0,0,0,0]);
  assert.deepEqual([...beatFrequency], [8,9]);
  assert.deepEqual([...waveform], [101,131,128,128,128,128]);
  frequency.fill(255);
  main.getByteFrequencyData(frequency);
  assert.equal(frequency[0], 3);
  assert.equal(item.facade.context.sampleRate, 48000);
});
