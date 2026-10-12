const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const parserStart = appSource.indexOf('function isNoLyricIgnoredChar(');
const parserEnd = appSource.indexOf('function renderLyrics(', parserStart);
assert.ok(parserStart >= 0 && parserEnd > parserStart, 'lyric parser source range');
const embeddedStart = appSource.indexOf('function normalizeEmbeddedLyricText(');
const embeddedEnd = appSource.indexOf('async function extractFlacEmbeddedLyricsText(', embeddedStart);
assert.ok(embeddedStart >= 0 && embeddedEnd > embeddedStart, 'embedded lyric ranking source range');

const parser = vm.runInNewContext(
  appSource.slice(parserStart, parserEnd) + '\n'
    + appSource.slice(embeddedStart, embeddedEnd)
    + '\n({ parseTimedLyricText, lyricFractionToSeconds, lyricLinesHaveWordTiming,'
    + ' embeddedLyricFieldPriority, parseFlacLyricsVorbisPayload })',
  {
    uint32LE: (bytes, offset) => Buffer.from(bytes).readUInt32LE(offset),
    utf8FromBytes: (bytes, offset, length) => Buffer.from(bytes).toString('utf8', offset, offset + length),
    findByteInRange: (bytes, start, end, value) => {
      for (let i = start; i < end; i++) if (bytes[i] === value) return i;
      return -1;
    }
  }
);

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);
}

test('LRC time units, global offset, and ordinary line-only timing', () => {
  const lines = parser.parseTimedLyricText(
    '[offset:-250]\n[00:09.50]第一句\n[00:12.125]第二句\n[00:13.1234]第三句'
  );
  assert.equal(lines.length, 3);
  close(lines[0].t, 9.75);
  close(lines[1].t, 12.375);
  close(lines[2].t, 13.3734);
  assert.equal(parser.lyricLinesHaveWordTiming(lines), false);
});

test('Enhanced LRC preserves unequal character onsets and a sustained syllable', () => {
  const lines = parser.parseTimedLyricText(
    '[00:10.00]<00:10.12>快<00:10.25>唱<00:10.62>长<00:11.90>音<00:12.50>'
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, '快唱长音');
  assert.equal(parser.lyricLinesHaveWordTiming(lines), true);
  assert.deepEqual(Array.from(lines[0].words, (word) => word.text), ['快', '唱', '长', '音']);
  close(lines[0].words[0].t, 10.12);
  close(lines[0].words[0].d, 0.13);
  close(lines[0].words[1].t, 10.25);
  close(lines[0].words[1].d, 0.37);
  close(lines[0].words[2].t, 10.62);
  close(lines[0].words[2].d, 1.28);
  close(lines[0].words[3].t, 11.9);
  close(lines[0].words[3].d, 0.6);
});

test('YRC, KRC, QRC and TTML convert millisecond word positions to seconds', () => {
  const formats = [
    ['[10000,2500](10100,140,0)快(10400,1200,0)唱', 'yrc-word'],
    ['[10000,2500]<100,140,0>快<400,1200,0>唱', 'krc-word'],
    ['[10000,2500]快(10100,140)唱(10400,1200)', 'qrc-word'],
    [
      '<tt><body><p begin="10s" end="12.5s">'
      + '<span begin="10.1s" end="10.24s">快</span>'
      + '<span begin="10.4s" end="11.6s">唱</span>'
      + '</p></body></tt>',
      'ttml-word'
    ]
  ];
  for (const [input, source] of formats) {
    const lines = parser.parseTimedLyricText(input);
    assert.equal(lines.length, 1, source);
    assert.equal(lines[0].source, source);
    assert.equal(lines[0].text, '快唱');
    close(lines[0].t, 10);
    close(lines[0].words[0].t, 10.1);
    close(lines[0].words[0].d, 0.14);
    close(lines[0].words[1].t, 10.4);
    close(lines[0].words[1].d, 1.2);
  }
});

test('native timing keeps rapid tokens, zero duration, sustained lines and exact normalized offsets', () => {
  const formats = [
    '[10000,15000](10100,20,0) 快  (10400,0,0)  唱 (11000,12000,0)  长音 ',
    '[10000,15000]<100,20,0> 快  <400,0,0>  唱 <1000,12000,0>  长音 ',
    '[10000,15000] 快  (10100,20)  唱 (10400,0)  长音 (11000,12000)',
    '<tt><body><p begin="10s" end="25s">'
      + '<span begin="10.1s" end="10.12s"> 快  </span>'
      + '<span begin="10.4s" end="10.4s">  唱 </span>'
      + '<span begin="11s" end="23s">  长音 </span></p></body></tt>'
  ];
  for (const input of formats) {
    const [line] = parser.parseTimedLyricText(input);
    assert.equal(line.duration, 15, line.source);
    assert.equal(line.text, '快 唱 长音');
    assert.equal(line.words.length, 3);
    line.words.forEach((word, i) => close(word.d, [0.02, 0, 12][i]));
    for (const word of line.words) {
      assert.equal(line.text.slice(word.c0, word.c1), word.text);
      assert.ok(word.text.trim());
    }
    assert.equal(line.words[1].text.trim(), '唱');
    assert.equal(line.words[2].text.trim(), '长音');
  }
});

test('Enhanced LRC keeps sub-60ms intervals and native primary timing beside translation', () => {
  const [line] = parser.parseTimedLyricText(
    '[00:10.00]<00:10.00>快<00:10.02>唱<00:11.50>\n[00:10.00]Sing fast'
  );
  assert.equal(line.text, '快唱\nSing fast');
  assert.equal(line.translation, 'Sing fast');
  assert.equal(line.charCount, 2);
  close(line.words[0].d, 0.02);
  close(line.words[1].d, 1.48);
  assert.deepEqual(Array.from(line.words, (word) => [word.c0, word.c1]), [[0, 1], [1, 2]]);
});

test('native per-character embedded lyrics outrank ordinary LRC from the same audio', () => {
  const ordinary = '[00:10.00]快唱';
  const native = '[00:10.00]<00:10.10>快<00:10.40>唱<00:11.00>';
  assert.ok(parser.embeddedLyricFieldPriority('SYNCEDLYRICS', native)
    > parser.embeddedLyricFieldPriority('LYRICS', ordinary));
  assert.ok(parser.embeddedLyricFieldPriority('SYNCEDLYRICS',
    '[10000,1500](10100,200,0)快(10400,1000,0)唱')
    > parser.embeddedLyricFieldPriority('LYRICS', ordinary));

  function le32(value) {
    const result = Buffer.alloc(4);
    result.writeUInt32LE(value);
    return result;
  }
  function flacComments(items) {
    const comments = items.map((item) => Buffer.from(item, 'utf8'));
    return Buffer.concat([
      le32(0), le32(comments.length),
      ...comments.flatMap((item) => [le32(item.length), item])
    ]);
  }
  const best = { priority: 0, text: '' };
  const done = parser.parseFlacLyricsVorbisPayload(flacComments([
    'LYRICS=' + ordinary,
    'SYNCEDLYRICS=' + native
  ]), best);
  assert.equal(done, false);
  assert.equal(best.text, native);
  assert.equal(parser.lyricLinesHaveWordTiming(parser.parseTimedLyricText(best.text)), true);
});

test('partially timed TTML retains its full sentence without enabling a cumulative word mask', () => {
  const [line] = parser.parseTimedLyricText(
    '<tt><body><p begin="10s" end="12.5s">'
      + '\uD840\uDC00A<span begin="10.4s" end="11.6s">B</span>C'
      + '<span ttm:role="x-translation">Translation</span></p></body></tt>'
  );
  assert.equal(line.text, '\uD840\uDC00ABC');
  assert.equal(line.charCount, 5);
  assert.equal(line.t, 10);
  assert.equal(line.duration, 2.5);
  assert.equal(line.source, 'ttml-line');
  assert.equal(line.words.length, 0);
});

test('complete TTML timing keeps full normalized text and UTF-16 token offsets', () => {
  const [line] = parser.parseTimedLyricText(
    '<tt><body><p begin="10s" end="12.5s">'
      + '<span begin="10.1s" end="10.4s"> \uD840\uDC00 </span> '
      + '<span begin="10.6s" end="11.6s"> B </span></p></body></tt>'
  );
  assert.equal(line.text, '\uD840\uDC00 B');
  assert.equal(line.charCount, 4);
  assert.equal(line.source, 'ttml-word');
  assert.deepEqual(Array.from(line.words, word => [word.text, word.c0, word.c1]),
    [['\uD840\uDC00', 0, 2], ['B', 3, 4]]);
});

test('QRC preserves an untimed trailing token instead of inventing its interval', () => {
  const [line] = parser.parseTimedLyricText('[10000,2500]AB(10100,140)C');
  assert.equal(line.text, 'ABC');
  assert.equal(line.t, 10);
  assert.equal(line.duration, 2.5);
  assert.equal(line.source, 'qrc-line');
  assert.equal(line.words.length, 0);
});

test('Enhanced LRC without a closing word tag retains text and translation but no guessed tail duration', () => {
  const [line] = parser.parseTimedLyricText(
    '[00:10.00]<00:10.10>A<00:10.40>B\n[00:10.00]Translation\n[00:15.00]Next line'
  );
  assert.equal(line.text, 'AB\nTranslation');
  assert.equal(line.translation, 'Translation');
  assert.equal(line.t, 10);
  assert.equal(line.duration, 5);
  assert.equal(line.words?.length || 0, 0);
  assert.equal(parser.lyricLinesHaveWordTiming([line]), false);
});

test('backward native word onsets retain sentence anchors and text without reordering words', () => {
  const formats = [
    '[00:10.00]<00:11.00>A<00:10.50>B<00:12.00>',
    '[10000,2500](11000,140,0)A(10500,1200,0)B',
    '[10000,2500]<1000,140,0>A<500,1200,0>B',
    '[10000,2500]A(11000,140)B(10500,1200)',
    '<tt><body><p begin="10s" end="12.5s">'
      + '<span begin="11s" end="11.14s">A</span>'
      + '<span begin="10.5s" end="11.7s">B</span></p></body></tt>'
  ];
  for (const input of formats) {
    const [line] = parser.parseTimedLyricText(input);
    assert.equal(line.text, 'AB', input);
    assert.equal(line.t, 10, input);
    assert.equal(line.words?.length || 0, 0, input);
    assert.equal(parser.lyricLinesHaveWordTiming([line]), false, input);
  }
});

test('known backward native end times and missing TTML end times do not become zero-duration timings', () => {
  const formats = [
    '[00:10.00]<00:11.00>A<00:10.50>',
    '<tt><body><p begin="10s" end="12.5s"><span begin="11s" end="10.5s">A</span></p></body></tt>',
    '<tt><body><p begin="10s"><span begin="11s">A</span></p></body></tt>'
  ];
  for (const input of formats) {
    const [line] = parser.parseTimedLyricText(input);
    assert.equal(line.text, 'A', input);
    assert.equal(line.t, 10, input);
    assert.equal(line.words?.length || 0, 0, input);
  }
});

test('real fast and slow FLAC files contain only line timestamps, not per-character timing', (t) => {
  const examples = [
    path.join('D:\\1', '阿禹ayy - 耍把戏.flac'),
    path.join('D:\\1', '安和桥.flac')
  ];
  if (!examples.every((file) => fs.existsSync(file))) {
    t.skip('real audio fixtures are not installed');
    return;
  }
  for (const file of examples) {
    const result = spawnSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration:format_tags=LYRICS',
      '-of', 'json', '-i', file
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const format = JSON.parse(result.stdout).format;
    const lyrics = format.tags && format.tags.LYRICS;
    assert.ok(lyrics, `embedded LYRICS in ${path.basename(file)}`);
    const lines = parser.parseTimedLyricText(lyrics);
    assert.ok(lines.length > 20, `timed lines in ${path.basename(file)}`);
    assert.equal(parser.lyricLinesHaveWordTiming(lines), false,
      `${path.basename(file)} has no source word timestamps`);
    assert.ok(lines.at(-1).t < Number(format.duration), 'lyrics within audio duration');
  }
});

test('real Enhanced LRC FLAC keeps nonuniform native character timestamps', (t) => {
  const file = path.join('D:\\1',
    '我爱你但是我要回家-邵甲天 ET、Happer、无面小生、口古口古-flac.flac');
  if (!fs.existsSync(file)) {
    t.skip('real Enhanced LRC audio fixture is not installed');
    return;
  }
  const result = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format_tags=LYRICS', '-of', 'json', '-i', file
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const lyrics = JSON.parse(result.stdout).format.tags.LYRICS;
  const lines = parser.parseTimedLyricText(lyrics);
  assert.equal(parser.lyricLinesHaveWordTiming(lines), true);
  const sungLine = lines.find((line) => line.text.startsWith('要经过多少黑夜'));
  assert.ok(sungLine, 'first sung line');
  close(sungLine.t, 1.17);
  assert.equal(sungLine.words[0].text, '要');
  close(sungLine.words[0].t, 1.17);
  close(sungLine.words[1].t, 1.32);
  assert.notEqual(sungLine.words[0].d, sungLine.words[3].d);
  assert.equal(sungLine.words.at(-1).text, '夜');
  close(sungLine.words.at(-1).t, 3.66);
  close(sungLine.words.at(-1).d, 0.6);
});
