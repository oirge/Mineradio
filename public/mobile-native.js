/* Android SAF keeps URI grants; songs stream from the selected document provider. */
(function () {
  'use strict';
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform()) return;
  var plugin = cap.registerPlugin('MineradioLibrary');
  var busy = false;
  var lastState = '';
  var playbackTimer = 0;
  var playbackController, lastNativeCompletions = 0;
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
  function captureNativeMedia(media) {
    var queue = playbackQueue();
    var uri = media ? String(media.src).split('/_capacitor_content_/').pop() : trackUri(playQueue[currentIdx]);
    var index = queue.tracks.findIndex(function (entry) { return entry.uri === uri; });
    if (index < 0) index = queue.indices[currentIdx];
    for (var i = 0; i < playQueue.length; i++) {
      var at = queue.indices[i];
      if (at >= 0) queue.tracks[at].replayGain = resolveReplayGain(playQueue[i].localReplayGain, replayGainSettings).linear;
    }
    var settings = nativeSettings();
    return Object.assign(settings, {queue: queue.tracks, index: index, uri: uri,
      position: media ? media._position : 0, duration: queue.tracks[index] && queue.tracks[index].duration || 0,
      initialGain: gainNode ? gainNode.gain.value : targetVolume,
      resumePlaying: true, transferAt: Date.now()});
  }
  function nativeSettings() {
    return {effects: Object.assign({}, resolveAudioChainState(audioChainSettings), {replayGain: replayGainActive.linear}),
      rate: playbackRateSetting,
      volume: targetVolume, playMode: playMode, gapless: gaplessSettings,
      sleepMode: sleepTimerState.mode, sleepDue: sleepTimerState.dueAt, stopAfterTrack: stopAfterCurrentTrack};
  }
  async function configureNative() {
    if (!playbackController || playbackController.synchronizing()) return;
    var state = playbackController.state();
    if (!state.nativeActive) return;
    var queue = captureNativeMedia(audio).queue;
    var settings = nativeSettings();
    var signature = JSON.stringify([queue, settings]);
    if (signature === lastState) return;
    lastState = signature;
    try {
      await plugin.cachePlaybackQueue({queue: queue});
      await plugin.configurePlayback(settings);
    } catch (error) { lastState = ''; throw error; }
    if (sleepTimerState.timer) { clearTimeout(sleepTimerState.timer); sleepTimerState.timer = null; }
    await playbackController.refresh();
  }
  async function syncNativeState(state) {
    if (!audioReady) initAudio();
    var nativeUri = state.uri;
    var restoredTrack = false;
    var completedTrack = Number(state.completions) > lastNativeCompletions;
    if (trackUri(currentLocalSong) !== nativeUri || !audio || !audio.src ||
        completedTrack && Number(state.index) !== currentIdx) {
      restoredTrack = true;
      var existing = new Map();
      [playQueue, localLibrarySongs].forEach(function (songs) { songs.forEach(function (song) { existing.set(trackUri(song), song); }); });
      var restored = state.queue.map(function (entry) { return existing.get(entry.uri); });
      if (restored.some(function (song) { return !song; })) throw new Error('NATIVE_RESTORE_TRACK_MISSING');
      if (currentLocalSong && Number(state.completions) > 0) finalizeListenSession(true);
      playQueue = restored; markQueueContentChanged();
      var changedTrack = trackUri(currentLocalSong) !== nativeUri;
      await playQueueAt(Math.max(0, Math.min(playQueue.length - 1, Number(state.index) || 0)), {resumeAt: state.position, startPaused: true});
      if (changedTrack && state.playing && currentLocalSong) beginListenSession(currentLocalSong, null);
    }
    playbackRateSetting = Number(state.rate) || 1;
    if (gainNode && Number.isFinite(state.masterLevel)) gainNode.gain.value = state.masterLevel;
    sleepTimerState.mode = state.sleepMode || 'off'; sleepTimerState.dueAt = Number(state.sleepDue) || 0;
    stopAfterCurrentTrack = !!state.stopAfterTrack;
    if (sleepTimerState.timer) { clearTimeout(sleepTimerState.timer); sleepTimerState.timer = null; }
    if (completedTrack && !restoredTrack && trackUri(currentLocalSong) === nativeUri && Number(state.index) === currentIdx && currentLocalSong) {
      finalizeListenSession(true);
      if (state.playing) beginListenSession(currentLocalSong, null);
    }
    lastNativeCompletions = Number(state.completions) || 0;
    updatePlaybackRateControls(); updateSleepTimerControls();
    playing = !!state.playing; setPlayIcon(playing);
  }
  playbackController = window.createMineradioNativeAudio({root: window, plugin: plugin,
    capture: captureNativeMedia, configure: configureNative, onState: syncNativeState,
    report: function (error) { console.warn('[AndroidAudio]', error); }});
  window.MineradioNativeAudio = playbackController;
  window.MineradioNativePlayback = playbackController;
  window.Audio = playbackController.Media;
  playShelfSelectTick = function (direction, variant) {
    var now = performance.now(), gap = variant === 'row' ? 36 : 42;
    if (now - lastShelfSelectSfxAt < gap) return;
    lastShelfSelectSfxAt = now;
    plugin.uiSound({direction: direction < 0 ? -1 : 1, row: variant === 'row', volume: targetVolume})
      .catch(function (error) { console.warn('[AndroidUiSound]', error); });
  };
  initAudio = function () {
    if (audioReady) return;
    audioCtx = playbackController.context;
    analyser = playbackController.analyser(false); beatAnalyser = playbackController.analyser(true);
    gainNode = playbackController.node(); gainNode.gain = playbackController.outputParam(targetVolume);
    replayGainNode = playbackController.node();
    ensureAudioDeckPool();
    audioChain = createAudioEffectChain(audioCtx);
    applyAudioChainToNodes(true); applyVolumeToAudio();
    audioReady = true;
  };
  // Native queue decoding handles these transitions even with the Activity destroyed.
  maybeStartGaplessPrefetch = function () {};
  maybeStartCrossfade = function () {};
  adoptGaplessDeckForSong = function () { return false; };
  [ 'commitAudioChainSettings', 'commitReplayGainSettings', 'commitGaplessSettings',
    'applyReplayGainForCurrentSong', 'applyPlaybackRateToDecks', 'applyVolumeToAudio',
    'updateSleepTimerControls', 'markQueueContentChanged' ].forEach(function (name) {
    var original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function () {
      var result = original.apply(this, arguments);
      if (!playbackController.synchronizing()) Promise.resolve().then(configureNative).catch(function (error) { console.warn('[AndroidSettings]', error); });
      return result;
    };
  });
  async function pollNative() {
    try { if (!document.hidden) { await playbackController.refresh(); await configureNative(); } }
    catch (error) { console.warn('[AndroidState]', error); }
    playbackTimer = setTimeout(pollNative, document.hidden ? 1000 : 50);
  }
  // Visibility affects UI polling only; no pause, load, seek or decoder ownership changes.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) playbackController.refresh().catch(function (error) { console.warn('[AndroidState]', error); });
  });
  plugin.addListener('appState', function (event) {
    if (event.active) playbackController.refresh().catch(function (error) { console.warn('[AndroidState]', error); });
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
  playbackController.ready = plugin.list().then(function (result) { return loadLibrary(result, false); }).then(function () { return playbackController.refresh(); }).catch(function (error) { console.warn('[AndroidInit]', error); }).finally(function () { pollNative(); });
})();
