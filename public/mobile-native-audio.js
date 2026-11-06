/* A media facade over the one Android service engine. No sound is created in the Activity. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createMineradioNativeAudio = factory;
})(typeof window === 'undefined' ? globalThis : window, function (dependencies) {
  'use strict';
  var root = dependencies.root, plugin = dependencies.plugin;
  var state = {nativeActive: false}, syncing = false, pending = 0, chain = Promise.resolve();
  var mediaList = [], origin = Date.now(), revision = 0, refreshId = 0, appliedRefresh = 0;
  function report(error) { dependencies.report(error); }
  function enqueue(operation) {
    pending++; revision++;
    var next = chain.catch(report).then(operation);
    chain = next.then(function () { pending--; }, function (error) { pending--; report(error); });
    return next;
  }
  function uriOf(url) {
    var marker = '/_capacitor_content_/';
    var value = String(url), at = value.indexOf(marker);
    if (at < 0) return value;
    // Android convertFileSrc replaces the content scheme; preserve encoded document IDs.
    var uri = value.slice(at + marker.length);
    return uri.indexOf('content://') === 0 ? uri : 'content://' + uri;
  }
  function emit(media, name) {
    media.dispatchEvent(new root.Event(name));
    if (typeof media['on' + name] === 'function') media['on' + name].call(media, new root.Event(name));
  }
  function NativeMedia() {
    this._mineradioNative = true; this._src = ''; this._position = 0; this._paused = true;
    this._duration = 0; this._rate = 1; this._volume = 1; this._at = Date.now();
    this._loadVersion = 0; this._playVersion = 0; this._events = new root.EventTarget(); this.error = null; this.ended = false;
    this.readyState = 0; this.networkState = 0; this.seeking = false; this.muted = false;
    mediaList.push(this);
  }
  NativeMedia.prototype.addEventListener = function () { return this._events.addEventListener.apply(this._events, arguments); };
  NativeMedia.prototype.removeEventListener = function () { return this._events.removeEventListener.apply(this._events, arguments); };
  NativeMedia.prototype.dispatchEvent = function (event) { return this._events.dispatchEvent(event); };
  Object.defineProperties(NativeMedia.prototype, {
    src: {get: function () { return this._src; }, set: function (value) { revision++; this._loadVersion++; this._reload = !syncing; this._src = String(value); this._position = 0; this._paused = true; this.ended = false; this.readyState = 0; }},
    currentSrc: {get: function () { return this._src; }},
    paused: {get: function () { return this._paused; }},
    duration: {get: function () { return this._duration; }},
    currentTime: {get: function () { return Math.min(this._duration || Infinity, this._position + (this._paused ? 0 : (Date.now() - this._at) / 1000 * this._rate)); },
      set: function (value) {
        this._position = Math.max(0, Number(value) || 0); this._at = Date.now();
        if (!syncing && state.nativeActive && state.uri === uriOf(this._src) && root.audio === this) {
          var media = this, position = this._position;
          this.seeking = true;
          enqueue(function () { return plugin.commandPlayback({action: 'seek', position: position}); })
            .then(function () { media.seeking = false; emit(media, 'seeked'); }, function (error) { media.seeking = false; report(error); });
        }
      }},
    playbackRate: {get: function () { return this._rate; }, set: function (value) {
      this._rate = Math.max(.5, Math.min(2, Number(value) || 1));
      if (!syncing && root.audio === this) enqueue(function () { return dependencies.configure(); }).catch(report);
    }},
    volume: {get: function () { return this._volume; }, set: function (value) { this._volume = Number(value); }}
  });
  NativeMedia.prototype.load = function () {
    var media = this;
    var selected = dependencies.capture(media);
    media._duration = state.nativeActive && state.uri === uriOf(media.src) ? Number(state.duration) || 0 : Number(selected.duration) || 0;
    media.readyState = 3; media.networkState = 1;
    Promise.resolve().then(function () { emit(media, 'loadedmetadata'); emit(media, 'canplay'); });
  };
  NativeMedia.prototype.removeAttribute = function (name) { if (name === 'src') this.src = ''; };
  NativeMedia.prototype.canPlayType = function () { return 'maybe'; };
  NativeMedia.prototype.pause = function () {
    this._playVersion++; this._position = this.currentTime; this._paused = true; this._at = Date.now();
    if (!syncing && root.audio === this && state.nativeActive) enqueue(function () { return plugin.commandPlayback({action: 'pause'}); }).catch(report);
    if (!syncing) emit(this, 'pause');
  };
  NativeMedia.prototype.play = function () {
    var media = this;
    return enqueue(async function () {
      var requested = dependencies.capture(media), loadVersion = media._loadVersion, playVersion = media._playVersion;
      requested.uri = uriOf(requested.uri);
      if (state.nativeActive && state.uri === requested.uri && !media._reload) {
        var command = {action: 'play'};
        if (requested.initialGain != null) command.initialGain = requested.initialGain;
        await plugin.commandPlayback(command);
      }
      else await plugin.startBackground(requested);
      var deadline = Date.now() + 25000;
      do {
        if (loadVersion !== media._loadVersion || playVersion !== media._playVersion) throw new Error('NATIVE_PLAY_CANCELLED');
        var next = await plugin.getPlaybackState();
        if (next.error) throw new Error(next.error);
        if (next.nativeActive && next.uri === requested.uri && next.playing) {
          state = next; applyMedia(media, next, true); emit(media, 'play'); emit(media, 'playing'); return;
        }
        await new Promise(function (resolve) { root.setTimeout(resolve, 25); });
      } while (Date.now() < deadline);
      throw new Error('NATIVE_AUDIO_START_TIMEOUT');
    });
  };
  function applyMedia(media, value, starting) {
    if (uriOf(media.src) !== value.uri) return;
    var wasPaused = media._paused, oldDuration = media._duration;
    media._position = Number(value.position) || 0; media._duration = Number(value.duration) || 0;
    media._rate = Number(value.rate) || 1; media._at = Number(value.snapshotAt) || Date.now();
    media._reload = false; media._paused = !value.playing; media.readyState = value.preparing ? 1 : 4;
    if (media._duration !== oldDuration && media._duration > 0) emit(media, 'loadedmetadata');
    if (!starting && wasPaused !== media._paused) emit(media, media._paused ? 'pause' : 'playing');
    if (value.error && media._lastError !== value.error) {
      media._lastError = value.error; media.error = {code: 3, message: value.error}; emit(media, 'error');
    } else if (!value.error) { media._lastError = ''; media.error = null; }
    emit(media, 'timeupdate');
  }
  async function refresh() {
    if (pending || syncing) return state;
    var capturedRevision = revision, sequence = ++refreshId;
    var next = await plugin.getPlaybackState();
    if (!next.nativeActive || pending || syncing || revision !== capturedRevision || sequence < appliedRefresh) return state;
    appliedRefresh = sequence;
    state = next;
    syncing = true;
    try { await dependencies.onState(next); for (var i = 0; i < mediaList.length; i++) applyMedia(mediaList[i], next); }
    finally { syncing = false; }
    return state;
  }
  function Param(value, output) { this._value = value; this._start = value; this._target = value; this._when = Date.now(); this._duration = 0; this.output = output; }
  Object.defineProperty(Param.prototype, 'value', {get: function () {
    var t = this._duration ? Math.max(0, Math.min(1, (Date.now() - this._when) / this._duration)) : 1;
    return this._start + (this._target - this._start) * t;
  }, set: function (value) { this._value = this._start = this._target = Number(value); this._duration = 0; }});
  Param.prototype.cancelScheduledValues = function () { this.setValueAtTime(this.value); };
  Param.prototype.cancelAndHoldAtTime = function () { this.setValueAtTime(this.value); };
  Param.prototype.setValueAtTime = function (value) {
    this.value = value;
    if (this.output && !syncing) enqueue(function () { return plugin.masterGain({target: value, durationMs: 0}); }).catch(report);
  };
  Param.prototype.linearRampToValueAtTime = function (value, time) {
    var duration = Math.max(0, (time - (Date.now() - origin) / 1000) * 1000);
    this._start = this.value; this._target = Number(value); this._when = Date.now(); this._duration = duration;
    if (this.output && !syncing) enqueue(function () { return plugin.masterGain({target: value, durationMs: Math.round(duration)}); }).catch(report);
  };
  Param.prototype.setTargetAtTime = function (value, time, constant) { this.linearRampToValueAtTime(value, time + constant * 3); };
  Param.prototype.setValueCurveAtTime = function (values, time, duration) { this.linearRampToValueAtTime(values[values.length - 1], time + duration); };
  function node() { return {connect: function (next) { return next; }, disconnect: function () {}, gain: new Param(1), frequency: new Param(0), Q: new Param(1), threshold: new Param(0), ratio: new Param(1), knee: new Param(0), attack: new Param(.003), release: new Param(.25)}; }
  function analyser(beat) {
    var result = node(); result.fftSize = 2048; result.frequencyBinCount = 1024;
    result.getByteFrequencyData = function (target) { target.fill(0); var data = state.analysis && state.analysis[beat ? 'beatFrequency' : 'frequency']; if (data) for (var i = 0; i < Math.min(data.length, target.length); i++) target[i] = data[i]; };
    result.getByteTimeDomainData = function (target) { target.fill(128); var data = state.analysis && state.analysis.timeDomain; if (data) for (var i = 0; i < Math.min(data.length, target.length); i++) target[i] = data[i]; };
    return result;
  }
  var context = {sampleRate: 48000, destination: node(), createGain: node, createBiquadFilter: node, createDynamicsCompressor: node,
    createChannelSplitter: node, createChannelMerger: node, createMediaElementSource: node,
    resume: function () { return Promise.resolve(); }, suspend: function () { return Promise.resolve(); }};
  Object.defineProperties(context, {currentTime: {get: function () { return (Date.now() - origin) / 1000; }}, state: {get: function () { return state.playing ? 'running' : 'suspended'; }}});
  return {Media: NativeMedia, context: context, analyser: analyser, node: node, outputParam: function (value) { return new Param(value, true); },
    uriOf: uriOf, configure: function () { return enqueue(function () { return dependencies.configure(); }); },
    refresh: refresh, state: function () { return state; }, synchronizing: function () { return syncing; }, busy: function () { return !!pending; },
    synchronize: async function (operation) { syncing = true; try { return await operation(); } finally { syncing = false; } },
    mode: 'single-native', phase: function () { return 'native'; }, ownsAudio: function () { return false; }, setBackground: function () { return refresh(); },
    events: function () { return []; }, initialize: function () { return refresh(); }, get revision() { return revision; }};
});
