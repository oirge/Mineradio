/* SilenceSkipper (Beta): skips prolonged track head/tail digital silence using the existing host AnalyserNode. */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'mineradio-silence-skip-v1';
  var SILENCE_RMS = 0.005;
  var POLL_MS = 200;
  var MIN_HEAD_MS = 2500;
  var TAIL_WINDOW_MS = 3000;
  var TAIL_MARGIN_MS = 450;
  var TAIL_SILENCE_MS = 800;
  var MAX_PROTECT_SECONDS = 20;
  var PROBE_STEP_SECONDS = 1.5;
  var COOLDOWN_MS = 320;
  var MIN_TRACK_DURATION_SECONDS = 15;

  function computeNormalizedRms(byteSamples) {
    if (!byteSamples || !byteSamples.length) return 1;
    var sum = 0;
    for (var i = 0; i < byteSamples.length; i += 1) {
      var centered = (byteSamples[i] - 128) / 128;
      sum += centered * centered;
    }
    return Math.sqrt(sum / byteSamples.length);
  }

  function createSilenceSkipper(deps) {
    var cfg = deps || {};
    var enabled = !!cfg.enabled;
    var timer = null;
    var lastTrackKey = '';
    var headDone = false;
    var tailDone = false;
    var silentHeadMs = 0;
    var silentTailMs = 0;
    var cooldownUntil = 0;
    var sampleBuffer = null;

    function resetTrackState(trackKey) {
      lastTrackKey = trackKey || '';
      headDone = false;
      tailDone = false;
      silentHeadMs = 0;
      silentTailMs = 0;
      cooldownUntil = 0;
    }

    function readRms() {
      if (typeof cfg.getRms === 'function') return Number(cfg.getRms());
      var analyser = typeof cfg.getAnalyser === 'function' ? cfg.getAnalyser() : null;
      if (!analyser || typeof analyser.getByteTimeDomainData !== 'function') return null;
      var size = analyser.fftSize || analyser.frequencyBinCount * 2 || 2048;
      if (!sampleBuffer || sampleBuffer.length !== size) {
        sampleBuffer = new Uint8Array(size);
      }
      analyser.getByteTimeDomainData(sampleBuffer);
      return computeNormalizedRms(sampleBuffer);
    }

    function step(nowMs) {
      var now = typeof nowMs === 'number' ? nowMs : Date.now();
      if (!enabled) return false;
      var state = typeof cfg.getPlaybackState === 'function' ? cfg.getPlaybackState() : null;
      if (!state || state.paused || !state.ready) return false;
      var trackKey = String(state.trackKey || '');
      if (trackKey !== lastTrackKey) resetTrackState(trackKey);

      var pos = Number(state.currentTime);
      var dur = Number(state.duration);
      if (!Number.isFinite(pos) || pos < 0) return false;
      var rms = readRms();
      if (rms == null || !Number.isFinite(rms)) return false;
      var isSilent = rms < SILENCE_RMS;

      if (!headDone) {
        if (pos > MAX_PROTECT_SECONDS) {
          headDone = true;
        } else if (now >= cooldownUntil) {
          if (isSilent) {
            silentHeadMs += POLL_MS;
            if (silentHeadMs >= MIN_HEAD_MS) {
              var nextHead = Math.min(pos + PROBE_STEP_SECONDS, MAX_PROTECT_SECONDS);
              if (Number.isFinite(dur) && dur > 0) nextHead = Math.min(nextHead, Math.max(0, dur - 0.5));
              if (typeof cfg.seekTo === 'function') cfg.seekTo(nextHead);
              cooldownUntil = now + COOLDOWN_MS;
              if (nextHead >= MAX_PROTECT_SECONDS) headDone = true;
              return 'head-seek';
            }
          } else {
            headDone = true;
          }
        }
      }

      if (!tailDone && Number.isFinite(dur) && dur >= MIN_TRACK_DURATION_SECONDS) {
        var remainingMs = (dur - pos) * 1000;
        if (remainingMs <= TAIL_WINDOW_MS && remainingMs > TAIL_MARGIN_MS) {
          if (isSilent) {
            silentTailMs += POLL_MS;
            if (silentTailMs >= TAIL_SILENCE_MS) {
              tailDone = true;
              if (typeof cfg.seekTo === 'function') cfg.seekTo(Math.max(0, dur - 0.12));
              return 'tail-seek';
            }
          } else {
            silentTailMs = 0;
          }
        } else if (remainingMs > TAIL_WINDOW_MS) {
          tailDone = false;
          silentTailMs = 0;
        }
      }
      return false;
    }

    function start() {
      if (timer || typeof global.setInterval !== 'function') return;
      timer = global.setInterval(function () { step(Date.now()); }, POLL_MS);
    }

    function stop() {
      if (timer && typeof global.clearInterval === 'function') {
        global.clearInterval(timer);
      }
      timer = null;
    }

    function setEnabled(next) {
      enabled = !!next;
      resetTrackState(lastTrackKey);
      if (enabled) start();
      else stop();
    }

    return {
      step: step,
      setEnabled: setEnabled,
      isEnabled: function () { return enabled; },
      resetTrackState: resetTrackState,
      dispose: stop,
    };
  }

  var hostInstance = null;

  function readSavedPreference() {
    try {
      return global.localStorage && global.localStorage.getItem(STORAGE_KEY) === '1';
    } catch (_e) {
      return false;
    }
  }

  function savePreference(enabled) {
    try {
      if (typeof global.setPersistentLocalStorageItem === 'function') {
        global.setPersistentLocalStorageItem(STORAGE_KEY, enabled ? '1' : '0');
      } else if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
      }
    } catch (_e) {}
  }

  function translate(text) {
    return typeof global.uiText === 'function' ? global.uiText(text) : text;
  }

  function updateSilenceSkipControls() {
    if (!global.document) return;
    var enabled = hostInstance ? hostInstance.isEnabled() : readSavedPreference();
    var toggle = global.document.getElementById('t-silenceSkip');
    if (toggle) {
      toggle.classList.toggle('on', enabled);
      toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }
    var hint = global.document.getElementById('silence-skip-hint');
    if (hint) {
      hint.textContent = translate(enabled
        ? '已开启（Beta）：自动跳过前 20 秒内超过 2.5 秒的纯静音与末尾静音，不改变循环模式。'
        : '关闭中；开启后使用现有音频分析器实时跳过首尾无声片段。');
    }
  }

  function initSilenceSkipControls() {
    if (!hostInstance) {
      hostInstance = createSilenceSkipper({
        enabled: readSavedPreference(),
        getAnalyser: function () { return global.analyser || null; },
        getPlaybackState: function () {
          var audio = global.audio;
          if (!audio) return null;
          var song = typeof global.currentCoverSong === 'function' ? global.currentCoverSong() : null;
          var trackKey = song && typeof global.queueItemKey === 'function' ? global.queueItemKey(song) : String(audio.src || '');
          return {
            trackKey: trackKey,
            paused: !!audio.paused || !!audio.ended,
            ready: Number(audio.readyState) >= 2,
            currentTime: Number(audio.currentTime) || 0,
            duration: Number(audio.duration),
          };
        },
        seekTo: function (seconds) {
          var audio = global.audio;
          if (!audio || !Number.isFinite(seconds)) return;
          try { audio.currentTime = seconds; } catch (_e) {}
        },
      });
      if (hostInstance.isEnabled()) hostInstance.setEnabled(true);
    }
    updateSilenceSkipControls();
  }

  function toggleSilenceSkipSetting() {
    if (!hostInstance) initSilenceSkipControls();
    var next = !(hostInstance && hostInstance.isEnabled());
    if (hostInstance) hostInstance.setEnabled(next);
    savePreference(next);
    updateSilenceSkipControls();
    if (typeof global.showToast === 'function') {
      global.showToast(translate(next ? '已开启跳过首尾静音（Beta）' : '已关闭跳过首尾静音'));
    }
  }

  global.MineradioSilenceSkipper = Object.freeze({
    STORAGE_KEY: STORAGE_KEY,
    SILENCE_RMS: SILENCE_RMS,
    computeNormalizedRms: computeNormalizedRms,
    create: createSilenceSkipper,
  });
  global.initSilenceSkipControls = initSilenceSkipControls;
  global.updateSilenceSkipControls = updateSilenceSkipControls;
  global.toggleSilenceSkipSetting = toggleSilenceSkipSetting;
}(typeof window !== 'undefined' ? window : globalThis));
