'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../public/video-export.js'), 'utf8');

function harness(options = {}) {
  const calls = [], status = [], listeners = new Map(), connections = new Set();
  let failureListener, controller, recorder;
  const media = {
    src: 'blob:original-song', currentTime: 12, duration: 60, paused: false, ended: false, readyState: 4,
    pause() { calls.push('pause-owner'); this.paused = true; this.fire('pause'); },
    play() { calls.push('play-owner'); this.paused = false; this.fire('playing'); return Promise.resolve(); },
    addEventListener(name, cb) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(cb); },
    removeEventListener(name, cb) { listeners.get(name)?.delete(cb); },
    fire(name) { for (const callback of listeners.get(name) || []) callback(); },
  };
  class Stream {
    constructor() { this.tracks = [{ kind: 'video', readyState: 'live', muted: false, stop() { this.readyState = 'ended'; calls.push('stop-video'); } }]; }
    getTracks() { return this.tracks; }
    getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
    getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
    addTrack(track) { this.tracks.push(track); }
  }
  const output = { connect(node) { connections.add(node); }, disconnect(node) { assert.ok(node, 'never disconnect the speaker chain'); connections.delete(node); calls.push('disconnect-tap'); } };
  class Recorder {
    static isTypeSupported(type) { return type === 'video/webm;codecs=vp8,opus'; }
    constructor(stream, settings) { this.stream = stream; this.settings = settings; this.state = 'inactive'; recorder = this; }
    start() {
      this.state = 'recording'; calls.push('record-start');
      const ready = () => { calls.push('encoder-ready'); this.onstart?.(); };
      if (options.startEncoder) options.startEncoder(ready);
      else queueMicrotask(ready);
    }
    pause() { this.state = 'paused'; calls.push('record-pause'); }
    resume() { this.state = 'recording'; calls.push('record-resume'); }
    stop() {
      assert.notEqual(this.state, 'inactive'); this.state = 'inactive'; calls.push('record-stop');
      queueMicrotask(() => { this.ondataavailable({ data: new Blob(['final-encoded-chunk']) }); this.onstop(); });
    }
  }
  const bridge = {
    async beginVideoExport(payload) { calls.push(['begin', payload]); return options.begin ? options.begin(payload) : { id: 'job', fileName: 'song.webm', sourceId: 'owner-bound-source' }; },
    onVideoExportFailure(callback) { failureListener = callback; return () => { failureListener = null; }; },
    updateVideoExport(payload) { calls.push(['update', payload]); },
    async appendVideoExportChunk(payload) { calls.push(['append', payload.sequence, payload.bytes.byteLength > 100 ? payload.bytes.byteLength : Buffer.from(payload.bytes).toString()]); if (options.append) await options.append(payload); },
    async finishVideoExport(payload) { calls.push(['finish', payload.id]); return { fileName: 'song.webm' }; },
    async cancelVideoExport(payload) { calls.push(['cancel', payload.id]); },
  };
  const host = {
    desktopWindow: bridge, MediaRecorder: Recorder, MediaStream: Stream, Blob,
    navigator: { mediaDevices: { getUserMedia: async constraints => { calls.push(['capture', constraints]); return options.capture ? options.capture() : new Stream(); } } },
    document: { createElement(tag) { assert.equal(tag, 'canvas'); return { width: 0, height: 0, getContext: () => ({ drawImage() {} }), captureStream: () => new Stream(), remove() {} }; } },
    audio: media, audioChain: { output },
    audioCtx: { sampleRate: 48000, createMediaStreamDestination() { return { stream: { getAudioTracks: () => [{ kind: 'audio', stop() { calls.push('stop-tap'); } }] } }; } },
    initAudio() { calls.push('init-existing-audio'); }, resumeAudioAnalysis: async () => {},
    setTimeout(callback, delay) { calls.push(['timer', delay]); return setTimeout(callback, delay === 1500 ? (options.drainDelay ?? 0) : delay); }, clearTimeout, addEventListener() {},
  };
  vm.runInNewContext(source, { window: host, Blob, Uint8Array, console, Date, Promise });
  controller = host.MineradioVideoExport.create(host, {
    getState: () => ({ currentTrack: { id: host.trackId || 'track', title: 'Original song' }, position: host.audio.currentTime, duration: host.audio.duration, playing: !host.audio.paused, volume: 0 }),
    getLyrics: () => ({ trackId: host.trackId || 'track', lines: [] }), getAnalysis: () => ({ trackId: host.trackId || 'track', revision: 1 }),
    emit: (name, value) => status.push({ name, ...value }),
  });
  return { controller, host, media, calls, status, connections, makeStream: () => new Stream(), get recorder() { return recorder; }, fail: error => failureListener({ id: 'job', error }) };
}
const params = { width: 1280, height: 720, startMode: 'current', visuals: { mode: 'classic' } };

test('recording does not wait for delayed muxed output before playing the song', async t => {
  let ready;
  const h = harness({ startEncoder: callback => { ready = callback; } });
  t.after(() => h.controller.cancel());
  await h.controller.start(params);
  assert.equal(typeof ready, 'function');
  assert.equal(h.media.paused, false);
  assert.equal(h.media.currentTime, 12);
  assert.equal(h.controller.getState().status, 'recording');
  assert.equal(h.recorder.state, 'recording');
  assert.ok(h.calls.includes('record-pause'));
  assert.ok(h.calls.includes('play-owner'));
  ready();
  assert.equal(h.controller.getState().status, 'recording');
  assert.ok(h.calls.indexOf('encoder-ready') > h.calls.indexOf('play-owner'));
  await h.controller.stop();
});

test('cancelling before or after the first muxed output leaves the song playing', async t => {
  for (const initialized of [false, true]) await t.test(initialized ? 'first muxed output received' : 'first muxed output pending', async () => {
    let ready;
    const h = harness({ startEncoder: callback => { ready = callback; } });
    const starting = h.controller.start(params);
    await new Promise(resolve => setTimeout(resolve, 40));
    if (initialized) ready();
    await h.controller.cancel();
    if (!initialized) ready();
    await starting;
    assert.equal(h.media.paused, false);
    assert.equal(h.controller.getState().status, 'cancelled');
    assert.equal(h.recorder.state, 'inactive');
    assert.equal(h.connections.size, 0);
  });
});

test('save dialog cancellation preserves the current audio, position and speaker graph', async () => {
  const h = harness({ begin: async () => ({ cancelled: true }) });
  const result = await h.controller.start({ ...params, startMode: 'from-start' });
  assert.equal(result.status, 'cancelled');
  assert.equal(h.media.currentTime, 12);
  assert.equal(h.media.paused, false);
  assert.equal(h.connections.size, 0);
  assert.ok(!h.calls.includes('pause-owner'));
});

test('final encoded chunk reaches disk before finish, with only the recording tap disconnected', async () => {
  let allowWrite;
  let signalWrite;
  const writeGate = new Promise(resolve => { allowWrite = resolve; });
  const writing = new Promise(resolve => { signalWrite = resolve; });
  const h = harness({ append: () => { signalWrite(); return writeGate; } });
  const owner = h.host.audio;
  await h.controller.start(params);
  assert.equal(h.controller.getState().status, 'recording');
  assert.equal(h.connections.size, 1);
  const saving = h.controller.stop();
  assert.equal(h.recorder.state, 'paused', 'new samples stop synchronously before another track can sound');
  assert.equal(h.connections.size, 0);
  await writing;
  assert.deepEqual(h.calls.find(item => Array.isArray(item) && item[0] === 'append'), ['append', 0, 'final-encoded-chunk']);
  assert.ok(!h.calls.some(item => Array.isArray(item) && item[0] === 'finish'));
  allowWrite();
  assert.equal((await saving).status, 'saved');
  assert.equal(h.host.audio, owner);
  assert.equal(owner.paused, false);
  assert.equal(h.calls.at(-1), 'stop-tap');
});

test('stopping drains already encoded frames while capture is paused and the speaker keeps playing', async () => {
  const h = harness({ drainDelay: 40 });
  await h.controller.start(params);
  const saving = h.controller.stop();
  assert.equal(h.recorder.state, 'paused');
  assert.equal(h.connections.size, 0);
  assert.equal(h.media.paused, false);
  h.recorder.ondataavailable({ data: new Blob(['queued-video-frame']) });
  assert.equal((await saving).status, 'saved');
  const chunks = h.calls.filter(item => Array.isArray(item) && item[0] === 'append');
  assert.deepEqual(chunks.map(item => item[2]), ['queued-video-frame', 'final-encoded-chunk']);
  assert.equal(h.media.paused, false);
  assert.equal(h.recorder.state, 'inactive');
});

test('save behavior follows pause/resume and pauses capture synchronously before track handoff', async () => {
  const h = harness();
  await h.controller.start({ ...params, transitionBehavior: 'save' });
  h.media.pause();
  assert.equal(h.recorder.state, 'paused');
  assert.equal(h.controller.getState().status, 'paused');
  await h.media.play();
  assert.equal(h.recorder.state, 'recording');
  h.controller.beforeTrackChange();
  assert.equal(h.recorder.state, 'paused');
  assert.equal(h.controller.isCapturing(), false);
  await h.controller.stop();
});

test('default behavior keeps one recording through seeks and track/audio owner changes', async t => {
  const h = harness();
  t.after(() => h.controller.cancel());
  await h.controller.start(params);
  const originalRecorder = h.recorder;
  assert.equal(h.controller.getState().transitionBehavior, 'continue');
  assert.equal(h.controller.blocksCrossfade(), false);
  h.media.seeking = true; h.media.fire('seeking');
  assert.equal(h.recorder.state, 'paused');
  h.media.currentTime = 40; h.media.seeking = false; h.media.fire('seeked');
  assert.equal(h.recorder.state, 'recording');
  h.controller.beforeTrackChange();
  h.host.trackId = 'next-track';
  h.host.audio = { ...h.media, currentTime: 0 };
  await new Promise(resolve => setTimeout(resolve, 45));
  assert.equal(h.recorder, originalRecorder);
  assert.equal(h.recorder.state, 'recording');
  const next = h.calls.find(item => Array.isArray(item) && item[0] === 'update' && item[1].state.currentTrack.id === 'next-track');
  assert.equal(next[1].lyrics.trackId, 'next-track');
  assert.equal(next[1].analysis.trackId, 'next-track');
  assert.ok(!h.calls.includes('record-stop'));
  assert.equal(h.connections.size, 1);
  await h.controller.stop();
});

test('save behavior saves on seeking while continuous behavior is the default', async () => {
  const h = harness();
  await h.controller.start({ ...params, transitionBehavior: 'save' });
  assert.equal(h.controller.blocksCrossfade(), true);
  h.media.seeking = true; h.media.fire('seeking');
  assert.equal(h.recorder.state, 'paused');
  assert.equal((await h.controller.stop()).status, 'saved');
});

test('a coalesced encoder blob is split into ordered writes below the desktop chunk limit', async () => {
  const h = harness();
  await h.controller.start(params);
  h.recorder.ondataavailable({ data: new Blob([new Uint8Array(8 * 1024 * 1024 + 100)]) });
  await h.controller.stop();
  const writes = h.calls.filter(item => Array.isArray(item) && item[0] === 'append');
  assert.equal(writes.length, 3);
  assert.equal(writes[0][1], 0); assert.equal(writes[0][2], 8 * 1024 * 1024);
  assert.equal(writes[1][1], 1);
  assert.equal(writes[2][1], 2); assert.equal(writes[2][2], 'final-encoded-chunk');
});

test('disk failure cancels the temporary output and releases capture resources', async () => {
  const h = harness({ append: async () => { throw new Error('disk full'); } });
  await h.controller.start(params);
  assert.equal((await h.controller.stop()).status, 'error');
  assert.match(h.controller.getState().error, /disk full/);
  assert.equal(h.connections.size, 0);
  assert.ok(h.calls.some(item => Array.isArray(item) && item[0] === 'cancel'));
  assert.ok(!h.calls.some(item => Array.isArray(item) && item[0] === 'finish'));
});

test('cancel during the pending dialog cleans up a late successful desktop session', async () => {
  let completeDialog;
  const dialog = new Promise(resolve => { completeDialog = resolve; });
  const h = harness({ begin: () => dialog });
  const starting = h.controller.start(params);
  await h.controller.cancel();
  completeDialog({ id: 'late-job', fileName: 'late.webm' });
  await starting;
  assert.ok(h.calls.some(item => Array.isArray(item) && item[0] === 'cancel' && item[1] === 'late-job'));
  assert.ok(!h.calls.includes('pause-owner'));
  assert.equal(h.controller.isCapturing(), false);
});

test('a late video stream after cancellation is stopped without changing the next recording', async t => {
  let resolveCapture;
  const pending = new Promise(resolve => { resolveCapture = resolve; });
  const h = harness({ capture: () => pending });
  t.after(() => h.controller.cancel());
  const starting = h.controller.start(params);
  await new Promise(resolve => setImmediate(resolve));
  await h.controller.cancel();
  h.host.navigator.mediaDevices.getUserMedia = async () => h.makeStream();
  await h.controller.start(params);
  const stale = h.makeStream();
  resolveCapture(stale);
  await starting;
  assert.equal(stale.getVideoTracks()[0].readyState, 'ended');
  assert.equal(h.controller.getState().status, 'recording');
  assert.equal(h.controller.getState().error, '');
});

test('native capture is video only and uses the hidden owner-bound tab token', async () => {
  const h = harness();
  await h.controller.start(params);
  const constraints = h.calls.find(value => Array.isArray(value) && value[0] === 'capture')[1];
  assert.equal(constraints.audio, false);
  assert.equal(constraints.video.mandatory.chromeMediaSource, 'tab');
  assert.equal(constraints.video.mandatory.chromeMediaSourceId, 'owner-bound-source');
  assert.equal(constraints.video.mandatory.maxWidth, 1280);
  assert.equal(constraints.video.mandatory.maxHeight, 720);
  assert.equal(constraints.video.mandatory.maxFrameRate, 30);
  assert.equal(h.controller.getState().frameRate, 30);
  await h.controller.stop();
});

test('all four FPS choices reach native capture, hidden surface, host updates and encoder bitrate', async t => {
  for (const frameRate of [30, 60, 90, 120]) await t.test(String(frameRate), async t => {
    const h = harness();
    t.after(() => h.controller.cancel());
    const hd = frameRate >= 90;
    await h.controller.start({ ...params, frameRate, ...(hd ? { width: 1920, height: 1080 } : {}) });
    assert.equal(h.controller.getState().frameRate, frameRate);
    assert.equal(h.calls.find(value => Array.isArray(value) && value[0] === 'begin')[1].frameRate, frameRate);
    const capture = h.calls.find(value => Array.isArray(value) && value[0] === 'capture')[1];
    assert.equal(capture.video.mandatory.minFrameRate, 1);
    assert.equal(capture.video.mandatory.maxFrameRate, frameRate);
    assert.equal(h.recorder.settings.videoBitsPerSecond, (hd ? 14000000 : 8000000) * frameRate / 30);
    assert.equal(h.recorder.settings.audioBitsPerSecond, 320000);
    assert.ok(h.calls.some(value => Array.isArray(value) && value[0] === 'timer' && value[1] >= 0 && value[1] <= 1000 / frameRate));
    assert.equal(h.connections.size, 1);
    await h.controller.stop();
    assert.equal(h.controller.getState().frameRate, frameRate);
    assert.equal(h.media.paused, false);
  });
});

test('invalid FPS is rejected before opening a dialog or touching playback', async () => {
  const h = harness();
  for (const frameRate of [null, '60', 0, -1, 29.97, 75, 121, Infinity, NaN, {}, []]) {
    await assert.rejects(h.controller.start({ ...params, frameRate }), /Invalid video export frame rate/);
  }
  assert.equal(h.controller.getState().status, 'idle');
  assert.equal(h.media.currentTime, 12);
  assert.equal(h.media.paused, false);
  assert.deepEqual(h.calls, []);
});

test('a rejected capture leaves playback untouched and releases the prepared surface', async () => {
  const h = harness({ capture: async () => { throw new Error('capture failed'); } });
  const result = await h.controller.start(params);
  assert.equal(result.status, 'error');
  assert.equal(h.media.paused, false);
  assert.equal(h.media.currentTime, 12);
  assert.ok(!h.calls.includes('pause-owner'));
  assert.ok(h.calls.some(value => Array.isArray(value) && value[0] === 'cancel'));
});
