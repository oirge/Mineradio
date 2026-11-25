'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const insightsCode = fs.readFileSync(path.join(__dirname, '../public/local-insights.js'), 'utf8');
const skipperCode = fs.readFileSync(path.join(__dirname, '../public/silence-skipper.js'), 'utf8');

function loadInsightsHarness() {
  const store = new Map();
  const global = {
    Math, Date, Object, Array, Number, String, JSON,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setPersistentLocalStorageItem: (k, v) => store.set(k, String(v)),
    queueItemKey: (song) => (song.localKey ? 'local:' + song.localKey : String(song.id || '')),
  };
  vm.runInNewContext(insightsCode, global);
  return { api: global.MineradioLocalInsights, store, global };
}

test('computePreferenceScores 结合收藏、完播和近期冷却计算推荐优先级', () => {
  const { api } = loadInsightsHarness();
  const now = 1_700_000_000_000;
  const songs = [
    { localKey: 'liked-top', name: 'Liked Track', artist: 'Artist A' },
    { localKey: 'skipped-recent', name: 'Skipped Recent', artist: 'Artist B' },
    { localKey: 'neutral', name: 'Neutral', artist: 'Artist C' },
  ];
  const stats = {
    songs: {
      'local:liked-top': { plays: 10, listenMs: 2_000_000, completed: 10, lastPlayedAt: now - 7_200_000 },
      'local:skipped-recent': { plays: 5, listenMs: 120_000, completed: 0, lastPlayedAt: now - 300_000 },
    },
  };
  const scores = api.computePreferenceScores(songs, stats, (s) => s.localKey === 'liked-top', now);
  assert.ok(scores['local:liked-top'] > scores['local:neutral'], '收藏与高完播歌曲评分应高于普通曲目');
  assert.ok(scores['local:skipped-recent'] < scores['local:neutral'], '近期跳过曲目应大幅降权');

  const mix = api.pickRecommendedTracks(songs, stats, {
    limit: 2,
    exploration: 0,
    isLiked: (s) => s.localKey === 'liked-top',
    nowMs: now,
  });
  assert.equal(mix[0].localKey, 'liked-top');
});

test('buildListenReport 聚合活跃天数、总时长与 16 周以上活动热力图', () => {
  const { api } = loadInsightsHarness();
  const now = new Date(2026, 9, 15, 14, 0, 0).getTime();
  const todayKey = '2026-10-15';
  const yesterdayKey = '2026-10-14';
  const oldKey = '2026-10-01';
  const report = api.buildListenReport({
    range: 'week',
    nowMs: now,
    dailyBuckets: {
      [todayKey]: 1_200_000,
      [yesterdayKey]: 600_000,
      [oldKey]: 9_000_000,
    },
    songs: {
      a: { key: 'a', name: 'Song A', artist: 'Artist A', plays: 4, listenMs: 900_000, completed: 4 },
      b: { key: 'b', name: 'Song B', artist: 'Artist B', plays: 2, listenMs: 300_000, completed: 1 },
    },
  });
  assert.equal(report.totalMs, 1_800_000, '周统计只累计最近 7 天时长');
  assert.equal(report.activeDays, 2);
  assert.equal(report.avgPerActiveDayMs, 900_000);
  assert.equal(report.peakDayMs, 1_200_000);
  assert.ok(report.cells.length >= 112);
  assert.equal(report.topSongs[0].name, 'Song A');
});

test('SilenceSkipper 跳过曲首长静音、跳过曲尾静音并严格尊重 20 秒保护窗和冷却期', () => {
  const seeks = [];
  let rms = 0;
  let state = { trackKey: 'track-1', paused: false, ready: true, currentTime: 0.2, duration: 180 };
  const global = { Math, Number, String, Date, Uint8Array };
  vm.runInNewContext(skipperCode, global);

  const skipper = global.MineradioSilenceSkipper.create({
    enabled: true,
    getRms: () => rms,
    getPlaybackState: () => state,
    seekTo: (sec) => seeks.push(sec),
  });

  // 累积 2.4 秒仍未达到 2.5 秒阈值，不应跳过合理前奏留白。
  for (let i = 0; i < 12; i += 1) {
    assert.equal(skipper.step(1000 + i * 220), false);
  }
  assert.equal(seeks.length, 0);

  // 第 13 拍达到 2600ms >= 2500ms，触发首次前奏跳过。
  assert.equal(skipper.step(5000), 'head-seek');
  assert.equal(seeks.length, 1);
  assert.ok(seeks[0] > 1.5);

  // 冷却期内（<320ms）即使仍为静音也不重复连续 seek。
  assert.equal(skipper.step(5100), false);
  assert.equal(seeks.length, 1);

  // 一旦检测到正常有声信号，曲首状态立即结束，不再误跳歌曲安静间奏。
  rms = 0.08;
  assert.equal(skipper.step(6000), false);
  rms = 0.001;
  state.currentTime = 12;
  assert.equal(skipper.step(10000), false);
  assert.equal(seeks.length, 1);

  // 进入最后 3 秒窗口且持续静音 800ms，跳转到曲尾留给循环模式接管。
  state.currentTime = 178.0;
  assert.equal(skipper.step(20000), false);
  assert.equal(skipper.step(20300), false);
  assert.equal(skipper.step(20600), false);
  assert.equal(skipper.step(20900), 'tail-seek');
  assert.equal(seeks.length, 2);
  assert.ok(Math.abs(seeks[1] - 179.88) < 0.01);
});
