'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../public/video-export.js'), 'utf8');

function harness(options = {}) {
  const calls = [], status = [], listeners = new Map(), connections = new Set();
  let frameListener, failureListener, controller, recorder;
  const media = {
    src: 'blob:original-song', currentTime: 12, duration: 60, paused: false, ended: false, readyState: 4,
    pause() { calls.push('pause-owner'); this.paused = true; this.fire('pause'); },
    play() { calls.push('play-owner'); this.paused = false; this.fire('playing'); return Promise.resolve(); },
    addEventListener(name, cb) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(cb); },
    removeEventListener(name, cb) { listeners.get(name)?.delete(cb); },
    fire(name) { for (const callback of listeners.get(name) || []) callback(); },
  };
  class Stream {
    constructor() { this.tracks = [{ kind: 'video', requestFrame() {}, stop() { calls.push('stop-video'); } }]; }
    getTracks() { return this.tracks; }
    getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
    addTrack(track) { this.tracks.push(track); }
  }
  const output = { connect(node) { connections.add(node); }, disconnect(node) { assert.ok(node, 'never disconnect the speaker chain'); connections.delete(node); calls.push('disconnect-tap'); } };
  class Recorder {
    static isTypeSupported(type) { return type === 'video/webm;codecs=vp8,opus'; }
    constructor(stream) { this.stream = stream; this.state = 'inactive'; recorder = this; }
    start() { this.state = 'recording'; calls.push('record-start'); }
    pause() { this.state = 'paused'; calls.push('record-pause'); }
    resume() { this.state = 'recording'; calls.push('record-resume'); }
    stop() {
      assert.notEqual(this.state, 'inactive'); this.state = 'inactive'; calls.push('record-stop');
      queueMicrotask(() => { this.ondataavailable({ data: new Blob(['final-encoded-chunk']) }); this.onstop(); });
    }
  }
  const bridge = {
    async beginVideoExport(payload) { calls.push(['begin', payload]); return options.begin ? options.begin(payload) : { id: 'job', fileName: 'song.webm' }; },
    onVideoExportFrame(callback) { frameListener = callback; return () => { frameListener = null; }; },
    onVideoExportFailure(callback) { failureListener = callback; return () => { failureListener = null; }; },
    ackVideoExportFrame(id) { calls.push(['ack', id]); },
    updateVideoExport(payload) { calls.push(['update', payload]); frameListener?.({ id: 'job', bytes: new Uint8Array([1, 2]), width: 1280, height: 720 }); },
    async appendVideoExportChunk(payload) { calls.push(['append', payload.sequence, payload.bytes.byteLength > 100 ? payload.bytes.byteLength : Buffer.from(payload.bytes).toString()]); if (options.append) await options.append(payload); },
    async finishVideoExport(payload) { calls.push(['finish', payload.id]); return { fileName: 'song.webm' }; },
    async cancelVideoExport(payload) { calls.push(['cancel', payload.id]); },
  };
  const host = {
    desktopWindow: bridge, MediaRecorder: Recorder, MediaStream: Stream, Blob, createImageBitmap: async () => ({ close() { calls.push('close-bitmap'); } }),
    document: { createElement(tag) { assert.equal(tag, 'canvas'); return { width: 0, height: 0, getContext: () => ({ drawImage() {} }), captureStream: () => new Stream(), remove() {} }; } },
    audio: media, audioChain: { output },
    audioCtx: { sampleRate: 48000, createMediaStreamDestination() { return { stream: { getAudioTracks: () => [{ kind: 'audio', stop() { calls.push('stop-tap'); } }] } }; } },
    initAudio() { calls.push('init-existing-audio'); }, resumeAudioAnalysis: async () => {},
    setTimeout, clearTimeout, addEventListener() {},
  };
  vm.runInNewContext(source, { window: host, Blob, Uint8Array, console, Date, Promise });
  controller = host.MineradioVideoExport.create(host, {
    getState: () => ({ currentTrack: { id: host.trackId || 'track', title: 'Original song' }, position: host.audio.currentTime, duration: host.audio.duration, playing: !host.audio.paused, volume: 0 }),
    getLyrics: () => ({ trackId: host.trackId || 'track', lines: [] }), getAnalysis: () => ({ trackId: host.trackId || 'track', revision: 1 }),
    emit: (name, value) => status.push({ name, ...value }),
  });
  return { controller, host, media, calls, status, connections, get recorder() { return recorder; }, fail: error => failureListener({ id: 'job', error }) };
}
const params = { width: 1280, height: 720, startMode: 'current', visuals: { mode: 'classic' } };

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
  const writeGate = new Promise(resolve => { allowWrite = resolve; });
  const h = harness({ append: () => writeGate });
  const owner = h.host.audio;
  await h.controller.start(params);
  assert.equal(h.controller.getState().status, 'recording');
  assert.equal(h.connections.size, 1);
  const saving = h.controller.stop();
  assert.equal(h.recorder.state, 'inactive', 'stop is synchronous before a new track can sound');
  assert.equal(h.connections.size, 0);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.calls.find(item => Array.isArray(item) && item[0] === 'append'), ['append', 0, 'final-encoded-chunk']);
  assert.ok(!h.calls.some(item => Array.isArray(item) && item[0] === 'finish'));
  allowWrite();
  assert.equal((await saving).status, 'saved');
  assert.equal(h.host.audio, owner);
  assert.equal(owner.paused, false);
  assert.equal(h.calls.at(-1), 'stop-tap');
});

test('save behavior follows pause/resume and stops synchronously before track handoff', async () => {
  const h = harness();
  await h.controller.start({ ...params, transitionBehavior: 'save' });
  h.media.pause();
  assert.equal(h.recorder.state, 'paused');
  assert.equal(h.controller.getState().status, 'paused');
  await h.media.play();
  assert.equal(h.recorder.state, 'recording');
  h.controller.beforeTrackChange();
  assert.equal(h.recorder.state, 'inactive');
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
  assert.equal(h.recorder.state, 'inactive');
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

test('a late bitmap failure from a saved job cannot overwrite the next recording', async t => {
  const h = harness();
  t.after(() => h.controller.cancel());
  await h.controller.start(params);
  const createBitmap = h.host.createImageBitmap;
  let rejectBitmap, markDecoding;
  const decoding = new Promise(resolve => { markDecoding = resolve; });
  h.host.createImageBitmap = () => {
    markDecoding();
    return new Promise((_resolve, reject) => { rejectBitmap = reject; });
  };
  await decoding;
  assert.equal((await h.controller.stop()).status, 'saved');
  h.host.createImageBitmap = createBitmap;
  await h.controller.start(params);
  const before = h.controller.getState();
  rejectBitmap(new Error('old bitmap decode failed'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.controller.getState().status, 'recording');
  assert.equal(h.controller.getState().fileName, before.fileName);
  assert.equal(h.controller.getState().error, '');
  assert.equal(h.controller.isCapturing(), true);
});
