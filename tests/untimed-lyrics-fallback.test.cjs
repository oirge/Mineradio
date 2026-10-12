'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function section(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `${start} source range`);
  return source.slice(from, to);
}

test('plain lyrics use display-only line positions and never invent word intervals', () => {
  const context = {
    audio: { duration: 18 },
    parseTimedLyricText: () => [],
    isNoLyricText: () => false,
    forEachNewlineRow: (raw, visit) => raw.split(/\r?\n/).forEach(visit),
  };
  const parse = vm.runInNewContext(
    section('function parseCustomLyricText(', 'function applyCustomLyricState(') + '\nparseCustomLyricText',
    context
  );
  const lines = parse('第一句\n第二句\n第三句');
  assert.deepEqual(Array.from(lines, line => line.t), [0, 6, 12]);
  assert.ok(lines.every(line => line.untimed && !line.words && line.duration === 6));
});

test('stage and desktop indices continue through approximate plain-text rows on seek', () => {
  const lines = [0, 6, 12].map((t, index) =>
    ({ text: `line ${index}`, t, duration: 6, untimed: true, words: [] }));
  const helper = section('function lyricLineVocalStart(', 'function findStageLyricIndex(');
  const stage = vm.runInNewContext(
    helper + section('function findStageLyricIndex(', 'function tickLyricsParticles(') + '\nfindStageLyricIndex',
    { stageLyrics: { cursorLines: null, cursorIdx: -1 } }
  );
  const desktop = vm.runInNewContext(
    helper + section('function findDesktopLyricIndex(', '// These scratch payloads') + '\nfindDesktopLyricIndex',
    { desktopLyricSnapshotState: { lines: null, idx: -1 } }
  );
  for (const [time, expected] of [[0, 0], [5.9, 0], [6, 1], [11.9, 1], [12, 2],
    [17.9, 2], [1, 0], [13, 2]]) {
    assert.equal(stage(lines, time), expected, `stage at ${time}s`);
    assert.equal(desktop(lines, time), expected, `desktop at ${time}s`);
  }
});
