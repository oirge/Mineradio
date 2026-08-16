'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const url = require('node:url');
const vm = require('node:vm');

/**
 * 截取生产歌词时间轴解析器，验证新增格式仍复用播放器统一歌词行结构。
 * @returns {string} 可在隔离上下文执行的歌词解析源码。
 */
function readTimedLyricParserSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function lyricTagTimeToSeconds(');
  const end = source.indexOf('function renderLyrics(', start);
  assert.ok(start >= 0 && end > start, '未找到歌词时间轴解析实现');
  return source.slice(start, end);
}

/**
 * 创建只包含歌词解析依赖的隔离上下文。
 * @returns {{parseTimedLyricText:(text:string)=>Array<object>}} 生产解析入口。
 */
function createTimedLyricParser() {
  /** @returns {boolean} 测试文本均不是无歌词占位。 */
  function isNoLyricText(text) { return !String(text || '').trim(); }

  const context = { Array, Math, Number, Object, String, RegExp, isFinite, isNoLyricText };
  vm.runInNewContext(
    readTimedLyricParserSource() + '\nthis.parseTimedLyricText = parseTimedLyricText;',
    context,
  );
  return context;
}

/**
 * 加载生产本地歌词入口，验证自动识别结果经过来源转换后仍保持格式信息。
 * @returns {{parseLocalLyricText:(text:string)=>Array<object>}} 本地歌词解析入口。
 */
function createLocalLyricParser() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
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
      + readTimedLyricParserSource()
      + '\nthis.parseLocalLyricText = parseLocalLyricText;',
    context,
  );
  return context;
}

/**
 * 加载生产文件分类函数，避免只按源码文本判断后缀是否真正可用。
 * @returns {{isLocalAudioFile:(file:object,folderOnly:boolean)=>boolean,isLocalLyricFile:(file:object)=>boolean,isLocalCoverFile:(file:object)=>boolean,buildLocalLyricMaps:(files:Array<object>)=>object,findLocalLyricFile:(file:object,maps:object)=>object|null,buildLocalCoverMaps:(files:Array<object>)=>object,findLocalCoverFile:(file:object,maps:object)=>object|null}} 文件分类和关联入口。
 */
function createLocalFileClassifier() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('var LOCAL_AUDIO_FILE_RE =');
  const end = source.indexOf('function localTrackInfoFromFile(', start);
  assert.ok(start >= 0 && end > start, '未找到本地文件分类实现');
  const context = { Array, Intl, Math, Number, Object, RegExp, String };
  vm.runInNewContext(
    source.slice(start, end)
      + '\nthis.isLocalAudioFile = isLocalAudioFile;'
      + '\nthis.isLocalLyricFile = isLocalLyricFile;'
      + '\nthis.isLocalCoverFile = isLocalCoverFile;'
      + '\nthis.buildLocalLyricMaps = buildLocalLyricMaps;'
      + '\nthis.findLocalLyricFile = findLocalLyricFile;'
      + '\nthis.buildLocalCoverMaps = buildLocalCoverMaps;'
      + '\nthis.findLocalCoverFile = findLocalCoverFile;',
    context,
  );
  return context;
}

/**
 * 加载桌面主进程的真实全量扫描入口。
 * @returns {(folderPath:string)=>Promise<object>} 本地曲库扫描函数。
 */
function loadDesktopFullScan() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const start = source.indexOf('const LOCAL_LIBRARY_EXTS = new Set(');
  const end = source.indexOf('async function scanLocalMusicFolder(folderPath, options)', start);
  assert.ok(start >= 0 && end > start, '未找到桌面曲库扫描实现');
  const context = {
    Array,
    Date,
    Intl,
    Map,
    Math,
    Number,
    Promise,
    Set,
    fs,
    mainServerPort: 0,
    path,
    pathToFileURL: url.pathToFileURL,
    LOCAL_FILE_TOKEN: 'test-token',
    authorizedLocalMusicRoots: new Set(),
    setImmediate,
  };
  vm.runInNewContext(source.slice(start, end) + '\nthis.scanFull = scanLocalMusicFolderFull;', context);
  return context.scanFull;
}

/**
 * 加载本地文件代理使用的 Content-Type 映射。
 * @returns {(filePath:string)=>string} MIME 查询函数。
 */
function loadLocalContentType() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = source.indexOf('const LOCAL_FILE_MIME =');
  const end = source.indexOf('function parseLocalFileRange(', start);
  assert.ok(start >= 0 && end > start, '未找到本地文件 MIME 映射');
  const context = { String, path };
  vm.runInNewContext(source.slice(start, end) + '\nthis.localContentTypeForPath = localContentTypeForPath;', context);
  return context.localContentTypeForPath;
}

test('SRT、VTT、ASS 歌词转换为统一时间轴行', () => {
  const parser = createTimedLyricParser();
  const srt = parser.parseTimedLyricText(
    '1\n00:00:01,000 --> 00:00:03,500\n<i>第一句</i>\n\n'
      + '2\n00:00:04.000 --> 00:00:05.000\n第二句',
  );
  assert.deepEqual(
    Array.from(srt, line => ({ t: line.t, duration: line.duration, text: line.text, source: line.source })),
    [
      { t: 1, duration: 2.5, text: '第一句', source: 'srt' },
      { t: 4, duration: 1, text: '第二句', source: 'srt' },
    ],
  );

  const vtt = parser.parseTimedLyricText(
    'WEBVTT\n\n00:01.000 --> 00:03.000\nVTT 第一行\n\n'
      + 'cue-2\n00:04.000 --> 00:05.500 align:start\nVTT 第二行',
  );
  assert.equal(vtt.length, 2);
  assert.equal(vtt[0].t, 1);
  assert.equal(vtt[0].duration, 2);
  assert.equal(vtt[1].text, 'VTT 第二行');
  assert.equal(vtt[1].source, 'vtt');

  const ass = parser.parseTimedLyricText(
    '[Script Info]\nTitle: test\n\n[Events]\n'
      + 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
      + 'Dialogue: 0,0:00:02.00,0:00:04.50,Default,,0,0,0,,{\\k20}你{\\k30}好\\N世界,继续',
  );
  assert.deepEqual(
    Array.from(ass, line => ({ t: line.t, duration: line.duration, text: line.text, source: line.source })),
    [{ t: 2, duration: 2.5, text: '你好\n世界,继续', source: 'ass' }],
  );

  const longCue = parser.parseTimedLyricText('1\n00:00:01,000 --> 00:00:21,000\n长段歌词');
  assert.equal(longCue[0].duration, 20, '字幕明确时长不得被旧 LRC 的 12 秒上限截断');

  const localParser = createLocalLyricParser();
  const localVtt = localParser.parseLocalLyricText('WEBVTT\n\n00:01.000 --> 00:03.000\n本地 VTT');
  assert.equal(localVtt[0].source, 'local-vtt');

  const yrc = parser.parseTimedLyricText('[1000,1000](1000,400,0)你(1400,600,0)好');
  assert.equal(yrc[0].source, 'yrc-word');
  assert.equal(yrc[0].words.length, 2);
});

test('本地媒体格式清单包含新增音频、封面和歌词后缀', () => {
  const classifier = createLocalFileClassifier();
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  for (const ext of ['aac', 'opus', 'webm', 'oga', 'weba']) {
    assert.equal(classifier.isLocalAudioFile({ name: `track.${ext}`, type: '' }, true), true);
  }
  for (const ext of ['srt', 'vtt', 'ass', 'yrc']) {
    assert.equal(classifier.isLocalLyricFile({ name: `track.${ext}`, type: '' }), true);
  }
  for (const ext of ['avif', 'gif', 'bmp', 'svg', 'jpe', 'jfif']) {
    assert.equal(classifier.isLocalCoverFile({ name: `cover.${ext}`, type: '' }), true);
  }
  assert.match(app, /else if \(isLocalCoverFile\(f\)\) imgFile = f;/, '单文件导入必须复用统一封面分类');

  const audioFile = { name: 'track.opus', webkitRelativePath: 'album/track.opus' };
  const lyricFile = { name: 'track.vtt', webkitRelativePath: 'album/track.vtt' };
  const coverFile = { name: 'cover.avif', webkitRelativePath: 'album/cover.avif' };
  assert.equal(classifier.findLocalLyricFile(audioFile, classifier.buildLocalLyricMaps([lyricFile])), lyricFile);
  assert.equal(classifier.findLocalCoverFile(audioFile, classifier.buildLocalCoverMaps([coverFile])), coverFile);

  for (const ext of ['aac', 'opus', 'webm', 'oga', 'weba', 'srt', 'vtt', 'ass', 'yrc', 'avif', 'gif', 'bmp', 'svg', 'jpe', 'jfif']) {
    assert.match(index, new RegExp(`\\.${ext}`));
    assert.match(main, new RegExp(`['"]\\.${ext}['"]`));
    assert.match(server, new RegExp(`['"]\\.${ext}['"]\\s*:`));
  }
});

test('桌面扫描和本地文件代理返回新增格式的正确 MIME', async () => {
  const scanFull = loadDesktopFullScan();
  const contentType = loadLocalContentType();
  const expected = {
    'track.aac': 'audio/aac',
    'track.opus': 'audio/ogg',
    'track.webm': 'audio/webm',
    'track.oga': 'audio/ogg',
    'track.weba': 'audio/webm',
    'track.srt': 'application/x-subrip',
    'track.vtt': 'text/vtt',
    'track.ass': 'text/x-ssa',
    'track.yrc': 'text/plain',
    'cover.avif': 'image/avif',
    'cover.gif': 'image/gif',
    'cover.bmp': 'image/bmp',
    'cover.svg': 'image/svg+xml',
    'cover.jpe': 'image/jpeg',
    'cover.jfif': 'image/jpeg',
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-media-formats-'));
  try {
    for (const name of Object.keys(expected)) fs.writeFileSync(path.join(root, name), 'x');
    const result = await scanFull(root);
    assert.equal(result.ok, true);
    assert.equal(result.files.length, Object.keys(expected).length);
    const byName = Object.fromEntries(Array.from(result.files, file => [file.name, file.type]));
    for (const [name, mime] of Object.entries(expected)) {
      assert.equal(byName[name], mime);
      assert.equal(contentType(path.join(root, name)).split(';')[0], mime);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
