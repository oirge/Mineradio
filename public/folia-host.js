/* The isolated Folia local-player component shares Mineradio's library and audio output. */
(function (global) {
  'use strict';
  var CHANNEL = 'mineradio-folia', VERSION = 1;
  var MODE_KEY = 'mineradio-player-interface-v1';
  var active = false, frame = null, ready = false, loadFailed = false;
  var tickTimer = 0, audioTimer = 0, loadTimer = 0;
  var libraryRevision = 1, queueRevision = 1, lyricsRevision = 1, favoritesRevision = 1;
  var sentLibraryRevision = 0, sentQueueRevision = 0, lastLibraryAt = 0, lastLyricsAt = 0;
  var lastLyricsSignature = '', lastLibrarySource = null, lastLibraryLength = -1;
  var lastQueueSource = null, lastQueueLength = -1;
  var pausedVideos = new Set(), oldInert = new Map(), inFlight = new Set();
  var audioFrequency = null;
  var coverTransfers = new Map(), coverTransferBytes = 0;
  var playlistMembership = new Map();
  var trackPageIndexes = new WeakMap();

  function number(value, fallback) { var result = Number(value); return Number.isFinite(result) ? result : fallback; }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function fail(code, message) { var error = new Error(message); error.code = code; throw error; }
  function call(name) {
    var fn = global[name];
    if (typeof fn !== 'function') fail('HOST_NOT_READY', '播放器尚未准备好');
    return fn.apply(global, Array.prototype.slice.call(arguments, 1));
  }
  function trackId(song) { return song ? String(call('specialLikedSongKey', song)) : ''; }
  function currentSong() { return (global.playQueue || [])[global.currentIdx] || global.currentLocalSong || null; }
  function librarySongs() {
    return Array.isArray(global.localLibrarySongs) && global.localLibrarySongs.length
      ? global.localLibrarySongs : (Array.isArray(global.playQueue) ? global.playQueue : []);
  }
  function coverTransferUrl(source, key) {
    if (source.indexOf('data:image/') !== 0 || typeof global.Blob !== 'function' || !global.URL.createObjectURL) return source;
    var cached = coverTransfers.get(key);
    if (cached && cached.source === source) { cached.usedAt = Date.now(); return cached.url; }
    if (cached) {
      global.URL.revokeObjectURL(cached.url); coverTransferBytes -= cached.bytes; coverTransfers.delete(key);
    }
    var comma = source.indexOf(',');
    if (comma < 0 || source.slice(0, comma).indexOf(';base64') < 0) return source;
    try {
      var raw = global.atob(source.slice(comma + 1));
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      var url = global.URL.createObjectURL(new global.Blob([bytes], { type: source.slice(5, source.indexOf(';')) }));
      coverTransfers.set(key, { source: source, url: url, bytes: bytes.byteLength, usedAt: Date.now() });
      coverTransferBytes += bytes.byteLength;
      var keep = 'current:' + trackId(currentSong());
      coverTransfers.forEach(function (entry, entryKey) {
        if ((coverTransfers.size > 96 || coverTransferBytes > 16 * 1024 * 1024) && entryKey !== key && entryKey !== keep) {
          global.URL.revokeObjectURL(entry.url); coverTransferBytes -= entry.bytes; coverTransfers.delete(entryKey);
        }
      });
      return url;
    } catch (_error) { return source; }
  }
  function projectTrack(song, current) {
    if (!song) return null;
    var path = String(song.localFilePathAbsolute || song.localPath || '');
    var cover = String(call('songCoverSrc', song, current ? 400 : 96) || '');
    if (!current && song.localCoverThumbDataUrl && !song.customCover) cover = song.localCoverThumbDataUrl;
    // A current cover travels with 5 state messages per second. Catalog covers are sent
    // only with their requested page; keep their original thumbnail URL leases intact.
    if (current) cover = coverTransferUrl(cover, 'current:' + trackId(song));
    return {
      id: trackId(song), title: String(song.name || song.title || ''),
      artist: String(song.artist || song.albumArtist || ''), album: String(song.album || ''),
      duration: Math.max(0, number(call('playbackDurationFromSong', song), 0)), cover: cover,
      liked: !!call('isSpecialLikedSong', song), filePath: path,
      format: String(song.format || song.localFormat || (path.match(/\.([^./\\]+)$/) || [])[1] || '').toLowerCase()
    };
  }
  function syncRevisions() {
    var source = global.localLibrarySongs || [];
    if (lastLibrarySource !== source || lastLibraryLength !== source.length) {
      lastLibrarySource = source; lastLibraryLength = source.length; libraryRevision++;
      playlistMembership.clear();
    }
    var queue = global.playQueue || [];
    if (lastQueueSource !== queue || lastQueueLength !== queue.length) {
      lastQueueSource = queue; lastQueueLength = queue.length; queueRevision++;
    }
  }
  function getState() {
    syncRevisions();
    var media = global.audio;
    var volume = clamp(number(global.targetVolume, media ? media.volume : 1), 0, 1);
    return {
      currentTrack: projectTrack(currentSong(), true), currentIndex: number(global.currentIdx, -1),
      position: number(call('getPlaybackCurrentSeconds'), 0), duration: number(call('getPlaybackDurationSeconds'), 0),
      playing: !!(media && media.src && !media.paused && !media.ended), playbackRate: media ? number(media.playbackRate, 1) : 1, volume: volume,
      muted: volume <= 0.0001 || !!(media && media.muted), playMode: global.playMode || 'loop',
      queueRevision: queueRevision, libraryRevision: libraryRevision, lyricsRevision: lyricsRevision,
      interface: active ? 'folia' : 'mineradio'
    };
  }
  function findSong(id) {
    if (typeof id !== 'string' || !id || id.length > 8192) fail('INVALID_TRACK', '歌曲标识无效');
    var lookup = call('getLocalPlaylistSongLookup');
    var song = lookup && lookup.byKey && lookup.byKey[id];
    if (!song) {
      var queue = global.playQueue || [];
      for (var i = 0; i < queue.length; i++) if (trackId(queue[i]) === id) { song = queue[i]; break; }
    }
    if (!song || song.type !== 'local') fail('TRACK_NOT_FOUND', '这首歌曲已不在本地曲库');
    return song;
  }
  function playlistSongs(id) {
    id = String(id || 'library');
    if (id === 'library') return librarySongs();
    if (id !== 'special-liked' && !call('localPlaylistById', id)) fail('PLAYLIST_NOT_FOUND', '歌单不存在');
    syncRevisions();
    var cached = playlistMembership.get(id);
    var revision = id === 'special-liked' ? favoritesRevision : libraryRevision;
    if (cached && cached.revision === revision && cached.queueRevision === queueRevision) return cached.songs;
    var songs = call('localPlaylistSongs', id);
    playlistMembership.set(id, { songs: songs, revision: revision, queueRevision: queueRevision });
    return songs;
  }
  function pageTracks(songs, params) {
    syncRevisions();
    var offset = Math.max(0, Math.floor(number(params.offset, 0)));
    var limit = clamp(Math.floor(number(params.limit, 100)), 1, 1000);
    var query = String(params.query || '').trim().toLocaleLowerCase().slice(0, 240);
    var index = trackPageIndexes.get(songs);
    if (!index || index.query !== query || index.length !== songs.length
      || index.libraryRevision !== libraryRevision || index.queueRevision !== queueRevision) {
      // Reuse membership across pages, but never retain projected metadata or covers.
      // The usual all-local catalog needs only a count, with no full-library copy.
      var positions = null, total = 0;
      for (var i = 0; i < songs.length; i++) {
        var song = songs[i];
        var matches = song && song.type === 'local'
          && (!query || (String(song.name || song.title || '') + '\n' + String(song.artist || '') + '\n' + String(song.album || '')).toLocaleLowerCase().indexOf(query) >= 0);
        if (matches) {
          if (positions) positions.push(i);
          total++;
        } else if (!positions) {
          positions = [];
          for (var previous = 0; previous < i; previous++) positions.push(previous);
        }
      }
      index = { query: query, length: songs.length, positions: positions, total: total,
        libraryRevision: libraryRevision, queueRevision: queueRevision };
      trackPageIndexes.set(songs, index);
    }
    var items = [], end = Math.min(index.total, offset + limit);
    for (var item = offset; item < end; item++) items.push(projectTrack(songs[index.positions ? index.positions[item] : item], false));
    return { items: items, total: index.total, offset: offset, limit: limit };
  }
  function projectPlaylist(playlist) {
    return { id: playlist.id, name: playlist.name, count: (playlist.songRefs || []).length, cover: '', readOnly: false };
  }
  function listPlaylists() {
    return [
      { id: 'library', name: '全部音乐', count: librarySongs().length, cover: '', readOnly: true },
      { id: 'special-liked', name: '特别喜欢', count: call('readSpecialLikedSongRefs').length, cover: '', readOnly: true }
    ].concat(call('readLocalPlaylists').map(projectPlaylist));
  }
  function getLyrics() {
    var source = global.lyricsLines || [], lines = [];
    for (var i = 0; i < source.length; i++) {
      var line = source[i];
      if (!line || line.fallback || !line.text) continue;
      var start = Math.max(0, number(line.t, 0)), next = source[i + 1];
      var end = next && number(next.t, 0) > start ? number(next.t, 0) : start + Math.max(0.1, number(line.duration, 4.8));
      var words = (Array.isArray(line.words) ? line.words : []).map(function (word) {
        return { time: Math.max(0, number(word.t, start)), duration: Math.max(0, number(word.d, 0.24)),
          text: String(word.text || word.word || String(line.text).slice(number(word.c0, 0), number(word.c1, 0))) };
      });
      lines.push({ time: start, endTime: end, text: String(line.text), translation: String(line.translation || ''), words: words });
    }
    return { trackId: trackId(currentSong()), lines: lines };
  }
  function lyricsSignature() {
    var lines = global.lyricsLines || [], hash = 2166136261;
    function mix(value) {
      var text = String(value == null ? '' : value);
      for (var j = 0; j < text.length; j++) hash = Math.imul(hash ^ text.charCodeAt(j), 16777619);
    }
    mix(trackId(currentSong()));
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]; if (!line) continue;
      mix(line.t); mix(line.duration); mix(line.text); mix(line.translation); mix(line.fallback); mix((line.words || []).length);
    }
    return lines.length + ':' + (hash >>> 0);
  }
  function post(payload) {
    if (frame && frame.contentWindow) frame.contentWindow.postMessage(Object.assign({ channel: CHANNEL, version: VERSION }, payload), global.location.origin);
  }
  function event(name, data) { post({ type: 'event', event: name, data: data }); }
  function updateStatus(message, failed) {
    var status = document.getElementById('folia-load-status');
    if (status) { status.textContent = message; status.classList.toggle('failed', !!failed); }
    var mount = document.getElementById('folia-interface');
    if (mount) mount.classList.toggle('folia-ready', ready);
  }
  function ensureFrame() {
    if (frame && loadFailed) { frame.remove(); frame = null; ready = false; loadFailed = false; updateStatus('正在重新加载 Folia…', false); }
    if (frame) return;
    var mount = document.getElementById('folia-interface');
    if (!mount) fail('HOST_NOT_READY', 'Folia 容器未加载');
    frame = document.createElement('iframe');
    frame.id = 'folia-frame'; frame.title = 'Folia 本地播放器'; frame.src = '/vendor/folia/index.html?host=mineradio&surface=local-player-v3';
    frame.setAttribute('allow', 'fullscreen');
    frame.addEventListener('load', function () {
      event('visibility', { active: active });
      if (!ready) updateStatus('正在连接播放器…', false);
    });
    mount.appendChild(frame);
    loadTimer = global.setTimeout(function () {
      if (!ready) { loadFailed = true; updateStatus('Folia 界面未能加载。可以切回 Mineradio 后重试。', true); }
    }, 20000);
  }
  function pauseBackgroundVideo(video) {
    if (!active || !video || video.tagName !== 'VIDEO') return;
    if (!video.paused) { pausedVideos.add(video); video.pause(); }
  }
  function setOriginalVisualsVisible(visible) {
    var shell = document.getElementById('desktop-window-shell');
    if (shell) Array.prototype.forEach.call(shell.children, function (node) {
      if (['desktop-titlebar', 'fullscreen-diy-zone', 'folia-interface'].indexOf(node.id) >= 0) return;
      if (node.tagName === 'INPUT' && node.type === 'file') return;
      if (!visible) { if (!oldInert.has(node)) oldInert.set(node, node.inert); node.inert = true; }
      else if (oldInert.has(node)) node.inert = oldInert.get(node);
    });
    if (visible) oldInert.clear();
    if (!visible) {
      call('suspendMainRenderLoop', 'folia-interface');
      if (global.MineradioSonicWorkshop) global.MineradioSonicWorkshop.clear();
      if (typeof global.releaseIdleGuideCanvasResources === 'function') global.releaseIdleGuideCanvasResources();
      document.querySelectorAll('#desktop-window-shell video').forEach(pauseBackgroundVideo);
    } else {
      pausedVideos.forEach(function (video) {
        if (video.isConnected && video.src) { var pending = video.play(); if (pending && pending.catch) pending.catch(function () {}); }
      });
      pausedVideos.clear();
      call('resumeMainRenderLoop', 'folia-interface-return');
      if (typeof global.scheduleMainRendererViewportRefresh === 'function') global.scheduleMainRendererViewportRefresh('folia-interface-return');
    }
    if (global.wallpaperBoardEffect && typeof global.wallpaperBoardEffect.setPaused === 'function') global.wallpaperBoardEffect.setPaused(!visible);
  }
  function updateButtons() {
    document.querySelectorAll('[data-folia-switch]').forEach(function (button) {
      button.textContent = active ? 'Mineradio' : 'Folia';
      button.title = button.textContent;
      button.setAttribute('aria-label', button.title); button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('on', true);
    });
  }
  function setInterface(mode) {
    var next = mode === 'folia';
    if (next) ensureFrame();
    if (active === next) return getState();
    active = next;
    document.body.classList.toggle('folia-interface-active', active);
    document.body.classList.remove('cursor-hidden');
    var mount = document.getElementById('folia-interface');
    if (mount) { mount.hidden = !active; mount.setAttribute('aria-hidden', String(!active)); }
    setOriginalVisualsVisible(!active); updateButtons();
    try {
      if (typeof global.setPersistentLocalStorageItem === 'function') global.setPersistentLocalStorageItem(MODE_KEY, active ? 'folia' : 'mineradio');
      else global.localStorage.setItem(MODE_KEY, active ? 'folia' : 'mineradio');
    } catch (_error) {}
    event('visibility', { active: active }); stopTimers();
    if (!active) trackPageIndexes = new WeakMap();
    if (active) { tick(); audioTick(); if (frame) frame.focus(); }
    return getState();
  }
  function stopTimers() {
    if (tickTimer) global.clearTimeout(tickTimer);
    if (audioTimer) global.clearTimeout(audioTimer);
    tickTimer = 0; audioTimer = 0;
  }
  function tick() {
    tickTimer = 0; if (!active) return;
    try {
      syncRevisions(); var now = Date.now();
      if (ready) {
        if (queueRevision !== sentQueueRevision) { sentQueueRevision = queueRevision; event('queueChanged', { revision: queueRevision }); }
        if (libraryRevision !== sentLibraryRevision && now - lastLibraryAt >= 900) {
          sentLibraryRevision = libraryRevision; lastLibraryAt = now; event('libraryChanged', { revision: libraryRevision });
        }
        if (now - lastLyricsAt >= 700) {
          lastLyricsAt = now; var signature = lyricsSignature();
          if (signature !== lastLyricsSignature) { lastLyricsSignature = signature; lyricsRevision++; event('lyrics', getLyrics()); }
        }
        event('state', getState());
      }
      if (global.wallpaperBoardEffect && global.wallpaperBoardEffect.setPaused) global.wallpaperBoardEffect.setPaused(true);
    } catch (error) { console.warn('[FoliaHost]', error); }
    tickTimer = global.setTimeout(tick, document.hidden ? 1000 : 200);
  }
  function audioTick() {
    audioTimer = 0; if (!active) return;
    var media = global.audio, playing = !!(media && !media.paused && !media.ended), analyser = global.analyser;
    if (ready && analyser && !document.hidden) {
      try {
        if (!audioFrequency || audioFrequency.length !== analyser.frequencyBinCount) {
          audioFrequency = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(audioFrequency);
        event('audio', { frequency: Array.from(audioFrequency),
          sampleRate: global.audioCtx ? global.audioCtx.sampleRate : 44100, fftSize: analyser.fftSize });
      } catch (_error) {}
    }
    audioTimer = global.setTimeout(audioTick, playing && !document.hidden ? 33 : 250);
  }
  function editablePlaylist(id) {
    if (typeof id !== 'string' || id.indexOf('local-playlist:') !== 0 || !call('localPlaylistById', id)) fail('PLAYLIST_READ_ONLY', '只能编辑自建歌单');
    return id;
  }
  function readTrackIds(params) {
    if (!Array.isArray(params.trackIds) || params.trackIds.length > 100000) fail('INVALID_TRACKS', '歌曲列表无效');
    return params.trackIds.map(findSong);
  }
  function queueEdited(saveSession) {
    call('markQueueContentChanged');
    if (saveSession !== false) call('savePlaybackSession', true);
    call('safeRenderQueuePanel', 'folia-queue'); call('safeShelfRebuild', 'folia-queue');
  }
  async function handle(method, params) {
    var song, index, source;
    switch (method) {
      case 'getState': return getState();
      case 'listTracks': return pageTracks(playlistSongs(params.playlistId), params);
      case 'listPlaylists': return listPlaylists();
      case 'getQueue': {
        syncRevisions();
        var page = pageTracks(global.playQueue || [], params);
        page.currentIndex = number(global.currentIdx, -1); page.revision = queueRevision; return page;
      }
      case 'getLyrics': return getLyrics();
      case 'addToQueue': {
        // Validate before touching the live queue; adding never loads, seeks or replaces audio.
        song = findSong(params.id);
        var appendQueue = global.playQueue || [];
        index = appendQueue.findIndex(function (entry) { return trackId(entry) === params.id; });
        if (index >= 0) return getState();
        var appendedSong = call('cloneSong', song);
        if (!appendedSong) fail('HOST_NOT_READY', '播放器队列尚未准备好');
        appendQueue.push(appendedSong);
        global.playQueue = appendQueue;
        if (global.playMode === 'shuffle' && global.shuffledPlayQueueArrays) global.shuffledPlayQueueArrays.add(appendQueue);
        call('clearLocalLibraryPassiveQueue'); queueEdited();
        return getState();
      }
      case 'play':
        song = findSong(params.id);
        if (params.playlistId) {
          source = playlistSongs(params.playlistId);
          index = source.findIndex(function (entry) { return trackId(entry) === params.id; });
          if (index < 0) fail('TRACK_NOT_IN_PLAYLIST', '歌单中没有这首歌曲');
          // A previous failed load may have left selection ahead of the loaded audio.
          if (global.audio && global.audio.src && global.currentLocalSong
            && trackId(global.currentLocalSong) === trackId(currentSong())) {
            call('savePlaybackSession', true);
          }
          call('clearLocalLibraryPassiveQueue'); call('setLocalPlaybackPlaylistSelection', params.playlistId);
          global.playQueue = call('cloneSongList', source); global.currentIdx = index; queueEdited(false);
        } else {
          index = (global.playQueue || []).findIndex(function (entry) { return trackId(entry) === params.id; });
          if (index < 0) { global.playQueue.push(call('cloneSong', song)); index = global.playQueue.length - 1; queueEdited(); }
        }
        await call('playQueueAt', index, { manual: true });
        // Loading may fail or be superseded. Never pair the selected song with another deck's time.
        if (params.playlistId && global.audio && global.audio.src && global.currentLocalSong
          && trackId(global.currentLocalSong) === params.id && trackId(currentSong()) === params.id) {
          call('savePlaybackSession', true);
        }
        return getState();
      case 'playQueue':
        index = number(params.index, -1);
        if (!Number.isInteger(index) || index < 0 || index >= (global.playQueue || []).length) fail('INVALID_INDEX', '队列位置无效');
        await call('playQueueAt', index, { manual: true }); return getState();
      case 'togglePlay': await call('togglePlay'); return getState();
      case 'pause': if (global.audio && !global.audio.paused) await call('togglePlay'); return getState();
      case 'resume':
        if (!global.audio || global.audio.paused || !global.audio.src || global.audio.ended) {
          if (global.currentIdx < 0 && (global.playQueue || []).length) await call('playQueueAt', 0, { manual: true });
          else await call('togglePlay');
        }
        return getState();
      case 'next': call('nextTrack'); return getState();
      case 'previous': call('prevTrack'); return getState();
      case 'seek': {
        var duration = number(call('getPlaybackDurationSeconds'), 0), seconds = number(params.seconds, NaN);
        if (!Number.isFinite(seconds) || !global.audio || !duration) fail('INVALID_SEEK', '当前歌曲还不能跳转');
        global.audio.currentTime = clamp(seconds, 0, duration);
        call('syncBeatMapPlaybackCursor', global.audio.currentTime); call('schedulePlaybackProgressUi', 'folia-seek', true);
        call('savePlaybackSession', true); return getState();
      }
      case 'setVolume':
        if (!Number.isFinite(Number(params.volume))) fail('INVALID_VOLUME', '音量无效');
        call('setVolume', clamp(Number(params.volume), 0, 1), true); return getState();
      case 'setMuted':
        if (typeof params.muted !== 'boolean') fail('INVALID_MUTED', '静音状态无效');
        call('setVolume', params.muted ? 0 : clamp(number(global.lastNonZeroVolume, 0.7), 0.01, 1), true); return getState();
      case 'setPlayMode':
        if (['loop', 'shuffle', 'single'].indexOf(params.mode) < 0) fail('INVALID_PLAY_MODE', '播放模式无效');
        call('setPlayMode', params.mode, { toast: false }); return getState();
      case 'setQueue': {
        source = readTrackIds(params);
        var current = currentSong(), currentId = trackId(current), mediaLoaded = !!(global.audio && global.audio.src && current);
        var next = source.map(function (entry) { return mediaLoaded && trackId(entry) === currentId ? current : call('cloneSong', entry); });
        index = mediaLoaded ? next.findIndex(function (entry) { return entry === current; }) : -1;
        if (mediaLoaded && index < 0) { next.unshift(current); index = 0; }
        global.playQueue = next;
        global.currentIdx = mediaLoaded ? index : (next.length ? clamp(Math.floor(number(params.currentIndex, 0)), 0, next.length - 1) : -1);
        // The caller supplied an explicit order, including edits to a shuffled queue.
        // Keep that order on the next playQueueAt instead of treating it as a new list.
        if (global.playMode === 'shuffle' && global.shuffledPlayQueueArrays) global.shuffledPlayQueueArrays.add(next);
        call('clearLocalLibraryPassiveQueue'); queueEdited(); return getState();
      }
      case 'toggleLike':
        song = findSong(params.id); await call('toggleLikeSong', song);
        return { id: params.id, liked: !!call('isSpecialLikedSong', song) };
      case 'createPlaylist': {
        var created = call('createLocalPlaylist', String(params.name || '').trim());
        if (!created) fail('INVALID_NAME', '请输入歌单名称'); return projectPlaylist(created);
      }
      case 'renamePlaylist':
        editablePlaylist(params.id);
        if (!call('renameLocalPlaylist', params.id, String(params.name || '').trim())) fail('INVALID_NAME', '请输入歌单名称');
        return { ok: true };
      case 'deletePlaylist': editablePlaylist(params.id); call('deleteLocalPlaylist', params.id); return { ok: true };
      case 'addToPlaylist':
      case 'removeFromPlaylist': {
        editablePlaylist(params.playlistId); source = readTrackIds(params); var count = 0;
        source.forEach(function (entry) { if (call(method === 'addToPlaylist' ? 'addSongToLocalPlaylist' : 'removeSongFromLocalPlaylist', params.playlistId, entry)) count++; });
        return { ok: true, count: count };
      }
      case 'setPlaylistTracks': {
        if (params.playlistId !== 'special-liked') editablePlaylist(params.playlistId);
        source = readTrackIds(params); var seen = new Set();
        var refs = source.filter(function (entry) { var id = trackId(entry); if (seen.has(id)) return false; seen.add(id); return true; }).map(function (entry) { return call('specialLikedSongRef', entry); });
        if (params.playlistId === 'special-liked') {
          var previous = call('getSpecialLikedSongs');
          call('writeSpecialLikedSongRefs', refs);
          previous.concat(source).forEach(function (entry) { call('syncLocalLibraryDbFavorite', entry, seen.has(trackId(entry))); });
          call('updateLikeButtons');
        } else {
          var list = call('localPlaylistById', params.playlistId); list.songRefs = refs; list.updatedAt = Date.now();
          call('writeLocalPlaylists', call('readLocalPlaylists'));
        }
        call('refreshLocalPlaylistSurfaces', 'folia-playlist-order'); return { ok: true, count: refs.length };
      }
      case 'importFolder': await call('openLocalFolderImport'); libraryRevision++; return { ok: true };
      case 'importFiles': {
        var input = document.getElementById('file-input');
        if (!input) fail('HOST_NOT_READY', '文件选择器未准备好'); input.click(); return { ok: true };
      }
      case 'switchInterface':
        if (params.mode !== 'folia' && params.mode !== 'mineradio') fail('INVALID_INTERFACE', '界面名称无效');
        return setInterface(params.mode);
      default: fail('METHOD_NOT_FOUND', '不支持的播放器操作');
    }
  }
  async function onMessage(message) {
    if (!frame || message.source !== frame.contentWindow || message.origin !== global.location.origin) return;
    var data = message.data;
    if (!data || data.channel !== CHANNEL || data.version !== VERSION || data.type !== 'request') return;
    if (typeof data.id !== 'string' || !data.id || data.id.length > 160 || typeof data.method !== 'string') return;
    if (inFlight.has(data.id) || inFlight.size >= 64) return;
    if (!ready) {
      ready = true; loadFailed = false; if (loadTimer) global.clearTimeout(loadTimer); loadTimer = 0;
      updateStatus('', false); event('visibility', { active: active });
    }
    inFlight.add(data.id);
    try {
      var params = data.params && typeof data.params === 'object' && !Array.isArray(data.params) ? data.params : {};
      var result = await handle(data.method, params);
      post({ type: 'response', id: data.id, ok: true, result: result });
    } catch (error) {
      post({ type: 'response', id: data.id, ok: false, error: { code: error.code || 'HOST_ERROR', message: error.message || '播放器操作失败' } });
    } finally { inFlight.delete(data.id); }
  }
  function observeMutation(name, kind) {
    var original = global[name]; if (typeof original !== 'function') return;
    global[name] = function () {
      var result = original.apply(this, arguments);
      if (kind === 'queue') queueRevision++;
      else if (kind === 'lyrics') { lastLyricsAt = 0; lastLyricsSignature = ''; }
      else if (kind === 'favorites') { favoritesRevision++; libraryRevision++; playlistMembership.clear(); }
      else { libraryRevision++; playlistMembership.clear(); }
      return result;
    };
  }
  global.isFoliaInterfaceActive = function () { return active; };
  global.MineradioFoliaHost = Object.freeze({ setInterface: setInterface, getState: getState, version: VERSION });
  global.addEventListener('message', onMessage);
  // Same-origin child preferences use the host's desktop backup, including across port changes.
  global.addEventListener('storage', function (change) {
    if (!['mineradio-folia-local-visuals-v1', 'mineradio-folia-local-lattice-v1'].includes(change.key)
      || change.storageArea !== global.localStorage) return;
    var patch = {}; patch[change.key] = change.newValue;
    call('backupPersistentUiState', patch);
  });
  document.addEventListener('play', function (event) { pauseBackgroundVideo(event.target); }, true);
  document.querySelectorAll('[data-folia-switch]').forEach(function (button) {
    button.addEventListener('click', function () { setInterface(active ? 'mineradio' : 'folia'); });
  });
  document.querySelectorAll('[data-folia-import]').forEach(function (button) {
    button.addEventListener('click', function () {
      handle('importFiles', {}).catch(function (error) { if (typeof global.showToast === 'function') global.showToast(error.message); });
    });
  });
  ['writeLocalPlaylists', 'invalidateLocalPlaylistSongLookup', 'schedulePlaybackMetadataRefresh', 'scheduleLocalAssetUiRefresh'].forEach(function (name) { observeMutation(name, 'library'); });
  observeMutation('writeSpecialLikedSongRefs', 'favorites');
  observeMutation('markQueueContentChanged', 'queue'); observeMutation('applyLyricsState', 'lyrics'); updateButtons();
  if (global.MineradioSonicWorkshop) {
    var workshopPresetChanged = global.MineradioSonicWorkshop.onPresetChange;
    global.MineradioSonicWorkshop.onPresetChange = function () {
      if (active) { global.MineradioSonicWorkshop.clear(); return; }
      return workshopPresetChanged.apply(this, arguments);
    };
  }
  try { if (global.localStorage.getItem(MODE_KEY) === 'folia') setInterface('folia'); } catch (error) { console.warn('[FoliaHostRestore]', error); }
  global.addEventListener('beforeunload', function () {
    stopTimers(); if (loadTimer) global.clearTimeout(loadTimer);
    coverTransfers.forEach(function (entry) { global.URL.revokeObjectURL(entry.url); }); coverTransfers.clear();
  });
})(window);
