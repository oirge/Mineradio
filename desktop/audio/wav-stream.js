'use strict';
/**
 * 把 APE / DSF 实时转码成 WAV 字节流。
 *
 * Chromium 不认识 Monkey's Audio 与 DSD，但认识未压缩 PCM WAV。本模块把这两种
 * 格式包装成一个“虚拟 WAV 文件”：总长度可精确算出，任意字节区间都能按需解码，
 * 于是 /api/local-file 的 Range 请求（<audio> 拖动进度条）可以照常工作。
 *
 * 只有本模块碰文件系统，两个解码器仍然只接受 read(offset, length) 读取器。
 */
var fs = require('fs');
var path = require('path');
var Readable = require('stream').Readable;
var ape = require('./ape-decoder.js');
var dsf = require('./dsf-decoder.js');

var WAV_HEADER_BYTES = 44;
var STREAM_CHUNK_BYTES = 64 * 1024;   // 每次推送的字节数（约 0.1~0.4 秒音频）
var INFO_CACHE_MAX = 8;               // 头部 / 滤波器表缓存条数
var MAX_WAV_BYTES = 0xfffffff0;       // RIFF 长度字段是 32 位
var TRANSCODE_KINDS = { '.ape': 'ape', '.dsf': 'dsf' };

/** 头部与查表结果缓存：同一文件的多次 Range 请求不必重复解析。 */
var infoCache = [];

/**
 * 判断某个路径是否需要转码后才能播放。
 * @param {string} filePath 文件路径。
 * @returns {string} 'ape' / 'dsf'，不需要转码时返回空串。
 */
function transcodeKind(filePath) {
  return TRANSCODE_KINDS[path.extname(String(filePath || '')).toLowerCase()] || '';
}

/**
 * 生成 44 字节 WAV 头（PCM，小端交错）。
 * @param {Object} spec 含 channels / sampleRate / bps / bytesPerSample / totalSamples。
 * @returns {Buffer} 头部。
 */
function buildWavHeader(spec) {
  var frameBytes = spec.channels * spec.bytesPerSample;
  var dataBytes = Math.min(spec.totalSamples * frameBytes, MAX_WAV_BYTES - WAV_HEADER_BYTES);
  var buf = Buffer.alloc(WAV_HEADER_BYTES);
  buf.write('RIFF', 0, 'latin1');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVEfmt ', 8, 'latin1');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);                                   // WAVE_FORMAT_PCM
  buf.writeUInt16LE(spec.channels, 22);
  buf.writeUInt32LE(spec.sampleRate, 24);
  buf.writeUInt32LE(spec.sampleRate * frameBytes, 28);
  buf.writeUInt16LE(frameBytes, 32);
  buf.writeUInt16LE(spec.bps, 34);
  buf.write('data', 36, 'latin1');
  buf.writeUInt32LE(dataBytes, 40);
  return buf;
}

/**
 * APE 取样源：顺序读取时保持解码状态，跳转时从所在帧头重新解码。
 * @param {function(number, number): Buffer} read 同步读取器。
 * @param {number} fileSize 文件长度。
 * @param {Object} info parseApeInfo() 的结果。
 * @constructor
 */
function ApeSampleSource(read, fileSize, info) {
  this.read = read;
  this.fileSize = fileSize;
  this.info = info;
  this.dec = new ape.ApeDecoder(info);
  this.channels = info.channels;
  this.sampleRate = info.sampleRate;
  this.bps = info.bps;
  this.bytesPerSample = info.bps >> 3;
  this.totalSamples = info.totalBlocks;
  this.frame = -1;        // 当前已 startFrame 的帧号
  this.frameEnd = 0;      // 当前帧结束处的全局样本序号
  this.chunkBase = 0;     // 当前批次首样本的全局序号
  this.chunkLen = 0;      // 当前批次样本数
  this.warned = false;
}

/**
 * 记录一次解码错误（同一个流只提示一次，避免损坏文件刷屏）。
 * @param {Error} err 错误。
 */
ApeSampleSource.prototype.noteError = function(err) {
  if (this.warned) return;
  this.warned = true;
  console.warn('[Transcode] APE frame error, filling silence:', err && err.message);
};

/**
 * 打开一帧。若该帧不可解，登记成长度 0 的空帧，让上层继续往后找。
 * @param {number} f 帧号。
 */
ApeSampleSource.prototype.openFrame = function(f) {
  var info = this.info;
  this.frame = f;
  this.chunkBase = f * info.blocksPerFrame;
  this.chunkLen = 0;
  this.frameEnd = this.chunkBase;
  try {
    var pos = info.frames.pos[f];
    var avail = Math.min(info.frames.size[f], this.fileSize - pos);
    if (avail <= 0) throw new Error('frame beyond end of file');
    var nblocks = f === info.totalFrames - 1 ? info.finalFrameBlocks : info.blocksPerFrame;
    this.dec.startFrame(this.read(pos, avail), nblocks, info.frames.skip[f]);
    this.frameEnd = this.chunkBase + nblocks;
  } catch (err) {
    this.noteError(err);
  }
};

/**
 * 保证指定样本落在当前批次内（必要时解下一批、换下一帧或重新定位）。
 *
 * 每轮循环要么推进帧号，要么让 chunkBase + chunkLen 严格增大，两者都有上界，
 * 因此循环必然结束。
 * @param {number} sample 全局样本序号。
 * @returns {boolean} false 表示取不到（已到结尾或该段损坏）。
 */
ApeSampleSource.prototype.ensure = function(sample) {
  var info = this.info, total = info.totalFrames, base, n;
  if (this.frame < 0 || sample < this.chunkBase) {
    this.openFrame(Math.max(0, Math.min(total - 1, Math.floor(sample / info.blocksPerFrame))));
  }
  while (sample >= this.chunkBase + this.chunkLen) {
    if (this.chunkBase + this.chunkLen >= this.frameEnd) {   // 本帧解完（或空帧）
      if (this.frame + 1 >= total) return false;
      this.openFrame(this.frame + 1);
      continue;
    }
    base = this.chunkBase + this.chunkLen;
    n = 0;
    try {
      n = this.dec.decodeChunk();
    } catch (err) {
      this.noteError(err);
    }
    if (n <= 0) {                                            // 帧内提前结束
      if (this.frame + 1 >= total) return false;
      this.openFrame(this.frame + 1);
      continue;
    }
    this.chunkBase = base;
    this.chunkLen = n;
  }
  return sample >= this.chunkBase;
};

/**
 * 取一段 PCM。
 * @param {number} start 起始样本序号。
 * @param {number} count 样本数。
 * @param {Buffer} out 输出缓冲。
 * @param {number} outOff 输出偏移。
 * @returns {number} 实际写入的样本数。
 */
ApeSampleSource.prototype.readSamples = function(start, count, out, outOff) {
  var frameBytes = this.channels * this.bytesPerSample, got = 0, off, n;
  while (got < count) {
    if (!this.ensure(start + got)) break;
    off = start + got - this.chunkBase;
    n = Math.min(count - got, this.chunkLen - off);
    if (n <= 0) break;
    this.dec.writeInterleaved(out, outOff + got * frameBytes, n, false, off);
    got += n;
  }
  return got;
};

/**
 * DSF 取样源：DSD 无跨帧状态，任意位置都能直接算，天然支持随机访问。
 * @param {function(number, number): Buffer} read 同步读取器。
 * @param {Object} info parseDsfInfo() 的结果。
 * @param {Object} conv 复用的 DsdConverter。
 * @constructor
 */
function DsdSampleSource(read, info, conv) {
  this.read = read;
  this.info = info;
  this.conv = conv;
  this.channels = info.channels;
  this.sampleRate = info.sampleRate;
  this.bps = info.bps;
  this.bytesPerSample = info.bytesPerSample;
  this.totalSamples = info.totalSamples;
}

/**
 * 取一段 PCM。
 * @param {number} start 起始样本序号。
 * @param {number} count 样本数。
 * @param {Buffer} out 输出缓冲。
 * @param {number} outOff 输出偏移。
 * @returns {number} 实际写入的样本数。
 */
DsdSampleSource.prototype.readSamples = function(start, count, out, outOff) {
  var n = Math.min(count, Math.max(0, this.totalSamples - start));
  if (n > 0) this.conv.render(this.read, start, n, out, outOff);
  return n;
};

/**
 * 打开同步读取器（读到文件尾会返回较短的 Buffer，符合两个解析器的约定）。
 * @param {string} filePath 文件路径。
 * @returns {Object} { size, mtimeMs, read, close }。
 */
function openReader(filePath) {
  var fd = fs.openSync(filePath, 'r');
  var stat;
  try {
    stat = fs.fstatSync(fd);
  } catch (err) {
    fs.closeSync(fd);
    throw err;
  }
  var size = stat.size;
  return {
    size: size,
    mtimeMs: stat.mtimeMs,
    read: function(offset, length) {
      if (length <= 0 || offset >= size) return Buffer.alloc(0);
      var want = Math.min(length, size - offset);
      var buf = Buffer.allocUnsafe(want);
      var got = fs.readSync(fd, buf, 0, want, offset);
      return got === want ? buf : buf.subarray(0, got);
    },
    close: function() {
      try {
        fs.closeSync(fd);
      } catch (err) {
        /* 重复关闭无需处理 */
      }
    }
  };
}

/**
 * 取（或建立）文件头解析结果缓存。DSF 的 DsdConverter 也一并缓存：它的暂存区在每次
 * render() 开头会被整段重写，同步调用之间没有残留状态，可以安全共享。
 * @param {string} kind 'ape' / 'dsf'。
 * @param {string} filePath 文件路径。
 * @param {Object} reader openReader() 的结果。
 * @returns {Object} { key, kind, info, conv }。
 */
function cachedHeader(kind, filePath, reader) {
  var key = kind + '|' + filePath + '|' + reader.size + '|' + reader.mtimeMs;
  var i;
  for (i = 0; i < infoCache.length; i++) {
    if (infoCache[i].key === key) return infoCache[i];
  }
  var entry = { key: key, kind: kind, info: null, conv: null };
  if (kind === 'ape') {
    entry.info = ape.parseApeInfo(reader.read, reader.size);
  } else {
    entry.info = dsf.parseDsfInfo(reader.read, reader.size);
    entry.conv = new dsf.DsdConverter(entry.info);
  }
  infoCache.push(entry);
  if (infoCache.length > INFO_CACHE_MAX) infoCache.shift();
  return entry;
}

/**
 * 虚拟 WAV 文件：头部 + 按需解码的 data 区。
 * @param {Object} source 取样源（ApeSampleSource / DsdSampleSource）。
 * @constructor
 */
function WavSource(source) {
  this.source = source;
  this.frameBytes = source.channels * source.bytesPerSample;
  this.header = buildWavHeader(source);
  this.dataBytes = this.header.readUInt32LE(40);
  this.size = WAV_HEADER_BYTES + this.dataBytes;
  this.silence = source.bps === 8 ? 0x80 : 0;   // 8 位 WAV 是无符号的
  this.temp = null;
}

/**
 * 解码 count 个样本；越过结尾的部分填静音，保证字节数与 Content-Length 一致。
 * @param {number} start 起始样本序号。
 * @param {number} count 样本数。
 * @param {Buffer} out 输出缓冲。
 * @param {number} outOff 输出偏移。
 */
WavSource.prototype.fill = function(start, count, out, outOff) {
  var got = 0;
  try {
    got = this.source.readSamples(start, count, out, outOff);
  } catch (err) {
    console.warn('[Transcode] decode failed:', err && err.message);
  }
  if (got < count) {
    out.fill(this.silence, outOff + got * this.frameBytes, outOff + count * this.frameBytes);
  }
};

/**
 * 读取虚拟文件的任意字节区间。
 * @param {number} offset 起始字节。
 * @param {number} length 字节数。
 * @returns {Buffer} 数据（到结尾可能较短）。
 */
WavSource.prototype.readAt = function(offset, length) {
  var len = Math.max(0, Math.min(length, this.size - offset));
  if (len <= 0) return Buffer.alloc(0);
  var out = Buffer.allocUnsafe(len), pos = 0, hn;
  if (offset < WAV_HEADER_BYTES) {
    hn = Math.min(len, WAV_HEADER_BYTES - offset);
    this.header.copy(out, 0, offset, offset + hn);
    pos = hn;
  }
  if (pos >= len) return out;
  var fb = this.frameBytes;
  var dataOff = offset + pos - WAV_HEADER_BYTES;
  var first = Math.floor(dataOff / fb);
  var skip = dataOff - first * fb;
  var need = len - pos;
  if (skip === 0 && need % fb === 0) {
    this.fill(first, need / fb, out, pos);
  } else {
    /* 请求区间没有对齐到样本边界：解到暂存区再截取。 */
    var count = Math.ceil((skip + need) / fb);
    if (!this.temp || this.temp.length < count * fb) this.temp = Buffer.allocUnsafe(count * fb);
    this.fill(first, count, this.temp, 0);
    this.temp.copy(out, pos, skip, skip + need);
  }
  return out;
};

/**
 * 把虚拟 WAV 的一段包成可读流：解码按块进行，背压交给 stream 自己控制，
 * 因此不会长时间占住事件循环。
 * @param {WavSource} wav 虚拟文件。
 * @param {number} start 起始字节。
 * @param {number} end 结束字节（含）。
 * @returns {Readable} 可读流。
 */
function createRangeStream(wav, start, end) {
  var pos = start;
  return new Readable({
    highWaterMark: STREAM_CHUNK_BYTES,
    read: function() {
      if (pos > end) {
        this.push(null);
        return;
      }
      var chunk;
      try {
        chunk = wav.readAt(pos, Math.min(STREAM_CHUNK_BYTES, end - pos + 1));
      } catch (err) {
        this.destroy(err);
        return;
      }
      if (!chunk.length) {
        this.push(null);
        return;
      }
      pos += chunk.length;
      this.push(chunk);
    }
  });
}

/**
 * 打开一个“虚拟 WAV 文件”。调用方用完必须 close()。
 * @param {string} filePath 文件路径。
 * @returns {Object|null} 不需要转码时返回 null；解析失败时抛错。
 */
function openTranscodeSource(filePath) {
  var kind = transcodeKind(filePath);
  if (!kind) return null;
  var reader = openReader(filePath);
  try {
    var entry = cachedHeader(kind, filePath, reader);
    var source = kind === 'ape'
      ? new ApeSampleSource(reader.read, reader.size, entry.info)
      : new DsdSampleSource(reader.read, entry.info, entry.conv);
    var wav = new WavSource(source);
    return {
      kind: kind,
      info: entry.info,
      size: wav.size,
      contentType: 'audio/wav',
      sampleRate: source.sampleRate,
      channels: source.channels,
      bps: source.bps,
      totalSamples: source.totalSamples,
      duration: source.sampleRate > 0 ? source.totalSamples / source.sampleRate : 0,
      readAt: function(offset, length) {
        return wav.readAt(offset, length);
      },
      createStream: function(start, end) {
        return createRangeStream(wav, start, end);
      },
      close: function() {
        reader.close();
      }
    };
  } catch (err) {
    reader.close();
    throw err;
  }
}

module.exports = {
  transcodeKind: transcodeKind,
  openTranscodeSource: openTranscodeSource,
  buildWavHeader: buildWavHeader,
  WAV_HEADER_BYTES: WAV_HEADER_BYTES
};
