'use strict';
// 单 deck 出声不变量：起播前收掉任何仍在响的非活动 deck，杜绝「切歌后旧歌还在放 / 两首重合」。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function readFunctionFrom(contents, name) {
  const start = contents.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const braceStart = contents.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < contents.length; i += 1) {
    if (contents[i] === '{') depth += 1;
    if (contents[i] === '}') {
      depth -= 1;
      if (depth === 0) return contents.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

function runPauseInactive(decks, activeIndex) {
  const ducked = [];
  const list = decks.map((d, i) => ({ el: { paused: !!d.paused }, _i: i }));
  const context = {
    audioDeckList: list,
    activeAudioDeck: () => list[activeIndex] || null,
    GAPLESS_HANDOFF_RAMP_SECONDS: 0.012,
    duckAndRetireAudioDeck: (deck) => { ducked.push(deck._i); },
  };
  vm.runInNewContext(
    `${readFunctionFrom(appSource, 'pauseInactiveAudioDecks')}\nthis.run = pauseInactiveAudioDecks;\nthis.run();`,
    context,
  );
  return ducked;
}

test('pauseInactiveAudioDecks 收掉仍在响的非活动 deck，跳过活动 deck 与已暂停 deck', () => {
  // deck0 活动（在放），deck1 非活动且在放 → 只收 deck1
  assert.deepEqual(runPauseInactive([{ paused: false }, { paused: false }], 0), [1]);
  // deck1 活动，deck0 非活动在放 → 只收 deck0
  assert.deepEqual(runPauseInactive([{ paused: false }, { paused: false }], 1), [0]);
  // 非活动 deck 已暂停（无缝预取的闲置 deck）→ 空操作
  assert.deepEqual(runPauseInactive([{ paused: false }, { paused: true }], 0), []);
});

test('pauseInactiveAudioDecks 用极短斜坡压 0 再停（duckAndRetireAudioDeck），不硬切爆音', () => {
  const fn = readFunctionFrom(appSource, 'pauseInactiveAudioDecks');
  assert.match(fn, /duckAndRetireAudioDeck\(deck, GAPLESS_HANDOFF_RAMP_SECONDS\)/);
  assert.match(fn, /deck === active/);
  assert.match(fn, /!deck\.el\.paused/);
});

test('attemptAudioPlay 起播前先收掉非活动 deck（交叉进行中除外）', () => {
  const fn = readFunctionFrom(appSource, 'attemptAudioPlay');
  assert.match(fn, /!crossfadeState\.active && !crossfadeState\.starting\) pauseInactiveAudioDecks\(\);/);
  // 必须在真正 audio.play() 之前收掉。
  const guardAt = fn.indexOf('pauseInactiveAudioDecks()');
  const playAt = fn.indexOf('audio.play()');
  assert.ok(guardAt >= 0 && playAt > guardAt, '收掉非活动 deck 必须在 play() 之前');
});
