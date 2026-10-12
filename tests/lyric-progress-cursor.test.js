const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const start = source.indexOf('var lyricWordProgressCursor = {');
const end = source.indexOf('\nfunction findStageLyricIndex(', start);
assert.ok(start >= 0, 'lyric progress cursor source must exist');
assert.ok(end > start, 'lyric progress cursor source must end before stage index lookup');
const progressSource = source.slice(start, end);

function createProgressContext() {
  const context = { audio: { duration: 120 } };
  vm.runInNewContext(`${progressSource}\nthis.progress = getLyricLineProgress;`, context);
  return context;
}

function referenceProgress(line, _nextLine, now) {
  if (!line) return 0;
  if (line.words && line.words.length && line.charCount > 0) {
    let lastP = 0;
    for (let i = 0; i < line.words.length; i++) {
      const w = line.words[i];
      if (now < w.t) return lastP;
      lastP = Math.max(lastP, Math.min(line.charCount, Number(w.c1) || 0) / line.charCount);
    }
    return lastP;
  }
  return 0;
}

function createWordLine() {
  return {
    t: 4,
    duration: 4,
    charCount: 12,
    words: [
      { text: 'one', t: 4.00, d: 0.50, c0: 0, c1: 3 },
      { text: ' two', t: 4.55, d: 0.45, c0: 3, c1: 7 },
      { text: ' three', t: 5.05, d: 0.60, c0: 7, c1: 12 }
    ]
  };
}

{
  const context = createProgressContext();
  const line = createWordLine();
  const next = { t: 8 };
  for (const now of [3, 4, 4.2, 4.8, 5.2, 6.4, 5.0, 4.1, 7.2]) {
    assert.strictEqual(
      context.progress(line, next, now),
      referenceProgress(line, next, now, context.audio.duration),
      `progress must remain numerically equivalent at ${now}s`
    );
  }
  assert.strictEqual(context.progress(line, next, 3.999), 0, '首词开始前不得提前点亮');
  assert.strictEqual(context.progress({ t: 4, charCount: 12, words: [] }, next, 6), 0,
    '只有整句时刻的歌词不得按句长猜逐字进度');
}

{
  const context = createProgressContext();
  let reads = 0;
  const words = [];
  for (let i = 0; i < 120; i++) {
    const word = { text: 'x', t: i * 0.08, d: 0.07, c0: i, c1: i + 1 };
    words.push(word);
  }
  const trackedWords = new Proxy(words, {
    get(target, property, receiver) {
      if (/^\d+$/.test(String(property))) reads++;
      return Reflect.get(target, property, receiver);
    }
  });
  const line = { t: 0, charCount: 120, words: trackedWords };
  context.progress(line, null, 5);
  const afterFirstFrame = reads;
  context.progress(line, null, 5.01);
  const afterSeekForward = reads;
  assert.ok(afterFirstFrame > 1, 'first frame should scan the words needed to reach the current time');
  assert.ok(afterSeekForward - afterFirstFrame < 4, 'forward playback should resume from the word cursor');
  const backwardProgress = context.progress(line, null, 0.1);
  assert.strictEqual(
    backwardProgress,
    referenceProgress(line, null, 0.1, context.audio.duration),
    'backward seeks should reset the cursor for correct progress'
  );
}

console.log('lyric-progress-cursor.test.js: ok');
