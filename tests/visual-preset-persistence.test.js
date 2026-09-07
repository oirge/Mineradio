'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function readSourceBlock(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码块: ${startMarker}`);
  return appSource.slice(start, end);
}

const normalizerSource = readSourceBlock(
  'function maxVisualPresetIndex() {',
  'function readSavedPlaybackVisualPreset() {',
);
const playbackReaderSource = readSourceBlock(
  'function readSavedPlaybackVisualPreset() {',
  'var playbackVisualPreset = readSavedPlaybackVisualPreset();',
);

function loadPresetHarness(saved, presetMeta) {
  const context = {
    VISUAL_PRESET_BOOT_MAX_INDEX: 8,
    VISUAL_PRESET_SCHEMA: 'skull-preset-v2',
    LYRIC_LAYOUT_STORE_KEY: 'mineradio-lyric-layout-v1',
    fxDefaults: { preset: 0 },
    localStorage: {
      getItem() { return saved == null ? null : JSON.stringify(saved); },
    },
    clampRange(value, min, max) { return Math.max(min, Math.min(max, value)); },
    Array,
    JSON,
    Math,
    Number,
    Object,
  };
  if (presetMeta) context.presetMeta = presetMeta;
  vm.runInNewContext(normalizerSource + playbackReaderSource, context);
  return context;
}

test('启动早于预设表初始化时仍能恢复视觉预设 7 和 8', () => {
  assert.equal(loadPresetHarness({ preset: 7, visualPresetSchema: 'skull-preset-v2' }).readSavedPlaybackVisualPreset(), 7);
  assert.equal(loadPresetHarness({ preset: 8, visualPresetSchema: 'skull-preset-v2' }).readSavedPlaybackVisualPreset(), 8);
  assert.equal(loadPresetHarness({ preset: 99, visualPresetSchema: 'skull-preset-v2' }).readSavedPlaybackVisualPreset(), 8);
});

test('预设表初始化后上限继续跟随表长度', () => {
  const context = loadPresetHarness({ preset: 9, visualPresetSchema: 'skull-preset-v2' }, new Array(10).fill(null));
  assert.equal(context.maxVisualPresetIndex(), 9);
  assert.equal(context.readSavedPlaybackVisualPreset(), 9);
});

test('三条读档链路共用同一个视觉预设归一化入口', () => {
  const playbackReader = playbackReaderSource;
  const layoutReader = readSourceBlock('function readSavedLyricLayout() {', 'function saveLyricLayout() {');
  const archiveReader = readSourceBlock('function normalizeFxArchiveSnapshot(raw) {', 'function normalizeUserFxArchives(value) {');

  assert.match(playbackReader, /return normalizeSavedVisualPreset\(raw\);/);
  assert.match(layoutReader, /var savedPreset = normalizeSavedVisualPreset\(raw\);/);
  assert.match(archiveReader, /var savedPreset = normalizeSavedVisualPreset\(raw\);/);
  assert.doesNotMatch(playbackReader + layoutReader + archiveReader, /raw\.preset[^\n]*,\s*0,\s*6\)/);
});

test('启动期上限与当前视觉预设表保持一致', () => {
  const maxMatch = appSource.match(/var VISUAL_PRESET_BOOT_MAX_INDEX = (\d+);/);
  assert.ok(maxMatch, '缺少启动期视觉预设上限');
  const meta = readSourceBlock('var presetMeta = [', 'var presetIcons = [');
  const presetCount = (meta.match(/\{ name:/g) || []).length;
  assert.equal(Number(maxMatch[1]), presetCount - 1);
});

test('旧版虚空预设迁移规则保持不变', () => {
  const old = loadPresetHarness({ preset: 3, visualPresetSchema: 'old-schema' });
  const current = loadPresetHarness({ preset: 3, visualPresetSchema: 'skull-preset-v2' });
  assert.equal(old.readSavedPlaybackVisualPreset(), 5);
  assert.equal(current.readSavedPlaybackVisualPreset(), 3);
});
