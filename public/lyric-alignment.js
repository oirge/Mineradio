(function(global) {
  'use strict';
  var applying = false, sequence = 0, lookupKey = '';
  var activeJob = null, pendingJob = null, lastError = '';
  var attempted = new Set(), retries = new Map(), boundMedia = new WeakSet();

  function currentContext() {
    var song = global.currentLyricSong && global.currentLyricSong();
    if (!song || song.type !== 'local') return null;
    var media = global.audio;
    var urls = [media && (media.currentSrc || media.src), song.localFileUrl,
      song.localFile && (song.localFile.url || song.localFile.fileUrl)];
    var file = String(song.localFilePathAbsolute || song.localPath ||
      (song.localFile && (song.localFile.fullPath || song.localFile.path)) || '');
    var proxy = null;
    for (var i = 0; i < urls.length; i++) {
      try {
        var candidate = new URL(urls[i] || '', global.location.href);
        if (candidate.pathname === '/api/local-file' && candidate.searchParams.get('token')) {
          proxy = candidate;
          break;
        }
      } catch (_) {}
    }
    if (!proxy) return null;
    var playingPath = proxy.searchParams.get('path') || '';
    if (file && playingPath && file.replace(/\\/g, '/').toLowerCase() !== playingPath.replace(/\\/g, '/').toLowerCase()) return null;
    return { path: playingPath || file, token: proxy.searchParams.get('token'),
      trackToken: global.trackSwitchToken };
  }

  function stillCurrent(context) {
    var now = currentContext();
    return !!(now && context && now.path === context.path && now.trackToken === context.trackToken);
  }

  async function request(context, action, data) {
    var response;
    try {
      response = await global.fetch('/api/lyrics-alignment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action: action, path: context.path, token: context.token }, data || {})),
      });
    } catch (error) {
      error.lyricRetryable = true;
      throw error;
    }
    var result = await response.json();
    if (!response.ok || result.ok === false) {
      var failure = new Error(result.message || result.error || 'LYRIC_ALIGNMENT_FAILED');
      failure.lyricRetryable = response.status === 429 || response.status >= 500;
      throw failure;
    }
    return result;
  }

  function lyricRows() {
    var source = global.lyricsLines || [], rows = [];
    for (var i = 0; i < source.length; i++) {
      var line = source[i];
      if (!line || line.fallback || !line.text) continue;
      var row = { text: line.text, translation: line.translation || '' };
      var audioAligned = /^audio-(?:aligned|corrected)$/.test(line.source || '');
      if (audioAligned) {
        if (Number.isFinite(line.alignmentHintStart)) row.hintStart = line.alignmentHintStart;
        if (Number.isFinite(line.alignmentHintEnd)) row.hintEnd = line.alignmentHintEnd;
      }
      if (line.untimed && Number.isFinite(line.t)) {
        row.displayStart = line.t;
        if (Number.isFinite(line.duration) && line.duration > 0) row.displayEnd = line.t + line.duration;
      } else if (!audioAligned && !line.untimed && Number.isFinite(line.t)) {
        row.hintStart = line.t;
        var next = source[i + 1];
        if (next && !next.untimed && Number.isFinite(next.t) && next.t > line.t) row.hintEnd = next.t;
      }
      rows.push(row);
    }
    return rows;
  }

  function sungText(row) {
    return String(row.text || '').split('\n')[0].trim();
  }

  function lyricKey(rows) {
    return JSON.stringify(rows.map(function(row) {
      return [sungText(row), row.hintStart == null ? null : row.hintStart,
        row.hintEnd == null ? null : row.hintEnd];
    }));
  }

  function hasNativeTiming() {
    return !!global.lyricsHasNativeKaraoke &&
      !/^audio-(?:aligned|corrected)$/.test(global.lyricsTimingSource || '');
  }

  function stateLines(alignment, originalRows) {
    var sameRows = originalRows && originalRows.length === alignment.lines.length &&
      alignment.lines.every(function(line, index) {
        return sungText(originalRows[index]) === line.text;
      });
    return alignment.lines.map(function(line, index) {
      var covered = 0;
      var complete = (alignment.corrected || !(line.reviewReasons || []).length) &&
        line.words.length > 0 && line.words.every(function(word) {
        var missing = /[\p{L}\p{N}]/u.test(line.text.slice(covered, word.c0));
        covered = word.c1;
        return !missing && Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start &&
          (alignment.corrected || !(word.reviewReasons || []).length);
      });
      complete = complete && !/[\p{L}\p{N}]/u.test(line.text.slice(covered));
      // A cumulative mask must not light up untimed characters before a later word.
      var words = (complete ? line.words : []).map(function(word) {
        return { text: word.text, t: word.start, d: word.end - word.start,
          c0: word.c0, c1: word.c1, reviewReasons: word.reviewReasons || [] };
      });
      var originalIndex = !sameRows && Number.isInteger(line.sourceIndex) ? line.sourceIndex : index;
      var original = originalRows && originalRows[originalIndex];
      if (original && sungText(original) !== line.text) original = null;
      var hintStart = original ? original.hintStart : line.hintStart;
      var hintEnd = original ? original.hintEnd : line.hintEnd;
      if (!Number.isFinite(hintStart) || hintStart < 0 || hintStart >= alignment.audioDuration) hintStart = null;
      if (!Number.isFinite(hintEnd) || hintEnd <= (hintStart || 0) || hintEnd > alignment.audioDuration) hintEnd = null;
      var displayStart = original && Number.isFinite(original.displayStart) ? original.displayStart : null;
      var displayEnd = original && Number.isFinite(original.displayEnd) ? original.displayEnd : null;
      var start = !complete && hintStart !== null ? hintStart
        : !complete && displayStart !== null ? displayStart : line.start;
      var end = !complete && hintEnd !== null ? hintEnd
        : !complete && displayEnd !== null ? displayEnd : line.end;
      return { text: line.text, t: start === null ? Infinity : start,
        duration: end === null || start === null ? 0 : Math.max(0, end - start),
        translation: original ? original.translation || String(original.text).split('\n').slice(1).join('\n') : line.translation || '',
        words: words, charCount: line.text.length,
        untimed: !complete && hintStart === null && displayStart !== null || !Number.isFinite(start),
        alignmentHintStart: hintStart, alignmentHintEnd: hintEnd,
        source: alignment.corrected ? 'audio-corrected' : 'audio-aligned',
        reviewReasons: line.reviewReasons || [] };
    });
  }

  function applyRecord(record, context, expectedKey) {
    if (!stillCurrent(context) || hasNativeTiming() || expectedKey !== lyricKey(lyricRows())) return false;
    var duration = global.audio && global.audio.duration;
    if (Number.isFinite(duration) && duration > 0 && Math.abs(duration - record.alignment.audioDuration) > 0.35) return false;
    var lines = stateLines(record.alignment, lyricRows());
    sequence++;
    applying = true;
    try {
      global.applyLyricsState(lines, lines.some(function(line) { return line.words.length > 0; }),
        record.alignment.corrected ? 'audio-corrected' : 'audio-aligned');
    } finally { applying = false; }
    return true;
  }

  function languageForRows(rows) {
    var text = rows.map(sungText).join('');
    if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'Japanese';
    if (/\p{Script=Hangul}/u.test(text)) return 'Korean';
    return /\p{Script=Han}/u.test(text) ? 'Chinese' : 'English';
  }

  function queueBackground(context, rows) {
    if (!rows.length || hasNativeTiming()) return;
    var signature = lyricKey(rows);
    var key = context.path + ':' + context.trackToken + ':' + signature;
    if (attempted.has(key)) return;
    pendingJob = { context: context, rows: rows, key: key, signature: signature };
    void drainBackground();
  }

  function retryTransient(job, error) {
    if (!error.lyricRetryable || !stillCurrent(job.context) || hasNativeTiming()) return;
    var count = retries.get(job.key) || 0;
    if (count >= 2) return;
    retries.set(job.key, count + 1);
    if (retries.size > 128) retries.delete(retries.keys().next().value);
    global.setTimeout(function() {
      if (!stillCurrent(job.context) || hasNativeTiming() || job.signature !== lyricKey(lyricRows())) return;
      attempted.delete(job.key);
      lookupKey = '';
      void onLyricsChanged();
    }, 30000 * (count + 1));
  }

  async function drainBackground() {
    if (activeJob || !pendingJob) return;
    var job = pendingJob;
    pendingJob = null;
    if (!stillCurrent(job.context) || hasNativeTiming() || job.signature !== lyricKey(lyricRows())) return;
    activeJob = job;
    attempted.add(job.key);
    if (attempted.size > 128) attempted.delete(attempted.values().next().value);
    lastError = '';
    try {
      var result = await request(job.context, 'ensure', {
        lyrics: job.rows, language: languageForRows(job.rows),
      });
      while (result.status === 'running' || result.status === 'queued') {
        job.stage = result.stage || result.status;
        await new Promise(function(resolve) { global.setTimeout(resolve, 1200); });
        result = await request(job.context, 'status', { id: result.id });
      }
      if (result.status === 'skipped') return;
      if (result.status !== 'complete' || !result.result) throw new Error(result.message || result.error || 'LYRIC_ALIGNMENT_FAILED');
      retries.delete(job.key);
      applyRecord(result.result, job.context, job.signature);
    } catch (error) {
      lastError = String(error.message || error);
      retryTransient(job, error);
    } finally {
      activeJob = null;
      void drainBackground();
    }
  }

  async function onLyricsChanged() {
    if (applying) return;
    var context = currentContext();
    if (!context || hasNativeTiming()) { sequence++; lookupKey = ''; pendingJob = null; return; }
    var rows = lyricRows();
    if (!rows.length) { sequence++; lookupKey = ''; pendingJob = null; return; }
    var signature = lyricKey(rows);
    var key = context.path + ':' + context.trackToken + ':' + signature;
    if (key === lookupKey) return;
    lookupKey = key;
    var ticket = ++sequence;
    try {
      var result = await request(context, 'lookup', { lyrics: rows });
      if (ticket !== sequence || !stillCurrent(context) || signature !== lyricKey(lyricRows()) || hasNativeTiming()) return;
      if (result.hit && result.matches && applyRecord(result, context, signature)) return;
      queueBackground(context, rows);
    } catch (error) {
      if (ticket !== sequence || !stillCurrent(context)) return;
      lastError = String(error.message || error);
      // Let the service decide whether a missing or unreadable cache can be replaced.
      queueBackground(context, rows);
    }
  }

  function bindAudio(media) {
    if (!media || boundMedia.has(media)) return;
    boundMedia.add(media);
    media.addEventListener('loadedmetadata', function() {
      if (media !== global.audio) return;
      lookupKey = '';
      void onLyricsChanged();
    });
    media.addEventListener('emptied', function() {
      if (media !== global.audio) return;
      sequence++; lookupKey = ''; pendingJob = null;
    });
  }

  global.MineradioLyricAlignment = {
    onLyricsChanged: onLyricsChanged, bindAudio: bindAudio,
    backgroundState: function() {
      return { running: !!activeJob, pending: !!pendingJob,
        stage: activeJob && activeJob.stage || '', lastError: lastError };
    },
  };
  bindAudio(global.audio);
  void onLyricsChanged();
})(window);
