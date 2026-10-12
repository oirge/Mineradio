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

function referenceProgress(line, nextLine, now, audioDuration) {
  if (!line) return 0;
  now += line.words && line.words.length ? 0.030 : 0.020;
  if (line.words && line.words.length && line.charCount > 0) {
    let lastP = 0;
    for (let i = 0; i < line.words.length; i++) {
      const w = line.words[i];
      const ws = w.t;
      const we = w.t + Math.max(0.08, w.d || 0.24);
      if (now < ws) return lastP;
      let local = now >= we ? 1 : (now - ws) / Math.max(0.08, we - ws);
      local = Math.max(0, Math.min(1, local));
      const p = (w.c0 + (w.c1 - w.c0) * local) / line.charCount;
      lastP = Math.max(lastP, p);
      if (now < we) return lastP;
    }
    return 1;
  }
  const nextT = nextLine && nextLine.t > line.t
    ? nextLine.t
    : Math.min(audioDuration || now + 4, line.t + (line.duration || 4.8));
  const span = Math.max(0.75, nextT - line.t);
  const prog = Math.max(0, Math.min(1, (now - line.t) / span));
  return prog * prog * (3 - 2 * prog);
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
