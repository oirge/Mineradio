/* Local Insights: preference-scored Daily Recommendation Mix & Listening Activity Report. */
(function (global) {
  'use strict';

  var DAILY_STORE_KEY = 'mineradio-listen-daily-v1';
  var MAX_DAILY_ENTRIES = 420;
  var RECENT_COOLDOWN_MS = 3600000;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function localDayKey(timestamp) {
    var d = new Date(timestamp || Date.now());
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function songStatsKey(song) {
    if (!song) return '';
    if (typeof global.queueItemKey === 'function') return global.queueItemKey(song);
    if (song.localKey) return 'local:' + song.localKey;
    if (song.id != null && song.id !== '') return String(song.id);
    return String((song.name || song.title || '') + '|' + (song.artist || ''));
  }

  function rankCurve(songs, valueByKey, maxDelta, sign) {
    var entries = [];
    for (var i = 0; i < songs.length; i += 1) {
      var key = songStatsKey(songs[i]);
      var v = key ? Number(valueByKey[key] || 0) : 0;
      if (v > 0) entries.push({ key: key, val: v });
    }
    if (!entries.length) return Object.create(null);
    entries.sort(function (a, b) { return b.val - a.val; });
    var total = entries.length;
    var out = Object.create(null);
    for (var rank = 0; rank < entries.length; rank += 1) {
      out[entries[rank].key] = sign * maxDelta * (1 - Math.sqrt(rank / total));
    }
    return out;
  }

  /**
   * Compute per-track affinity scores (baseline 1.0) using likes, sqrt-decay play & duration ranks,
   * artist like affinity, incomplete-play penalty, and 1h recency cooldown.
   */
  function computePreferenceScores(songs, statsState, isLikedFn, nowMs) {
    var list = Array.isArray(songs) ? songs : [];
    var stats = statsState && typeof statsState === 'object' ? statsState : {};
    var songStats = stats.songs || {};
    var now = typeof nowMs === 'number' ? nowMs : Date.now();

    var playsByKey = Object.create(null);
    var msByKey = Object.create(null);
    var incompleteByKey = Object.create(null);
    var artistTotals = Object.create(null);
    var artistLikes = Object.create(null);
    var likedKeys = Object.create(null);

    for (var i = 0; i < list.length; i += 1) {
      var song = list[i];
      if (!song) continue;
      var key = songStatsKey(song);
      if (!key) continue;
      var s = songStats[key];
      if (s) {
        var plays = Math.max(0, Number(s.plays) || 0);
        var ms = Math.max(0, Number(s.listenMs) || 0);
        var completed = Math.max(0, Number(s.completed) || 0);
        playsByKey[key] = plays;
        msByKey[key] = ms;
        if (plays > completed) incompleteByKey[key] = plays - completed;
      }
      var liked = typeof isLikedFn === 'function' ? !!isLikedFn(song) : false;
      if (liked) likedKeys[key] = true;
      var artist = String(song.artist || '').trim();
      if (artist) {
        artistTotals[artist] = (artistTotals[artist] || 0) + 1;
        if (liked) artistLikes[artist] = (artistLikes[artist] || 0) + 1;
      }
    }

    var playBoost = rankCurve(list, playsByKey, 0.20, 1);
    var msBoost = rankCurve(list, msByKey, 0.20, 1);
    var skipPenalty = rankCurve(list, incompleteByKey, 0.10, -1);

    var scores = Object.create(null);
    for (var j = 0; j < list.length; j += 1) {
      var item = list[j];
      var itemKey = item ? songStatsKey(item) : '';
      if (!itemKey) continue;
      var score = 1.0;
      if (likedKeys[itemKey]) score *= 1.5;
      score += playBoost[itemKey] || 0;
      score += msBoost[itemKey] || 0;
      var artistName = String(item.artist || '').trim();
      if (artistName && artistTotals[artistName] && artistLikes[artistName]) {
        score += (artistLikes[artistName] / artistTotals[artistName]) * 0.10;
      }
      score += skipPenalty[itemKey] || 0;
      var lastAt = songStats[itemKey] ? Number(songStats[itemKey].lastPlayedAt) || 0 : 0;
      if (lastAt && now - lastAt < RECENT_COOLDOWN_MS) score *= 0.1;
      scores[itemKey] = Math.max(0.05, score);
    }
    return scores;
  }

  function pickRecommendedTracks(songs, statsState, opts) {
    var list = Array.isArray(songs) ? songs : [];
    if (!list.length) return [];
    opts = opts || {};
    var limit = Math.max(1, Number(opts.limit) || 30);
    var exploration = Math.min(1, Math.max(0, opts.exploration == null ? 0.3 : Number(opts.exploration)));
    var rng = typeof opts.random === 'function' ? opts.random : Math.random;
    var scores = computePreferenceScores(list, statsState, opts.isLiked, opts.nowMs);
    var scored = [];
    for (var i = 0; i < list.length; i += 1) {
      var song = list[i];
      var key = songStatsKey(song);
      if (!key) continue;
      var pref = scores[key] || 1.0;
      var rand = rng() * 2.0;
      scored.push({ song: song, total: pref * (1 - exploration) + rand * exploration, preference: pref });
    }
    scored.sort(function (a, b) { return b.total - a.total; });
    var picked = [];
    for (var k = 0; k < scored.length && picked.length < limit; k += 1) picked.push(scored[k].song);
    return picked;
  }

  function readDailyBuckets() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(DAILY_STORE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_e) {
      return {};
    }
  }

  function writeDailyBuckets(buckets) {
    var keys = Object.keys(buckets || {}).sort();
    if (keys.length > MAX_DAILY_ENTRIES) {
      var keep = {};
      for (var i = keys.length - MAX_DAILY_ENTRIES; i < keys.length; i += 1) keep[keys[i]] = buckets[keys[i]];
      buckets = keep;
    }
    try {
      if (typeof global.setPersistentLocalStorageItem === 'function') {
        global.setPersistentLocalStorageItem(DAILY_STORE_KEY, JSON.stringify(buckets));
      } else if (global.localStorage) {
        global.localStorage.setItem(DAILY_STORE_KEY, JSON.stringify(buckets));
      }
    } catch (_e) {}
  }

  function notePlay(record) {
    if (!record || !record.playedAt || !(Number(record.listenMs) > 0)) return;
    var buckets = readDailyBuckets();
    var day = localDayKey(record.playedAt);
    buckets[day] = Math.max(0, Number(buckets[day]) || 0) + Math.round(Number(record.listenMs) || 0);
    writeDailyBuckets(buckets);
  }

  function clearDaily() {
    try {
      if (global.localStorage) global.localStorage.removeItem(DAILY_STORE_KEY);
    } catch (_e) {}
  }

  function buildListenReport(input) {
    input = input || {};
    var range = ['day', 'week', 'month', 'year'].indexOf(input.range) >= 0 ? input.range : 'week';
    var now = typeof input.nowMs === 'number' ? input.nowMs : Date.now();
    var today = new Date(now);
    today.setHours(0, 0, 0, 0);
    var daysCount = range === 'day' ? 1 : range === 'week' ? 7 : range === 'month' ? 30 : 365;
    var startMs = today.getTime() - (daysCount - 1) * 86400000;

    var daily = Object.assign({}, input.dailyBuckets || {});
    var history = Array.isArray(input.history) ? input.history : [];
    // Backfill recent history when daily store doesn't yet include older recorded sessions.
    var historyDayTotals = Object.create(null);
    for (var i = 0; i < history.length; i += 1) {
      var item = history[i];
      if (!item || !item.playedAt) continue;
      var k = localDayKey(item.playedAt);
      historyDayTotals[k] = (historyDayTotals[k] || 0) + Math.max(0, Number(item.listenMs) || 0);
    }
    var hKeys = Object.keys(historyDayTotals);
    for (var hk = 0; hk < hKeys.length; hk += 1) {
      var dk = hKeys[hk];
      if (!daily[dk]) daily[dk] = historyDayTotals[dk];
    }

    var heatmapDays = Math.max(daysCount, 112); // Always show at least 16 weeks for the calendar grid.
    var cells = [];
    var maxDayMs = 0;
    var rangeTotalMs = 0;
    var activeDays = 0;
    var peakDayMs = 0;
    for (var offset = heatmapDays - 1; offset >= 0; offset -= 1) {
      var ts = today.getTime() - offset * 86400000;
      var key = localDayKey(ts);
      var ms = Math.max(0, Number(daily[key]) || 0);
      if (ms > maxDayMs) maxDayMs = ms;
      if (ts >= startMs) {
        rangeTotalMs += ms;
        if (ms > 0) activeDays += 1;
        if (ms > peakDayMs) peakDayMs = ms;
      }
      cells.push({ dayKey: key, timestamp: ts, ms: ms, inRange: ts >= startMs });
    }
    for (var c = 0; c < cells.length; c += 1) {
      var ratio = maxDayMs > 0 && cells[c].ms > 0 ? cells[c].ms / maxDayMs : 0;
      cells[c].level = ratio === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
    }

    var songsObj = input.songs || {};
    var topSongs = [];
    var songKeys = Object.keys(songsObj);
    var distinctSongs = 0;
    for (var s = 0; s < songKeys.length; s += 1) {
      var stat = songsObj[songKeys[s]];
      if (!stat || !(Number(stat.plays) > 0 || Number(stat.listenMs) > 0)) continue;
      distinctSongs += 1;
      topSongs.push({
        key: stat.key || songKeys[s],
        name: stat.name || '未知歌曲',
        artist: stat.artist || '',
        plays: Number(stat.plays) || 0,
        listenMs: Number(stat.listenMs) || 0,
        completed: Number(stat.completed) || 0,
      });
    }
    topSongs.sort(function (a, b) {
      if (b.listenMs !== a.listenMs) return b.listenMs - a.listenMs;
      return b.plays - a.plays;
    });

    return {
      range: range,
      totalMs: rangeTotalMs,
      activeDays: activeDays,
      distinctSongs: distinctSongs,
      avgPerActiveDayMs: activeDays > 0 ? Math.round(rangeTotalMs / activeDays) : 0,
      peakDayMs: peakDayMs,
      cells: cells,
      topSongs: topSongs.slice(0, 30),
    };
  }

  var activeReportRange = 'week';

  function tr(text) { return typeof global.uiText === 'function' ? global.uiText(text) : text; }
  function esc(text) {
    if (typeof global.escHtml === 'function') return global.escHtml(text);
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function fmtDur(ms) {
    if (typeof global.formatListenDurationText === 'function') return global.formatListenDurationText(ms);
    var mins = Math.round(Math.max(0, ms || 0) / 60000);
    return mins >= 60 ? Math.floor(mins / 60) + ' h ' + (mins % 60) + ' m' : mins + ' min';
  }

  function renderListenReportModal(range) {
    if (range) activeReportRange = range;
    var modal = global.document && global.document.getElementById('listen-report-modal');
    if (!modal) return;
    var state = typeof global.ensureListenStatsState === 'function' ? global.ensureListenStatsState() : { history: [], songs: {}, artists: {} };
    var report = buildListenReport({
      range: activeReportRange,
      history: state.history,
      songs: state.songs,
      artists: state.artists,
      dailyBuckets: readDailyBuckets(),
    });

    modal.querySelectorAll('[data-report-range]').forEach(function (btn) {
      var selected = btn.getAttribute('data-report-range') === report.range;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });

    var kpis = modal.querySelector('#listen-report-kpis');
    if (kpis) {
      kpis.innerHTML =
        '<div class="lr-kpi"><small>' + esc(tr('累计听歌时长')) + '</small><strong>' + esc(fmtDur(report.totalMs)) + '</strong></div>' +
        '<div class="lr-kpi"><small>' + esc(tr('活跃天数')) + '</small><strong>' + report.activeDays + '</strong></div>' +
        '<div class="lr-kpi"><small>' + esc(tr('日均收听')) + '</small><strong>' + esc(fmtDur(report.avgPerActiveDayMs)) + '</strong></div>' +
        '<div class="lr-kpi"><small>' + esc(tr('单日最高')) + '</small><strong>' + esc(fmtDur(report.peakDayMs)) + '</strong></div>';
    }

    var heatmap = modal.querySelector('#listen-report-heatmap');
    if (heatmap) {
      var cellHtml = '';
      for (var c = 0; c < report.cells.length; c += 1) {
        var cell = report.cells[c];
        cellHtml += '<button type="button" class="lr-heat-cell lv-' + cell.level + (cell.inRange ? '' : ' muted') + '" ' +
          'data-day-key="' + esc(cell.dayKey) + '" title="' + esc(cell.dayKey + ' · ' + fmtDur(cell.ms)) + '" aria-label="' + esc(cell.dayKey) + '"></button>';
      }
      heatmap.innerHTML = cellHtml;
    }

    var topEl = modal.querySelector('#listen-report-top');
    if (topEl) {
      if (!report.topSongs.length) {
        topEl.innerHTML = '<div class="lr-empty">' + esc(tr('还没有听歌记录，播完或收听半首以上会自动统计。')) + '</div>';
      } else {
        var rowsHtml = '';
        for (var t = 0; t < report.topSongs.length; t += 1) {
          var row = report.topSongs[t];
          rowsHtml += '<button type="button" class="lr-top-row" data-report-song-key="' + esc(row.key) + '">' +
            '<span class="lr-rank">' + (t + 1) + '</span>' +
            '<span class="lr-track"><strong>' + esc(row.name) + '</strong><small>' + esc(row.artist || tr('未知歌手')) + '</small></span>' +
            '<span class="lr-metric">' + esc(fmtDur(row.listenMs)) + '</span>' +
          '</button>';
        }
        topEl.innerHTML = rowsHtml;
      }
    }
  }

  function openListenReportModal() {
    var modal = global.document && global.document.getElementById('listen-report-modal');
    if (!modal) return;
    renderListenReportModal(activeReportRange);
    if (typeof global.openGsapModal === 'function') global.openGsapModal(modal);
    else modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeListenReportModal() {
    var modal = global.document && global.document.getElementById('listen-report-modal');
    if (!modal) return;
    if (typeof global.closeGsapModal === 'function') global.closeGsapModal(modal);
    else modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  function playRecommendedDailyMix() {
    var library = Array.isArray(global.localLibrarySongs) && global.localLibrarySongs.length
      ? global.localLibrarySongs : (Array.isArray(global.playQueue) ? global.playQueue : []);
    if (!library.length) {
      if (typeof global.showToast === 'function') global.showToast(tr('请先导入本地歌曲再生成推荐混音'));
      return false;
    }
    var state = typeof global.ensureListenStatsState === 'function' ? global.ensureListenStatsState() : { songs: {} };
    var likedFn = typeof global.isSongLiked === 'function' ? global.isSongLiked : null;
    var mix = pickRecommendedTracks(library, state, { limit: 30, exploration: 0.3, isLiked: likedFn });
    if (!mix.length) return false;
    var cloned = typeof global.cloneSongList === 'function' ? global.cloneSongList(mix) : mix.slice();
    global.playQueue = cloned;
    global.currentIdx = 0;
    if (typeof global.markQueueContentChanged === 'function') global.markQueueContentChanged();
    if (typeof global.safeRenderQueuePanel === 'function') global.safeRenderQueuePanel('daily-mix');
    if (typeof global.playQueueAt === 'function') global.playQueueAt(0);
    if (typeof global.showToast === 'function') global.showToast(tr('已为你生成今日偏好推荐混音'));
    return true;
  }

  function initLocalInsightsControls() {
    var modal = global.document && global.document.getElementById('listen-report-modal');
    if (!modal || modal._lrBound) return;
    modal._lrBound = true;
    modal.addEventListener('click', function (ev) {
      if (ev.target === modal) { closeListenReportModal(); return; }
      var rangeBtn = ev.target && ev.target.closest ? ev.target.closest('[data-report-range]') : null;
      if (rangeBtn) {
        renderListenReportModal(rangeBtn.getAttribute('data-report-range'));
        return;
      }
      var cell = ev.target && ev.target.closest ? ev.target.closest('[data-day-key]') : null;
      if (cell) {
        var note = modal.querySelector('#listen-report-day-note');
        if (note) note.textContent = cell.getAttribute('title') || '';
        return;
      }
      var row = ev.target && ev.target.closest ? ev.target.closest('[data-report-song-key]') : null;
      if (row) {
        var targetKey = row.getAttribute('data-report-song-key');
        var libs = [global.playQueue || [], global.localLibrarySongs || []];
        for (var l = 0; l < libs.length; l += 1) {
          for (var i = 0; i < libs[l].length; i += 1) {
            if (songStatsKey(libs[l][i]) === targetKey) {
              closeListenReportModal();
              if (l === 0 && typeof global.playQueueAt === 'function') {
                global.currentIdx = i;
                global.playQueueAt(i);
              } else if (typeof global.playLocalLibrarySong === 'function') {
                global.playLocalLibrarySong(i, 'library');
              }
              return;
            }
          }
        }
      }
    });
    global.document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && modal.classList.contains('show')) closeListenReportModal();
    });
  }

  global.MineradioLocalInsights = Object.freeze({
    DAILY_STORE_KEY: DAILY_STORE_KEY,
    computePreferenceScores: computePreferenceScores,
    pickRecommendedTracks: pickRecommendedTracks,
    buildListenReport: buildListenReport,
    notePlay: notePlay,
    clearDaily: clearDaily,
  });
  global.openListenReportModal = openListenReportModal;
  global.closeListenReportModal = closeListenReportModal;
  global.playRecommendedDailyMix = playRecommendedDailyMix;
  global.initLocalInsightsControls = initLocalInsightsControls;
}(typeof window !== 'undefined' ? window : globalThis));
