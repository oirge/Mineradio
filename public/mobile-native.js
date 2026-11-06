/* Android SAF keeps URI grants; songs stream from the selected document provider. */
(function () {
  'use strict';
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform()) return;
  var plugin = cap.registerPlugin('MineradioLibrary');
  var busy = false;
  var lastState = '';
  var playbackTimer = 0;
  var playbackController;
  var nativeQueueRevision = 0, cachedQueueRevision = -1, sentQueueRevision = -1, cachedQueueSource = null, cachedQueue = null;
  var originalQueueChanged = markQueueContentChanged;
  markQueueContentChanged = function () {
    nativeQueueRevision++; cachedQueueSource = null; cachedQueue = null;
    return originalQueueChanged.apply(this, arguments);
  };

  var NATIVE_READER_VERSION = 1;
  var NATIVE_READ_CHUNK_BYTES = 1024 * 1024;
  var NATIVE_READ_MAX_BYTES = 64 * 1024 * 1024;

  // Keep each bridge message small while honoring the parser's complete byte range.
  async function readNativeFileRange(uri, start, end) {
    start = Math.max(0, Math.floor(Number(start) || 0));
    end = Math.max(0, Math.floor(Number(end) || 0));
    if (end && end <= start) return { ok: true, base64Chunks: [], byteLength: 0 };
    if (end && end - start > NATIVE_READ_MAX_BYTES) throw new Error('NATIVE_FILE_RANGE_TOO_LARGE');
    var chunks = [];
    var length = 0;
    while (!end || start + length < end) {
      var remaining = NATIVE_READ_MAX_BYTES - length;
      var amount = Math.min(NATIVE_READ_CHUNK_BYTES, end ? end - start - length : remaining || 1);
      var offset = start + length;
      var result = await plugin.readRange({ uri: uri, start: offset, end: offset + amount });
      if (!result || !result.ok) throw new Error('NATIVE_FILE_RANGE_FAILED');
      var size = Number(result.byteLength);
      if (!Number.isInteger(size) || size < 0 || size > amount || !Array.isArray(result.base64Chunks)) {
        throw new Error('NATIVE_FILE_RANGE_INVALID');
      }
      if (length + size > NATIVE_READ_MAX_BYTES) throw new Error('NATIVE_FILE_RANGE_TOO_LARGE');
      for (var i = 0; i < result.base64Chunks.length; i++) chunks.push(result.base64Chunks[i]);
      length += size;
      if (size < amount) break;
    }
    return { ok: true, base64Chunks: chunks, byteLength: length };
  }

  window.MineradioNativeLibraryApi = {
    readerVersion: NATIVE_READER_VERSION,
    readLocalFileRange: function (uri, start, end) {
      return readNativeFileRange(uri, start, end);
    }
  };

  async function loadLibrary(result, autoPlay) {
    var files = (result.files || []).map(function (entry) {
      return Object.assign({}, entry, { url: cap.convertFileSrc(entry.fullPath), nativeReaderVersion: NATIVE_READER_VERSION });
    });
    if (files.length) {
      await handleLocalFolderFiles(files, { autoPlay: !!autoPlay, restored: !autoPlay });
    }
    return files.length;
  }

  async function importMusic(folder) {
    if (busy) return;
    busy = true;
    try {
      var result = await (folder ? plugin.pickFolder() : plugin.pickFiles());
      if (!result.canceled) {
        if (playbackController) await playbackController.setBackground(false);
        await loadLibrary(result, true);
        if (window.MineradioMobile) window.MineradioMobile.openView('player');
      }
    } catch (error) {
      console.warn('[AndroidImport]', error);
      showToast('音乐导入失败，请重新选择有访问权限的文件');
    } finally { busy = false; }
  }
  window.MineradioNativeImport = importMusic;
  document.getElementById('file-input').addEventListener('click', function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    importMusic(false);
  }, true);
  document.getElementById('local-folder-input').addEventListener('click', function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    importMusic(true);
  }, true);

  function trackUri(song) {
    return song && (song.localFile && song.localFile.fullPath || song.localFilePathAbsolute) || '';
  }
  function playbackQueue() {
    if (cachedQueue && cachedQueueSource === playQueue && cachedQueueRevision === nativeQueueRevision) return cachedQueue;
    var tracks = [], indices = [];
    for (var i = 0; i < playQueue.length; i++) {
      var song = playQueue[i], uri = trackUri(song);
      indices[i] = -1;
      if (uri.indexOf('content://') !== 0) continue;
      indices[i] = tracks.length;
      tracks.push({ uri: uri, id: song.localKey || '', title: song.name || song.title || '', artist: song.artist || '', duration: Number(song.duration) || 0 });
    }
    cachedQueueSource = playQueue; cachedQueueRevision = nativeQueueRevision;
    cachedQueue = { tracks: tracks, indices: indices };
    return cachedQueue;
  }
  function capturePlayback() {
    var song = typeof playQueue !== 'undefined' && currentIdx >= 0 ? playQueue[currentIdx] : null;
    if (!song || !audio) return null;
    var queue = playbackQueue(), index = queue.indices[currentIdx];
    if (index == null || index < 0) return null;
    queue.tracks[index].title = song.name || song.title || '';
    queue.tracks[index].artist = song.artist || '';
    return {
      playing: !!(song && audio && !audio.paused && !(typeof sleepTimerState !== 'undefined' && sleepTimerState.fading)),
      title: song && (song.name || song.title) || 'Mineradio',
      artist: song && song.artist || '',
      position: audio && isFinite(audio.currentTime) ? audio.currentTime : 0,
      duration: audio && isFinite(audio.duration) ? audio.duration : 0,
      uri: trackUri(song), index: index, rate: Number(audio.playbackRate) || 1,
      volume: typeof targetVolume === 'number' ? targetVolume : 1,
      playMode: typeof playMode === 'string' ? playMode : 'loop',
      stopAfterTrack: typeof stopAfterCurrentTrack !== 'undefined' && stopAfterCurrentTrack,
      sleepMode: typeof sleepTimerState !== 'undefined' ? sleepTimerState.mode : 'off',
      sleepDue: typeof sleepTimerState !== 'undefined' ? sleepTimerState.dueAt : 0
    };
  }
  function syncPlayback() {
    if (playbackController && playbackController.ownsAudio()) return;
    var state = capturePlayback();
    if (!state) return;
    if (sentQueueRevision !== nativeQueueRevision) {
      sentQueueRevision = nativeQueueRevision;
      plugin.cachePlaybackQueue({ queue: playbackQueue().tracks }).catch(function (error) {
        sentQueueRevision = -1; console.warn('[AndroidQueue]', error);
      });
    }
    var signature = JSON.stringify([state.playing, state.uri, state.title, state.artist, Math.floor(state.position / 5), state.rate, state.volume, state.playMode, state.sleepMode, state.sleepDue, state.stopAfterTrack]);
    if (signature !== lastState) {
      lastState = signature;
      plugin.updatePlayback(state).catch(function (error) { console.warn('[AndroidPlayback]', error); });
    }
  }
  function schedulePlayback() {
    if (playbackTimer) clearTimeout(playbackTimer);
    syncPlayback();
    playbackTimer = setTimeout(schedulePlayback, 5000);
  }
  function bindAudio() {
    if (typeof audioCtx !== 'undefined' && audioCtx && !audioCtx._mineradioNativeResume) {
      var context = audioCtx, resume = context.resume.bind(context);
      context._mineradioNativeResume = resume;
      context.resume = function () {
        return playbackController && playbackController.ownsAudio() ? Promise.resolve() : resume();
      };
    }
    (typeof audioDeckList !== 'undefined' ? audioDeckList : []).forEach(function (deck) {
      var element = deck.el;
      if (!element || element._mineradioNativeBound) return;
      element._mineradioNativeBound = true;
      ['play', 'pause', 'ended', 'loadedmetadata', 'seeked'].forEach(function (name) {
        element.addEventListener(name, function () {
          syncPlayback();
          if (name === 'play' && document.hidden && playbackController) playbackController.setBackground(true).catch(function (error) { console.warn('[AndroidBackground]', error); });
        });
      });
    });
  }
  var originalInitAudio = initAudio;
  initAudio = function () {
    var result = originalInitAudio.apply(this, arguments);
    bindAudio();
    return result;
  };
  bindAudio();
  async function pauseWebForNative() {
    trackSwitchToken++;
    pauseCurrentAudioForTrackSwitch();
    if (typeof clearSleepTimerCountdown === 'function') clearSleepTimerCountdown();
    (typeof audioDeckList !== 'undefined' ? audioDeckList : []).forEach(function (deck) { if (deck.el) deck.el.pause(); });
    if (typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state !== 'closed') await audioCtx.suspend();
  }
  async function restoreWebFromNative(state) {
    if (!state || !state.queue || !state.queue.length) return;
    var existing = new Map();
    [playQueue, localLibrarySongs].forEach(function (songs) {
      for (var i = 0; i < songs.length; i++) { var uri = trackUri(songs[i]); if (uri && !existing.has(uri)) existing.set(uri, songs[i]); }
    });
    var restored = state.queue.map(function (entry) { return existing.get(entry.uri); });
    if (restored.some(function (song) { return !song; })) throw new Error('NATIVE_RESTORE_TRACK_MISSING');
    var same = playQueue.length === restored.length;
    for (var j = 0; same && j < restored.length; j++) same = trackUri(playQueue[j]) === trackUri(restored[j]);
    if (!same) { playQueue = restored; markQueueContentChanged(); }
    if (typeof stopAfterCurrentTrack !== 'undefined') stopAfterCurrentTrack = !!state.stopAfterTrack;
    var expired = Number(state.sleepDue) > 0 && Number(state.sleepDue) <= Date.now();
    if (typeof sleepTimerState !== 'undefined') {
      if (sleepTimerState.timer) clearTimeout(sleepTimerState.timer);
      sleepTimerState.timer = null; sleepTimerState.fading = false;
      sleepTimerState.mode = expired ? 'off' : state.sleepMode || 'off'; sleepTimerState.dueAt = expired ? 0 : Number(state.sleepDue) || 0;
      if (sleepTimerState.dueAt > Date.now()) sleepTimerState.timer = setTimeout(fireSleepTimer, sleepTimerState.dueAt - Date.now());
      setPersistentLocalStorageItem(SLEEP_TIMER_STORE_KEY, JSON.stringify({ mode: sleepTimerState.mode }));
      updateSleepTimerControls();
    }
    var wanted = !expired && (state.resumePlaying == null ? !!state.playing : !!state.resumePlaying);
    await playQueueAt(Math.max(0, Math.min(playQueue.length - 1, Number(state.index) || 0)), {
      resumeAt: Math.max(0, Number(state.position) || 0), startPaused: !wanted
    });
    lastState = ''; syncPlayback();
  }
  playbackController = window.createMineradioNativePlayback({
    capture: function () {
      var state = capturePlayback();
      return state && Object.assign({}, state, { queue: playbackQueue().tracks, transferAt: Date.now(), resumePlaying: state.playing });
    },
    pauseWeb: pauseWebForNative, restoreWeb: restoreWebFromNative,
    startNative: function (state) { return plugin.startBackground(state); },
    getNative: function () { return plugin.getPlaybackState(); },
    takeNative: function () { return plugin.takeForeground(); },
    report: function (error) { console.warn('[AndroidBackground]', error); }
  });
  window.MineradioNativePlayback = playbackController;
  document.addEventListener('visibilitychange', function () { playbackController.setBackground(document.hidden).catch(function (error) { console.warn('[AndroidBackground]', error); }); });
  plugin.addListener('appState', function (event) { playbackController.setBackground(!event.active).catch(function (error) { console.warn('[AndroidBackground]', error); }); });
  plugin.addListener('mediaControl', function (event) {
    if (event.action === 'next') nextTrack();
    else if (event.action === 'previous') prevTrack();
    else if (event.action === 'pause' && audio && !audio.paused) togglePlay();
    else if (event.action === 'play' && audio && audio.paused) togglePlay();
    else if (event.action === 'toggle') togglePlay();
    else if (event.action === 'seek' && audio) audio.currentTime = event.position;
  });
  plugin.addListener('back', function () {
    if (document.body.classList.contains('folia-interface-active')) {
      var folia = document.getElementById('folia-frame');
      try { if (folia && folia.contentWindow.MineradioFoliaMobileBack && folia.contentWindow.MineradioFoliaMobileBack()) return; } catch (_) {}
      plugin.minimize();
      return;
    }
    var modal = document.querySelector('.modal-mask.show');
    if (modal) {
      var close = modal.querySelector('.modal-close, .close-btn, button[onclick*="close"]');
      if (close) close.click();
      return;
    }
    var mobile = window.MineradioMobile;
    if (mobile && document.body.dataset.mobileView !== 'player') mobile.openView('player');
    else plugin.minimize();
  });
  plugin.list().then(function (result) { return loadLibrary(result, false); }).catch(function (error) {
    console.warn('[AndroidLibraryRestore]', error);
  }).finally(function () { return playbackController.initialize(); });
  schedulePlayback();
})();
