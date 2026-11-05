/* Android SAF keeps URI grants; songs stream from the selected document provider. */
(function () {
  'use strict';
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform()) return;
  var plugin = cap.registerPlugin('MineradioLibrary');
  var busy = false;
  var lastState = '';
  var playbackTimer = 0;

  window.MineradioNativeLibraryApi = {
    readLocalFileRange: function (uri, start, end) {
      return plugin.readRange({ uri: uri, start: start || 0, end: end || 0 });
    }
  };

  async function loadLibrary(result, autoPlay) {
    var files = (result.files || []).map(function (entry) {
      return Object.assign({}, entry, { url: cap.convertFileSrc(entry.fullPath) });
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

  function syncPlayback() {
    var song = typeof playQueue !== 'undefined' && currentIdx >= 0 ? playQueue[currentIdx] : null;
    var state = {
      playing: !!(song && audio && !audio.paused),
      title: song && (song.name || song.title) || 'Mineradio',
      artist: song && song.artist || '',
      position: audio && isFinite(audio.currentTime) ? audio.currentTime : 0,
      duration: audio && isFinite(audio.duration) ? audio.duration : 0
    };
    var signature = JSON.stringify([state.playing, state.title, state.artist, Math.floor(state.position / 5)]);
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
    (typeof audioDeckList !== 'undefined' ? audioDeckList : []).forEach(function (deck) {
      var element = deck.el;
      if (!element || element._mineradioNativeBound) return;
      element._mineradioNativeBound = true;
      ['play', 'pause', 'ended', 'loadedmetadata', 'seeked'].forEach(function (name) {
        element.addEventListener(name, syncPlayback);
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
  });
  schedulePlayback();
})();
