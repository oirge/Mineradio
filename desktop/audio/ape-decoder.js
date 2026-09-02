/*
 * Monkey's Audio (APE) 解复用 + 解码器 —— 纯 JavaScript 实现。
 *
 * 本文件是 FFmpeg 的 libavformat/ape.c 与 libavcodec/apedec.c 的逐行移植：
 *   Copyright (c) 2007 Benjamin Zores <ben@geexbox.org>
 *   based upon libdemac from Dave Chapman.
 * 原始代码以 GNU LGPL v2.1 或(可选)任意更高版本发布，本移植沿用同一授权条款。
 * 详见项目根目录 THIRD-PARTY-NOTICES.md。
 *
 * 设计约束：
 *   - 不依赖任何 npm 包，也不直接触碰 fs；调用方通过 read(offset,length) 提供字节。
 *   - 输出与 FFmpeg 逐比特一致：所有 32 位运算用 Math.imul/|0 复现 C 的回绕语义，
 *     64 位预测器用 float64 精确整数运算（|值| < 2^53 时与 int64 等价）。
 */
'use strict';

var APE_MIN_VERSION = 3800;
var APE_MAX_VERSION = 3990;

var MAC_FORMAT_FLAG_8_BIT = 1;              // 8 位样本（已废弃）
var MAC_FORMAT_FLAG_HAS_PEAK_LEVEL = 4;     // 头部之后存在 uint32 峰值电平
var MAC_FORMAT_FLAG_24_BIT = 8;             // 24 位样本（已废弃）
var MAC_FORMAT_FLAG_HAS_SEEK_ELEMENTS = 16; // 峰值电平之后存在 seek 元素数量
var MAC_FORMAT_FLAG_CREATE_WAV_HEADER = 32; // 解压时生成 wav 头（即文件内未存储）

var APE_FRAMECODE_STEREO_SILENCE = 3;
var APE_FRAMECODE_PSEUDO_STEREO = 4;

var HISTORY_SIZE = 512;
var PREDICTOR_ORDER = 8;
var PREDICTOR_SIZE = 50;

var YDELAYA = 18 + PREDICTOR_ORDER * 4;
var YDELAYB = 18 + PREDICTOR_ORDER * 3;
var XDELAYA = 18 + PREDICTOR_ORDER * 2;
var XDELAYB = 18 + PREDICTOR_ORDER;

var YADAPTCOEFFSA = 18;
var XADAPTCOEFFSA = 14;
var YADAPTCOEFFSB = 10;
var XADAPTCOEFFSB = 5;

var COMPRESSION_LEVEL_FAST = 1000;
var COMPRESSION_LEVEL_NORMAL = 2000;
var COMPRESSION_LEVEL_HIGH = 3000;
var COMPRESSION_LEVEL_EXTRA_HIGH = 4000;
var COMPRESSION_LEVEL_INSANE = 5000;

var APE_FILTER_LEVELS = 3;
var MODEL_ELEMENTS = 64;
var MIN_CACHE_BITS = 25;
var BLOCKS_PER_LOOP = 4608;

/* 各压缩等级对应的滤波器阶数 */
var APE_FILTER_ORDERS = [
  [0, 0, 0],
  [16, 0, 0],
  [64, 0, 0],
  [32, 256, 0],
  [16, 256, 1280]
];

/* 各压缩等级对应的定点小数位 */
var APE_FILTER_FRACBITS = [
  [0, 0, 0],
  [11, 0, 0],
  [11, 0, 0],
  [10, 13, 0],
  [11, 13, 15]
];

/* 3.97 的固定符号概率区间起点 */
var COUNTS_3970 = [
  0, 14824, 28224, 39348, 47855, 53994, 58171, 60926,
  62682, 63786, 64463, 64878, 65126, 65276, 65365, 65419,
  65450, 65469, 65480, 65487, 65491, 65493
];
/* 3.97 的固定符号概率区间宽度 */
var COUNTS_DIFF_3970 = [
  14824, 13400, 11124, 8507, 6139, 4177, 2755, 1756,
  1104, 677, 415, 248, 150, 89, 54, 31,
  19, 11, 7, 4, 2
];
/* 3.98 的固定符号概率区间起点 */
var COUNTS_3980 = [
  0, 19578, 36160, 48417, 56323, 60899, 63265, 64435,
  64971, 65232, 65351, 65416, 65447, 65466, 65476, 65482,
  65485, 65488, 65490, 65491, 65492, 65493
];
/* 3.98 的固定符号概率区间宽度 */
var COUNTS_DIFF_3980 = [
  19578, 16582, 12257, 7906, 4576, 2366, 1170, 536,
  261, 119, 65, 31, 19, 10, 6, 3,
  3, 2, 1, 1, 1
];

var INITIAL_COEFFS_FAST_3320 = [375];
var INITIAL_COEFFS_A_3800 = [64, 115, 64];
var INITIAL_COEFFS_B_3800 = [740, 0];
var INITIAL_COEFFS_3930 = [360, 317, -109, 98];

/**
 * 复现 C 的 APESIGN 宏：负数返回 1、正数返回 -1、零返回 0（注意是反向符号）。
 * @param {number} x 32 位整数。
 * @returns {number} 反向符号。
 */
function apeSign(x) {
  return (x < 0 ? 1 : 0) - (x > 0 ? 1 : 0);
}

/**
 * av_log2：返回最高有效位下标，输入 0 时返回 0。
 * @param {number} v 无符号 32 位整数。
 * @returns {number} 位下标。
 */
function avLog2(v) {
  v = v >>> 0;
  return v === 0 ? 0 : (31 - Math.clz32(v));
}

/**
 * MSB 优先位读取器，等价于 FFmpeg 的 GetBitContext（仅 3.90 之前的旧版本会用到）。
 * @param {Buffer|Uint8Array} buf 已按 32 位字节序翻转的帧数据。
 * @param {number} byteLength 可读字节数。
 */
function BitReader(buf, byteLength) {
  this.b = buf;
  this.len = byteLength;
  this.bitLen = byteLength * 8;
  this.pos = 0;
}
/**
 * 读取 n 位（1 <= n <= 25），越界按 0 补齐。
 * @param {number} n 位数。
 * @returns {number} 无符号结果。
 */
BitReader.prototype.getBits = function(n) {
  var p = this.pos;
  this.pos = p + n;
  var i = p >> 3;
  var b = this.b;
  var w;
  if (i + 4 <= b.length) {
    w = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  } else {
    w = (((i < b.length ? b[i] : 0) << 24) |
         ((i + 1 < b.length ? b[i + 1] : 0) << 16) |
         ((i + 2 < b.length ? b[i + 2] : 0) << 8) |
         (i + 3 < b.length ? b[i + 3] : 0)) >>> 0;
  }
  return ((w << (p & 7)) >>> (32 - n)) >>> 0;
};
/**
 * 读取 1 位。
 * @returns {number} 0 或 1。
 */
BitReader.prototype.getBits1 = function() {
  var p = this.pos;
  this.pos = p + 1;
  var i = p >> 3;
  var byte = i < this.b.length ? this.b[i] : 0;
  return (byte >> (7 - (p & 7))) & 1;
};
/**
 * 读取 32 位。
 * @returns {number} 无符号 32 位结果。
 */
BitReader.prototype.getBitsLong32 = function() {
  var hi = this.getBits(16);
  var lo = this.getBits(16);
  return ((hi * 65536) + lo) >>> 0;
};
/**
 * 剩余可读位数，可为负。
 * @returns {number} 位数。
 */
BitReader.prototype.getBitsLeft = function() {
  return this.bitLen - this.pos;
};
/**
 * 跳过若干位。
 * @param {number} n 位数。
 */
BitReader.prototype.skipBits = function(n) {
  this.pos += n;
};
/**
 * 等价于 FFmpeg unary.h 的 get_unary(gb, 1, len)：统计到首个 1 之前的 0 的个数。
 * @param {number} len 最多读取的位数。
 * @returns {number} 0 的个数。
 */
BitReader.prototype.getUnary = function(len) {
  var i = 0;
  while (i < len && this.getBits1() !== 1) i++;
  return i;
};

/**
 * 解析 APE 文件的描述块、头块与 seek 表，产出解码所需的全部信息。
 * 逐行对应 FFmpeg libavformat/ape.c 的 ape_read_header()。
 * @param {function(number, number): Buffer} read 同步读取函数，返回不超过请求长度的字节。
 * @param {number} fileSize 文件总长度。
 * @returns {object} APE 元信息与帧索引表。
 */
function parseApeInfo(read, fileSize) {
  var junk = 0;
  var probe = read(0, 10);
  if (probe.length >= 10 && probe[0] === 0x49 && probe[1] === 0x44 && probe[2] === 0x33) {
    var id3Flags = probe[5];
    var id3Size = ((probe[6] & 0x7f) << 21) | ((probe[7] & 0x7f) << 14) |
                  ((probe[8] & 0x7f) << 7) | (probe[9] & 0x7f);
    junk = 10 + id3Size + ((id3Flags & 0x10) ? 10 : 0);
  }
  var hdr = read(junk, 128);
  if (hdr.length < 32 || hdr[0] !== 0x4d || hdr[1] !== 0x41 || hdr[2] !== 0x43 || hdr[3] !== 0x20) {
    throw apeError('not an APE file');
  }
  var fileversion = hdr.readUInt16LE(4);
  if (fileversion < APE_MIN_VERSION || fileversion > APE_MAX_VERSION) {
    throw apeError('unsupported APE version ' + fileversion);
  }
  var info = {
    junkLength: junk,
    fileversion: fileversion,
    descriptorLength: 0,
    headerLength: 32,
    seekTableLength: 0,
    wavHeaderLength: 0,
    wavTailLength: 0,
    audioDataLength: 0,
    md5: null,
    compressionLevel: 0,
    formatFlags: 0,
    blocksPerFrame: 0,
    finalFrameBlocks: 0,
    totalFrames: 0,
    bps: 16,
    channels: 0,
    sampleRate: 0
  };
  var seekTableOffset;
  if (fileversion >= 3980) {
    info.descriptorLength = hdr.readUInt32LE(8);
    info.headerLength = hdr.readUInt32LE(12);
    info.seekTableLength = hdr.readUInt32LE(16);
    info.wavHeaderLength = hdr.readUInt32LE(20);
    info.audioDataLength = hdr.readUInt32LE(24);
    info.wavTailLength = hdr.readUInt32LE(32);
    info.md5 = Buffer.from(hdr.slice(36, 52));
    var hOff = info.descriptorLength > 52 ? info.descriptorLength : 52;
    var hb = read(junk + hOff, 24);
    if (hb.length < 24) throw apeError('truncated APE header');
    info.compressionLevel = hb.readUInt16LE(0);
    info.formatFlags = hb.readUInt16LE(2);
    info.blocksPerFrame = hb.readUInt32LE(4);
    info.finalFrameBlocks = hb.readUInt32LE(8);
    info.totalFrames = hb.readUInt32LE(12);
    info.bps = hb.readUInt16LE(16);
    info.channels = hb.readUInt16LE(18);
    info.sampleRate = hb.readUInt32LE(20);
    seekTableOffset = junk + hOff + 24;
  } else {
    info.compressionLevel = hdr.readUInt16LE(6);
    info.formatFlags = hdr.readUInt16LE(8);
    info.channels = hdr.readUInt16LE(10);
    info.sampleRate = hdr.readUInt32LE(12);
    info.wavHeaderLength = hdr.readUInt32LE(16);
    info.wavTailLength = hdr.readUInt32LE(20);
    info.totalFrames = hdr.readUInt32LE(24);
    info.finalFrameBlocks = hdr.readUInt32LE(28);
    var pos = 32;
    if (info.formatFlags & MAC_FORMAT_FLAG_HAS_PEAK_LEVEL) {
      pos += 4;
      info.headerLength += 4;
    }
    if (info.formatFlags & MAC_FORMAT_FLAG_HAS_SEEK_ELEMENTS) {
      if (hdr.length < pos + 4) throw apeError('truncated APE header');
      info.seekTableLength = hdr.readUInt32LE(pos) * 4;
      pos += 4;
      info.headerLength += 4;
    } else {
      info.seekTableLength = info.totalFrames * 4;
    }
    if (info.formatFlags & MAC_FORMAT_FLAG_8_BIT) info.bps = 8;
    else if (info.formatFlags & MAC_FORMAT_FLAG_24_BIT) info.bps = 24;
    else info.bps = 16;
    if (fileversion >= 3950) info.blocksPerFrame = 73728 * 4;
    else if (fileversion >= 3900 || (fileversion >= 3800 && info.compressionLevel >= 4000)) info.blocksPerFrame = 73728;
    else info.blocksPerFrame = 9216;
    if (!(info.formatFlags & MAC_FORMAT_FLAG_CREATE_WAV_HEADER)) pos += info.wavHeaderLength;
    seekTableOffset = junk + pos;
  }
  if (!info.totalFrames) throw apeError('no frames in APE file');
  if (info.channels < 1 || info.channels > 2) throw apeError('unsupported channel count ' + info.channels);
  if (info.bps !== 8 && info.bps !== 16 && info.bps !== 24) throw apeError('unsupported bit depth ' + info.bps);
  if (!info.sampleRate) throw apeError('invalid sample rate');
  if (info.totalFrames > 0x3fffffff) throw apeError('too many frames');
  if (Math.floor(info.seekTableLength / 4) < info.totalFrames) throw apeError('APE seek table too short');
  if (info.compressionLevel % 1000 || !info.compressionLevel ||
      info.compressionLevel > COMPRESSION_LEVEL_INSANE ||
      (fileversion < 3930 && info.compressionLevel === COMPRESSION_LEVEL_INSANE)) {
    throw apeError('invalid compression level ' + info.compressionLevel);
  }
  var total = info.totalFrames;
  var framePos = new Float64Array(total);
  var frameSize = new Float64Array(total);
  var frameSkip = new Int32Array(total);
  var firstFrame = junk + info.descriptorLength + info.headerLength + info.seekTableLength + info.wavHeaderLength;
  if (fileversion < 3810) firstFrame += total;
  info.firstFrame = firstFrame;
  var table = read(seekTableOffset, total * 4);
  if (table.length < total * 4) throw apeError('APE seek table truncated');
  framePos[0] = firstFrame;
  frameSkip[0] = 0;
  for (var i = 1; i < total; i++) {
    framePos[i] = table.readUInt32LE(i * 4) + junk;
    frameSize[i - 1] = framePos[i] - framePos[i - 1];
    frameSkip[i] = (framePos[i] - framePos[0]) & 3;
  }
  var finalSize = 0;
  if (fileSize > 0) {
    finalSize = fileSize - framePos[total - 1] - info.wavTailLength;
    finalSize -= finalSize & 3;
  }
  if (fileSize <= 0 || finalSize <= 0) finalSize = info.finalFrameBlocks * 8;
  frameSize[total - 1] = finalSize;
  for (i = 0; i < total; i++) {
    if (frameSkip[i]) {
      framePos[i] -= frameSkip[i];
      frameSize[i] += frameSkip[i];
    }
    if (frameSize[i] > 0x7ffffffc) throw apeError('invalid APE frame size');
    frameSize[i] = (frameSize[i] + 3) & ~3;
  }
  if (fileversion < 3810) {
    var bitTableOffset = seekTableOffset + total * 4 + (Math.floor(info.seekTableLength / 4) - total);
    var bitTable = read(bitTableOffset, total);
    if (bitTable.length < total) throw apeError('APE bittable truncated');
    for (i = 0; i < total; i++) {
      var bits = bitTable[i];
      if (i && bits) frameSize[i - 1] += 4;
      frameSkip[i] = (frameSkip[i] << 3) + bits;
    }
  }
  info.frames = { pos: framePos, size: frameSize, skip: frameSkip };
  info.totalBlocks = total > 0 ? ((total - 1) * info.blocksPerFrame + info.finalFrameBlocks) : 0;
  info.duration = info.totalBlocks / info.sampleRate;
  info.bytesPerSample = info.bps === 24 ? 4 : (info.bps >> 3);
  return info;
}

/**
 * 构造带标记的解析错误，便于上层区分“文件损坏”与“不支持”。
 * @param {string} message 错误描述。
 * @returns {Error} 错误对象。
 */
function apeError(message) {
  var err = new Error('APE: ' + message);
  err.code = 'APE_INVALID';
  return err;
}

/**
 * 3.95 及之后版本使用的 64 位预测器状态。
 */
function Predictor64() {
  this.hist = new Float64Array(HISTORY_SIZE + PREDICTOR_SIZE);
  this.coeffsA = new Float64Array(8);
  this.coeffsB = new Float64Array(10);
  this.lastA = new Float64Array(2);
  this.filterA = new Float64Array(2);
  this.filterB = new Float64Array(2);
  this.bufPos = 0;
}
/**
 * 复制另一份预测器状态（等价于 C 的结构体赋值）。
 * @param {Predictor64} o 源状态。
 */
Predictor64.prototype.copyFrom = function(o) {
  this.hist.set(o.hist);
  this.coeffsA.set(o.coeffsA);
  this.coeffsB.set(o.coeffsB);
  this.lastA.set(o.lastA);
  this.filterA.set(o.filterA);
  this.filterB.set(o.filterB);
  this.bufPos = o.bufPos;
};

/**
 * Monkey's Audio 帧解码器，一次处理一帧（可分多次取出样本）。
 * @param {object} info parseApeInfo() 的返回值。
 */
function ApeDecoder(info) {
  this.fileversion = info.fileversion;
  this.compressionLevel = info.compressionLevel;
  this.channels = info.channels;
  this.bps = info.bps;
  this.fset = info.compressionLevel / 1000 - 1;
  this.blocksPerLoop = BLOCKS_PER_LOOP;
  this.interimMode = this.bps === 24 ? -1 : 0;
  this.samples = 0;
  this.error = 0;
  this.frameflags = 0;
  this.CRC = 0;
  this.riceK = new Int32Array(2);      // [0]=Y(左/主声道), [1]=X
  this.riceKsum = new Float64Array(2); // 以 uint32 语义维护
  this.rcLow = 0; this.rcRange = 0; this.rcHelp = 0; this.rcBuffer = 0;
  this.data = null;
  this.ptr = 0;
  this.dataEnd = 0;
  this.gb = null;

  var maxBlocks = this.fileversion < 3930
    ? info.blocksPerFrame
    : Math.min(this.blocksPerLoop, info.blocksPerFrame);
  maxBlocks = Math.max(8, (maxBlocks + 7) & ~7);
  this.maxBlocks = maxBlocks;
  this.decoded0 = new Int32Array(maxBlocks);
  this.decoded1 = new Int32Array(maxBlocks);
  this.interim0 = null;
  this.interim1 = null;
  if (this.interimMode < 0) {
    this.interim0 = new Int32Array(maxBlocks);
    this.interim1 = new Int32Array(maxBlocks);
  }

  /* 32 位预测器（3.93 之前） */
  this.pHist = new Int32Array(HISTORY_SIZE + PREDICTOR_SIZE);
  this.pCoeffsA = new Int32Array(8);
  this.pCoeffsB = new Int32Array(10);
  this.pLastA = new Int32Array(2);
  this.pFilterA = new Int32Array(2);
  this.pFilterB = new Int32Array(2);
  this.pBufPos = 0;
  this.pSamplePos = 0;

  /* 64 位预测器（3.95 及之后） */
  this.q = new Predictor64();
  this.qInterim = new Predictor64();

  /* 级联自适应滤波器 */
  this.filterBuf = [];
  this.filterState = [];
  for (var i = 0; i < APE_FILTER_LEVELS; i++) {
    var order = APE_FILTER_ORDERS[this.fset][i];
    if (!order) break;
    this.filterBuf.push(new Int16Array(2 * (order * 3 + HISTORY_SIZE)));
    this.filterState.push([
      { base: 0, delay: 0, adapt: 0, avg: 0 },
      { base: order * 3 + HISTORY_SIZE, delay: 0, adapt: 0, avg: 0 }
    ]);
  }
  /* 3.80~3.92 的 long filter 需要的临时缓冲 */
  this.lfCoeffs = null;
  this.lfDelay = null;
  this.ehCoeffs = null;
  this.ehDelay = null;
  if (this.fileversion < 3930 && this.compressionLevel >= COMPRESSION_LEVEL_HIGH) {
    this.lfCoeffs = new Int32Array(256);
    this.lfDelay = new Int32Array(256 + 256);
    this.ehCoeffs = new Int32Array(8);
    this.ehDelay = new Int32Array(8);
  }
}

/* ---------------- 区间编码器（range coder） ---------------- */

var BOTTOM_VALUE = 1 << 23;
var EXTRA_BITS = 7;

/** 读取一个字节并前进，越界返回 0（对应 C 端的零填充缓冲）。 */
ApeDecoder.prototype.readByte = function() {
  var v = this.ptr < this.data.length ? this.data[this.ptr] : 0;
  this.ptr++;
  return v;
};
ApeDecoder.prototype.readBE32 = function() {
  var b = this.data, p = this.ptr;
  this.ptr = p + 4;
  return (((p < b.length ? b[p] : 0) * 16777216) +
          ((p + 1 < b.length ? b[p + 1] : 0) << 16) +
          ((p + 2 < b.length ? b[p + 2] : 0) << 8) +
          (p + 3 < b.length ? b[p + 3] : 0)) >>> 0;
};
ApeDecoder.prototype.rangeStartDecoding = function() {
  this.rcBuffer = this.readByte();
  this.rcLow = this.rcBuffer >>> (8 - EXTRA_BITS);
  this.rcRange = 1 << EXTRA_BITS;
};
ApeDecoder.prototype.rangeDecNormalize = function() {
  while (this.rcRange <= BOTTOM_VALUE) {
    if (this.rcRange === 0) { this.error = 1; this.rcRange = 1 << EXTRA_BITS; return; }
    this.rcBuffer = (this.rcBuffer << 8) >>> 0;
    if (this.ptr < this.dataEnd) {
      this.rcBuffer = (this.rcBuffer + this.data[this.ptr]) >>> 0;
      this.ptr++;
    } else {
      this.error = 1;
    }
    this.rcLow = (((this.rcLow << 8) >>> 0) + ((this.rcBuffer >>> 1) & 0xFF)) >>> 0;
    this.rcRange = (this.rcRange * 256) >>> 0;
  }
};
ApeDecoder.prototype.rangeDecodeCulfreq = function(totF) {
  this.rangeDecNormalize();
  this.rcHelp = Math.floor(this.rcRange / totF);
  return this.rcHelp > 0 ? Math.floor(this.rcLow / this.rcHelp) : (this.error = 1, 0);
};
ApeDecoder.prototype.rangeDecodeCulshift = function(shift) {
  this.rangeDecNormalize();
  this.rcHelp = this.rcRange >>> shift;
  return this.rcHelp > 0 ? Math.floor(this.rcLow / this.rcHelp) : (this.error = 1, 0);
};
ApeDecoder.prototype.rangeDecodeUpdate = function(syF, ltF) {
  this.rcLow = (this.rcLow - this.rcHelp * ltF) >>> 0;
  this.rcRange = (this.rcHelp * syF) >>> 0;
};
ApeDecoder.prototype.rangeDecodeBits = function(n) {
  var sym = this.rangeDecodeCulshift(n);
  this.rangeDecodeUpdate(1, sym);
  return sym;
};
/**
 * 按固定概率表解一个符号。
 * @param {Array<number>} counts 区间起点表。
 * @param {Array<number>} countsDiff 区间宽度表。
 * @returns {number} 符号值。
 */
ApeDecoder.prototype.rangeGetSymbol = function(counts, countsDiff) {
  var cf = this.rangeDecodeCulshift(16);
  if (cf > 65492) {
    var symbol = cf - 65535 + 63;
    this.rangeDecodeUpdate(1, cf);
    if (cf > 65535) this.error = 1;
    return symbol;
  }
  var s = 0;
  while (counts[s + 1] <= cf) s++;
  this.rangeDecodeUpdate(countsDiff[s], counts[s]);
  return s;
};

/* ---------------- Rice 参数自适应与取值 ---------------- */

/**
 * 对应 update_rice()，按 uint32 语义更新第 r 组 Rice 参数。
 * @param {number} r 0=Y, 1=X。
 * @param {number} x 刚解出的无符号值。
 */
ApeDecoder.prototype.updateRice = function(r, x) {
  var k = this.riceK[r];
  var ksum = this.riceKsum[r];
  var lim = k ? (1 << (k + 4)) : 0;
  ksum = (ksum + Math.floor(((x + 1) >>> 0) / 2) - (((ksum + 16) >>> 0) >>> 5)) >>> 0;
  if (ksum < lim) k--;
  else if (ksum >= (1 << (k + 5)) && k < 24) k++;
  this.riceK[r] = k;
  this.riceKsum[r] = ksum;
};
/** 无符号值转有符号，对应 “Convert to signed” 语句。 */
function apeToSigned(x) {
  return ((((x >>> 1) ^ ((x & 1) - 1)) + 1) | 0);
}
/** 对应 get_rice_ook()，供 3.86 之前的版本使用。 */
ApeDecoder.prototype.getRiceOok = function(k) {
  var gb = this.gb;
  var x = gb.getUnary(gb.getBitsLeft());
  if (k) x = ((x << k) >>> 0) + gb.getBits(k);
  return x >>> 0;
};
/** 对应 ape_decode_value_3860()。 */
ApeDecoder.prototype.decodeValue3860 = function(r) {
  var gb = this.gb;
  var x;
  var overflow = gb.getUnary(gb.getBitsLeft());
  var k = this.riceK[r];
  if (this.fileversion > 3880) {
    while (overflow >= 16) {
      overflow -= 16;
      k += 4;
    }
  }
  if (!k) {
    x = overflow;
  } else if (k <= MIN_CACHE_BITS) {
    x = (((overflow << k) >>> 0) + gb.getBits(k)) >>> 0;
  } else {
    this.error = 1;
    this.riceK[r] = k;
    return 0;
  }
  var ksum = (this.riceKsum[r] + x - (((this.riceKsum[r] + 8) >>> 0) >>> 4)) >>> 0;
  if (ksum < (k ? (1 << (k + 4)) : 0)) k--;
  else if (ksum >= (1 << (k + 5)) && k < 24) k++;
  this.riceK[r] = k;
  this.riceKsum[r] = ksum;
  return apeToSigned(x);
};
/** 对应 ape_decode_value_3900()。 */
ApeDecoder.prototype.decodeValue3900 = function(r) {
  var x;
  var tmpk;
  var overflow = this.rangeGetSymbol(COUNTS_3970, COUNTS_DIFF_3970);
  if (overflow === MODEL_ELEMENTS - 1) {
    tmpk = this.rangeDecodeBits(5);
    overflow = 0;
  } else {
    tmpk = this.riceK[r] < 1 ? 0 : this.riceK[r] - 1;
  }
  if (tmpk <= 16 || this.fileversion < 3910) {
    if (tmpk > 23) { this.error = 1; return 0; }
    x = this.rangeDecodeBits(tmpk);
  } else if (tmpk <= 31) {
    x = this.rangeDecodeBits(16);
    x = (x | (this.rangeDecodeBits(tmpk - 16) << 16)) >>> 0;
  } else {
    this.error = 1;
    return 0;
  }
  x = (x + ((overflow << tmpk) >>> 0)) >>> 0;
  this.updateRice(r, x);
  return apeToSigned(x);
};
/** 对应 ape_decode_value_3990()。 */
ApeDecoder.prototype.decodeValue3990 = function(r) {
  var base;
  var pivot = this.riceKsum[r] >>> 5;
  if (pivot < 1) pivot = 1;
  var overflow = this.rangeGetSymbol(COUNTS_3980, COUNTS_DIFF_3980);
  if (overflow === MODEL_ELEMENTS - 1) {
    overflow = ((this.rangeDecodeBits(16) << 16) >>> 0);
    overflow = (overflow | this.rangeDecodeBits(16)) >>> 0;
  }
  if (pivot < 0x10000) {
    base = this.rangeDecodeCulfreq(pivot);
    this.rangeDecodeUpdate(1, base);
  } else {
    var baseHi = pivot;
    var bbits = 0;
    while (baseHi & ~0xFFFF) {
      baseHi >>= 1;
      bbits++;
    }
    baseHi = this.rangeDecodeCulfreq(baseHi + 1);
    this.rangeDecodeUpdate(1, baseHi);
    var baseLo = this.rangeDecodeCulfreq(1 << bbits);
    this.rangeDecodeUpdate(1, baseLo);
    base = ((baseHi << bbits) + baseLo) | 0;
  }
  var x = (base + Math.imul(overflow, pivot)) >>> 0;
  this.updateRice(r, x);
  return apeToSigned(x);
};
/** 对应 get_k()。 */
function apeGetK(ksum) {
  return avLog2(ksum) + (ksum ? 1 : 0);
}
/**
 * 对应 decode_array_0000()（3.86 之前版本的整块 Rice 解码）。
 * @param {Int32Array} out 输出缓冲。
 * @param {number} r Rice 组下标。
 * @param {number} n 本次要解的块数。
 */
ApeDecoder.prototype.decodeArray0000 = function(out, r, n) {
  var gb = this.gb;
  var i = 0;
  var ksum = 0;
  var k = 0;
  var lim5 = n < 5 ? n : 5;
  for (i = 0; i < lim5; i++) {
    out[i] = this.getRiceOok(10);
    ksum = (ksum + out[i]) >>> 0;
  }
  this.riceKsum[r] = ksum;
  if (n <= 5) { this.apeArrayToSigned(out, n); return; }
  k = apeGetK(Math.floor(ksum / 10));
  this.riceK[r] = k;
  if (k >= 24) return;
  var lim64 = n < 64 ? n : 64;
  for (; i < lim64; i++) {
    out[i] = this.getRiceOok(k);
    ksum = (ksum + out[i]) >>> 0;
    k = apeGetK(Math.floor(ksum / ((i + 1) * 2)));
    this.riceKsum[r] = ksum;
    this.riceK[r] = k;
    if (k >= 24) return;
  }
  if (n <= 64) { this.apeArrayToSigned(out, n); return; }
  k = apeGetK(ksum >>> 7);
  this.riceK[r] = k;
  var ksummax = (1 << (k + 7)) >>> 0;
  var ksummin = k ? ((1 << (k + 6)) >>> 0) : 0;
  for (; i < n; i++) {
    if (gb.getBitsLeft() < 1) { this.error = 1; return; }
    out[i] = this.getRiceOok(k);
    ksum = (ksum + out[i] - out[i - 64]) >>> 0;
    while (ksum < ksummin) {
      k--;
      ksummin = k ? (ksummin >>> 1) : 0;
      ksummax = ksummax >>> 1;
    }
    while (ksum >= ksummax) {
      k++;
      if (k > 24) { this.riceK[r] = k; this.riceKsum[r] = ksum; return; }
      ksummax = (ksummax * 2) >>> 0;
      ksummin = ksummin ? ((ksummin * 2) >>> 0) : 128;
    }
    this.riceK[r] = k;
    this.riceKsum[r] = ksum;
  }
  this.apeArrayToSigned(out, n);
};
/** decode_array_0000() 末尾的有符号转换（注意此处是带符号右移）。 */
ApeDecoder.prototype.apeArrayToSigned = function(out, n) {
  for (var i = 0; i < n; i++) {
    out[i] = (((out[i] >> 1) ^ ((out[i] & 1) - 1)) + 1) | 0;
  }
};
/* ---------------- 熵解码分派 ---------------- */

/** 单声道熵解码，按文件版本选择算法。 */
ApeDecoder.prototype.entropyDecodeMono = function(n) {
  var out = this.decoded0;
  var i;
  var v = this.fileversion;
  if (v < 3860) {
    this.decodeArray0000(out, 0, n);
  } else if (v < 3900) {
    for (i = 0; i < n; i++) out[i] = this.decodeValue3860(0);
  } else if (v < 3990) {
    for (i = 0; i < n; i++) out[i] = this.decodeValue3900(0);
  } else {
    for (i = 0; i < n; i++) out[i] = this.decodeValue3990(0);
  }
};
/** 立体声熵解码，按文件版本选择算法（注意 3.90 的“回退一字节”特例）。 */
ApeDecoder.prototype.entropyDecodeStereo = function(n) {
  var out0 = this.decoded0;
  var out1 = this.decoded1;
  var i;
  var v = this.fileversion;
  if (v < 3860) {
    this.decodeArray0000(out0, 0, n);
    this.decodeArray0000(out1, 1, n);
  } else if (v < 3900) {
    for (i = 0; i < n; i++) out0[i] = this.decodeValue3860(0);
    for (i = 0; i < n; i++) out1[i] = this.decodeValue3860(1);
  } else if (v < 3930) {
    for (i = 0; i < n; i++) out0[i] = this.decodeValue3900(0);
    this.rangeDecNormalize();
    this.ptr -= 1;
    this.rangeStartDecoding();
    for (i = 0; i < n; i++) out1[i] = this.decodeValue3900(1);
  } else if (v < 3990) {
    for (i = 0; i < n; i++) {
      out0[i] = this.decodeValue3900(0);
      out1[i] = this.decodeValue3900(1);
    }
  } else {
    for (i = 0; i < n; i++) {
      out0[i] = this.decodeValue3990(0);
      out1[i] = this.decodeValue3990(1);
    }
  }
};
/**
 * 对应 init_entropy_decoder()：读取帧 CRC 与帧标志，复位 Rice 参数与区间编码器。
 * @returns {boolean} 成功与否。
 */
ApeDecoder.prototype.initEntropyDecoder = function() {
  if (this.fileversion >= 3900) {
    if (this.dataEnd - this.ptr < 6) return false;
    this.CRC = this.readBE32();
  } else {
    this.CRC = this.gb.getBitsLong32();
  }
  this.frameflags = 0;
  if (this.fileversion > 3820 && (this.CRC & 0x80000000)) {
    this.CRC = (this.CRC & ~0x80000000) >>> 0;
    if (this.dataEnd - this.ptr < 6) return false;
    this.frameflags = this.readBE32();
  }
  this.riceK[0] = 10;
  this.riceKsum[0] = (1 << 10) * 16;
  this.riceK[1] = 10;
  this.riceKsum[1] = (1 << 10) * 16;
  if (this.fileversion >= 3900) {
    this.ptr++;
    this.rangeStartDecoding();
  }
  return true;
};
/* ---------------- 预测器 ---------------- */

/** 对应 init_predictor_decoder()：清空历史并载入初始系数。 */
ApeDecoder.prototype.initPredictorDecoder = function() {
  this.pHist.fill(0);
  this.q.hist.fill(0);
  this.pBufPos = 0;
  this.q.bufPos = 0;
  this.pCoeffsA.fill(0);
  this.q.coeffsA.fill(0);
  var i;
  if (this.fileversion < 3930) {
    var init = this.compressionLevel === COMPRESSION_LEVEL_FAST
      ? INITIAL_COEFFS_FAST_3320 : INITIAL_COEFFS_A_3800;
    for (i = 0; i < init.length; i++) {
      this.pCoeffsA[i] = init[i];
      this.pCoeffsA[4 + i] = init[i];
    }
  } else {
    for (i = 0; i < 4; i++) {
      this.pCoeffsA[i] = INITIAL_COEFFS_3930[i];
      this.pCoeffsA[4 + i] = INITIAL_COEFFS_3930[i];
      this.q.coeffsA[i] = INITIAL_COEFFS_3930[i];
      this.q.coeffsA[4 + i] = INITIAL_COEFFS_3930[i];
    }
  }
  this.pCoeffsB.fill(0);
  this.q.coeffsB.fill(0);
  if (this.fileversion < 3930) {
    for (i = 0; i < INITIAL_COEFFS_B_3800.length; i++) {
      this.pCoeffsB[i] = INITIAL_COEFFS_B_3800[i];
      this.pCoeffsB[5 + i] = INITIAL_COEFFS_B_3800[i];
    }
  }
  this.pFilterA[0] = this.pFilterA[1] = 0;
  this.pFilterB[0] = this.pFilterB[1] = 0;
  this.pLastA[0] = this.pLastA[1] = 0;
  this.q.filterA[0] = this.q.filterA[1] = 0;
  this.q.filterB[0] = this.q.filterB[1] = 0;
  this.q.lastA[0] = this.q.lastA[1] = 0;
  this.pSamplePos = 0;
};
/** 对应 filter_fast_3320()。 */
ApeDecoder.prototype.filterFast3320 = function(decoded, f, delayA) {
  var hist = this.pHist, b = this.pBufPos, c = f * 4;
  hist[b + delayA] = this.pLastA[f];
  if (this.pSamplePos < 3) {
    this.pLastA[f] = decoded;
    this.pFilterA[f] = decoded;
    return decoded;
  }
  var predA = ((hist[b + delayA] * 2) - hist[b + delayA - 1]) | 0;
  this.pLastA[f] = (decoded + (Math.imul(predA, this.pCoeffsA[c]) >> 9)) | 0;
  if ((decoded ^ predA) > 0) this.pCoeffsA[c] = (this.pCoeffsA[c] + 1) | 0;
  else this.pCoeffsA[c] = (this.pCoeffsA[c] - 1) | 0;
  this.pFilterA[f] = (this.pFilterA[f] + this.pLastA[f]) | 0;
  return this.pFilterA[f];
};
/** 对应 filter_3800()。 */
ApeDecoder.prototype.filter3800 = function(decoded, f, delayA, delayB, start, shift) {
  var hist = this.pHist, b = this.pBufPos, ca = f * 4, cb = f * 5, sign;
  hist[b + delayA] = this.pLastA[f];
  hist[b + delayB] = this.pFilterB[f];
  if (this.pSamplePos < start) {
    var first = (decoded + this.pFilterA[f]) | 0;
    this.pLastA[f] = decoded;
    this.pFilterB[f] = decoded;
    this.pFilterA[f] = first;
    return first;
  }
  var d2 = hist[b + delayA];
  var d1 = ((hist[b + delayA] - hist[b + delayA - 1]) * 2) | 0;
  var d0 = (hist[b + delayA] + (hist[b + delayA - 2] - hist[b + delayA - 1]) * 8) | 0;
  var d3 = (hist[b + delayB] * 2 - hist[b + delayB - 1]) | 0;
  var d4 = hist[b + delayB];

  var predictionA = (Math.imul(d0, this.pCoeffsA[ca]) +
                     Math.imul(d1, this.pCoeffsA[ca + 1]) +
                     Math.imul(d2, this.pCoeffsA[ca + 2])) | 0;

  sign = apeSign(decoded);
  this.pCoeffsA[ca]     += (((d0 >> 30) & 2) - 1) * sign;
  this.pCoeffsA[ca + 1] += (((d1 >> 28) & 8) - 4) * sign;
  this.pCoeffsA[ca + 2] += (((d2 >> 28) & 8) - 4) * sign;

  var predictionB = (Math.imul(d3, this.pCoeffsB[cb]) -
                     Math.imul(d4, this.pCoeffsB[cb + 1])) | 0;
  this.pLastA[f] = (decoded + (predictionA >> 11)) | 0;
  sign = apeSign(this.pLastA[f]);
  this.pCoeffsB[cb]     += (((d3 >> 29) & 4) - 2) * sign;
  this.pCoeffsB[cb + 1] -= (((d4 >> 30) & 2) - 1) * sign;

  this.pFilterB[f] = (this.pLastA[f] + (predictionB >> shift)) | 0;
  this.pFilterA[f] = (this.pFilterB[f] + (Math.imul(this.pFilterA[f], 31) >> 5)) | 0;
  return this.pFilterA[f];
};
/** 对应 long_filter_high_3800()，原地处理 buf[0..length-1]。 */
ApeDecoder.prototype.longFilterHigh3800 = function(buf, order, shift, length) {
  if (order >= length) return;
  var coeffs = this.lfCoeffs, delay = this.lfDelay;
  var i, j, dot, sign, dp = 0, v;
  for (i = 0; i < order; i++) {
    coeffs[i] = 0;
    delay[i] = buf[i];
  }
  for (i = order; i < length; i++) {
    dot = 0;
    sign = apeSign(buf[i]);
    if (sign === 1) {
      for (j = 0; j < order; j++) {
        v = delay[dp + j];
        dot = (dot + Math.imul(v, coeffs[j])) | 0;
        coeffs[j] += (v >> 31) | 1;
      }
    } else if (sign === -1) {
      for (j = 0; j < order; j++) {
        v = delay[dp + j];
        dot = (dot + Math.imul(v, coeffs[j])) | 0;
        coeffs[j] -= (v >> 31) | 1;
      }
    } else {
      for (j = 0; j < order; j++) {
        dot = (dot + Math.imul(delay[dp + j], coeffs[j])) | 0;
      }
    }
    buf[i] = (buf[i] - (dot >> shift)) | 0;
    dp++;
    delay[dp + order - 1] = buf[i];
    if (dp === 256) {
      delay.copyWithin(0, 256, 512);
      dp = 0;
    }
  }
};
/** 对应 long_filter_ehigh_3830()，原地处理 buf[off .. off+length-1]。 */
ApeDecoder.prototype.longFilterEhigh3830 = function(buf, off, length) {
  var coeffs = this.ehCoeffs, delay = this.ehDelay, i, j, dot, sign;
  for (i = 0; i < 8; i++) {
    coeffs[i] = 0;
    delay[i] = 0;
  }
  for (i = 0; i < length; i++) {
    dot = 0;
    sign = apeSign(buf[off + i]);
    for (j = 7; j >= 0; j--) {
      dot = (dot + Math.imul(delay[j], coeffs[j])) | 0;
      coeffs[j] += ((delay[j] >> 31) | 1) * sign;
    }
    for (j = 7; j > 0; j--) delay[j] = delay[j - 1];
    delay[0] = buf[off + i];
    buf[off + i] = (buf[off + i] - (dot >> 9)) | 0;
  }
};
/** 32 位预测器每样本推进一格，必要时回卷历史缓冲。 */
ApeDecoder.prototype.advance32 = function() {
  this.pBufPos++;
  if (this.pBufPos === HISTORY_SIZE) {
    this.pHist.copyWithin(0, HISTORY_SIZE, HISTORY_SIZE + PREDICTOR_SIZE);
    this.pBufPos = 0;
  }
};
/** 对应 predictor_decode_stereo_3800()。 */
ApeDecoder.prototype.predictorDecodeStereo3800 = function(count) {
  var d0 = this.decoded0, d1 = this.decoded1;
  var start = 4, shift = 10, i;
  if (this.compressionLevel === COMPRESSION_LEVEL_HIGH) {
    start = 16;
    this.longFilterHigh3800(d0, 16, 9, count);
    this.longFilterHigh3800(d1, 16, 9, count);
  } else if (this.compressionLevel === COMPRESSION_LEVEL_EXTRA_HIGH) {
    var order = 128, shift2 = 11;
    if (this.fileversion >= 3830) {
      order <<= 1;
      shift++;
      shift2++;
      this.longFilterEhigh3830(d0, order, count - order);
      this.longFilterEhigh3830(d1, order, count - order);
    }
    start = order;
    this.longFilterHigh3800(d0, order, shift2, count);
    this.longFilterHigh3800(d1, order, shift2, count);
  }
  var fast = this.compressionLevel === COMPRESSION_LEVEL_FAST;
  for (i = 0; i < count; i++) {
    var X = d0[i], Y = d1[i];
    if (fast) {
      d0[i] = this.filterFast3320(Y, 0, YDELAYA);
      d1[i] = this.filterFast3320(X, 1, XDELAYA);
    } else {
      d0[i] = this.filter3800(Y, 0, YDELAYA, YDELAYB, start, shift);
      d1[i] = this.filter3800(X, 1, XDELAYA, XDELAYB, start, shift);
    }
    this.pSamplePos++;
    this.advance32();
  }
};
/** 对应 predictor_decode_mono_3800()。 */
ApeDecoder.prototype.predictorDecodeMono3800 = function(count) {
  var d0 = this.decoded0;
  var start = 4, shift = 10, i;
  if (this.compressionLevel === COMPRESSION_LEVEL_HIGH) {
    start = 16;
    this.longFilterHigh3800(d0, 16, 9, count);
  } else if (this.compressionLevel === COMPRESSION_LEVEL_EXTRA_HIGH) {
    var order = 128, shift2 = 11;
    if (this.fileversion >= 3830) {
      order <<= 1;
      shift++;
      shift2++;
      this.longFilterEhigh3830(d0, order, count - order);
    }
    start = order;
    this.longFilterHigh3800(d0, order, shift2, count);
  }
  var fast = this.compressionLevel === COMPRESSION_LEVEL_FAST;
  for (i = 0; i < count; i++) {
    d0[i] = fast
      ? this.filterFast3320(d0[i], 0, YDELAYA)
      : this.filter3800(d0[i], 0, YDELAYA, YDELAYB, start, shift);
    this.pSamplePos++;
    this.advance32();
  }
};
/** 对应 predictor_update_3930()。 */
ApeDecoder.prototype.predictorUpdate3930 = function(decoded, f, delayA) {
  var hist = this.pHist, b = this.pBufPos, ca = f * 4;
  hist[b + delayA] = this.pLastA[f];
  var d0 = hist[b + delayA];
  var d1 = (hist[b + delayA] - hist[b + delayA - 1]) | 0;
  var d2 = (hist[b + delayA - 1] - hist[b + delayA - 2]) | 0;
  var d3 = (hist[b + delayA - 2] - hist[b + delayA - 3]) | 0;

  var predictionA = (Math.imul(d0, this.pCoeffsA[ca]) +
                     Math.imul(d1, this.pCoeffsA[ca + 1]) +
                     Math.imul(d2, this.pCoeffsA[ca + 2]) +
                     Math.imul(d3, this.pCoeffsA[ca + 3])) | 0;

  this.pLastA[f] = (decoded + (predictionA >> 9)) | 0;
  this.pFilterA[f] = (this.pLastA[f] + (Math.imul(this.pFilterA[f], 31) >> 5)) | 0;

  /* C 源为 (((int32_t)dN < 0) * 2 - 1) * sign：负数取 +1、非负取 -1（与 APESIGN 同向）。 */
  var sign = apeSign(decoded);
  this.pCoeffsA[ca]     += (d0 < 0 ? 1 : -1) * sign;
  this.pCoeffsA[ca + 1] += (d1 < 0 ? 1 : -1) * sign;
  this.pCoeffsA[ca + 2] += (d2 < 0 ? 1 : -1) * sign;
  this.pCoeffsA[ca + 3] += (d3 < 0 ? 1 : -1) * sign;

  return this.pFilterA[f];
};
/** 对应 predictor_decode_stereo_3930()。 */
ApeDecoder.prototype.predictorDecodeStereo3930 = function(count) {
  var d0 = this.decoded0, d1 = this.decoded1, i;
  this.apeApplyFilters(d0, d1, count);
  for (i = 0; i < count; i++) {
    var Y = d1[i], X = d0[i];
    d0[i] = this.predictorUpdate3930(Y, 0, YDELAYA);
    d1[i] = this.predictorUpdate3930(X, 1, XDELAYA);
    this.advance32();
  }
};
/** 对应 predictor_decode_mono_3930()。 */
ApeDecoder.prototype.predictorDecodeMono3930 = function(count) {
  var d0 = this.decoded0, i;
  this.apeApplyFilters(d0, null, count);
  for (i = 0; i < count; i++) {
    d0[i] = this.predictorUpdate3930(d0[i], 0, YDELAYA);
    this.advance32();
  }
};
/**
 * 对应 predictor_update_filter()（3.95+ 的 64 位预测器）。
 * @param {Predictor64} p 预测器状态。
 * @param {number} decoded 熵解码得到的残差。
 * @param {number} f 声道（0=Y, 1=X）。
 * @param {number} delayA delay 槽位。
 * @param {number} delayB 交叉 delay 槽位。
 * @param {number} adaptA 自适应槽位。
 * @param {number} adaptB 交叉自适应槽位。
 * @param {number} interimMode 过渡模式（>=1 时按完整 64 位计算）。
 * @returns {number} 输出样本（int32 截断）。
 */
ApeDecoder.prototype.predictorUpdateFilter = function(p, decoded, f, delayA, delayB, adaptA, adaptB, interimMode) {
  var h = p.hist, b = p.bufPos, ca = f * 4, cb = f * 5, o = f ^ 1;

  h[b + delayA] = p.lastA[f];
  h[b + adaptA] = apeSign(h[b + delayA] | 0);
  h[b + delayA - 1] = h[b + delayA] - h[b + delayA - 1];
  h[b + adaptA - 1] = apeSign(h[b + delayA - 1] | 0);

  var predictionA = h[b + delayA] * p.coeffsA[ca] +
                    h[b + delayA - 1] * p.coeffsA[ca + 1] +
                    h[b + delayA - 2] * p.coeffsA[ca + 2] +
                    h[b + delayA - 3] * p.coeffsA[ca + 3];

  /* 一阶缩放滤波 */
  h[b + delayB] = p.filterA[o] - Math.floor(p.filterB[f] * 31 / 32);
  h[b + adaptB] = apeSign(h[b + delayB] | 0);
  h[b + delayB - 1] = h[b + delayB] - h[b + delayB - 1];
  h[b + adaptB - 1] = apeSign(h[b + delayB - 1] | 0);
  p.filterB[f] = p.filterA[o];

  var predictionB = h[b + delayB] * p.coeffsB[cb] +
                    h[b + delayB - 1] * p.coeffsB[cb + 1] +
                    h[b + delayB - 2] * p.coeffsB[cb + 2] +
                    h[b + delayB - 3] * p.coeffsB[cb + 3] +
                    h[b + delayB - 4] * p.coeffsB[cb + 4];

  if (interimMode < 1) {
    var pa = predictionA | 0;
    var pb = predictionB | 0;
    p.lastA[f] = (decoded + ((((pa + (pb >> 1)) | 0) >> 10))) | 0;
  } else {
    p.lastA[f] = decoded + Math.floor((predictionA + Math.floor(predictionB / 2)) / 1024);
  }
  p.filterA[f] = p.lastA[f] + Math.floor(p.filterA[f] * 31 / 32);

  var sign = apeSign(decoded);
  p.coeffsA[ca]     += h[b + adaptA] * sign;
  p.coeffsA[ca + 1] += h[b + adaptA - 1] * sign;
  p.coeffsA[ca + 2] += h[b + adaptA - 2] * sign;
  p.coeffsA[ca + 3] += h[b + adaptA - 3] * sign;
  p.coeffsB[cb]     += h[b + adaptB] * sign;
  p.coeffsB[cb + 1] += h[b + adaptB - 1] * sign;
  p.coeffsB[cb + 2] += h[b + adaptB - 2] * sign;
  p.coeffsB[cb + 3] += h[b + adaptB - 3] * sign;
  p.coeffsB[cb + 4] += h[b + adaptB - 4] * sign;

  return p.filterA[f] | 0;
};
/** 64 位预测器推进一格。 */
function advance64(p) {
  p.bufPos++;
  if (p.bufPos === HISTORY_SIZE) {
    p.hist.copyWithin(0, HISTORY_SIZE, HISTORY_SIZE + PREDICTOR_SIZE);
    p.bufPos = 0;
  }
}
/** 对应 predictor_decode_stereo_3950()（含 24 位溢出的两遍 interim 逻辑）。 */
ApeDecoder.prototype.predictorDecodeStereo3950 = function(count) {
  var lcount = count, numPasses = 1, pass, i;
  this.apeApplyFilters(this.decoded0, this.decoded1, count);
  if (this.interimMode === -1) {
    this.qInterim.copyFrom(this.q);
    numPasses++;
    for (i = 0; i < count; i++) {
      this.interim0[i] = this.decoded0[i];
      this.interim1[i] = this.decoded1[i];
    }
  }
  for (pass = 0; pass < numPasses; pass++) {
    var interimMode = (this.interimMode > 0 || pass) ? 1 : 0;
    var p, d0, d1;
    if (pass) {
      p = this.qInterim;
      d0 = this.interim0;
      d1 = this.interim1;
    } else {
      p = this.q;
      d0 = this.decoded0;
      d1 = this.decoded1;
    }
    p.bufPos = 0;
    for (i = 0; i < lcount; i++) {
      var a0 = this.predictorUpdateFilter(p, d0[i], 0, YDELAYA, YDELAYB,
        YADAPTCOEFFSA, YADAPTCOEFFSB, interimMode);
      var a1 = this.predictorUpdateFilter(p, d1[i], 1, XDELAYA, XDELAYB,
        XADAPTCOEFFSA, XADAPTCOEFFSB, interimMode);
      d0[i] = a0;
      d1[i] = a1;
      if (numPasses > 1) {
        var left = (a1 - Math.trunc(a0 / 2)) | 0;
        var right = (left + a0) | 0;
        var nl = left <= 0 ? left : -left;
        var nr = right <= 0 ? right : -right;
        if ((nl < nr ? nl : nr) < -8388608) {
          this.interimMode = interimMode ? 0 : 1;
          break;
        }
      }
      advance64(p);
    }
  }
  if (numPasses > 1 && this.interimMode > 0) {
    for (i = 0; i < lcount; i++) {
      this.decoded0[i] = this.interim0[i];
      this.decoded1[i] = this.interim1[i];
    }
    this.q.copyFrom(this.qInterim);
    this.q.bufPos = 0;
  }
};
/** 对应 predictor_decode_mono_3950()。 */
ApeDecoder.prototype.predictorDecodeMono3950 = function(count) {
  var p = this.q, d0 = this.decoded0, h = p.hist, i;
  this.apeApplyFilters(d0, null, count);
  var currentA = p.lastA[0] | 0;
  for (i = 0; i < count; i++) {
    var b = p.bufPos;
    var A = d0[i];

    h[b + YDELAYA] = currentA;
    h[b + YDELAYA - 1] = h[b + YDELAYA] - h[b + YDELAYA - 1];

    var predictionA = (h[b + YDELAYA] * p.coeffsA[0] +
                       h[b + YDELAYA - 1] * p.coeffsA[1] +
                       h[b + YDELAYA - 2] * p.coeffsA[2] +
                       h[b + YDELAYA - 3] * p.coeffsA[3]) | 0;

    currentA = (A + (predictionA >> 10)) | 0;

    h[b + YADAPTCOEFFSA] = apeSign(h[b + YDELAYA] | 0);
    h[b + YADAPTCOEFFSA - 1] = apeSign(h[b + YDELAYA - 1] | 0);

    var sign = apeSign(A);
    p.coeffsA[0] += h[b + YADAPTCOEFFSA] * sign;
    p.coeffsA[1] += h[b + YADAPTCOEFFSA - 1] * sign;
    p.coeffsA[2] += h[b + YADAPTCOEFFSA - 2] * sign;
    p.coeffsA[3] += h[b + YADAPTCOEFFSA - 3] * sign;

    advance64(p);

    p.filterA[0] = currentA + Math.floor(p.filterA[0] * 31 / 32);
    d0[i] = p.filterA[0] | 0;
  }
  p.lastA[0] = currentA;
};
/* ---------------- 级联自适应滤波器 ---------------- */

/** 对应 init_filter()/do_init_filter()：复位系数、历史与游标。 */
ApeDecoder.prototype.initFilters = function() {
  for (var i = 0; i < this.filterBuf.length; i++) {
    var order = APE_FILTER_ORDERS[this.fset][i];
    this.filterBuf[i].fill(0);
    for (var ch = 0; ch < 2; ch++) {
      var st = this.filterState[i][ch];
      st.base = ch === 0 ? 0 : order * 3 + HISTORY_SIZE;
      st.delay = st.base + order * 3;
      st.adapt = st.base + order * 2;
      st.avg = 0;
    }
  }
};
/**
 * 对应 do_apply_filter()：定点自适应 FIR，原地修改 data。
 * @param {number} level 滤波器级别（0..2）。
 * @param {number} ch 声道。
 * @param {Int32Array} data 样本缓冲。
 * @param {number} count 样本数。
 * @param {number} order 阶数。
 * @param {number} fracbits 小数位数。
 */
ApeDecoder.prototype.doApplyFilter = function(level, ch, data, count, order, fracbits) {
  var st = this.filterState[level][ch];
  var buf = this.filterBuf[level];
  var cbase = st.base;
  var hbase = st.base + order;
  var wrapAt = st.base + order * 3 + HISTORY_SIZE;
  var delay = st.delay, adapt = st.adapt, avg = st.avg;
  var half = 1 << (fracbits - 1);
  var scale = half * 2;
  var old = this.fileversion < 3980;
  var i, j, res, mul, v2, v3, absres;

  for (i = 0; i < count; i++) {
    mul = apeSign(data[i]);
    v2 = delay - order;
    v3 = adapt - order;
    res = 0;
    if (mul === 0) {
      for (j = 0; j < order; j++) res += buf[cbase + j] * buf[v2 + j];
    } else if (mul === 1) {
      for (j = 0; j < order; j++) {
        res += buf[cbase + j] * buf[v2 + j];
        buf[cbase + j] += buf[v3 + j];
      }
    } else {
      for (j = 0; j < order; j++) {
        res += buf[cbase + j] * buf[v2 + j];
        buf[cbase + j] -= buf[v3 + j];
      }
    }
    res = Math.floor(((res | 0) + half) / scale);
    res = (res + data[i]) | 0;
    data[i] = res;

    /* 更新输出历史 */
    buf[delay] = res < -32768 ? -32768 : (res > 32767 ? 32767 : res);
    delay++;

    if (old) {
      /* 3.98 之前的版本 */
      buf[adapt] = res === 0 ? 0 : ((res >> 28) & 8) - 4;
      buf[adapt - 4] >>= 1;
      buf[adapt - 8] >>= 1;
    } else {
      absres = res <= 0 ? -res : res;
      if (absres) {
        buf[adapt] = apeSign(res) *
          (8 << ((absres > avg * 3 ? 1 : 0) + (absres > avg + Math.trunc(avg / 3) ? 1 : 0)));
      } else {
        buf[adapt] = 0;
      }
      avg = (avg + Math.trunc(((absres - avg) | 0) / 16)) | 0;
      buf[adapt - 1] >>= 1;
      buf[adapt - 2] >>= 1;
      buf[adapt - 8] >>= 1;
    }
    adapt++;

    /* 历史缓冲满了吗？ */
    if (delay === wrapAt) {
      buf.copyWithin(hbase, delay - order * 2, delay);
      delay = hbase + order * 2;
      adapt = hbase + order;
    }
  }
  st.delay = delay;
  st.adapt = adapt;
  st.avg = avg;
};
/** 对应 ape_apply_filters()：按压缩级别逐级应用滤波器。 */
ApeDecoder.prototype.apeApplyFilters = function(d0, d1, count) {
  for (var i = 0; i < APE_FILTER_LEVELS; i++) {
    var order = APE_FILTER_ORDERS[this.fset][i];
    if (!order) break;
    var fracbits = APE_FILTER_FRACBITS[this.fset][i];
    this.doApplyFilter(i, 0, d0, count, order, fracbits);
    if (d1) this.doApplyFilter(i, 1, d1, count, order, fracbits);
  }
};
/* ---------------- 帧解码 ---------------- */

/**
 * 开始解码一帧（对应 ape_decode_frame() 中 !s->samples 的分支）。
 * @param {Uint8Array} frameData 帧数据（parseApeInfo 给出的 pos/size 区间）。
 * @param {number} nblocks 帧内样本数。
 * @param {number} skip 帧内起始偏移（seek table 4 字节对齐产生）。
 */
ApeDecoder.prototype.startFrame = function(frameData, nblocks, skip) {
  var bufSize = (8 + frameData.length) & ~3;
  if (bufSize < 8) throw apeError('frame is too small');
  if (this.fileversion < 3950) bufSize += 2; // 旧版本会多读两字节
  if (!this.data || this.data.length < bufSize + 64) {
    this.data = new Uint8Array(bufSize + 64);
  }
  var d = this.data;
  d.fill(0);
  /* 8 字节前缀 + 帧数据整体按 32 位字节序翻转（对应 bswap_buf） */
  d[0] = (nblocks >>> 24) & 0xff;
  d[1] = (nblocks >>> 16) & 0xff;
  d[2] = (nblocks >>> 8) & 0xff;
  d[3] = nblocks & 0xff;
  d[4] = (skip >>> 24) & 0xff;
  d[5] = (skip >>> 16) & 0xff;
  d[6] = (skip >>> 8) & 0xff;
  d[7] = skip & 0xff;
  var n = frameData.length & ~3;
  for (var i = 0; i < n; i += 4) {
    d[8 + i] = frameData[i + 3];
    d[8 + i + 1] = frameData[i + 2];
    d[8 + i + 2] = frameData[i + 1];
    d[8 + i + 3] = frameData[i];
  }

  this.ptr = 0;
  this.dataEnd = bufSize;
  var hdrBlocks = this.readBE32();
  var offset = this.readBE32();
  if (this.fileversion >= 3900) {
    if (offset > 3) throw apeError('incorrect offset passed');
    if (this.dataEnd - this.ptr < offset) throw apeError('frame is too small');
    this.ptr += offset;
  } else {
    this.gb = new BitReader(this.data.subarray(this.ptr), this.dataEnd - this.ptr);
    this.gb.skipBits(this.fileversion > 3800 ? offset * 8 : offset);
  }
  if (!hdrBlocks || hdrBlocks > 0x1000000) {
    throw apeError('invalid sample count: ' + hdrBlocks);
  }
  if (hdrBlocks > this.maxBlocks) {
    this.maxBlocks = (hdrBlocks + 7) & ~7;
    this.decoded0 = new Int32Array(this.maxBlocks);
    this.decoded1 = new Int32Array(this.maxBlocks);
    if (this.interim0) {
      this.interim0 = new Int32Array(this.maxBlocks);
      this.interim1 = new Int32Array(this.maxBlocks);
    }
  }
  if (!this.initEntropyDecoder()) throw apeError('error reading frame header');
  this.initPredictorDecoder();
  this.initFilters();
  this.samples = hdrBlocks;
};
/** 对应 ape_unpack_mono()。 */
ApeDecoder.prototype.apeUnpackMono = function(count) {
  if (this.frameflags & APE_FRAMECODE_STEREO_SILENCE) return; /* 纯静音 */
  this.entropyDecodeMono(count);
  if (this.error) return;
  var v = this.fileversion;
  if (v < 3930) this.predictorDecodeMono3800(count);
  else if (v < 3950) this.predictorDecodeMono3930(count);
  else this.predictorDecodeMono3950(count);
  /* 伪立体声：右声道直接复制左声道 */
  if (this.channels === 2) {
    this.decoded1.set(this.decoded0.subarray(0, count));
  }
};
/** 对应 ape_unpack_stereo()（含去相关与深度还原）。 */
ApeDecoder.prototype.apeUnpackStereo = function(count) {
  if ((this.frameflags & APE_FRAMECODE_STEREO_SILENCE) === APE_FRAMECODE_STEREO_SILENCE) return;
  this.entropyDecodeStereo(count);
  if (this.error) return;
  var v = this.fileversion;
  if (v < 3930) this.predictorDecodeStereo3800(count);
  else if (v < 3950) this.predictorDecodeStereo3930(count);
  else this.predictorDecodeStereo3950(count);
  var d0 = this.decoded0, d1 = this.decoded1, i;
  for (i = 0; i < count; i++) {
    var left = (d1[i] - Math.trunc(d0[i] / 2)) | 0;
    var right = (left + d0[i]) | 0;
    d0[i] = left;
    d1[i] = right;
  }
};
/**
 * 解码当前帧的下一批样本，结果放在 decoded0/decoded1。
 * @returns {number} 本批样本数，0 表示当前帧已解完。
 */
ApeDecoder.prototype.decodeChunk = function() {
  if (this.samples <= 0) return 0;
  var n = Math.min(this.blocksPerLoop, this.samples);
  if (this.fileversion < 3930) n = this.samples; // 旧版本系数未交错，必须整帧解码
  var n8 = (n + 7) & ~7;
  this.decoded0.fill(0, 0, n8);
  this.decoded1.fill(0, 0, n8);
  if (this.interim0) {
    this.interim0.fill(0, 0, n8);
    this.interim1.fill(0, 0, n8);
  }
  this.error = 0;
  if (this.channels === 1 || (this.frameflags & APE_FRAMECODE_PSEUDO_STEREO)) {
    this.apeUnpackMono(n);
  } else {
    this.apeUnpackStereo(n);
  }
  if (this.error) {
    this.samples = 0;
    throw apeError('error decoding frame');
  }
  this.samples -= n;
  return n;
};
/**
 * 把最近一批解码结果按交错小端 PCM 写出。
 * @param {Uint8Array} out 目标缓冲。
 * @param {number} off 起始字节偏移。
 * @param {number} count 样本数。
 * @param {boolean} [ffmpegStyle] 为真时 24 位输出 ×256 的 s32le（与 FFmpeg 输出一致）。
 * @param {number} [from] 批次内起始样本下标，默认 0（随机访问时从中途取）。
 * @returns {number} 写入的字节数。
 */
ApeDecoder.prototype.writeInterleaved = function(out, off, count, ffmpegStyle, from) {
  var ch = this.channels, d0 = this.decoded0, d1 = this.decoded1;
  var s = from > 0 ? from : 0, e = s + count;
  var p = off, i, v;
  if (this.bps === 8) {
    for (i = s; i < e; i++) {
      out[p++] = (d0[i] + 0x80) & 0xff;
      if (ch === 2) out[p++] = (d1[i] + 0x80) & 0xff;
    }
  } else if (this.bps === 16) {
    for (i = s; i < e; i++) {
      v = d0[i];
      out[p++] = v & 0xff;
      out[p++] = (v >> 8) & 0xff;
      if (ch === 2) {
        v = d1[i];
        out[p++] = v & 0xff;
        out[p++] = (v >> 8) & 0xff;
      }
    }
  } else if (ffmpegStyle) {
    for (i = s; i < e; i++) {
      v = Math.imul(d0[i], 256);
      out[p++] = v & 0xff;
      out[p++] = (v >> 8) & 0xff;
      out[p++] = (v >> 16) & 0xff;
      out[p++] = (v >>> 24) & 0xff;
      if (ch === 2) {
        v = Math.imul(d1[i], 256);
        out[p++] = v & 0xff;
        out[p++] = (v >> 8) & 0xff;
        out[p++] = (v >> 16) & 0xff;
        out[p++] = (v >>> 24) & 0xff;
      }
    }
  } else {
    for (i = s; i < e; i++) {
      v = d0[i];
      out[p++] = v & 0xff;
      out[p++] = (v >> 8) & 0xff;
      out[p++] = (v >> 16) & 0xff;
      if (ch === 2) {
        v = d1[i];
        out[p++] = v & 0xff;
        out[p++] = (v >> 8) & 0xff;
        out[p++] = (v >> 16) & 0xff;
      }
    }
  }
  return p - off;
};

module.exports = {
  APE_MIN_VERSION: APE_MIN_VERSION,
  APE_MAX_VERSION: APE_MAX_VERSION,
  parseApeInfo: parseApeInfo,
  ApeDecoder: ApeDecoder
};
