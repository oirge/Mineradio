'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

/** @returns {object} The actual hydration callback and lyric activation in isolation. */
function createContext() {
  const specStart = source.indexOf('      id: LOCAL_USER_STATE_CUSTOM_LYRICS,');
  const specEnd = source.indexOf('\n    },\n    {', specStart);
  const applyStart = source.indexOf('function applyCustomLyricState(');
  const applyEnd = source.indexOf('function preferredLyricSourceForSong(', applyStart);
  assert.ok(specStart >= 0 && specEnd > specStart && applyStart >= 0 && applyEnd > applyStart);

  const song = { localKey: 'restored-song', name: 'Restored song' };
  const context = {
    LOCAL_USER_STATE_CUSTOM_LYRICS: 'custom-lyrics',
    CUSTOM_LYRIC_STORE_KEY: 'mineradio-custom-lyrics-v1',
    readCustomLyricMap: () => ({}),
    normalizeCustomLyricMapValue: value => value,
    currentLyricSong: () => song,
    getCustomLyricEntry: () => context.customLyricMap[song.localKey],
    parseCustomLyricText: text => [{ t: 0, text, source: 'custom-lrc' }],
    lyricLinesHaveWordTiming: () => false,
    withLyricFallback: lines => lines,
    updateCustomLyricControls() {},
    renderLyrics() { context.renders++; },
    openCustomLyricModal() { context.editorsOpened++; },
    showToast() { context.toasts++; },
    renders: 0,
    editorsOpened: 0,
    toasts: 0,
    customLyricMap: {},
    customLyricMapHydrated: false,
    lyricsLines: [{ text: 'Original lyrics' }],
    lyricSourceMode: 'original',
  };
  vm.runInNewContext(source.slice(applyStart, applyEnd)
    + '\nthis.spec = ({\n' + source.slice(specStart, specEnd) + '\n});', context);
  return context;
}

test('cold restore without custom lyrics keeps playback lyrics and the editor closed', () => {
  const context = createContext();
  const originalLines = context.lyricsLines;
  context.spec.apply(null);
  assert.equal(context.customLyricMapHydrated, true);
  assert.equal(context.lyricsLines, originalLines);
  assert.equal(context.lyricSourceMode, 'original');
  assert.equal(context.editorsOpened, 0);
  assert.equal(context.toasts, 0);
});

test('cold restore still activates saved custom lyrics without opening an editor', () => {
  const context = createContext();
  context.spec.apply({ 'restored-song': { text: 'Saved custom lyrics' } });
  assert.equal(context.customLyricMapHydrated, true);
  assert.equal(context.lyricsLines[0].text, 'Saved custom lyrics');
  assert.equal(context.lyricSourceMode, 'custom');
  assert.equal(context.renders, 1);
  assert.equal(context.editorsOpened, 0);
});

test('explicit custom lyric editing remains available when the song has no saved lyrics', () => {
  const context = createContext();
  assert.equal(context.applyCustomLyricState(context.currentLyricSong(), false), false);
  assert.equal(context.editorsOpened, 1);
});
