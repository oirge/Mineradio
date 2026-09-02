'use strict';
/**
 * DSF（DSD Stream File，Sony 定义）解析与 DSD→PCM 转换。
 *
 * 纯 JavaScript，无外部依赖，也不直接触碰文件系统：调用方提供同步的
 * read(offset, length) 读取器（返回 Buffer，允许在文件末尾返回较短的结果）。
 *
 * 设计要点：
 *  - DSD 是未压缩的 1-bit 码流，输出样本 s 只依赖固定窗口内的输入字节，
 *    没有跨帧状态，因此可以从任意位置随机访问（HTTP Range 请求依赖这一点）。
 *  - 抽取滤波器用“字节查表”实现：把 FIR 系数按 8 个一组预乘成 256 项表，
 *    每个输出样本只需 rows 次查表累加（rows = FIR 长度 / 8）。
 *  - 抽取率固定为 32 的倍数（DSD64 → 88200 Hz），保证 8 位对齐。
 */

var DSD_PAD_BYTE = 0x69;    // DSF 规范用于填充块尾的字节，其直流分量为 0
var TAPS_PER_DECIM = 40;    // FIR 长度 = 40 × 抽取率，兼顾过渡带宽与运算量
var KAISER_BETA = 8;        // 阻带约 -80 dB
var MIN_CUTOFF_HZ = 30000;  // 至少保留到 30 kHz，避免可听频段被削
var MAX_OUT_RATE = 384000;  // 输出采样率上限（超过则继续加大抽取率）
var OUT_BITS = 24;
var EMPTY = Buffer.alloc(0);

var DSF_CHANNEL_TYPES = {
  1: 'mono', 2: 'stereo', 3: '3.0', 4: 'quad', 5: '4.0', 6: '5.0', 7: '5.1'
};

/**
 * 构造带错误码的解析异常。
 * @param {string} message 描述。
 * @returns {Error} 异常对象。
 */
function dsfError(message) {
  var err = new Error('DSF: ' + message);
  err.code = 'DSF_INVALID';
  return err;
}

/**
 * 读取 64 位小端无符号整数（超出安全整数范围视为非法）。
 * @param {Buffer} buf 数据。
 * @param {number} off 偏移。
 * @returns {number} 数值。
 */
function readU64(buf, off) {
  var lo = buf.readUInt32LE(off);
  var hi = buf.readUInt32LE(off + 4);
  if (hi > 0x1fffff) throw dsfError('64 位数值超出范围 @' + off);
  return hi * 4294967296 + lo;
}

/**
 * 解析 DSF 头部（DSD / fmt / data 三个块），并给出 PCM 输出规格。
 * @param {function(number, number): Buffer} read 同步读取器。
 * @param {number} fileSize 文件总长度。
 * @returns {Object} 描述信息。
 */
function parseDsfInfo(read, fileSize) {
  var head = read(0, 28);
  if (!head || head.length < 28) throw dsfError('文件过小');
  if (head.toString('latin1', 0, 4) !== 'DSD ') throw dsfError('缺少 DSD 块');
  var dsdChunkSize = readU64(head, 4);
  var declaredSize = readU64(head, 12);
  var metadataOffset = readU64(head, 20);
  if (dsdChunkSize < 28) throw dsfError('DSD 块长度非法: ' + dsdChunkSize);

  var fmtOffset = dsdChunkSize;
  var fmt = read(fmtOffset, 52);
  if (!fmt || fmt.length < 52 || fmt.toString('latin1', 0, 4) !== 'fmt ') {
    throw dsfError('缺少 fmt 块');
  }
  var fmtChunkSize = readU64(fmt, 4);
  if (fmtChunkSize < 52) throw dsfError('fmt 块长度非法: ' + fmtChunkSize);
  var formatVersion = fmt.readUInt32LE(12);
  var formatId = fmt.readUInt32LE(16);
  var channelType = fmt.readUInt32LE(20);
  var channels = fmt.readUInt32LE(24);
  var dsdRate = fmt.readUInt32LE(28);
  var bitsPerSample = fmt.readUInt32LE(32);
  var sampleCount = readU64(fmt, 36);
  var blockSize = fmt.readUInt32LE(44);

  if (formatId !== 0) throw dsfError('不支持的格式（DST 压缩流）');
  if (channels < 1 || channels > 6) throw dsfError('声道数非法: ' + channels);
  if (bitsPerSample !== 1 && bitsPerSample !== 8) {
    throw dsfError('每样本位数非法: ' + bitsPerSample);
  }
  if (dsdRate < 8000 || dsdRate > 100000000) throw dsfError('DSD 采样率非法: ' + dsdRate);
  if (blockSize < 8 || blockSize % 8 !== 0 || blockSize > 1 << 20) {
    throw dsfError('块长度非法: ' + blockSize);
  }

  var dataOffset = fmtOffset + fmtChunkSize;
  var dataHead = read(dataOffset, 12);
  if (!dataHead || dataHead.length < 12 || dataHead.toString('latin1', 0, 4) !== 'data') {
    throw dsfError('缺少 data 块');
  }
  var dataChunkSize = readU64(dataHead, 4);
  var audioOffset = dataOffset + 12;
  var dataSize = dataChunkSize > 12 ? dataChunkSize - 12 : 0;
  /* 以文件实际长度（以及 ID3 标签位置）为上限，容忍被截断或长度写错的文件。 */
  var limit = fileSize > audioOffset ? fileSize - audioOffset : 0;
  if (metadataOffset > audioOffset && metadataOffset <= fileSize) {
    limit = Math.min(limit, metadataOffset - audioOffset);
  }
  if (dataSize <= 0 || dataSize > limit) dataSize = limit;
  if (dataSize < blockSize) throw dsfError('没有音频数据');

  /* 数据区按“块组”排列：每组内先是声道 0 的 blockSize 字节，然后声道 1……
     最后一组可能不完整（规范要求用 0x69 填充，但截断文件里可能直接缺失）。 */
  var groupBytes = blockSize * channels;
  var fullGroups = Math.floor(dataSize / groupBytes);
  var restBytes = dataSize - fullGroups * groupBytes;
  var tailBytes = Math.min(blockSize, Math.max(0, restBytes - (channels - 1) * blockSize));
  var perChannelBytes = fullGroups * blockSize + tailBytes;
  var availableBits = perChannelBytes * 8;
  var validBits = sampleCount > 0 ? Math.min(sampleCount, availableBits) : availableBits;
  if (validBits < 8) throw dsfError('没有音频数据');

  var decimation = 32;
  while (dsdRate / decimation > MAX_OUT_RATE) decimation *= 2;
  var outSampleRate = Math.floor(dsdRate / decimation);
  var totalOutSamples = Math.floor(validBits / decimation);

  return {
    formatVersion: formatVersion,
    formatId: formatId,
    channelType: channelType,
    channelLayout: DSF_CHANNEL_TYPES[channelType] || String(channels) + 'ch',
    channels: channels,
    dsdRate: dsdRate,
    bitsPerSample: bitsPerSample,
    lsbFirst: bitsPerSample === 1,
    sampleCount: sampleCount,
    blockSize: blockSize,
    audioOffset: audioOffset,
    dataSize: dataSize,
    perChannelBytes: perChannelBytes,
    metadataOffset: metadataOffset > 0 && metadataOffset < fileSize ? metadataOffset : 0,
    declaredFileSize: declaredSize,
    duration: validBits / dsdRate,
    decimation: decimation,
    sampleRate: outSampleRate,
    bps: OUT_BITS,
    bytesPerSample: OUT_BITS / 8,
    totalSamples: totalOutSamples,
    /* 供界面显示：DSD 的“比特率”按 1 bit × 声道 × DSD 采样率计。 */
    bitrate: dsdRate * channels
  };
}

/**
 * 零阶修正贝塞尔函数 I0，用于 Kaiser 窗。
 * @param {number} x 自变量。
 * @returns {number} I0(x)。
 */
function besselI0(x) {
  var sum = 1, term = 1, y = x * x / 4, k;
  for (k = 1; k < 80; k++) {
    term *= y / (k * k);
    sum += term;
    if (term < sum * 1e-17) break;
  }
  return sum;
}

/**
 * 设计 Kaiser 窗低通 FIR（直流增益归一化为 1）。
 * @param {number} taps 抽头数。
 * @param {number} cutoffHz 半幅截止频率。
 * @param {number} rateHz 输入采样率。
 * @returns {Float64Array} 系数。
 */
function designLowpass(taps, cutoffHz, rateHz) {
  var h = new Float64Array(taps);
  var fc = cutoffHz / rateHz;
  var half = (taps - 1) / 2;
  var denom = besselI0(KAISER_BETA);
  var sum = 0, i, m, r, w, s;
  for (i = 0; i < taps; i++) {
    m = i - half;
    s = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
    r = m / half;
    w = besselI0(KAISER_BETA * Math.sqrt(Math.max(0, 1 - r * r))) / denom;
    h[i] = s * w;
    sum += h[i];
  }
  for (i = 0; i < taps; i++) h[i] /= sum;
  return h;
}

/**
 * DSD→PCM 转换器：查表式 FIR 抽取。
 * @param {Object} info parseDsfInfo() 的返回值。
 * @constructor
 */
function DsdConverter(info) {
  this.info = info;
  this.channels = info.channels;
  this.decimation = info.decimation;
  this.bytesPerOutSample = info.decimation / 8;   // 每个输出样本推进的字节数
  this.rows = TAPS_PER_DECIM * info.decimation / 8;

  var cutoff = Math.max(MIN_CUTOFF_HZ, info.sampleRate / 4);
  var taps = designLowpass(this.rows * 8, cutoff, info.dsdRate);
  this.cutoffHz = cutoff;

  /* 预乘出每个字节（8 个 1-bit 样本）对输出的贡献：table[row * 256 + byte]。 */
  var table = new Float64Array(this.rows * 256);
  var lsbFirst = info.lsbFirst;
  var row, byte, bit, acc, coeff;
  for (row = 0; row < this.rows; row++) {
    for (byte = 0; byte < 256; byte++) {
      acc = 0;
      for (bit = 0; bit < 8; bit++) {
        coeff = taps[row * 8 + bit];
        /* 1-bit 流：1 表示 +1，0 表示 -1；bps=1 时字节内低位在前。 */
        if ((byte >> (lsbFirst ? bit : 7 - bit)) & 1) acc += coeff;
        else acc -= coeff;
      }
      table[row * 256 + byte] = acc;
    }
  }
  this.table = table;

  this.scratch = [];
  this.scratchLength = 0;
  this.blockBuf = null;
}

/**
 * 确保每声道的暂存缓冲不小于 need 字节。
 * @param {number} need 需要的长度。
 */
DsdConverter.prototype.ensureScratch = function(need) {
  if (this.scratchLength >= need) return;
  var size = 1024;
  while (size < need) size *= 2;
  for (var ch = 0; ch < this.channels; ch++) this.scratch[ch] = new Uint8Array(size);
  this.scratchLength = size;
};

/**
 * 把交错存放的块组数据按声道展开到暂存缓冲。
 * @param {function(number, number): Buffer} read 同步读取器。
 * @param {number} startByte 每声道起始字节索引。
 * @param {number} need 每声道需要的字节数。
 */
DsdConverter.prototype.gather = function(read, startByte, need) {
  var info = this.info, bs = info.blockSize, ch = this.channels, groupBytes = bs * ch;
  var g0 = Math.floor(startByte / bs);
  var g1 = Math.floor((startByte + need - 1) / bs);
  var fileStart = info.audioOffset + g0 * groupBytes;
  var wantLen = (g1 - g0 + 1) * groupBytes;
  var maxLen = info.audioOffset + info.dataSize - fileStart;
  var blob = EMPTY;
  if (wantLen > 0 && maxLen > 0) blob = read(fileStart, Math.min(wantLen, maxLen)) || EMPTY;
  this.ensureScratch(need);
  var i, g, dst, from, to, srcOff, len;
  for (i = 0; i < ch; i++) {
    dst = this.scratch[i];
    dst.fill(DSD_PAD_BYTE, 0, need);
    for (g = g0; g <= g1; g++) {
      from = Math.max(startByte, g * bs);
      to = Math.min(startByte + need, (g + 1) * bs);
      if (to > info.perChannelBytes) to = info.perChannelBytes;
      if (to <= from) continue;
      srcOff = (g - g0) * groupBytes + i * bs + (from - g * bs);
      len = to - from;
      if (srcOff + len > blob.length) len = blob.length - srcOff;
      if (len > 0) dst.set(blob.subarray(srcOff, srcOff + len), from - startByte);
    }
  }
};

/**
 * 渲染一段 PCM（24-bit 小端交错）。
 * @param {function(number, number): Buffer} read 同步读取器。
 * @param {number} startSample 起始输出样本序号。
 * @param {number} count 输出样本数。
 * @param {Buffer|Uint8Array} out 输出缓冲。
 * @param {number} outOff 输出起始偏移。
 * @returns {number} 写入的字节数。
 */
DsdConverter.prototype.render = function(read, startSample, count, out, outOff) {
  if (count <= 0) return 0;
  var step = this.bytesPerOutSample, rows = this.rows, ch = this.channels;
  var table = this.table, scratch = this.scratch;
  var need = (count - 1) * step + rows;
  this.gather(read, startSample * step, need);
  var i, c, j, base, acc, v, o, src;
  var pos = outOff;
  for (i = 0; i < count; i++) {
    base = i * step;
    for (c = 0; c < ch; c++) {
      src = scratch[c];
      acc = 0;
      for (j = 0; j < rows; j++) acc += table[j * 256 + src[base + j]];
      v = Math.round(acc * 8388608);
      if (v > 8388607) v = 8388607;
      else if (v < -8388608) v = -8388608;
      out[pos] = v & 0xff;
      out[pos + 1] = (v >> 8) & 0xff;
      out[pos + 2] = (v >> 16) & 0xff;
      pos += 3;
    }
  }
  return pos - outOff;
};

module.exports = {
  parseDsfInfo: parseDsfInfo,
  DsdConverter: DsdConverter,
  designLowpass: designLowpass,
  DSD_PAD_BYTE: DSD_PAD_BYTE
};






