'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');

const APP_PATH = path.join(__dirname, '..', 'public', 'app.js');

/**
 * 读取生产歌词解析段落，确认新增格式和既有格式共用同一份实现。
 * @returns {string} 可在隔离上下文执行的歌词解析源码。
 */
function readLyricParserSource() {
  const source = fs.readFileSync(APP_PATH, 'utf8');
  const start = source.indexOf('function lyricTagTimeToSeconds(');
  const end = source.indexOf('function renderLyrics(', start);
  assert.ok(start >= 0 && end > start, '未找到歌词解析实现');
  return source.slice(start, end);
}

/**
 * 创建只包含歌词解析依赖的隔离上下文，暴露分流入口与各格式解析器。
 * @returns {object} 生产歌词解析入口集合。
 */
function createLyricParsers() {
  /** @returns {boolean} 测试文本均不是无歌词占位。 */
  function isNoLyricText(text) { return !String(text || '').trim(); }

  const context = { Array, Math, Number, Object, String, RegExp, isFinite, isNoLyricText };
  vm.runInNewContext(
    readLyricParserSource()
      + '\nthis.parseTimedLyricText = parseTimedLyricText;'
      + '\nthis.parseQrcText = parseQrcText;'
      + '\nthis.parseKrcText = parseKrcText;'
      + '\nthis.parseTtmlText = parseTtmlText;',
    context,
  );
  return context;
}

/**
 * 创建歌词文件字节解码上下文，覆盖 KRC 加密二进制还原链路。
 * @returns {object} 字节解码与歌词读取入口。
 */
function createLyricByteReaders() {
  const source = fs.readFileSync(APP_PATH, 'utf8');
  const start = source.indexOf('async function readLocalTextFileBytes(');
  const end = source.indexOf('function readFileAsDataUrl(', start);
  assert.ok(start >= 0 && end > start, '未找到歌词文件字节解码实现');

  /** @param {Uint8Array} bytes 文本字节。 @returns {string} UTF-8 解码结果。 */
  function decodeLocalTextBuffer(bytes) {
    return new TextDecoder('utf-8').decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []));
  }

  /** @returns {string} 测试不走桌面范围读取。 */
  function localFullPath() { return ''; }

  /** @returns {null} 测试不提供桌面 API。 */
  function desktopLocalMusicApi() { return null; }

  const context = {
    Promise,
    Response,
    DecompressionStream,
    Uint8Array,
    Number,
    String,
    decodeLocalTextBuffer,
    localFullPath,
    desktopLocalMusicApi,
    localFileSize: () => 0,
    readLocalFileBytes: async () => null,
    FileReader: function FileReaderStub() {},
  };
  vm.runInNewContext(
    source.slice(start, end)
      + '\nthis.krcEncryptedPayloadBytes = krcEncryptedPayloadBytes;'
      + '\nthis.decodeLyricFileBuffer = decodeLyricFileBuffer;'
      + '\nthis.readLocalLyricText = readLocalLyricText;',
    context,
  );
  return context;
}

/**
 * 按酷狗 KRC 二进制格式打包：`krc1` 头 + 逐字节异或的 deflate 数据。
 * @param {string} text KRC 明文。
 * @param {boolean} raw true 时使用无 zlib 头的 raw deflate。
 * @returns {Uint8Array} 加密后的文件字节。
 */
function packKrcBinary(text, raw) {
  const key = [0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47, 0x51, 0x36, 0x31, 0x2d, 0xce, 0xd2, 0x6e, 0x69];
  const body = raw
    ? zlib.deflateRawSync(Buffer.from(text, 'utf8'))
    : zlib.deflateSync(Buffer.from(text, 'utf8'));
  const out = new Uint8Array(4 + body.length);
  out.set([0x6b, 0x72, 0x63, 0x31], 0);
  for (let i = 0; i < body.length; i++) out[4 + i] = body[i] ^ key[i % key.length];
  return out;
}

/**
 * 把歌词行压成便于断言的精简结构。
 * @param {Array<object>} lines 歌词行。
 * @returns {Array<object>} 只保留时间、正文与来源的视图。
 */
function briefLines(lines) {
  return Array.from(lines, line => ({ t: line.t, duration: line.duration, text: line.text, source: line.source }));
}

test('QRC 的 XML 容器与裸正文都解析成逐字歌词行', () => {
  const parsers = createLyricParsers();
  const body = '[1000,2000]今(1000,400)天(1400,600)真好(2000,1000)\n[4000,1500]第(4000,700)二句(4700,800)';
  const bare = parsers.parseQrcText(body);
  assert.deepEqual(briefLines(bare), [
    { t: 1, duration: 2, text: '今天真好', source: 'qrc-word' },
    { t: 4, duration: 1.5, text: '第二句', source: 'qrc-word' },
  ]);
  assert.deepEqual(
    Array.from(bare[0].words, w => ({ text: w.text, t: w.t, d: w.d, c0: w.c0, c1: w.c1 })),
    [
      { text: '今', t: 1, d: 0.4, c0: 0, c1: 1 },
      { text: '天', t: 1.4, d: 0.6, c0: 1, c1: 2 },
      { text: '真好', t: 2, d: 1, c0: 2, c1: 4 },
    ],
    'QRC 词项必须落在正文的字符区间上，逐字高亮才对得齐',
  );

  const xml = '<?xml version="1.0" encoding="utf-8"?>\n<QrcInfos><LyricInfo LyricCount="1">'
    + '<Lyric_1 LyricType="1" LyricContent="[900,1100]&#10;[1000,2000]容(1000,500)器(1500,500)"/>'
    + '</LyricInfo></QrcInfos>';
  const wrapped = parsers.parseQrcText(xml);
  assert.deepEqual(briefLines(wrapped), [{ t: 1, duration: 2, text: '容器', source: 'qrc-word' }]);
  assert.deepEqual(briefLines(parsers.parseTimedLyricText(xml)), briefLines(wrapped), 'XML 容器要能被分流认出来');

  const lineOnly = parsers.parseQrcText('[2000,3000]整行没有逐字时间');
  assert.equal(lineOnly.length, 1);
  assert.equal(lineOnly[0].source, 'qrc-line');
  assert.equal(lineOnly[0].words.length, 0);

  const tailed = parsers.parseQrcText('[1000,2000]今(1000,400)天(1400,600)漏了标记');
  assert.equal(tailed[0].text, '今天漏了标记', '最后一个词项漏写时间标记也不能把正文丢掉');
  assert.equal(tailed[0].words.length, 3);
});

test('KRC 词项偏移以行首为基准换算成绝对时间', () => {
  const parsers = createLyricParsers();
  const text = '[id:$00000000]\n[ti:测试]\n[1000,1200]<0,400,0>你<400,300,0>好<700,500,0>啊\n[3000,900]<0,900,0>下一句';
  const lines = parsers.parseKrcText(text);
  assert.deepEqual(briefLines(lines), [
    { t: 1, duration: 1.2, text: '你好啊', source: 'krc-word' },
    { t: 3, duration: 0.9, text: '下一句', source: 'krc-word' },
  ]);
  assert.deepEqual(
    Array.from(lines[0].words, w => ({ text: w.text, t: w.t, d: w.d })),
    [
      { text: '你', t: 1, d: 0.4 },
      { text: '好', t: 1.4, d: 0.3 },
      { text: '啊', t: 1.7, d: 0.5 },
    ],
    'KRC 的偏移必须加上行起点',
  );
  assert.equal(parsers.parseKrcText('[5000,800]没有词项标记')[0].source, 'krc-line');
  assert.equal(
    parsers.parseKrcText('[1000,20000]<0,20000,0>长段')[0].duration,
    20,
    '行头写明的时长不得被旧 LRC 的 12 秒上限截断',
  );
});

test('TTML 逐字与整行都能解析，译文与罗马音不进正文', () => {
  const parsers = createLyricParsers();
  const ttml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">'
    + '<body><div>'
    + '<p begin="00:00:01.000" end="00:00:03.500">'
    + '<span begin="00:00:01.000" end="00:00:01.800">Hello </span>'
    + '<span begin="00:00:01.800" end="00:00:03.500">world</span>'
    + '<span ttm:role="x-translation">你好世界</span>'
    + '</p>'
    + '<p begin="4s" end="6.5s">整行没有 span &amp; 带实体</p>'
    + '<p><span begin="00:08.000">只有</span><span begin="00:08.500">开始</span></p>'
    + '</div></body></tt>';
  const lines = parsers.parseTtmlText(ttml);
  assert.deepEqual(briefLines(lines), [
    { t: 1, duration: 2.5, text: 'Hello world', source: 'ttml-word' },
    { t: 4, duration: 2.5, text: '整行没有 span & 带实体', source: 'ttml-line' },
    { t: 8, duration: 4.8, text: '只有开始', source: 'ttml-word' },
  ]);
  assert.deepEqual(
    Array.from(lines[0].words, w => ({ text: w.text, t: w.t, d: w.d, c0: w.c0, c1: w.c1 })),
    [
      { text: 'Hello ', t: 1, d: 0.8, c0: 0, c1: 6 },
      { text: 'world', t: 1.8, d: 1.7, c0: 6, c1: 11 },
    ],
  );
  assert.ok(!lines[0].text.includes('你好世界'), '标成 x-translation 的 span 是译文，不能混进正文');
  assert.equal(lines[2].words[0].d, 0.5, '只写 begin 的词项按下一个词项的开始收尾');
  assert.deepEqual(briefLines(parsers.parseTimedLyricText(ttml)), briefLines(lines), 'TTML 要能被分流认出来');

  const nested = parsers.parseTtmlText(
    '<tt><body><div><p begin="0s" end="2s">'
      + '<span begin="0s" end="2s"><span begin="0s" end="1s">外</span><span begin="1s" end="2s">层</span></span>'
      + '</p></div></body></tt>',
  );
  assert.equal(nested[0].text, '外层', '嵌套 span 只取最内层，正文不得重复');
});

test('歌词格式分流不抢走 LRC、YRC 与字幕格式', () => {
  const parsers = createLyricParsers();
  const lrc = parsers.parseTimedLyricText('[00:01.00]第一行\n[00:05.50]第二行');
  assert.deepEqual(Array.from(lrc, line => line.t), [1, 5.5]);
  assert.equal(lrc[0].source, 'lrc');

  const yrc = parsers.parseTimedLyricText('[1000,1000](1000,400,0)你(1400,600,0)好');
  assert.equal(yrc[0].source, 'yrc-word', 'YRC 的 3 段括号不得被 QRC 的 2 段括号嗅探截走');
  assert.equal(yrc[0].words.length, 2);

  const krc = parsers.parseTimedLyricText('[1000,1200]<0,400,0>你<400,800,0>好');
  assert.equal(krc[0].source, 'krc-word', 'KRC 必须排在 YRC 之前，否则会被当成无逐字的整行');
  assert.equal(krc[0].text, '你好');

  const qrc = parsers.parseTimedLyricText('[1000,1200]你(1000,400)好(1400,800)');
  assert.equal(qrc[0].source, 'qrc-word');
  assert.equal(qrc[0].text, '你好');

  assert.equal(parsers.parseTimedLyricText('WEBVTT\n\n00:01.000 --> 00:03.000\n字幕')[0].source, 'vtt');
  assert.equal(parsers.parseTimedLyricText('1\n00:00:01,000 --> 00:00:03,000\n字幕')[0].source, 'srt');
  assert.equal(parsers.parseTimedLyricText('没有任何时间轴的纯文本').length, 0);
});

test('KRC 加密二进制经异或与 deflate 还原成明文', async () => {
  const readers = createLyricByteReaders();
  const plain = '[id:$00000000]\n[1000,1200]<0,400,0>加<400,800,0>密';

  for (const raw of [false, true]) {
    const packed = packKrcBinary(plain, raw);
    assert.equal(await readers.decodeLyricFileBuffer(packed), plain, raw ? 'raw deflate 也要认' : 'zlib 头要认');
    const file = { name: 'song.krc', arrayBuffer: async () => packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength) };
    assert.equal(await readers.readLocalLyricText(file), plain, '歌词读取入口必须先解密再交给解析器');
  }

  const payload = readers.krcEncryptedPayloadBytes(packKrcBinary(plain, false));
  assert.equal(payload[0], 0x78, '异或还原后应当是 zlib 数据');
  assert.equal(readers.krcEncryptedPayloadBytes(new Uint8Array([0x6b, 0x72, 0x63])), null, '不足一个头长度不算 KRC');
  assert.equal(readers.krcEncryptedPayloadBytes(new TextEncoder().encode('[00:01.00]明文')), null, '明文不得走解密分支');
  assert.equal(await readers.decodeLyricFileBuffer(new TextEncoder().encode('[00:01.00]明文')), '[00:01.00]明文');
  assert.equal(await readers.readLocalLyricText(null), '');

  const broken = packKrcBinary(plain, false);
  broken[10] ^= 0xff;
  broken[11] ^= 0xff;
  assert.equal(await readers.decodeLyricFileBuffer(broken), '', '解压失败时返回空文本而不是抛异常');
});

test('本地歌词入口把新格式转换成 local- 来源标记', () => {
  const source = fs.readFileSync(APP_PATH, 'utf8');
  const cloneStart = source.indexOf('function cloneLyricLine(');
  const cloneEnd = source.indexOf('function cloneLyricLines(', cloneStart);
  const customStart = source.indexOf('function parseCustomLyricText(');
  const customEnd = source.indexOf('function applyCustomLyricState(', customStart);
  const localStart = source.indexOf('function parseLocalLyricText(');
  const localEnd = source.indexOf('function applyLocalOriginalLyricsState(', localStart);
  assert.ok(cloneStart >= 0 && cloneEnd > cloneStart, '未找到歌词行克隆实现');
  assert.ok(customStart >= 0 && customEnd > customStart, '未找到自定义歌词解析实现');
  assert.ok(localStart >= 0 && localEnd > localStart, '未找到本地歌词解析实现');

  /** @returns {boolean} 测试歌词均不是无歌词占位。 */
  function isNoLyricText(text) { return !String(text || '').trim(); }

  const context = { Array, Math, Number, Object, String, RegExp, audio: null, isFinite, isNoLyricText };
  vm.runInNewContext(
    source.slice(cloneStart, cloneEnd)
      + source.slice(customStart, customEnd)
      + source.slice(localStart, localEnd)
      + readLyricParserSource()
      + '\nthis.parseLocalLyricText = parseLocalLyricText;',
    context,
  );
  assert.equal(context.parseLocalLyricText('[1000,1200]<0,400,0>你<400,800,0>好')[0].source, 'local-krc-word');
  assert.equal(context.parseLocalLyricText('[1000,1200]你(1000,400)好(1400,800)')[0].source, 'local-qrc-word');
  assert.equal(
    context.parseLocalLyricText('<tt><body><div><p begin="1s" end="3s">TTML 正文</p></div></body></tt>')[0].source,
    'local-ttml-line',
  );
});

test('KRC、QRC、TTML 进入本地格式清单与各层 MIME 映射', () => {
  const app = fs.readFileSync(APP_PATH, 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const lyricRe = /var LOCAL_LYRIC_FILE_RE = (\/[^\n]+\/i);/.exec(app);
  assert.ok(lyricRe, '未找到本地歌词后缀清单');
  const matchesExt = new RegExp(lyricRe[1].slice(1, -2), 'i');
  for (const ext of ['lrc', 'txt', 'srt', 'vtt', 'ass', 'yrc', 'krc', 'qrc', 'ttml']) {
    assert.equal(matchesExt.test(`.${ext}`), true, `歌词后缀清单缺少 .${ext}`);
    assert.match(main, new RegExp(`['"]\\.${ext}['"]`), `desktop/main.js 缺少 .${ext}`);
    assert.match(server, new RegExp(`['"]\\.${ext}['"]\\s*:`), `server.js 缺少 .${ext}`);
    // 单文件导入和文件夹导入两个 accept 清单都要收。
    assert.equal((index.match(new RegExp(`\\.${ext}[,"]`, 'g')) || []).length >= 2, true, `index.html accept 缺少 .${ext}`);
  }
  assert.equal(matchesExt.test('.mp3'), false, '歌词清单不得收音频后缀');
});




