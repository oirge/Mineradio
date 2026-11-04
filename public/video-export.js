/* Record only Mineradio's hidden Folia scene and its existing WebAudio output. */
(function (global) {
  'use strict';
  var PRESETS = ['1280x720', '1920x1080', '720x1280', '1080x1920'];
  var MAX_PENDING_BYTES = 32 * 1024 * 1024;
  var MAX_CHUNK_BYTES = 8 * 1024 * 1024;
  function formatFor(Recorder) {
    if (!Recorder || typeof Recorder.isTypeSupported !== 'function') return null;
    // The built-in Opus path records from the first audio block. Windows AAC
    // initialization can drop the beginning or add seconds of silent preroll.
    var formats = [['video/webm;codecs=vp8,opus', 'webm'], ['video/webm', 'webm']];
    return formats.find(function (entry) { return Recorder.isTypeSupported(entry[0]); }) || null;
  }
  function create(host, services) {
    var bridge = host.desktopWindow, current = null;
    var supported = !!(bridge && bridge.beginVideoExport && host.MediaStream && host.navigator && host.navigator.mediaDevices && host.navigator.mediaDevices.getUserMedia && formatFor(host.MediaRecorder));
    var state = { supported: supported, status: 'idle', progress: 0, elapsed: 0, transitionBehavior: 'continue' };
    function publish(patch) {
      state = Object.assign({}, state, patch);
      services.emit('videoExport', Object.assign({}, state));
      return Object.assign({}, state);
    }
    function snapshot() { return Object.assign({}, state); }
    function isCapturing() { return !!current && !current.finishing && !current.cancelled; }
    function blocksCrossfade() { return isCapturing() && current.transitionBehavior === 'save'; }
    function accrue(s) {
      var now = Date.now();
      if (s.recordingSince) s.elapsed += Math.max(0, (now - s.recordingSince) / 1000);
      s.recordingSince = s.recorder && s.recorder.state === 'recording' ? now : 0;
    }
    function disconnectAudio(s) {
      if (s.tap && s.output) { try { s.output.disconnect(s.tap); } catch (_) {} }
      s.tap = null;
    }
    function release(s) {
      if (s.timer) host.clearTimeout(s.timer);
      s.listeners.forEach(function (entry) { entry[2].removeEventListener(entry[0], entry[1]); });
      s.listeners = [];
      disconnectAudio(s);
      if (s.stream) s.stream.getTracks().forEach(function (track) { track.stop(); });
      if (s.unsubscribeFailure) s.unsubscribeFailure();
      s.stream = null;
      if (current === s) current = null;
    }
    async function discard(s, error) {
      if (s.discarding) return s.discarding;
      s.cancelled = true;
      disconnectAudio(s);
      if (s.preparedPlayback && !s.playbackReleased && s.wasPlaying && host.audio === s.audio) {
        // Cancelling preparation must not leave the user's previously playing song paused.
        try { Promise.resolve(s.audio.play()).catch(function () {}); } catch (_) {}
      }
      if (s.recorder && s.recorder.state !== 'inactive') { try { s.recorder.stop(); } catch (_) {} }
      s.discarding = (async function () {
        try { if (s.id) await bridge.cancelVideoExport({ id: s.id }); } catch (_) {}
        // begin may still be waiting for the save dialog. Its continuation owns that late session.
        release(s);
        var message = error ? String(error.message || error) : '';
        return publish({ status: error ? 'error' : 'cancelled', error: message && host.uiText ? host.uiText(message) : message, fileName: '' });
      })();
      return s.discarding;
    }
    function fail(s, error) {
      // A late capture/encoder callback from a released job must not overwrite a newer job.
      if (current !== s || s.cancelled) return;
      void discard(s, error).catch(function () {});
    }
    function queueChunk(s, blob) {
      if (!blob || !blob.size || s.cancelled) return;
      s.pendingBytes += blob.size;
      if (s.pendingBytes > MAX_PENDING_BYTES) { fail(s, new Error('Video export disk is too slow. Please choose another location.')); return; }
      s.writes = s.writes.then(async function () {
        // Chromium may coalesce timeslices while busy. Keep each IPC write below the desktop cap.
        for (var offset = 0; offset < blob.size && !s.cancelled; offset += MAX_CHUNK_BYTES) {
          var bytes = await blob.slice(offset, offset + MAX_CHUNK_BYTES).arrayBuffer();
          if (!s.cancelled) await bridge.appendVideoExportChunk({ id: s.id, sequence: s.sequence++, bytes: bytes });
        }
      }).finally(function () { s.pendingBytes -= blob.size; });
      // Mark rejection handled immediately; finish still awaits the original failed chain.
      s.writes.catch(function (error) { fail(s, error); });
    }
    function syncRecording(s) {
      if (!s.recorder || s.finishing || s.cancelled || s.recorder.state === 'inactive') return;
      var paused = s.audio.paused || s.audio.seeking || s.audio.readyState < 3;
      accrue(s);
      if (paused && s.recorder.state === 'recording') s.recorder.pause();
      if (!paused && s.recorder.state === 'paused') s.recorder.resume();
      s.recordingSince = !paused ? Date.now() : 0;
      if (state.status !== (paused ? 'paused' : 'recording')) publish({ status: paused ? 'paused' : 'recording' });
    }
    function bindMedia(s, media) {
      s.listeners.forEach(function (entry) { entry[2].removeEventListener(entry[0], entry[1]); });
      s.listeners = [];
      s.audio = media;
      function listen(name, callback) { media.addEventListener(name, callback); s.listeners.push([name, callback, media]); }
      ['play', 'playing', 'pause', 'waiting', 'canplay', 'seeked'].forEach(function (name) {
        listen(name, function () { syncRecording(s); });
      });
      listen('seeking', function () {
        if (s.transitionBehavior === 'save') beforeTrackChange();
        else { s.stateAt = 0; syncRecording(s); }
      });
      listen('ended', beforeTrackEnd);
      listen('emptied', function () {
        if (s.transitionBehavior === 'save') beforeTrackChange();
        else syncRecording(s);
      });
    }
    function update(s) {
      if (current !== s || s.cancelled || s.finishing) return;
      try {
        var now = Date.now();
        if (now - s.stateAt >= 200) {
          s.base = services.getState(); s.stateAt = now;
          var nextId = s.base.currentTrack && s.base.currentTrack.id;
          if (!nextId || !host.audio) { void stop(); return; }
          if (nextId !== s.trackId || host.audio !== s.audio) {
            if (s.transitionBehavior === 'save') { void stop(); return; }
            s.trackId = nextId; s.startPosition = 0; s.analysisRevision = -1; s.analysisAt = 0; s.lyricSignature = null;
            s.endingAt = 0;
            if (s.recorder && host.audio !== s.audio) bindMedia(s, host.audio);
            else s.audio = host.audio;
          }
        }
        if (s.recorder) syncRecording(s);
        var playing = !s.audio.paused && !s.audio.ended && !s.audio.seeking && s.audio.readyState >= 3;
        var visualState = Object.assign({}, s.base, { position: s.audio.currentTime || 0, playing: playing });
        var payload = { id: s.id, state: visualState };
        if (s.lyricSignature == null || now - s.lyricsAt >= 700) {
          s.lyricsAt = now;
          var signature = services.getLyricsSignature ? services.getLyricsSignature() : JSON.stringify(services.getLyrics());
          if (signature !== s.lyricSignature) { payload.lyrics = services.getLyrics(); s.lyricSignature = signature; }
        }
        if (playing && host.analyser) {
          if (!s.frequency || s.frequency.length !== host.analyser.frequencyBinCount) s.frequency = new Uint8Array(host.analyser.frequencyBinCount);
          host.analyser.getByteFrequencyData(s.frequency);
          payload.audio = { trackId: s.trackId, position: visualState.position, playing: true, frequency: s.frequency,
            sampleRate: host.audioCtx.sampleRate, fftSize: host.analyser.fftSize };
        }
        if (now - s.analysisAt >= 1000) {
          s.analysisAt = now;
          var analysis = services.getAnalysis();
          if (analysis.revision !== s.analysisRevision) { payload.analysis = analysis; s.analysisRevision = analysis.revision; }
        }
        bridge.updateVideoExport(payload);
        // The queue may hand off asynchronously after ended. Leave room for its next owner to start.
        if (s.recorder && s.endingAt && s.audio.ended && now - s.endingAt > 1500) { void stop(); return; }
        if (s.videoTrack && s.videoTrack.readyState === 'ended') throw new Error('Video export stopped receiving visual frames.');
        if (s.recorder && now - s.progressAt >= 250) {
          s.progressAt = now;
          publish({ elapsed: s.elapsed, progress: Math.max(0, Math.min(1, (visualState.position - s.startPosition) / Math.max(0.01, s.base.duration - s.startPosition))) });
        }
        s.timer = host.setTimeout(function () { update(s); }, 33);
      } catch (error) { fail(s, error); }
    }
    async function waitForFrame(s) {
      var until = Date.now() + 15000;
      while (s.videoTrack.muted && !s.cancelled) {
        if (Date.now() >= until) throw new Error('Video export could not render its first frame.');
        await new Promise(function (resolve) { host.setTimeout(resolve, 25); });
      }
      if (s.cancelled) throw new Error('Video export cancelled.');
      if (s.videoTrack.readyState !== 'live') throw new Error('Video export stopped receiving visual frames.');
    }
    async function start(params) {
      if (current) throw new Error('A video export is already running.');
      if (!supported) throw new Error('Video export requires the Mineradio desktop app.');
      if (PRESETS.indexOf(params.width + 'x' + params.height) < 0 || ['from-start', 'current'].indexOf(params.startMode) < 0) throw new Error('Invalid video export preset.');
      var transitionBehavior = params.transitionBehavior === undefined ? 'continue' : params.transitionBehavior;
      if (['continue', 'save'].indexOf(transitionBehavior) < 0) throw new Error('Invalid recording transition behavior.');
      var initial = services.getState(), media = host.audio;
      if (!initial.currentTrack || !media || !media.src || !(initial.duration > 0)) throw new Error('Choose a playable song before exporting.');
      if (host.crossfadeState && (host.crossfadeState.active || host.crossfadeState.starting)) throw new Error('Wait for the song transition to finish before exporting.');
      var format = formatFor(host.MediaRecorder);
      var s = { id: '', audio: media, trackId: initial.currentTrack.id, width: params.width, height: params.height,
        transitionBehavior: transitionBehavior, lyricSignature: null, lyricsAt: 0,
        listeners: [], writes: Promise.resolve(), sequence: 0, pendingBytes: 0, elapsed: 0,
        stateAt: 0, analysisAt: 0, progressAt: 0, startPosition: params.startMode === 'from-start' ? 0 : initial.position };
      current = s;
      publish({ status: 'preparing', progress: 0, elapsed: 0, error: '', fileName: '', transitionBehavior: transitionBehavior });
      try {
        s.unsubscribeFailure = bridge.onVideoExportFailure(function (failure) { if (failure.id === s.id) fail(s, new Error(failure.error)); });
        var result = await bridge.beginVideoExport({ width: s.width, height: s.height, extension: format[1],
          fileName: initial.currentTrack.title + '-' + s.width + 'x' + s.height + '.' + format[1], visuals: params.visuals,
          state: Object.assign({}, initial, { playing: false, position: s.startPosition }), lyrics: services.getLyrics(), analysis: services.getAnalysis() });
        if (result.cancelled) { if (!s.cancelled) await discard(s); return snapshot(); }
        s.id = result.id;
        if (s.cancelled || current !== s) { await bridge.cancelVideoExport({ id: s.id }); return snapshot(); }
        // Capture only the hidden Folia document via an owner-bound tab token.
        // The native video track goes straight to the encoder without JPEG copies.
        var captureTimer;
        var capture = host.navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: {
          chromeMediaSource: 'tab', chromeMediaSourceId: result.sourceId,
          minWidth: s.width, maxWidth: s.width, minHeight: s.height, maxHeight: s.height,
          minFrameRate: 1, maxFrameRate: 30
        } } }).then(function (stream) {
          if (s.cancelled || current !== s) { stream.getTracks().forEach(function (track) { track.stop(); }); return null; }
          return stream;
        });
        try {
          s.stream = await Promise.race([capture, new Promise(function (_resolve, reject) {
            captureTimer = host.setTimeout(function () { reject(new Error('Video export could not prepare its video stream.')); }, 15000);
          })]);
        } finally { host.clearTimeout(captureTimer); }
        if (!s.stream || s.cancelled || current !== s) {
          if (s.stream) s.stream.getTracks().forEach(function (track) { track.stop(); });
          s.stream = null;
          return snapshot();
        }
        s.videoTrack = s.stream.getVideoTracks()[0];
        if (!s.videoTrack || s.stream.getAudioTracks().length) throw new Error('Video export received an invalid video stream.');
        var check = services.getState();
        if (!check.currentTrack || check.currentTrack.id !== s.trackId || host.audio !== media) throw new Error('The song changed while preparing the export. Please try again.');
        // A dismissed save dialog has no transport side effects. Only now prepare the shared owner.
        host.initAudio(); await host.resumeAudioAnalysis();
        if (s.cancelled) return snapshot();
        s.wasPlaying = !media.paused;
        media.pause(); s.preparedPlayback = true;
        if (params.startMode === 'from-start' || media.ended) media.currentTime = 0;
        s.startPosition = media.currentTime || 0;
        if (typeof host.syncBeatMapPlaybackCursor === 'function') host.syncBeatMapPlaybackCursor(s.startPosition);
        s.base = services.getState(); s.stateAt = Date.now();
        s.output = host.audioChain.output; s.tap = host.audioCtx.createMediaStreamDestination(); s.output.connect(s.tap);
        s.tap.stream.getAudioTracks().forEach(function (track) { s.stream.addTrack(track); });
        update(s);
        await waitForFrame(s);
        var mediaReadyUntil = Date.now() + 15000;
        while (!s.cancelled && (media.seeking || media.readyState < 3)) {
          if (Date.now() >= mediaReadyUntil) throw new Error('The song could not prepare audio for export.');
          await new Promise(function (resolve) { host.setTimeout(resolve, 25); });
        }
        if (s.cancelled) return snapshot();
        s.recorder = new host.MediaRecorder(s.stream, { mimeType: format[0], audioBitsPerSecond: 320000,
          videoBitsPerSecond: s.width * s.height > 1000000 ? 14000000 : 8000000 });
        s.recorder.ondataavailable = function (event) { queueChunk(s, event.data); };
        s.recorder.onerror = function (event) { fail(s, event.error || new Error('Video encoding failed.')); };
        s.stopped = new Promise(function (resolve) { s.recorder.onstop = resolve; });
        bindMedia(s, media);
        // The start event waits for the first muxed bytes, which may follow a
        // slow GPU frame. Waiting for it here would record a silent introduction.
        s.recorder.start(1000); s.recorder.pause();
        publish({ status: 'paused', fileName: result.fileName });
        s.playbackReleased = true;
        await media.play(); syncRecording(s);
        return snapshot();
      } catch (error) {
        if (!s.cancelled) await discard(s, error);
        return snapshot();
      }
    }
    function stop() {
      var s = current;
      if (!s) return Promise.resolve(snapshot());
      if (s.finishing) return s.finishing;
      if (!s.recorder) return discard(s);
      // Stop synchronously before the host can start the next deck, then await its final data event.
      accrue(s);
      s.recordingSince = 0;
      disconnectAudio(s);
      if (s.timer) host.clearTimeout(s.timer);
      publish({ status: 'saving', elapsed: s.elapsed });
      if (s.recorder.state !== 'inactive') s.recorder.stop();
      s.finishing = (async function () {
        try {
          await s.stopped; await s.writes;
          if (s.cancelled) return snapshot();
          var result = await bridge.finishVideoExport({ id: s.id });
          if (s.cancelled || current !== s) return snapshot();
          release(s); return publish({ status: 'saved', fileName: result.fileName, error: '' });
        } catch (error) { return discard(s, error); }
      })();
      return s.finishing;
    }
    function cancel() { return current ? discard(current) : Promise.resolve(snapshot()); }
    function beforeTrackChange() {
      if (!current) return;
      if (!current.recorder || current.transitionBehavior === 'save') void stop().catch(function () {});
      else current.stateAt = 0;
    }
    function beforeTrackEnd() {
      if (!current) return;
      if (current.transitionBehavior === 'save') beforeTrackChange();
      else { current.endingAt = Date.now(); syncRecording(current); }
    }
    host.addEventListener('pagehide', function () { void cancel(); });
    return { getState: snapshot, start: start, stop: stop, cancel: cancel, isCapturing: isCapturing,
      blocksCrossfade: blocksCrossfade, beforeTrackChange: beforeTrackChange, beforeTrackEnd: beforeTrackEnd };
  }
  global.MineradioVideoExport = Object.freeze({ create: create });
})(window);
