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
  var currentTrackCache = null;
  var pendingTrackChanges = new Map(), trackChangeTimer = 0;
  // Native metadata and cover hydration mutate these projection inputs in place.
  var CURRENT_TRACK_FIELDS = [
    'type', 'localKey', 'id', 'localFilePathAbsolute', 'localPath', 'localFile',
    'name', 'title', 'artist', 'albumArtist', 'album', 'duration', 'durationMs', 'dt',
    'cover', 'customCoverKey', 'customCover', 'localCoverThumbDataUrl', 'localCoverDataUrl',
    'localCoverObjectUrl', 'localCoverFile', '_mineradioCoverCacheVersion', 'format', 'localFormat'
  ];
  var TRACK_QUERY_CACHE_LIMIT = 8;
  var TRACK_CHANGE_DELAY_MS = 180, TRACK_CHANGE_DRAIN_DELAY_MS = 32, TRACK_CHANGE_BATCH_LIMIT = 180;

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
  function projectCurrentTrack(song) {
    if (!song) { currentTrackCache = null; return null; }
    var cached = currentTrackCache, covers = global.customCoverMap;
    var unchanged = !!(cached && cached.song === song && cached.favoritesRevision === favoritesRevision
      && cached.mappedCover === (covers && cached.coverKey ? covers[cached.coverKey] : undefined));
    if (unchanged) {
      for (var i = 0; i < CURRENT_TRACK_FIELDS.length; i++) {
        if (cached.fields[i] !== song[CURRENT_TRACK_FIELDS[i]]) { unchanged = false; break; }
      }
    }
    if (!unchanged) {
      var projected = projectTrack(song, true), fields = new Array(CURRENT_TRACK_FIELDS.length);
      for (var field = 0; field < fields.length; field++) fields[field] = song[CURRENT_TRACK_FIELDS[field]];
      var coverKey = typeof global.songCustomCoverKey === 'function' ? global.songCustomCoverKey(song) : '';
      covers = global.customCoverMap;
      currentTrackCache = { song: song, favoritesRevision: favoritesRevision,
        coverKey: coverKey, mappedCover: covers && coverKey ? covers[coverKey] : undefined,
        fields: fields, projected: projected };
    }
    return Object.assign({}, currentTrackCache.projected);
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
      currentTrack: projectCurrentTrack(currentSong()), currentIndex: number(global.currentIdx, -1),
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
  function createTrackPageIndex(songs) {
    return {
      length: songs.length,
      queries: new Map(), queryOrder: [], libraryRevision: libraryRevision, queueRevision: queueRevision
    };
  }
  function rememberTrackQuery(index, query, result) {
    var existing = index.queryOrder.indexOf(query);
    if (existing >= 0) index.queryOrder.splice(existing, 1);
    index.queries.set(query, result);
    index.queryOrder.push(query);
    while (index.queryOrder.length > TRACK_QUERY_CACHE_LIMIT) index.queries.delete(index.queryOrder.shift());
    return result;
  }
  function trackQueryIndex(index, songs, query) {
    var cached = index.queries.get(query);
    if (cached) return rememberTrackQuery(index, query, cached);
    if (!query) {
      var allPositions = null, localCount = 0;
      for (var i = 0; i < index.length; i++) {
        if (songs[i] && songs[i].type === 'local') {
          if (allPositions) allPositions.push(i);
          localCount++;
        } else if (!allPositions) {
          allPositions = [];
          for (var previous = 0; previous < i; previous++) allPositions.push(previous);
        }
      }
      return rememberTrackQuery(index, query, { positions: allPositions, total: localCount });
    }
    var positions = [], total = 0;
    // New searches read live metadata; tags can change in place without replacing the library array.
    for (var candidate = 0; candidate < index.length; candidate++) {
      var song = songs[candidate];
      if (song && song.type === 'local'
        && (String(song.name || song.title || '') + '\n' + String(song.artist || '') + '\n' + String(song.album || '')).toLocaleLowerCase().indexOf(query) >= 0) {
        positions.push(candidate); total++;
      }
    }
    return rememberTrackQuery(index, query, {
      positions: total === index.length ? null : positions, total: total
    });
  }
  function pageTracks(songs, params) {
    syncRevisions();
    var offset = Math.max(0, Math.floor(number(params.offset, 0)));
    var limit = clamp(Math.floor(number(params.limit, 100)), 1, 1000);
    var query = String(params.query || '').trim().toLocaleLowerCase().slice(0, 240);
    var index = trackPageIndexes.get(songs);
    if (!index || index.length !== songs.length
      || index.libraryRevision !== libraryRevision || index.queueRevision !== queueRevision) {
      index = createTrackPageIndex(songs);
      trackPageIndexes.set(songs, index);
    }
    var queryIndex = trackQueryIndex(index, songs, query);
    var items = [], end = Math.min(queryIndex.total, offset + limit);
    for (var item = offset; item < end; item++) {
      var songIndex = queryIndex.positions ? queryIndex.positions[item] : item;
      items.push(projectTrack(songs[songIndex], false));
    }
    return { items: items, total: queryIndex.total, offset: offset, limit: limit };
  }
  function queueTrackChange(song, searchableChanged) {
    if (!song || song.type !== 'local' || !frame || !ready) return;
    syncRevisions();
    var id = trackId(song);
    var lookup = call('getLocalPlaylistSongLookup');
    var canonical = lookup && lookup.byKey && lookup.byKey[id];
    var queueClone = canonical !== song && (global.playQueue || []).indexOf(song) >= 0;
    if (!canonical || (canonical !== song && !queueClone)) return;
    if (searchableChanged) trackPageIndexes = new WeakMap();
    var pending = pendingTrackChanges.get(id);
    pendingTrackChanges.set(id, {
      song: song, queueClone: queueClone, librarySource: global.localLibrarySongs,
      libraryRevision: libraryRevision, searchableChanged: !!searchableChanged || !!(pending && pending.searchableChanged)
    });
    if (!trackChangeTimer) trackChangeTimer = global.setTimeout(flushTrackChanges, TRACK_CHANGE_DELAY_MS);
  }
  function flushTrackChanges() {
    trackChangeTimer = 0;
    if (!frame || !ready) { pendingTrackChanges.clear(); return; }
    try {
      syncRevisions();
      var lookup = call('getLocalPlaylistSongLookup'), updates = [];
      var entries = pendingTrackChanges.entries();
      for (var i = 0; i < TRACK_CHANGE_BATCH_LIMIT; i++) {
        var entry = entries.next();
        if (entry.done) break;
        var id = entry.value[0], pending = entry.value[1];
        pendingTrackChanges.delete(id);
        var song = lookup && lookup.byKey && lookup.byKey[id];
        if (!song || pending.librarySource !== global.localLibrarySongs
          || pending.libraryRevision !== libraryRevision
          || (song !== pending.song && !pending.queueClone)) continue;
        updates.push({ track: projectTrack(song, false), searchableChanged: pending.searchableChanged });
      }
      if (updates.length) event('tracksChanged', { updates: updates });
      if (pendingTrackChanges.size) trackChangeTimer = global.setTimeout(flushTrackChanges, TRACK_CHANGE_DRAIN_DELAY_MS);
    } catch (error) {
      pendingTrackChanges.clear();
      console.warn('[FoliaHostTracks]', error);
    }
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
      if (active) attachFrameActivity();
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
  // ---- Immersive chrome: top host titlebar + bottom Folia player bar auto-hide on idle ----
  // Both float over the visualization and slide away after a short idle; the pointer reaching the
  // top edge or the bottom band (or touching a control) brings the relevant one back. Dragging or
  // hovering a control holds it open. Torn down when Folia is left. Same-origin iframe is driven
  // via a body class + an injected stylesheet, so React re-renders never fight it.
  var CHROME_HIDE_DELAY = 2500, BAR_HIDE_DELAY = 2500, TOP_BAND = 96, BOTTOM_BAND = 170;
  var chromeHideTimer = 0, barHideTimer = 0, topHideTimer = 0;
  var chromeHoverLock = false, barLock = false, barDragging = false, barZone = false, topLock = false, topZone = false, chromeZone = false;
  var chromeListening = false, frameActivityDoc = null;
  function setChromeHidden(h) { document.body.classList.toggle('folia-chrome-hidden', !!h); }
  function setBarHidden(h) { if (frameActivityDoc && frameActivityDoc.body) frameActivityDoc.body.classList.toggle('mineradio-bar-hidden', !!h); }
  function scheduleChromeHide() {
    if (chromeHideTimer) { global.clearTimeout(chromeHideTimer); chromeHideTimer = 0; }
    if (!isImmersive() || chromeHoverLock) return;
    chromeHideTimer = global.setTimeout(function () { chromeHideTimer = 0; if (isImmersive() && !chromeHoverLock) setChromeHidden(true); }, CHROME_HIDE_DELAY);
  }
  function revealChrome(persist) {
    setChromeHidden(false);
    if (persist) { if (chromeHideTimer) { global.clearTimeout(chromeHideTimer); chromeHideTimer = 0; } }
    else scheduleChromeHide();
  }
  function scheduleBarHide() {
    if (barHideTimer) { global.clearTimeout(barHideTimer); barHideTimer = 0; }
    if (!active || barLock || barDragging) return;
    barHideTimer = global.setTimeout(function () { barHideTimer = 0; if (active && !barLock && !barDragging) setBarHidden(true); }, BAR_HIDE_DELAY);
  }
  function revealBar(persist) {
    setBarHidden(false);
    if (persist) { if (barHideTimer) { global.clearTimeout(barHideTimer); barHideTimer = 0; } }
    else scheduleBarHide();
  }
  // Fullscreen Folia renders its top nav (.local-header) inside the iframe; auto-hide it too.
  function setTopHidden(h) { if (frameActivityDoc && frameActivityDoc.body) frameActivityDoc.body.classList.toggle('mineradio-topnav-hidden', !!h); }
  function scheduleTopHide() {
    if (topHideTimer) { global.clearTimeout(topHideTimer); topHideTimer = 0; }
    if (!active || topLock) return;
    topHideTimer = global.setTimeout(function () { topHideTimer = 0; if (active && !topLock) setTopHidden(true); }, CHROME_HIDE_DELAY);
  }
  function revealTop(persist) {
    setTopHidden(false);
    if (persist) { if (topHideTimer) { global.clearTimeout(topHideTimer); topHideTimer = 0; } }
    else scheduleTopHide();
  }
  function onHostPointerMove(e) {
    if (!isImmersive()) return;
    var y = (e && typeof e.clientY === 'number') ? e.clientY : 0;
    if (y <= TOP_BAND) { chromeZone = true; revealChrome(false); }
    else if (chromeZone) { chromeZone = false; scheduleChromeHide(); }
  }
  function onChromeHoverEnter() { chromeHoverLock = true; revealChrome(true); }
  function onChromeHoverLeave() { chromeHoverLock = false; scheduleChromeHide(); }
  function onFramePointerMove(e) {
    if (!active) return;
    var doc = frameActivityDoc && frameActivityDoc.documentElement;
    var h = doc ? doc.clientHeight : 0, y = e.clientY;
    var closest = (e.target && e.target.closest) ? e.target.closest.bind(e.target) : function () { return null; };
    // top: host titlebar (windowed) + Folia header (fullscreen)
    var overTop = !!closest('.local-header');
    topLock = overTop;
    if (overTop || y <= TOP_BAND) { topZone = true; revealChrome(false); revealTop(false); }
    else if (topZone) { topZone = false; scheduleChromeHide(); scheduleTopHide(); }
    // bottom: Folia player bar
    var overBar = !!closest('.local-controls');
    barLock = overBar;
    if (overBar || (h && y >= h - BOTTOM_BAND)) { barZone = true; revealBar(false); }
    else if (barZone) { barZone = false; scheduleBarHide(); }
  }
  function onFramePointerDown(e) {
    if (e.pointerType === 'touch') { revealChrome(false); revealTop(false); revealBar(false); }
    if (e.target && e.target.closest && e.target.closest('.local-controls')) { barDragging = true; revealBar(true); }
  }
  function onFramePointerUp() { if (barDragging) { barDragging = false; scheduleBarHide(); } }
  function injectBarStyle(doc) {
    if (!doc || !doc.head || doc.getElementById('mineradio-immersive-bar-style')) return;
    var style = doc.createElement('style');
    style.id = 'mineradio-immersive-bar-style';
    style.textContent = '.local-controls{transition:background .3s ease,border-color .3s ease,box-shadow .3s ease,backdrop-filter .3s ease,-webkit-backdrop-filter .3s ease,padding .3s ease!important}'
      + '.local-transport{overflow:hidden;max-height:80px;transition:opacity .3s cubic-bezier(.22,1,.36,1),max-height .34s cubic-bezier(.22,1,.36,1),margin-top .3s cubic-bezier(.22,1,.36,1)!important}'
      + 'body.mineradio-bar-hidden .local-controls{background:transparent!important;border-color:transparent!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;padding-top:4px!important;padding-bottom:4px!important}'
      + 'body.mineradio-bar-hidden .local-transport{opacity:0!important;max-height:0!important;margin-top:0!important;pointer-events:none!important}'
      + '.local-header{transition:opacity .3s cubic-bezier(.22,1,.36,1),transform .3s cubic-bezier(.22,1,.36,1)!important}'
      + 'body.mineradio-topnav-hidden .local-header{opacity:0!important;transform:translateY(-16px)!important;pointer-events:none!important}'
      + 'button[aria-label="沉浸播放"]{display:none!important}'
      + '@media(prefers-reduced-motion:reduce){.local-controls,.local-transport{transition-duration:.15s!important}}';
    doc.head.appendChild(style);
  }
  function attachFrameActivity() {
    if (!frame) return;
    var doc;
    try { doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document); } catch (_e) { return; }
    if (!doc || doc === frameActivityDoc) return;
    detachFrameActivity();
    frameActivityDoc = doc;
    injectBarStyle(doc);
    doc.addEventListener('pointermove', onFramePointerMove, true);
    doc.addEventListener('pointerdown', onFramePointerDown, true);
    doc.addEventListener('pointerup', onFramePointerUp, true);
    if (active) { scheduleBarHide(); scheduleTopHide(); }
  }
  function detachFrameActivity() {
    if (barHideTimer) { global.clearTimeout(barHideTimer); barHideTimer = 0; }
    if (topHideTimer) { global.clearTimeout(topHideTimer); topHideTimer = 0; }
    barLock = barDragging = barZone = topLock = topZone = false;
    if (!frameActivityDoc) return;
    try {
      setBarHidden(false); setTopHidden(false);
      frameActivityDoc.removeEventListener('pointermove', onFramePointerMove, true);
      frameActivityDoc.removeEventListener('pointerdown', onFramePointerDown, true);
      frameActivityDoc.removeEventListener('pointerup', onFramePointerUp, true);
    } catch (_e) {}
    frameActivityDoc = null;
  }
  function chromeHoverTargets() {
    return Array.prototype.slice.call(document.querySelectorAll(
      '.desktop-drag-region,.desktop-window-controls,#top-right,#folia-floating-switch,#folia-floating-import,#fullscreen-diy-zone'));
  }
  function startChromeAutoHide() {
    var fresh = !chromeListening;
    if (fresh) {
      chromeListening = true;
      if (document.addEventListener) { document.addEventListener('mousemove', onHostPointerMove, true); document.addEventListener('pointerdown', onHostPointerMove, true); }
      chromeHoverTargets().forEach(function (el) {
        el.addEventListener('mouseenter', onChromeHoverEnter);
        el.addEventListener('mouseleave', onChromeHoverLeave);
        el.addEventListener('focusin', onChromeHoverEnter);
        el.addEventListener('focusout', onChromeHoverLeave);
      });
    }
    attachFrameActivity();
    if (fresh) { chromeHoverLock = false; revealChrome(false); }
    if (active) scheduleBarHide();
  }
  function stopChromeAutoHide() {
    if (chromeHideTimer) { global.clearTimeout(chromeHideTimer); chromeHideTimer = 0; }
    chromeHoverLock = false; chromeZone = false; setChromeHidden(false);
    detachFrameActivity();
    if (!chromeListening) return;
    chromeListening = false;
    if (document.removeEventListener) { document.removeEventListener('mousemove', onHostPointerMove, true); document.removeEventListener('pointerdown', onHostPointerMove, true); }
    chromeHoverTargets().forEach(function (el) {
      el.removeEventListener('mouseenter', onChromeHoverEnter);
      el.removeEventListener('mouseleave', onChromeHoverLeave);
      el.removeEventListener('focusin', onChromeHoverEnter);
      el.removeEventListener('focusout', onChromeHoverLeave);
    });
  }
  function isDesktopFullscreen() { var b = document.body; return !!(b && b.classList && b.classList.contains && b.classList.contains('desktop-fullscreen')) || !!document.fullscreenElement; }
  function isImmersive() { return active || isDesktopFullscreen(); }
  function syncImmersiveController() { if (isImmersive()) startChromeAutoHide(); else stopChromeAutoHide(); }
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
    if (active) startChromeAutoHide(); else syncImmersiveController();
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
        event('audio', { frequency: audioFrequency,
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
      if (kind === 'asset-cache') {
        var song = arguments[0];
        if (!song || song.type !== 'local' || !frame || !ready) return original.apply(this, arguments);
        var nameBefore = song.name, artistBefore = song.artist, albumBefore = song.album;
        var albumArtistBefore = song.albumArtist, durationBefore = song.duration, formatBefore = song.localFormat;
        var thumbBefore = song.localCoverThumbDataUrl, coverBefore = song.localCoverDataUrl;
        var coverFileBefore = song.localCoverFile, coverUrlBefore = song.localCoverObjectUrl;
        var changed = original.apply(this, arguments);
        if (changed) {
          var searchableChanged = nameBefore !== song.name || artistBefore !== song.artist || albumBefore !== song.album;
          if (searchableChanged || albumArtistBefore !== song.albumArtist || durationBefore !== song.duration
            || formatBefore !== song.localFormat || thumbBefore !== song.localCoverThumbDataUrl
            || coverBefore !== song.localCoverDataUrl || coverFileBefore !== song.localCoverFile
            || coverUrlBefore !== song.localCoverObjectUrl) queueTrackChange(song, searchableChanged);
        }
        return changed;
      }
      var result = original.apply(this, arguments);
      if (kind === 'queue') queueRevision++;
      else if (kind === 'lyrics') { lastLyricsAt = 0; lastLyricsSignature = ''; }
      else if (kind === 'track-metadata') queueTrackChange(arguments[0], arguments[2] !== false);
      else if (kind === 'track-cover') {
        if (arguments[1] === 'local-cover-prefetch') queueTrackChange(arguments[0], false);
      }
      else if (kind === 'custom-cover') queueTrackChange(currentSong(), false);
      else if (kind === 'favorites') { favoritesRevision++; libraryRevision++; playlistMembership.clear(); }
      else { libraryRevision++; playlistMembership.clear(); }
      return result;
    };
  }
  global.isFoliaInterfaceActive = function () { return active; };
  global.MineradioFoliaHost = Object.freeze({
    setInterface: setInterface, getState: getState, noteTrackChanged: queueTrackChange, version: VERSION
  });
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
  // Collapse/expand the centred Folia nav from a toggle placed left of the Mineradio switch.
  var NAV_COLLAPSE_KEY = 'mineradio-folia-nav-collapsed';
  function setFoliaNavCollapsed(collapsed, persist) {
    document.body.classList.toggle('folia-nav-collapsed', !!collapsed);
    var btn = document.getElementById('folia-expand-proxy');
    if (btn) { btn.title = collapsed ? '展开导航' : '收起导航'; btn.setAttribute('aria-label', btn.title); btn.setAttribute('aria-pressed', String(!!collapsed)); }
    if (persist) { try { global.localStorage.setItem(NAV_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (_e) {} }
  }
  var foliaNavToggle = document.getElementById('folia-expand-proxy');
  if (foliaNavToggle) {
    foliaNavToggle.addEventListener('click', function () {
      setFoliaNavCollapsed(!document.body.classList.contains('folia-nav-collapsed'), true);
    });
    try { if (global.localStorage.getItem(NAV_COLLAPSE_KEY) === '1') setFoliaNavCollapsed(true, false); } catch (_e) {}
  }
  // Keep the idle auto-hide running in fullscreen for the Mineradio view too (not only Folia).
  (function () {
    var wasFullscreen = isDesktopFullscreen();
    try {
      new MutationObserver(function () {
        var now = isDesktopFullscreen();
        if (now !== wasFullscreen) { wasFullscreen = now; syncImmersiveController(); }
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_e) {}
    if (document.addEventListener) document.addEventListener('fullscreenchange', syncImmersiveController);
    syncImmersiveController();
  })();
  ['writeLocalPlaylists', 'invalidateLocalPlaylistSongLookup'].forEach(function (name) { observeMutation(name, 'library'); });
  observeMutation('refreshLocalMetadataUi', 'track-metadata');
  observeMutation('scheduleLocalAssetUiRefresh', 'track-cover');
  observeMutation('applyLocalAssetCacheToSong', 'asset-cache');
  observeMutation('setCustomCoverForCurrent', 'custom-cover');
  observeMutation('clearCustomCoverForCurrent', 'custom-cover');
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
  finally { if (document.documentElement) document.documentElement.classList.remove('folia-mode-preload'); }
  global.addEventListener('beforeunload', function () {
    stopTimers(); stopChromeAutoHide(); if (loadTimer) global.clearTimeout(loadTimer);
    if (trackChangeTimer) global.clearTimeout(trackChangeTimer);
    pendingTrackChanges.clear();
    coverTransfers.forEach(function (entry) { global.URL.revokeObjectURL(entry.url); }); coverTransfers.clear();
  });
})(window);
