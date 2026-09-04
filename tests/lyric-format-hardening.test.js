'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');

const APP_PATH = path.join(__dirname, '..', 'public', 'app.js');

/**
 * 读取 renderer 主脚本源码。
 * @returns {string} 完整 public/app.js 文本。
 */
function readAppSource() {
  return fs.readFileSync(APP_PATH, 'utf8');
}

/**
 * 按前后界标截取生产源码片段，保证测试跑的是线上那一份实现。
 * @param {string} source 完整源码。
 * @param {string} startAnchor 起始界标。
 * @param {string} endAnchor 结束界标。
 * @returns {string} 片段源码。
 */
function sliceSource(source, startAnchor, endAnchor) {
  const start = source.indexOf(startAnchor);
  const end = source.indexOf(endAnchor, start + 1);
  assert.ok(start >= 0 && end > start, `未找到源码接缝 ${startAnchor}`);
  return source.slice(start, end);
}

/**
 * 截取文本编码识别实现，连带真实的 TextDecoder 缓存。
 * @param {string} source 完整源码。
 * @returns {string} 编码识别源码。
 */
function textDecodeSource(source) {
  return sliceSource(source, 'var localTextDecoderCache = Object.create(null);', 'function decodeBytesWithEncoding(')
    + sliceSource(source, 'function countTextReplacementChars(', 'async function readLocalTextFileBytes(');
}

/**
 * 字节序列转小写十六进制串。
 * @param {Uint8Array} bytes 字节序列。
 * @returns {string} 十六进制串。
 */
function toHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 十六进制串转字节序列。
 * @param {string} hex 十六进制串。
 * @returns {Uint8Array} 字节序列。
 */
function fromHex(hex) {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

/**
 * 创建文本编码识别上下文，用真实 TextDecoder 覆盖 BOM、无 BOM UTF-16 与单双字节回退。
 * @returns {object} 编码识别入口集合。
 */
function createTextDecodeContext() {
  const context = { Math, Object, String, Uint8Array, TextDecoder, window: { TextDecoder } };
  vm.runInNewContext(
    textDecodeSource(readAppSource())
      + '\nthis.decodeLocalTextBuffer = decodeLocalTextBuffer;'
      + '\nthis.localTextBomEncoding = localTextBomEncoding;'
      + '\nthis.sniffBomlessUtf16Encoding = sniffBomlessUtf16Encoding;'
      + '\nthis.isStrictUtf8Bytes = isStrictUtf8Bytes;'
      + '\nthis.stripTextBom = stripTextBom;',
    context,
  );
  return context;
}

/**
 * 创建歌词字节解码上下文：真实编码识别 + 真实 KRC / QRC 解密链。
 * @returns {object} 歌词字节解码入口集合。
 */
function createLyricByteReaders() {
  const source = readAppSource();
  const context = {
    DecompressionStream,
    Int32Array,
    Math,
    Number,
    Object,
    Promise,
    Response,
    String,
    TextDecoder,
    Uint8Array,
    window: { TextDecoder },
    localFullPath: () => '',
    desktopLocalMusicApi: () => null,
    localFileSize: () => 0,
    readLocalFileBytes: async () => null,
    FileReader: function FileReaderStub() {},
  };
  vm.runInNewContext(
    textDecodeSource(source)
      + sliceSource(source, 'async function readLocalTextFileBytes(', 'function readFileAsDataUrl(')
      + '\nthis.QRC_DES_KEYS = [QRC_DES_KEY_1, QRC_DES_KEY_2, QRC_DES_KEY_3];'
      + '\nthis.qrcDesKeySchedule = qrcDesKeySchedule;'
      + '\nthis.qrcDesCryptBlock = qrcDesCryptBlock;'
      + '\nthis.qrcEncryptedPayloadBytes = qrcEncryptedPayloadBytes;'
      + '\nthis.qrcDecryptedLyricBytes = qrcDecryptedLyricBytes;'
      + '\nthis.krcEncryptedPayloadBytes = krcEncryptedPayloadBytes;'
      + '\nthis.decodeLyricFileBuffer = decodeLyricFileBuffer;'
      + '\nthis.readLocalLyricText = readLocalLyricText;',
    context,
  );
  return context;
}

/**
 * 创建本地文件分类上下文，验证歌词格式优先级与候选清单。
 * @returns {object} 文件分类与歌词候选入口。
 */
function createLocalFileClassifier() {
  const context = { Array, Intl, Math, Number, Object, RegExp, String };
  vm.runInNewContext(
    sliceSource(readAppSource(), 'var LOCAL_AUDIO_FILE_RE =', 'function localTrackInfoFromFile(')
      + '\nthis.LOCAL_LYRIC_FORMAT_RANK = LOCAL_LYRIC_FORMAT_RANK;'
      + '\nthis.objectPrototype = Object.getPrototypeOf({});'
      + '\nthis.buildLocalLyricMaps = buildLocalLyricMaps;'
      + '\nthis.findLocalLyricCandidates = findLocalLyricCandidates;'
      + '\nthis.findLocalLyricFile = findLocalLyricFile;'
      + '\nthis.localLyricFormatRank = localLyricFormatRank;'
      + '\nthis.localLyricFileExt = localLyricFileExt;',
    context,
  );
  return context;
}

/**
 * 创建同名多歌词选择记录上下文，含持久化读写与建曲时的选择套用。
 * @returns {object} 选择记录入口，`writes` 记录每次持久化调用。
 */
function createLyricPickStore() {
  const source = readAppSource();
  const store = new Map();
  const writes = [];
  const context = {
    Array,
    JSON,
    Object,
    String,
    LOCAL_LYRIC_PICK_STORE_KEY: 'mineradio-local-lyric-picks-v1',
    LOCAL_USER_STATE_LOCAL_LYRIC_PICKS: 'local-lyric-picks',
    localLyricPicks: {},
    localLyricPicksHydrated: false,
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
    },
    /** @returns {void} 记录持久化调用而不真的落盘。 */
    scheduleLocalUserStateWrite(id, value, legacyKey) {
      writes.push({ id, value: JSON.parse(JSON.stringify(value)), legacyKey });
      store.set(legacyKey, JSON.stringify(value));
    },
    /** @returns {string} 用歌曲 localKey 当自定义歌词键。 */
    songCustomLyricKey(song) { return (song && song.localKey) || ''; },
    /** @returns {string} 用相对路径当候选标识来源。 */
    localFilePath(file) { return String((file && file.webkitRelativePath) || (file && file.name) || ''); },
  };
  vm.runInNewContext(
    sliceSource(source, 'function readLocalLyricPicks(', 'function songCustomLyricKey(')
      + sliceSource(source, 'function applyStoredLocalLyricPick(', 'function createLocalSongsFromFiles(')
      + '\nthis.readLocalLyricPicks = readLocalLyricPicks;'
      + '\nthis.localLyricPickId = localLyricPickId;'
      + '\nthis.localLyricPickForSong = localLyricPickForSong;'
      + '\nthis.setLocalLyricPickForSong = setLocalLyricPickForSong;'
      + '\nthis.applyStoredLocalLyricPick = applyStoredLocalLyricPick;',
    context,
  );
  context.writes = writes;
  context.rawStore = store;
  return context;
}

/**
 * 生成最小 DOM 元素替身：设置 textContent 会清空子节点，和真实 DOM 的清空写法一致。
 * @param {string} tag 标签名。
 * @returns {object} 元素替身。
 */
function createElementStub(tag) {
  let text = '';
  const node = {
    tagName: String(tag).toUpperCase(),
    className: '',
    title: '',
    onclick: null,
    style: {},
    children: [],
    /** @returns {object} 追加的子节点。 */
    appendChild(child) { node.children.push(child); return child; },
  };
  Object.defineProperty(node, 'textContent', {
    get: () => text,
    set(value) {
      text = value == null ? '' : String(value);
      node.children.length = 0;
    },
  });
  return node;
}

/**
 * 创建同名多歌词候选按钮的渲染与切换上下文。
 * @returns {object} 渲染入口、DOM 替身与调用记录。
 */
function createLyricPickUi() {
  const row = createElementStub('div');
  const calls = { picks: [], ensured: [], toasts: [], statuses: [], refreshes: [] };
  const context = {
    Object,
    String,
    localLibrarySongs: [],
    playQueue: [],
    playlist: [],
    trackSwitchToken: 7,
    document: {
      /** @returns {object|null} 候选行替身。 */
      getElementById: id => (id === 'local-lyric-pick-row' ? row : null),
      /** @returns {object} 新建元素替身。 */
      createElement: tag => createElementStub(tag),
    },
    /** @returns {string} 候选标识用相对路径。 */
    localLyricPickId: file => String((file && file.webkitRelativePath) || (file && file.name) || '').toLowerCase(),
    /** @returns {string} 候选完整路径。 */
    localFilePath: file => String((file && file.webkitRelativePath) || (file && file.name) || ''),
    /** @returns {string} 候选后缀。 */
    localLyricFileExt: file => String((file && file.name) || '').split('.').pop().toLowerCase(),
    /** @returns {boolean} 记录写入的选择。 */
    setLocalLyricPickForSong: (song, pickId) => { calls.picks.push({ key: song && song.localKey, pickId }); return true; },
    /** @returns {void} 记录状态文案。 */
    setCustomLyricStatus: (text, tone) => { calls.statuses.push({ text, tone }); },
    /** @returns {void} 记录 toast。 */
    showToast: text => { calls.toasts.push(text); },
    /** @returns {void} 记录界面刷新。 */
    scheduleLocalAssetUiRefresh: (song, reason) => { calls.refreshes.push(reason); },
    /** @returns {Promise<boolean>} 记录重新读取歌词的调用。 */
    ensureLocalLyricsForSong: (song, opts) => {
      calls.ensured.push({ file: song.localLyricFile && song.localLyricFile.name, opts });
      return Promise.resolve(true);
    },
  };
  vm.runInNewContext(
    sliceSource(readAppSource(), 'function renderLocalLyricPickRow(', 'function openCustomLyricModal(')
      + '\nthis.renderLocalLyricPickRow = renderLocalLyricPickRow;'
      + '\nthis.useLocalLyricCandidate = useLocalLyricCandidate;'
      + '\nthis.propagateLocalLyricPick = propagateLocalLyricPick;',
    context,
  );
  context.row = row;
  context.calls = calls;
  return context;
}

/**
 * 创建歌词加载上下文，用来验证外挂歌词读空或读失败时回退到内嵌歌词。
 * @param {object} hooks 需要覆盖的读取桩：`lyricFileText`、`embeddedText`。
 * @returns {object} 歌词加载入口与调用记录。
 */
function createLyricEnsureContext(hooks) {
  const calls = { fileReads: 0, embeddedReads: 0, applied: 0, cacheWrites: 0, refreshes: [] };
  const context = {
    Promise,
    String,
    trackSwitchToken: 1,
    /** @returns {Promise<string>} 外挂歌词文件内容或抛错。 */
    readLocalLyricText() {
      calls.fileReads += 1;
      return hooks.lyricFileText();
    },
    /** @returns {Promise<string>} 内嵌歌词文本。 */
    extractEmbeddedLyricsText(file, opts) {
      calls.embeddedReads += 1;
      calls.embeddedOpts = opts;
      return Promise.resolve(hooks.embeddedText ? hooks.embeddedText() : '');
    },
    /** @returns {boolean} 是否允许读取内嵌歌词。 */
    canReadEmbeddedLyrics: () => !!hooks.embeddedText,
    /** @returns {boolean} 后台轻扫不参与这组断言。 */
    canReadTruncatableEmbeddedLyrics: () => false,
    /** @returns {string} 内嵌歌词来源标签。 */
    embeddedLyricSourceLabel: () => 'FLAC LYRICS',
    /** @returns {void} 记录缓存写入。 */
    scheduleLocalAssetCacheWrite: () => { calls.cacheWrites += 1; },
    /** @returns {void} 同名副本同步不参与这组断言。 */
    syncLocalSongAssetFields: () => {},
    /** @returns {void} 记录界面刷新原因。 */
    scheduleLocalAssetUiRefresh: (song, reason) => { calls.refreshes.push(reason); },
    /** @returns {void} 记录歌词应用次数。 */
    maybeApplyLocalLyricsForSong: () => { calls.applied += 1; },
    /** @returns {boolean} 测试歌曲始终视为当前播放项。 */
    isCurrentLocalQueueSong: () => true,
    /** @returns {boolean} 测试歌曲始终持有歌词驻留权。 */
    shouldRetainLocalLyricText: () => true,
    /** @returns {void} 自定义歌词控件刷新不参与这组断言。 */
    updateCustomLyricControls: () => {},
    /** @returns {Promise<number>} 这组断言不走 IndexedDB 补水。 */
    hydrateLocalAssetCacheForSongRange: () => Promise.resolve(0),
  };
  vm.runInNewContext(
    sliceSource(readAppSource(), 'function hydrateLocalLyricCacheForSong(', 'function loadLocalLyricsForSong(')
      + '\nthis.ensureLocalLyricsForSong = ensureLocalLyricsForSong;',
    context,
  );
  context.calls = calls;
  return context;
}

/**
 * 创建歌词文本解析上下文，验证时间轴解析与时长收敛。
 * @returns {object} 解析入口集合。
 */
function createLyricParser() {
  /** @returns {boolean} 空白文本视为无歌词。 */
  function isNoLyricText(text) { return !String(text || '').trim(); }
  const context = { Array, Math, Number, Object, String, RegExp, isFinite, isNoLyricText };
  vm.runInNewContext(
    sliceSource(readAppSource(), 'function lyricTagTimeToSeconds(', 'function renderLyrics(')
      + '\nthis.parseLyricText = parseLyricText;'
      + '\nthis.parseTimedLyricText = parseTimedLyricText;'
      + '\nthis.finalizeLyricLineDurations = finalizeLyricLineDurations;'
      + '\nthis.lyricGlobalOffsetSeconds = lyricGlobalOffsetSeconds;'
      + '\nthis.lyricLineTagToSeconds = lyricLineTagToSeconds;'
      + '\nthis.shiftLyricTagTime = shiftLyricTagTime;',
    context,
  );
  return context;
}

/**
 * 生成本地文件替身，`arrayBuffer` 让生产读取路径走浏览器分支。
 * @param {string} relativePath 相对路径，同时用作候选标识。
 * @param {Uint8Array} [bytes] 文件字节。
 * @returns {object} 文件替身。
 */
function createFileStub(relativePath, bytes) {
  const parts = String(relativePath).split('/');
  return {
    name: parts[parts.length - 1],
    webkitRelativePath: relativePath,
    /** @returns {Promise<Uint8Array>} 文件字节。 */
    arrayBuffer: () => Promise.resolve(bytes || new Uint8Array(0)),
  };
}

/**
 * 用移植版自身的分组原语反向加密歌词明文，得到 QRC 密文字节。
 * 加密链是解密链的镜像：E(K1) → D(K2) → E(K3)，尾部按零填充补齐分组。
 * @param {object} readers 歌词字节解码上下文。
 * @param {string} plainText 歌词明文。
 * @returns {Uint8Array} QRC 加密字节。
 */
function encryptQrcBytes(readers, plainText) {
  const deflated = zlib.deflateSync(Buffer.from(plainText, 'utf8'), { level: 9 });
  const padded = new Uint8Array(deflated.length + ((8 - (deflated.length % 8)) % 8));
  padded.set(deflated, 0);
  const schedules = [
    readers.qrcDesKeySchedule(readers.QRC_DES_KEYS[0], false),
    readers.qrcDesKeySchedule(readers.QRC_DES_KEYS[1], true),
    readers.qrcDesKeySchedule(readers.QRC_DES_KEYS[2], false),
  ];
  const cipher = new Uint8Array(padded.length);
  const stage1 = new Uint8Array(8);
  const stage2 = new Uint8Array(8);
  for (let i = 0; i < padded.length; i += 8) {
    readers.qrcDesCryptBlock(padded, i, stage1, 0, schedules[0]);
    readers.qrcDesCryptBlock(stage1, 0, stage2, 0, schedules[1]);
    readers.qrcDesCryptBlock(stage2, 0, cipher, i, schedules[2]);
  }
  return cipher;
}

/**
 * 按 UTF-8 解码字节，用来核对解密结果。
 * @param {Uint8Array} bytes 明文字节。
 * @returns {string} 文本。
 */
function utf8Text(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * 文本转 UTF-8 字节。
 * @param {string} text 文本。
 * @returns {Uint8Array} 字节序列。
 */
function utf8Bytes(text) {
  return new Uint8Array(Buffer.from(text, 'utf8'));
}

/**
 * ASCII 文本转字节，用于构造十六进制形态的 QRC 密文文件。
 * @param {string} text ASCII 文本。
 * @returns {Uint8Array} 字节序列。
 */
function asciiBytes(text) {
  return new Uint8Array(Buffer.from(text, 'ascii'));
}

test('QRC 非标准 DES 分组输出锁定在已知答案上', () => {
  const readers = createLyricByteReaders();
  const input = fromHex('0011223344556677');
  // 这套分组密码故意偏离标准 DES（S 盒笔误、PC-2 的 pos - 27、15 轮半、末尾不交换），
  // 平台自带的 crypto/des-ede3 对不上，所以用已知答案向量锁死移植结果。
  const vectors = [
    { key: 0, decrypt: false, out: '2ee37fef94b5f5f8' },
    { key: 0, decrypt: true, out: '208ee920df35a4e6' },
    { key: 1, decrypt: false, out: '6d69f8cf914320b8' },
    { key: 1, decrypt: true, out: 'cb9099c684168d39' },
    { key: 2, decrypt: false, out: 'e4d37693f95b9cf1' },
    { key: 2, decrypt: true, out: 'cc953d3f508dfc89' },
  ];
  const out = new Uint8Array(8);
  for (const vector of vectors) {
    const schedule = readers.qrcDesKeySchedule(readers.QRC_DES_KEYS[vector.key], vector.decrypt);
    readers.qrcDesCryptBlock(input, 0, out, 0, schedule);
    assert.equal(toHex(out), vector.out, `K${vector.key + 1} decrypt=${vector.decrypt} 的分组输出变了`);
  }
  // 三把密钥、两个方向都必须互不相同，密钥表不能串味。
  assert.equal(new Set(vectors.map(vector => vector.out)).size, vectors.length);
});

test('QRC 加密歌词的十六进制与二进制形态都能解密成明文', async () => {
  const readers = createLyricByteReaders();
  const plain = '[1000,2000]密(1000,500)文(1500,500)';
  const pinnedHex = 'B5B302E9D93FE91A623AB8C85F7B63D75EF437514B12C750753D73020E0FC4F9A06F6E682A30B71C';
  const cipher = encryptQrcBytes(readers, plain);
  assert.equal(toHex(cipher).toUpperCase(), pinnedHex, 'QRC 加密链的密文向量变了');

  // 二进制密文：整段长度按分组对齐，中间必然带控制字节。
  assert.equal(cipher.length % 8, 0);
  assert.equal(utf8Text(await readers.qrcDecryptedLyricBytes(cipher)), plain);
  assert.equal(await readers.decodeLyricFileBuffer(cipher), plain);

  // 十六进制文本密文：大小写和换行、空格都得认。
  const spacedHex = pinnedHex.toLowerCase().replace(/(.{16})/g, '$1\r\n');
  for (const variant of [pinnedHex, pinnedHex.toLowerCase(), spacedHex]) {
    assert.equal(utf8Text(await readers.qrcDecryptedLyricBytes(asciiBytes(variant))), plain, variant.slice(0, 8));
    assert.equal(await readers.decodeLyricFileBuffer(asciiBytes(variant)), plain);
  }

  // 走完整读取链：文件替身 → 字节 → 解密 → 解码。
  assert.equal(await readers.readLocalLyricText(createFileStub('a/密文.qrc', asciiBytes(pinnedHex))), plain);
  assert.equal(await readers.readLocalLyricText(createFileStub('a/密文.qrc', cipher)), plain);

  // 解压结果自带 UTF-8 BOM 时必须剥掉，否则第一行时间标签会被 BOM 顶掉。
  const bomPlain = String.fromCharCode(0xfeff) + plain;
  assert.equal(await readers.decodeLyricFileBuffer(encryptQrcBytes(readers, bomPlain)), plain);

  // 零填充：deflate 长度不是 8 的整数倍时，尾部补的 0 得在解压前逐个剥掉。
  let padded = '[0,1000]零(0,500)填(500,500)充(1000,500)';
  /** @returns {number} 当前样本的 deflate 长度。 */
  const deflatedLength = () => zlib.deflateSync(Buffer.from(padded, 'utf8'), { level: 9 }).length;
  while (deflatedLength() % 8 === 0) padded += '声';
  assert.notEqual(deflatedLength() % 8, 0, '样本没触发零填充');
  assert.equal(utf8Text(await readers.qrcDecryptedLyricBytes(encryptQrcBytes(readers, padded))), padded);
});

test('QRC 密文识别不误伤明文歌词与其它格式', async () => {
  const readers = createLyricByteReaders();
  const lrc = '[00:01.00]明文歌词\n[00:05.00]第二行歌词\n';

  // 纯文本歌词没有控制字节，长度也不按分组对齐。
  assert.equal(readers.qrcEncryptedPayloadBytes(utf8Bytes(lrc)), null);
  assert.equal(await readers.qrcDecryptedLyricBytes(utf8Bytes(lrc)), null);
  assert.equal(await readers.decodeLyricFileBuffer(utf8Bytes(lrc)), lrc);

  // 带 BOM 的文本一定是文本，三种 BOM 都要先行短路。
  for (const bom of [[0xef, 0xbb, 0xbf], [0xff, 0xfe], [0xfe, 0xff]]) {
    const bytes = new Uint8Array(bom.length + 32);
    bytes.set(bom, 0);
    bytes.fill(0x41, bom.length);
    assert.equal(readers.qrcEncryptedPayloadBytes(bytes), null, `BOM ${bom[0].toString(16)} 没被短路`);
  }

  // 太短、长度不对齐、十六进制位数不成整块的都不认。
  assert.equal(readers.qrcEncryptedPayloadBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 0])), null);
  const cipher = encryptQrcBytes(readers, '[0,500]对(0,500)');
  assert.ok(readers.qrcEncryptedPayloadBytes(cipher));
  assert.equal(readers.qrcEncryptedPayloadBytes(cipher.subarray(0, cipher.length - 1)), null);
  assert.equal(readers.qrcEncryptedPayloadBytes(asciiBytes(toHex(cipher).slice(0, -2))), null);
  assert.equal(readers.qrcEncryptedPayloadBytes(asciiBytes(toHex(cipher) + 'a')), null);

  // KRC 二进制走自己的分支，不该被 QRC 抢走。
  const krcPlain = '[0,500]酷(0,500)狗(250,250)';
  const krcDeflated = zlib.deflateSync(Buffer.from(krcPlain, 'utf8'), { level: 9 });
  const krcKey = [0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47, 0x51, 0x36, 0x31, 0x2d, 0xce, 0xd2, 0x6e, 0x69];
  const krc = new Uint8Array(4 + krcDeflated.length);
  krc.set([0x6b, 0x72, 0x63, 0x31], 0);
  for (let i = 0; i < krcDeflated.length; i++) krc[4 + i] = krcDeflated[i] ^ krcKey[i % krcKey.length];
  assert.ok(readers.krcEncryptedPayloadBytes(krc));
  assert.equal(await readers.decodeLyricFileBuffer(krc), krcPlain);
});

test('歌词编码自动识别覆盖 BOM、无 BOM UTF-16 与单字节回退', () => {
  const codecs = createTextDecodeContext();
  const text = '[00:01.00]编码测试';

  // 三种 BOM：识别出编码，并且 BOM 字符本身不能留在正文里。
  const utf8Bom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8Bytes(text)]);
  assert.equal(codecs.localTextBomEncoding(utf8Bom), 'utf-8');
  assert.equal(codecs.decodeLocalTextBuffer(utf8Bom), text);
  const utf16le = new Uint8Array(Buffer.from(String.fromCharCode(0xfeff) + text, 'utf16le'));
  assert.equal(codecs.localTextBomEncoding(utf16le), 'utf-16le');
  assert.equal(codecs.decodeLocalTextBuffer(utf16le), text);
  const utf16be = new Uint8Array(Buffer.from(String.fromCharCode(0xfeff) + text, 'utf16le').swap16());
  assert.equal(codecs.localTextBomEncoding(utf16be), 'utf-16be');
  assert.equal(codecs.decodeLocalTextBuffer(utf16be), text);

  // 没有 BOM 的 UTF-16 靠 0 字节落在哪一侧来分辨。
  const bomlessLe = new Uint8Array(Buffer.from(text, 'utf16le'));
  const bomlessBe = new Uint8Array(Buffer.from(text, 'utf16le').swap16());
  assert.equal(codecs.sniffBomlessUtf16Encoding(bomlessLe), 'utf-16le');
  assert.equal(codecs.sniffBomlessUtf16Encoding(bomlessBe), 'utf-16be');
  assert.equal(codecs.decodeLocalTextBuffer(bomlessLe), text);
  assert.equal(codecs.decodeLocalTextBuffer(bomlessBe), text);
  // 单字节文本和过短的输入都不能被误判成 UTF-16。
  assert.equal(codecs.sniffBomlessUtf16Encoding(utf8Bytes(text)), '');
  assert.equal(codecs.sniffBomlessUtf16Encoding(utf8Bytes('[00:0')), '');

  // 合法 UTF-8 直接定稿，不进候选猜测。
  assert.equal(codecs.isStrictUtf8Bytes(utf8Bytes(text)), true);
  assert.equal(codecs.decodeLocalTextBuffer(utf8Bytes(text)), text);
  // 按范围读取时末尾多字节序列会被截断，这不算编码错误，整篇不能改判成 gb18030。
  const truncated = utf8Bytes(text).subarray(0, utf8Bytes(text).length - 1);
  assert.equal(codecs.isStrictUtf8Bytes(truncated), true);
  assert.ok(codecs.decodeLocalTextBuffer(truncated).startsWith('[00:01.00]编码测'));

  // 过长编码、代理区码位、越界码位一律不算合法 UTF-8。
  assert.equal(codecs.isStrictUtf8Bytes(new Uint8Array([0xc0, 0xaf])), false);
  assert.equal(codecs.isStrictUtf8Bytes(new Uint8Array([0xe0, 0x80, 0xaf])), false);
  assert.equal(codecs.isStrictUtf8Bytes(new Uint8Array([0xed, 0xa0, 0x80])), false);
  assert.equal(codecs.isStrictUtf8Bytes(new Uint8Array([0xf5, 0x80, 0x80, 0x80])), false);
  assert.equal(codecs.isStrictUtf8Bytes(new Uint8Array([0x41, 0xc2, 0x41])), false);

  // GBK 落盘的歌词不是合法 UTF-8，回退候选里 gb18030 排第一，正文得完整还原。
  const gbk = new Uint8Array([...asciiBytes('[00:01.00]'), 0xb1, 0xe0, 0xc2, 0xeb, 0xb2, 0xe2, 0xca, 0xd4]);
  assert.equal(codecs.isStrictUtf8Bytes(gbk), false);
  assert.equal(codecs.decodeLocalTextBuffer(gbk), text);
  assert.equal(codecs.stripTextBom(String.fromCharCode(0xfeff) + text), text);
});

test('同名多歌词按格式优先级排序并给出候选清单', () => {
  const classifier = createLocalFileClassifier();
  // 逐字时间轴排最前，逐行 LRC 次之，字幕再次之，纯文本兜底，未知后缀最后。
  assert.deepEqual({ ...classifier.LOCAL_LYRIC_FORMAT_RANK }, {
    qrc: 0, krc: 0, ttml: 0, yrc: 0, lrc: 1, ass: 2, srt: 2, vtt: 2, txt: 3,
  });
  assert.equal(classifier.localLyricFormatRank(createFileStub('a/song.qrc')), 0);
  assert.equal(classifier.localLyricFormatRank(createFileStub('a/song.lrc')), 1);
  assert.equal(classifier.localLyricFormatRank(createFileStub('a/song.srt')), 2);
  assert.equal(classifier.localLyricFormatRank(createFileStub('a/song.txt')), 3);
  assert.equal(classifier.localLyricFormatRank(createFileStub('a/song.lyric')), 4);
  assert.equal(classifier.localLyricFileExt(createFileStub('a/song.QRC')), 'qrc');
  assert.equal(classifier.localLyricFileExt(createFileStub('a/song')), '');

  const audio = createFileStub('a/song.mp3');
  const txt = createFileStub('a/song.txt');
  const lrc = createFileStub('a/song.lrc');
  const qrc = createFileStub('a/song.qrc');
  const vtt = createFileStub('a/song.vtt');
  const other = createFileStub('a/别的歌.lrc');
  const maps = classifier.buildLocalLyricMaps([txt, other, vtt, lrc, qrc]);
  const candidates = Array.from(classifier.findLocalLyricCandidates(audio, maps));
  assert.deepEqual(candidates.map(file => file.name), ['song.qrc', 'song.lrc', 'song.vtt', 'song.txt']);
  // 老接口只取最优先的一个，行为不能变。
  assert.equal(classifier.findLocalLyricFile(audio, maps), qrc);
  // 同名候选去重：三层索引命中同一批文件时不能重复列出。
  assert.equal(new Set(candidates).size, candidates.length);
  assert.equal(classifier.findLocalLyricCandidates(createFileStub('a/无歌词.mp3'), maps).length, 0);

  // 同格式撞车按路径排序，保证同一批文件每次导入结果一致。
  const deepQrc = createFileStub('a/b/song.qrc');
  const sameRank = classifier.buildLocalLyricMaps([deepQrc, qrc]);
  assert.deepEqual(
    Array.from(classifier.findLocalLyricCandidates(audio, sameRank), file => file.webkitRelativePath),
    ['a/song.qrc', 'a/b/song.qrc'],
  );
});

test('磁盘文件名不能污染原型，也不能凭原型属性混进候选', () => {
  const classifier = createLocalFileClassifier();
  const polluted = classifier.buildLocalLyricMaps([
    createFileStub('__proto__.lrc'),
    createFileStub('constructor.lrc'),
  ]);
  // `__proto__` 直接挡掉；模糊键去掉下划线后变成普通键，可以正常入桶。
  assert.deepEqual(Object.keys(polluted.byPath), ['constructor']);
  assert.deepEqual(Object.keys(polluted.byBase), ['constructor']);
  assert.deepEqual(Object.keys(polluted.byLoose).sort(), ['constructor', 'proto']);
  assert.equal(classifier.objectPrototype[0], undefined);
  assert.equal(classifier.objectPrototype.length, undefined);
  assert.equal(Object.prototype[0], undefined);

  // `constructor.mp3` 之类的文件名不能靠 `Object.length === 1` 混出一个 undefined 候选。
  const empty = classifier.buildLocalLyricMaps([]);
  for (const name of ['constructor', '__proto__', 'toString', 'valueOf']) {
    const found = classifier.findLocalLyricCandidates(createFileStub(name + '.mp3'), empty);
    assert.deepEqual(Array.from(found), [], name + ' 混进了候选');
    assert.equal(classifier.findLocalLyricFile(createFileStub(name + '.mp3'), empty), null);
  }
  // 真的有同名歌词时照常命中。
  const real = createFileStub('constructor.lrc');
  assert.equal(classifier.findLocalLyricFile(createFileStub('constructor.mp3'), classifier.buildLocalLyricMaps([real])), real);
});

test('同名多歌词选择被记住并在重新导入后套用', () => {
  const store = createLyricPickStore();
  const lrc = createFileStub('a/song.lrc');
  const qrc = createFileStub('a/song.qrc');
  /** @returns {object} 新导入的歌曲对象，歌词默认取优先级最高的候选。 */
  const makeSong = () => ({
    localKey: 'local:a/song.mp3',
    localLyricCandidates: [qrc, lrc],
    localLyricFile: qrc,
    localLyricFileName: 'song.qrc',
  });

  // 没有记录时保持自动优先级。
  const song = makeSong();
  assert.equal(store.localLyricPickForSong(song), '');
  assert.equal(store.applyStoredLocalLyricPick(song).localLyricFile, qrc);

  // 记住手动选择：按注册的用户状态 id 与旧 localStorage 键一起落盘。
  assert.equal(store.setLocalLyricPickForSong(song, store.localLyricPickId(lrc)), true);
  assert.equal(store.writes.length, 1);
  assert.equal(store.writes[0].id, 'local-lyric-picks');
  assert.equal(store.writes[0].legacyKey, 'mineradio-local-lyric-picks-v1');
  assert.deepEqual(store.writes[0].value, { 'local:a/song.mp3': 'a/song.lrc' });
  assert.deepEqual({ ...store.readLocalLyricPicks() }, { 'local:a/song.mp3': 'a/song.lrc' });

  // 重新导入同一文件夹：新对象按记录改写要读的歌词文件。
  const reimported = makeSong();
  assert.equal(store.applyStoredLocalLyricPick(reimported), reimported);
  assert.equal(reimported.localLyricFile, lrc);
  assert.equal(reimported.localLyricFileName, 'song.lrc');

  // 记录指向已经不在候选里的文件时，退回自动优先级而不是把歌词清空。
  const stale = makeSong();
  stale.localLyricCandidates = [qrc, createFileStub('a/song.txt')];
  store.applyStoredLocalLyricPick(stale);
  assert.equal(stale.localLyricFile, qrc);

  // 只有一个候选就没得选，记录不参与改写。
  const single = makeSong();
  single.localLyricCandidates = [lrc];
  single.localLyricFile = qrc;
  store.applyStoredLocalLyricPick(single);
  assert.equal(single.localLyricFile, qrc);

  // 清除选择：记录删掉，后续导入回到自动优先级。
  assert.equal(store.setLocalLyricPickForSong(song, ''), true);
  assert.deepEqual(store.writes[store.writes.length - 1].value, {});
  const cleared = makeSong();
  store.applyStoredLocalLyricPick(cleared);
  assert.equal(cleared.localLyricFile, qrc);

  // 没有歌曲键时不写记录；存档坏掉时读成空表而不是抛错。
  assert.equal(store.setLocalLyricPickForSong({}, 'a/song.lrc'), false);
  assert.equal(store.setLocalLyricPickForSong(null, 'a/song.lrc'), false);
  store.rawStore.set('mineradio-local-lyric-picks-v1', '{坏档');
  assert.deepEqual({ ...store.readLocalLyricPicks() }, {});
});

test('切换歌词候选清掉旧歌词状态并同步到同曲副本', async () => {
  const ui = createLyricPickUi();
  const qrc = createFileStub('a/song.qrc');
  const lrc = createFileStub('a/song.lrc');
  const song = {
    localKey: 'local:a/song.mp3',
    localLyricCandidates: [qrc, lrc],
    localLyricFile: qrc,
    localLyricFileName: 'song.qrc',
    localLyricTagName: 'song.qrc',
    localLyricText: '[00:01.00]旧歌词',
    localLyricLoaded: true,
    localLyricLightScanned: true,
    localLyricCacheHydrated: false,
    localLyricResidencyReleased: true,
  };
  const queueCopy = {
    localKey: 'local:a/song.mp3',
    localLyricFile: qrc,
    localLyricFileName: 'song.qrc',
    localLyricTagName: 'song.qrc',
    localLyricText: '[00:01.00]旧歌词',
    localLyricLoaded: true,
    localLyricLightScanned: true,
    localLyricCacheHydrated: false,
  };
  const otherSong = { localKey: 'local:b/other.mp3', localLyricFile: qrc, localLyricText: '[00:02.00]别人的歌词' };
  ui.localLibrarySongs.push(song);
  ui.playQueue.push(queueCopy, otherSong);

  // 两个以上候选才显示按钮行，正在用的那个高亮。
  ui.renderLocalLyricPickRow(song);
  assert.equal(ui.row.style.display, '');
  assert.equal(ui.row.children.length, 2);
  assert.equal(ui.row.children[0].className, 'modal-btn primary');
  assert.equal(ui.row.children[1].className, 'modal-btn');
  assert.equal(ui.row.children[0].textContent, 'song.qrc');
  assert.equal(ui.row.children[1].textContent, 'song.lrc');
  assert.equal(ui.row.children[1].title, 'a/song.lrc · LRC');

  ui.row.children[1].onclick();
  await new Promise(resolve => setImmediate(resolve));

  // 选择被记住，旧歌词状态清空，并且标成已水合以跳过 IndexedDB 里上一个文件的歌词。
  assert.deepEqual(ui.calls.picks.map(call => call.pickId), ['a/song.lrc']);
  assert.equal(song.localLyricFile, lrc);
  assert.equal(song.localLyricFileName, 'song.lrc');
  assert.equal(song.localLyricText, '');
  assert.equal(song.localLyricTagName, '');
  assert.equal(song.localLyricLoaded, false);
  assert.equal(song.localLyricLightScanned, false);
  assert.equal(song.localLyricCacheHydrated, true);
  assert.equal(song.localLyricResidencyReleased, false);

  // 同一首歌的其它视图副本跟着换，别的歌一个字段都不能动。
  assert.equal(queueCopy.localLyricFile, lrc);
  assert.equal(queueCopy.localLyricFileName, 'song.lrc');
  assert.equal(queueCopy.localLyricText, '');
  assert.equal(queueCopy.localLyricTagName, '');
  assert.equal(queueCopy.localLyricLoaded, false);
  assert.equal(queueCopy.localLyricLightScanned, false);
  assert.equal(queueCopy.localLyricCacheHydrated, true);
  assert.equal(otherSong.localLyricFile, qrc);
  assert.equal(otherSong.localLyricText, '[00:02.00]别人的歌词');

  // 重新渲染后高亮跟着走，并且真的重新读了一遍所选文件。
  assert.equal(ui.row.children[0].className, 'modal-btn');
  assert.equal(ui.row.children[1].className, 'modal-btn primary');
  assert.equal(ui.calls.ensured.length, 1);
  assert.equal(ui.calls.ensured[0].file, 'song.lrc');
  assert.equal(ui.calls.ensured[0].opts.applyCurrent, true);
  assert.equal(ui.calls.ensured[0].opts.token, 7);
  assert.deepEqual(ui.calls.statuses.map(call => call.tone), ['', 'good']);
  assert.deepEqual(ui.calls.toasts, ['已切换歌词文件：song.lrc']);
  assert.deepEqual(ui.calls.refreshes, ['local-lyric-pick']);

  // 再点已经在用的那个：只提示一句，不重复写记录也不重复读取。
  ui.row.children[1].onclick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.calls.picks.length, 1);
  assert.equal(ui.calls.ensured.length, 1);
  assert.equal(ui.calls.statuses.length, 3);
  assert.equal(ui.calls.statuses[2].tone, 'good');

  // 候选不足两个就把整行藏起来并清空按钮。
  song.localLyricCandidates = [lrc];
  ui.renderLocalLyricPickRow(song);
  assert.equal(ui.row.style.display, 'none');
  assert.equal(ui.row.children.length, 0);
  ui.renderLocalLyricPickRow(null);
  assert.equal(ui.row.style.display, 'none');
});

test('外挂歌词读空或读失败时回退到内嵌歌词', async () => {
  // 外挂文件是空文件：内嵌歌词得顶上，来源标签也要换成内嵌。
  const empty = createLyricEnsureContext({
    lyricFileText: () => Promise.resolve('   \n'),
    embeddedText: () => '[00:03.00]内嵌歌词',
  });
  const emptySong = { localKey: 'k', localFile: {}, localLyricFile: { name: 'song.qrc' }, localLyricFileName: 'song.qrc' };
  assert.equal(await empty.ensureLocalLyricsForSong(emptySong, { applyCurrent: true, token: 1 }), true);
  assert.equal(emptySong.localLyricText, '[00:03.00]内嵌歌词');
  assert.equal(emptySong.localLyricTagName, 'FLAC LYRICS');
  assert.equal(emptySong.localLyricFileName, 'song.qrc');
  assert.equal(emptySong.localLyricLoaded, true);
  assert.equal(empty.calls.embeddedReads, 1);
  assert.equal(empty.calls.embeddedOpts.light, false);
  assert.deepEqual(empty.calls.refreshes, ['local-lyric-prefetch']);

  // 解密失败、编码坏掉之类的读取异常，同样不该把能用的内嵌歌词整首挡掉。
  const failed = createLyricEnsureContext({
    lyricFileText: () => Promise.reject(new Error('decrypt failed')),
    embeddedText: () => '[00:04.00]内嵌歌词',
  });
  const failedSong = { localKey: 'k', localFile: {}, localLyricFile: { name: 'bad.qrc' } };
  assert.equal(await failed.ensureLocalLyricsForSong(failedSong, { applyCurrent: true, token: 1 }), true);
  assert.equal(failedSong.localLyricText, '[00:04.00]内嵌歌词');
  assert.equal(failedSong.localLyricTagName, 'FLAC LYRICS');
  // 建曲时没有文件名的话，用内嵌来源顶上，界面不会显示空标签。
  assert.equal(failedSong.localLyricFileName, 'FLAC LYRICS');

  // 外挂文件读到内容时不去碰内嵌歌词，来源标签留给文件名。
  const hit = createLyricEnsureContext({
    lyricFileText: () => Promise.resolve('[00:05.00]外挂歌词'),
    embeddedText: () => '[00:06.00]内嵌歌词',
  });
  const hitSong = { localKey: 'k', localFile: {}, localLyricFile: { name: 'song.lrc' }, localLyricFileName: 'song.lrc' };
  assert.equal(await hit.ensureLocalLyricsForSong(hitSong, { applyCurrent: true, token: 1 }), true);
  assert.equal(hitSong.localLyricText, '[00:05.00]外挂歌词');
  assert.equal(hit.calls.embeddedReads, 0);
  assert.equal(hitSong.localLyricTagName, undefined);

  // 两边都没有歌词：标成已加载，别反复读同一首。
  const none = createLyricEnsureContext({ lyricFileText: () => Promise.resolve('') });
  const noneSong = { localKey: 'k', localFile: {}, localLyricFile: { name: 'song.lrc' } };
  assert.equal(await none.ensureLocalLyricsForSong(noneSong, { applyCurrent: true, token: 1 }), false);
  assert.equal(noneSong.localLyricText, '');
  assert.equal(noneSong.localLyricLoaded, true);
  assert.equal(none.calls.embeddedReads, 0);

  // 连外挂文件都没有、也没有内嵌歌词时直接收工。
  const bare = createLyricEnsureContext({ lyricFileText: () => Promise.resolve('') });
  const bareSong = { localKey: 'k', localFile: {} };
  assert.equal(await bare.ensureLocalLyricsForSong(bareSong, { applyCurrent: true, token: 1 }), false);
  assert.equal(bareSong.localLyricLoaded, true);
  assert.equal(bare.calls.fileReads, 0);
  assert.equal(bare.calls.cacheWrites, 1);
});

test('歌词时间轴异常修复：全局偏移、时分秒与时长收敛', () => {
  const parser = createLyricParser();

  // [offset:] 按 LRC 惯例：正值提前，负值延后，缺省不动。
  assert.equal(parser.lyricGlobalOffsetSeconds('[offset:+500]\n[00:10.00]甲'), -0.5);
  assert.equal(parser.lyricGlobalOffsetSeconds('[offset:-500]\n[00:10.00]甲'), 0.5);
  assert.equal(parser.lyricGlobalOffsetSeconds('[ offset : 250 ]\n[00:10.00]甲'), -0.25);
  assert.equal(parser.lyricGlobalOffsetSeconds('[00:10.00]甲'), 0);
  // 偏移后越过 0 的行贴到 0，不能出现负时间把整轨排序搞乱。
  assert.equal(parser.shiftLyricTagTime(1, -2), 0);
  assert.equal(parser.shiftLyricTagTime(1, -0.4), 0.6);

  assert.equal(parser.parseLyricText('[offset:+500]\n[00:10.00]甲')[0].t, 9.5);
  assert.equal(parser.parseLyricText('[offset:-500]\n[00:10.00]甲')[0].t, 10.5);
  assert.equal(parser.parseLyricText('[offset:+2000]\n[00:01.00]甲')[0].t, 0);
  // Enhanced LRC 的逐字时间轴跟着整行一起偏移。
  const shifted = parser.parseLyricText('[offset:+500]\n[00:10.00]<00:10.00>甲<00:11.00>乙');
  assert.equal(shifted[0].t, 9.5);
  assert.deepEqual(Array.from(shifted[0].words, word => word.t), [9.5, 10.5]);

  // 时间标签的四种写法：mm:ss、mm:ss.xx、mm:ss:xx（冒号分隔的百分秒）、hh:mm:ss.xxx。
  assert.equal(parser.lyricLineTagToSeconds('01', '02'), 62);
  assert.equal(parser.lyricLineTagToSeconds('01', '02', undefined, '50'), 62.5);
  assert.equal(parser.lyricLineTagToSeconds('01', '02', '50'), 62.5);
  assert.equal(parser.lyricLineTagToSeconds('01', '02', '03', '400'), 3723.4);
  // 小数位按位数缩放，不再固定当毫秒；超过 6 位截断。
  assert.equal(parser.lyricLineTagToSeconds('00', '01', undefined, '5'), 1.5);
  assert.equal(parser.lyricLineTagToSeconds('00', '01', undefined, '1234'), 1.1234);
  assert.equal(parser.lyricLineTagToSeconds('00', '01', undefined, '1234567'), 1.123456);
  assert.equal(parser.parseLyricText('[01:02:50]甲')[0].t, 62.5);
  assert.equal(parser.parseLyricText('[01:02:03.400]甲')[0].t, 3723.4);
  // 超过 99 分钟的长音频不能再被两位分钟数截掉。
  assert.equal(parser.parseLyricText('[100:05.50]长曲')[0].t, 6005.5);

  // 逐行歌词的时长按下一行推断，并收敛到 [0.45, 12]。
  const sparse = parser.parseLyricText('[00:00.00]甲\n[00:30.00]乙');
  assert.equal(sparse[0].duration, 12);
  assert.equal(sparse[1].duration, 4.8);
  const dense = parser.parseLyricText('[00:00.00]甲\n[00:00.10]乙');
  assert.equal(dense[0].duration, 0.45);

  // 逐字格式自带的显式时长照原样保留，超过 12 秒的长句不能被截短。
  const qrc = parser.parseTimedLyricText('[1000,20000]很长的一行(1000,20000)');
  assert.equal(qrc[0].t, 1);
  assert.equal(qrc[0].duration, 20);
  assert.deepEqual(
    Array.from(parser.finalizeLyricLineDurations([{ t: 0, text: '甲', duration: 30 }], true), line => line.duration),
    [30],
  );
  assert.deepEqual(
    Array.from(parser.finalizeLyricLineDurations([{ t: 0, text: '甲', duration: 30 }]), line => line.duration),
    [12],
  );
});
