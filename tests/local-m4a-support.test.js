const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const url = require('node:url');

/**
 * 从渲染器源码截取本地标签、范围读取和封面解析实现。
 * @returns {string} 可在隔离上下文中执行的生产源码。
 */
function readLocalM4aParserSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function base64ChunksToBytes(');
  const end = source.indexOf('function applyLocalMetadataTags(', start);
  assert.ok(start >= 0 && end > start, '未找到本地 M4A 解析接缝');
  return source.slice(start, end);
}

/**
 * 创建一个带四字节类型和 payload 的 MP4 atom。
 * @param {string} type atom 类型。
 * @param {Buffer} payload atom 数据。
 * @returns {Buffer} 完整 atom 字节。
 */
function atom(type, payload) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, 4, 'latin1');
  return Buffer.concat([header, payload]);
}

/**
 * 创建 iTunes metadata data atom。
 * @param {number} dataType iTunes 数据类型标记。
 * @param {Buffer} payload 展示值或图片字节。
 * @returns {Buffer} data atom。
 */
function m4aDataAtom(dataType, payload) {
  const descriptor = Buffer.alloc(8);
  descriptor.writeUInt32BE(dataType >>> 0, 0);
  return atom('data', Buffer.concat([descriptor, payload]));
}

/**
 * 将文本编码为 M4A 常见的 UTF-16BE data atom 值。
 * @param {string} text 展示文本。
 * @returns {Buffer} UTF-16BE 字节。
 */
function utf16Be(text) {
  const utf16le = Buffer.from(text, 'utf16le');
  for (let i = 0; i < utf16le.length; i += 2) {
    const first = utf16le[i];
    utf16le[i] = utf16le[i + 1];
    utf16le[i + 1] = first;
  }
  return utf16le;
}

/**
 * 创建带文本标签和 JPEG 封面的最小 M4A 文件。
 * @returns {{bytes:Buffer, image:Buffer, metadataOffset:number}} 连续文件夹具。
 */
function buildM4aFixture() {
  const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x4d, 0x34, 0x41, 0x00, 0xff, 0xd9]);
  const track = Buffer.from([0, 0, 0, 7, 0, 12, 0, 0]);
  const ilst = Buffer.concat([
    atom('\xa9nam', m4aDataAtom(1, Buffer.from('M4A 标题', 'utf8'))),
    atom('\xa9ART', m4aDataAtom(1, Buffer.from('M4A 艺术家', 'utf8'))),
    atom('\xa9alb', m4aDataAtom(1, Buffer.from('M4A 专辑', 'utf8'))),
    atom('aART', m4aDataAtom(1, Buffer.from('M4A 专辑艺术家', 'utf8'))),
    atom('\xa9day', m4aDataAtom(1, Buffer.from('2026-08-12', 'utf8'))),
    atom('trkn', m4aDataAtom(0, track)),
    atom('covr', m4aDataAtom(13, image)),
  ]);
  const meta = atom('meta', Buffer.concat([Buffer.alloc(4), atom('ilst', ilst)]));
  const moov = atom('moov', atom('udta', meta));
  const ftyp = atom('ftyp', Buffer.from('M4A \x00\x00\x00\x00isom', 'latin1'));
  const mdat = atom('mdat', Buffer.alloc(5 * 1024 * 1024, 0x11));
  const bytes = Buffer.concat([ftyp, mdat, moov]);
  return { bytes, image, metadataOffset: ftyp.length + mdat.length };
}

/**
 * 创建直接挂在 moov/meta 下、包含 UTF-16 标签和 PNG 封面的 M4A 夹具。
 * @returns {{bytes:Buffer, image:Buffer}} 直挂结构夹具。
 */
function buildDirectMetadataFixture() {
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const ilst = Buffer.concat([
    atom('\xa9nam', m4aDataAtom(2, utf16Be('UTF-16 标题'))),
    atom('covr', m4aDataAtom(14, image)),
  ]);
  const meta = atom('meta', Buffer.concat([Buffer.alloc(4), atom('ilst', ilst)]));
  const moov = atom('moov', meta);
  const ftyp = atom('ftyp', Buffer.from('M4A \x00\x00\x00\x00isom', 'latin1'));
  return { bytes: Buffer.concat([ftyp, moov]), image };
}

/**
 * 创建使用真实范围读取入口的 M4A 解析测试环境。
 * @param {Buffer} bytes 虚拟文件完整字节。
 * @returns {{context:object,requests:Array<object>}} 隔离上下文和读取记录。
 */
function createM4aParserHarness(bytes) {
  const requests = [];

  /**
   * 返回测试文件逻辑大小。
   * @param {object} file 本地文件记录。
   * @returns {number} 文件字节数。
   */
  function localFileSize(file) { return Number(file && file.size) || bytes.length; }

  /**
   * 返回测试文件绝对路径，驱动桌面 IPC 范围读取分支。
   * @param {object} file 本地文件记录。
   * @returns {string} 文件路径。
   */
  function localFullPath(file) { return String(file && file.fullPath || ''); }

  /**
   * 按生产 IPC 契约返回指定范围，禁止测试绕过范围读取直接注入完整文件。
   * @param {string} fullPath 文件路径。
   * @param {number} start 起始偏移。
   * @param {number|null} end 结束偏移。
   * @returns {Promise<object>} 分块读取结果。
   */
  function readLocalFileRange(fullPath, start, end) {
    const stop = end == null ? bytes.length : Math.min(bytes.length, end);
    const range = bytes.subarray(Math.min(bytes.length, start), stop);
    requests.push({ fullPath, start, end });
    return Promise.resolve({
      ok: true,
      base64Chunks: [range.toString('base64')],
      byteLength: range.length,
    });
  }

  /** @returns {object} 桌面本地音乐桥接对象。 */
  function desktopLocalMusicApi() { return { readLocalFileRange }; }

  const context = {
    Array,
    Blob,
    Error,
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    Promise,
    String,
    TextDecoder,
    Uint8Array,
    atob,
    console: { warn() {} },
    desktopLocalMusicApi,
    localFileSize,
    localFullPath,
  };
  vm.runInNewContext(
    readLocalM4aParserSource()
      + '\nthis.extractMetadata = extractLocalMetadataTags;'
      + '\nthis.extractCover = extractEmbeddedCoverSource;',
    context,
  );
  return { context, requests };
}

/**
 * 验证后台轻量扫描在 moov 超出范围时保持可重试，前台完整扫描读取标签和封面。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testM4aMetadataAndCoverParsing() {
  const fixture = buildM4aFixture();
  const harness = createM4aParserHarness(fixture.bytes);
  const file = {
    name: 'fixture.m4a',
    fullPath: 'C:\\Music\\fixture.m4a',
    size: fixture.bytes.length,
  };

  const light = await harness.context.extractMetadata(file, { light: true });
  assert.equal(light._mineradioScanComplete, false, 'moov 超出轻量范围时必须允许前台重试');
  assert.equal(light.title, undefined);

  const tags = await harness.context.extractMetadata(file, {});
  assert.deepEqual(
    {
      title: tags.title,
      artist: tags.artist,
      album: tags.album,
      albumArtist: tags.albumArtist,
      year: tags.year,
      track: tags.track,
    },
    {
      title: 'M4A 标题',
      artist: 'M4A 艺术家',
      album: 'M4A 专辑',
      albumArtist: 'M4A 专辑艺术家',
      year: '2026-08-12',
      track: '7',
    },
  );
  assert.equal(tags._mineradioScanComplete, true);

  const cover = await harness.context.extractCover(file, {});
  assert.ok(cover, 'M4A covr 必须返回封面');
  assert.equal(cover.type, 'image/jpeg');
  assert.deepEqual(Array.from(new Uint8Array(await cover.arrayBuffer())), Array.from(fixture.image));
  assert.ok(harness.requests.some(request => request.start === fixture.metadataOffset));
}

/**
 * 验证文件夹导入路径把 M4A 视为音频文件，而不是只支持 MP3/FLAC。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testM4aFolderImportAndScan() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('var LOCAL_AUDIO_FILE_RE =');
  const end = source.indexOf('function isLocalLyricFile(', start);
  assert.ok(start >= 0 && end > start, '未找到本地音频筛选接缝');
  const context = { String, RegExp };
  vm.runInNewContext(
    source.slice(start, end) + '\nthis.isLocalAudio = isLocalAudioFile;',
    context,
  );
  assert.equal(context.isLocalAudio({ name: 'track.m4a', type: '' }, true), true);
  assert.equal(context.isLocalAudio({ name: 'track.wav', type: '' }, true), true);
  assert.equal(context.isLocalAudio({ name: 'track.ogg', type: '' }, true), true);

  const indexSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.match(indexSource, /accept="[^"]*\.m4a/);

  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(serverSource, /['"]\.m4a['"]\s*:\s*['"]audio\/mp4['"]/);

  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const scanStart = mainSource.indexOf('const LOCAL_LIBRARY_EXTS = new Set(');
  const scanEnd = mainSource.indexOf('async function scanLocalMusicFolder(folderPath, options)', scanStart);
  assert.ok(scanStart >= 0 && scanEnd > scanStart, '未找到桌面曲库扫描接缝');
  const scanContext = {
    path,
    fs,
    Intl,
    Promise,
    Math,
    Number,
    Set,
    Map,
    Array,
    Date,
    setImmediate,
    pathToFileURL: url.pathToFileURL,
    mainServerPort: 0,
    LOCAL_FILE_TOKEN: 'test-token',
    authorizedLocalMusicRoots: new Set(),
  };
  vm.runInNewContext(
    mainSource.slice(scanStart, scanEnd) + '\nthis.scanFull = scanLocalMusicFolderFull;',
    scanContext,
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-m4a-'));
  try {
    fs.writeFileSync(path.join(root, 'track.m4a'), 'm4a');
    const result = await scanContext.scanFull(root);
    assert.equal(result.ok, true);
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].name, 'track.m4a');
    assert.equal(result.files[0].type, 'audio/mp4');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/**
 * 验证标准 data atom 头、UTF-16 文本和 PNG covr 封面不会依赖旧错误夹具。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testM4aStandardDataAtomVariants() {
  const fixture = buildDirectMetadataFixture();
  const harness = createM4aParserHarness(fixture.bytes);
  const file = {
    name: 'direct.m4a',
    fullPath: 'C:\\Music\\direct.m4a',
    size: fixture.bytes.length,
  };
  const tags = await harness.context.extractMetadata(file, {});
  assert.equal(tags.title, 'UTF-16 标题');
  assert.equal(tags._mineradioScanComplete, true);
  const cover = await harness.context.extractCover(file, {});
  assert.ok(cover, '标准 data atom 的 PNG covr 必须返回封面');
  assert.equal(cover.type, 'image/png');
  assert.deepEqual(Array.from(new Uint8Array(await cover.arrayBuffer())), Array.from(fixture.image));
}

test('M4A 轻量重试、标签和 covr 封面解析', testM4aMetadataAndCoverParsing);
test('M4A 文件夹导入和桌面曲库扫描支持', testM4aFolderImportAndScan);
test('M4A 标准 data atom、UTF-16 标签和 PNG 封面解析', testM4aStandardDataAtomVariants);
