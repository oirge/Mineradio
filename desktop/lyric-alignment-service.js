'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const SCHEMA_VERSION = 1;
const MAX_LYRIC_CHARS = 16000;
const MAX_ACTIVE_JOBS = 8;
const LANGUAGES = new Set(['Chinese', 'English', 'Cantonese', 'French', 'German',
  'Italian', 'Japanese', 'Korean', 'Portuguese', 'Russian', 'Spanish']);
const CREDIT = /^(?:作[词曲]|词(?:作者)?|曲(?:作者)?|编曲|演唱|歌手|制作(?:人)?|出品(?:人)?|监制|录音(?:师|助理|工程)?|混音(?:师|工程)?|母带|和声|合声(?:编写)?|吉他|贝斯|键盘|鼓|弦乐|发行|版权|OP|SP|词曲|词\s*[\/&]\s*曲|Lyrics?|Composer|Arranger|Producer|Written\s+by|Music\s+by|Vocal|Recording|Mixing|Mastering)\s*[:：/]/i;
const PLACEHOLDER = /^(?:纯音乐|暂无歌词|此歌曲为没有填词|未经许可|未经著作权|未经允许)/;
const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });

function fail(code, message, status = 400) {
  const error = new Error(message || code);
  error.code = code;
  error.status = status;
  throw error;
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sungText(text) {
  return String(text || '').split('\n')[0].trim();
}

function normalizeLyrics(input) {
  if (!Array.isArray(input)) fail('LYRICS_REQUIRED', '缺少准确歌词');
  if (input.length > 2000) fail('LYRICS_TOO_LONG', '歌词内容过长');
  let count = 0;
  const rows = [];
  for (let index = 0; index < input.length; index++) {
    const item = input[index];
    const text = sungText(typeof item === 'string' ? item : item && item.text);
    if (!text || item && item.metadata === true || !/[\p{L}\p{N}]/u.test(text) || CREDIT.test(text) || PLACEHOLDER.test(text) || /^\[[a-z]+:/i.test(text)) continue;
    if (item && Number.isFinite(item.hintStart) && item.hintStart < 8 && /\s[-–]\s/.test(text)) continue;
    count += text.length;
    if (count > MAX_LYRIC_CHARS || text.length > 4000 || rows.length >= 600) fail('LYRICS_TOO_LONG', '歌词内容过长');
    const row = { text, sourceIndex: index };
    const translation = item && (item.translation || String(item.text || '').split('\n').slice(1).join('\n'));
    if (translation) row.translation = String(translation).slice(0, 2000);
    // Line timestamps are optional anchors, never the source of character durations.
    if (item && Number.isFinite(item.hintStart) && item.hintStart >= 0) row.hintStart = item.hintStart;
    if (item && Number.isFinite(item.hintEnd) && item.hintEnd > (row.hintStart || 0)) row.hintEnd = item.hintEnd;
    rows.push(row);
  }
  if (!rows.length) fail('LYRICS_REQUIRED', '没有可对齐的演唱歌词');
  return rows;
}

function lyricHash(rows) {
  return digest(JSON.stringify(rows.map(row => row.text)));
}

function reviewList(value) {
  return Array.isArray(value) ? [...new Set(value.map(item => String(item).slice(0, 600)))].slice(0, 12) : [];
}

function validateAlignment(input, expectedRows) {
  if (!input || input.timeUnit !== 'seconds' || input.schemaVersion !== SCHEMA_VERSION) {
    fail('ALIGNMENT_SCHEMA_INVALID', '时间轴格式或时间单位无效');
  }
  const duration = input.audioDuration;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 7200) {
    fail('ALIGNMENT_DURATION_INVALID', '音频时长无效');
  }
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 600) {
    fail('ALIGNMENT_LINES_INVALID', '没有有效时间轴');
  }
  if (expectedRows && (expectedRows.length !== input.lines.length ||
      expectedRows.some((row, i) => !input.lines[i] || row.text !== input.lines[i].text))) {
    fail('ALIGNMENT_TEXT_MISMATCH', '对齐结果与歌词正文不一致');
  }
  let previousStart = -1;
  let previousWord = null;
  let totalChars = 0;
  const lines = input.lines.map((line, lineIndex) => {
    const text = sungText(line && line.text);
    totalChars += text.length;
    if (!text || line.text !== text || totalChars > MAX_LYRIC_CHARS || !Array.isArray(line.words) || line.words.length > text.length) {
      fail('ALIGNMENT_TEXT_INVALID', '歌词或逐字数据无效');
    }
    const boundaries = new Set([0, text.length]);
    for (const part of segmenter.segment(text)) {
      boundaries.add(part.index);
      boundaries.add(part.index + part.segment.length);
    }
    const reviews = reviewList(line.reviewReasons);
    let previousOffset = 0;
    const covered = new Set();
    const words = line.words.map(word => {
      if (!word || typeof word !== 'object') fail('ALIGNMENT_CHAR_RANGE_INVALID', '逐字字符范围与歌词不一致');
      const c0 = word.c0;
      const c1 = word.c1;
      if (!Number.isInteger(c0) || !Number.isInteger(c1) ||
          c0 < previousOffset || c1 <= c0 || c1 > text.length ||
          !boundaries.has(c0) || !boundaries.has(c1) || word.text !== text.slice(c0, c1)) {
        fail('ALIGNMENT_CHAR_RANGE_INVALID', '逐字字符范围与歌词不一致');
      }
      previousOffset = c1;
      for (let i = c0; i < c1; i++) covered.add(i);
      const reasons = reviewList(word.reviewReasons);
      let start = word.start;
      let end = word.end;
      if ((start === null) !== (end === null)) fail('ALIGNMENT_WORD_TIME_INVALID', '逐字开始和结束时间必须一起填写');
      const hanCount = (word.text.match(/\p{Script=Han}/gu) || []).length;
      if (hanCount > 1) {
        start = null;
        end = null;
        reasons.push('MULTI_CHARACTER_TIMESTAMP');
      }
      if (start === null || end === null) {
        start = null;
        end = null;
        reasons.push('MISSING_ALIGNMENT');
      } else {
        if (!Number.isFinite(start) || !Number.isFinite(end) ||
            start < 0 || end <= start || end > duration + 0.001) {
          fail('ALIGNMENT_WORD_TIME_INVALID', '逐字开始或结束时间无效');
        }
        if (start + 0.001 < previousStart) fail('ALIGNMENT_NOT_MONOTONIC', '逐字开始时间不是递增顺序');
        if (previousWord && previousWord.end > start + 0.01) {
          reasons.push('OVERLAPPING_INTERVAL');
          previousWord.reviewReasons.push('OVERLAPPING_INTERVAL');
        }
        if (end - start > 8) reasons.push('LONG_INTERVAL');
        if (end - start < 0.025) reasons.push('SHORT_INTERVAL');
        previousStart = start;
      }
      const result = {
        text: word.text, c0, c1, start, end,
        reviewReasons: [...new Set(reasons)],
      };
      if (Number.isFinite(word.rawStart) && Number.isFinite(word.rawEnd)) {
        result.rawStart = word.rawStart;
        result.rawEnd = word.rawEnd;
      }
      if (Number.isFinite(word.confidence)) result.confidence = word.confidence;
      if (start !== null) previousWord = result;
      return result;
    });
    for (const part of segmenter.segment(text)) {
      if (/[\p{L}\p{N}]/u.test(part.segment) && !covered.has(part.index)) {
        reviews.push('MISSING_CHARACTER');
      }
    }
    const valid = words.filter(word => word.start !== null);
    const start = valid.length ? Math.min(...valid.map(word => word.start)) : null;
    const end = valid.length ? Math.max(...valid.map(word => word.end)) : null;
    const result = { text, start, end, words,
      translation: String(line.translation || expectedRows && expectedRows[lineIndex].translation || '').slice(0, 2000),
      sourceIndex: expectedRows && Number.isInteger(expectedRows[lineIndex].sourceIndex)
        ? expectedRows[lineIndex].sourceIndex : Number.isInteger(line.sourceIndex) ? line.sourceIndex : lineIndex,
      reviewReasons: [...new Set(reviews)] };
    // Worker output and manual edits cannot replace the original lyric anchors.
    const anchors = expectedRows ? expectedRows[lineIndex] : line;
    if (Number.isFinite(anchors.hintStart) && anchors.hintStart >= 0 && anchors.hintStart < duration) {
      result.hintStart = anchors.hintStart;
      if (Number.isFinite(anchors.hintEnd) && anchors.hintEnd > anchors.hintStart && anchors.hintEnd <= duration) {
        result.hintEnd = anchors.hintEnd;
      }
    }
    return result;
  });
  const reviewCount = lines.reduce((count, line) =>
    count + line.words.filter(word => word.reviewReasons.length).length + (line.reviewReasons.length ? 1 : 0), 0);
  return {
    schemaVersion: SCHEMA_VERSION, timeUnit: 'seconds',
    audioDuration: duration, engine: String(input.engine || 'manual').slice(0, 120),
    language: String(input.language || 'Chinese').slice(0, 32), lines,
    model: String(input.model || '').slice(0, 200), modelRevision: String(input.modelRevision || '').slice(0, 120),
    warnings: reviewList(input.warnings), reviewCount,
    corrected: input.corrected === true,
  };
}

function resolveAlignmentPaths({ runtimeRoot, resourceRoot, resourcesPath, pythonPath, workerPath }) {
  const root = path.resolve(runtimeRoot);
  // Python is an external process: it cannot open Electron's virtual app.asar paths.
  const external = file => file && file.replace(/([\\/])app\.asar([\\/])/i, '$1app.asar.unpacked$2');
  const workers = workerPath ? [external(path.resolve(workerPath))] : [
    resourcesPath && path.join(resourcesPath, 'app.asar.unpacked', 'lyric-aligner', 'align.py'),
    resourceRoot && external(path.join(resourceRoot, 'lyric-aligner', 'align.py')),
    path.join(root, 'align.py'),
  ].filter(Boolean);
  const interpreters = pythonPath ? [path.resolve(pythonPath)] : [
    path.join(root, 'venv', 'Scripts', 'python.exe'), path.join(root, 'venv', 'bin', 'python'),
  ];
  const exists = file => { try { return fs.statSync(file).isFile(); } catch (_) { return false; } };
  return { runtimeRoot: root, workerPath: workers.find(exists) || workers[0],
    pythonPath: interpreters.find(exists) || interpreters[0] };
}

function defaultAlignmentRuntimeRoot(options = {}) {
  const platform = options.platform || process.platform;
  const homeDir = options.homeDir || os.homedir();
  const dataRoot = platform === 'win32'
    ? options.localAppData || process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local')
    : options.xdgDataHome || process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
  return path.resolve(dataRoot, 'Mineradio-oirge', 'lyric-runtime');
}

function createLyricAlignmentService(options) {
  const resolved = resolveAlignmentPaths(options);
  const runtimeRoot = resolved.runtimeRoot;
  const cacheRoot = path.resolve(options.cacheRoot);
  const worker = resolved.workerPath;
  const python = resolved.pythonPath;
  const jobs = new Map();
  const fingerprints = new Map();
  const mutations = new Map();
  const queue = [];
  let running = false;

  function withAudioLock(audioHash, operation) {
    const previous = mutations.get(audioHash) || Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    mutations.set(audioHash, next);
    return next.finally(() => { if (mutations.get(audioHash) === next) mutations.delete(audioHash); });
  }

  function fileStamp(stat) { return `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`; }

  async function fingerprint(file) {
    let stat;
    try { stat = await fs.promises.stat(file); }
    catch (error) { if (error.code === 'ENOENT') fail('AUDIO_NOT_FOUND', '音频文件不存在', 404); throw error; }
    if (!stat.isFile()) fail('AUDIO_NOT_FOUND', '音频文件不存在', 404);
    const stamp = fileStamp(stat);
    const known = fingerprints.get(file);
    if (known && known.stamp === stamp) return known.value;
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    if (fileStamp(await fs.promises.stat(file)) !== stamp) fail('AUDIO_CHANGED', '读取期间音频文件发生了变化', 409);
    const value = { sha256: hash.digest('hex'), size: stat.size, modifiedAt: stat.mtimeMs };
    fingerprints.set(file, { stamp, value });
    if (fingerprints.size > 128) fingerprints.delete(fingerprints.keys().next().value);
    return value;
  }

  function cachePath(audioHash) {
    if (!/^[a-f0-9]{64}$/.test(audioHash)) fail('AUDIO_HASH_INVALID');
    return path.join(cacheRoot, audioHash + '.json');
  }

  async function persist(record) {
    await fs.promises.mkdir(cacheRoot, { recursive: true });
    const target = cachePath(record.audio.sha256);
    const temporary = target + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
    try {
      await fs.promises.writeFile(temporary, JSON.stringify(record, null, 2), { flag: 'wx' });
      await fs.promises.rename(temporary, target);
    } finally {
      await fs.promises.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
    return record;
  }

  async function readCache(file, rows) {
    const audio = await fingerprint(file);
    try {
      const record = JSON.parse(await fs.promises.readFile(cachePath(audio.sha256), 'utf8'));
      if (!record || !record.audio || record.audio.sha256 !== audio.sha256 || record.audio.size !== audio.size) {
        fail('AUDIO_VERSION_MISMATCH', '音频版本不一致');
      }
      const alignment = validateAlignment(record.alignment);
      if (record.lyricsHash !== lyricHash(alignment.lines)) fail('ALIGNMENT_CACHE_INVALID', '缓存歌词正文校验失败');
      const textMatches = !rows || record.lyricsHash === lyricHash(rows);
      const matches = textMatches && (!rows || rows.every((row, index) => {
        const line = alignment.lines[index];
        if (!Number.isFinite(row.hintStart) || row.hintStart < 0 || row.hintStart >= alignment.audioDuration) return true;
        // Missing legacy anchors are unknown, not conflicts with the current LRC.
        if (Number.isFinite(line.hintStart) && Math.abs(line.hintStart - row.hintStart) > 0.001) return false;
        return !Number.isFinite(row.hintEnd) || row.hintEnd <= row.hintStart || row.hintEnd > alignment.audioDuration ||
          !Number.isFinite(line.hintEnd) || Math.abs(line.hintEnd - row.hintEnd) <= 0.001;
      }));
      return { ok: true, hit: true, matches, textMatches, audio,
        lyricsHash: record.lyricsHash, savedAt: record.savedAt, alignment,
        revision: record.revision || digest(JSON.stringify(record)) };
    } catch (error) {
      if (error.code === 'ENOENT') return { ok: true, hit: false, audio };
      throw error;
    }
  }

  function runtimeStatus() {
    const modelPath = path.join(runtimeRoot, 'models', 'Qwen3-ForcedAligner-0.6B', 'model.safetensors');
    const needsModel = path.basename(worker).toLowerCase() === 'align.py';
    const modelReady = !needsModel || (() => {
      try {
        const stat = fs.statSync(modelPath);
        return stat.isFile() && stat.size > 0;
      } catch (_) { return false; }
    })();
    return {
      ok: true, available: fs.existsSync(python) && fs.existsSync(worker) && modelReady,
      engine: 'Qwen3-ForcedAligner', running,
      queued: queue.length, languages: [...LANGUAGES],
    };
  }

  function publicJob(job) {
    return { ok: true, id: job.id, status: job.status, stage: job.stage,
      error: job.error || '', message: job.message || '',
      createdAt: job.createdAt, finishedAt: job.finishedAt || 0,
      result: job.status === 'complete' ? job.result : undefined };
  }

  function invokeWorker(requestPath, outputPath, job) {
    return new Promise((resolve, reject) => {
      const child = spawn(python, [worker, '--request', requestPath, '--output', outputPath, '--runtime', runtimeRoot], {
        windowsHide: true, shell: false, cwd: runtimeRoot,
        env: { ...process.env, PYTHONUTF8: '1', HF_HOME: path.join(runtimeRoot, 'models'),
          MINERADIO_ALIGN_RUNTIME: runtimeRoot },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      job.child = child;
      let log = '';
      let pending = '';
      const consume = chunk => {
        log = (log + chunk.toString('utf8')).slice(-12000);
        pending += chunk.toString('utf8');
        const messages = pending.split(/\r?\n/);
        pending = messages.pop().slice(-4000);
        for (const message of messages) {
          try {
            const event = JSON.parse(message);
            if (event.stage) {
              const labels = { 'model-download': '下载本地对齐模型', 'model-load': '加载本地对齐模型',
                'decode-audio': '解码实际音频', align: '对齐演唱时间', complete: '完成' };
              job.stage = (labels[event.stage] || event.stage) +
                (Number.isFinite(event.completed) && Number.isFinite(event.total) ? ` ${event.completed}/${event.total}` : '');
            }
          } catch (_) {}
        }
      };
      child.stdout.on('data', consume);
      child.stderr.on('data', consume);
      // Wait for close after termination, so the next queued model cannot start while
      // a timed-out model still owns memory or keeps writing its result file.
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill(); }, options.workerTimeoutMs || 30 * 60 * 1000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => {
        clearTimeout(timer);
        job.child = null;
        if (job.cancelled) reject(Object.assign(new Error('时间轴已清除或校正，旧任务已取消'), { code: 'ALIGNMENT_CANCELLED' }));
        else if (timedOut) reject(Object.assign(new Error('音频对齐超时'), { code: 'ALIGNMENT_TIMEOUT' }));
        else if (code !== 0) {
          const detail = log.split(/\r?\n/).filter(Boolean).slice(-3).join(' ').slice(0, 300);
          reject(Object.assign(new Error(detail || '本地对齐模型运行失败'), { code: 'ALIGNMENT_WORKER_FAILED' }));
        } else resolve();
      });
    });
  }

  async function drain() {
    if (running || !queue.length) return;
    running = true;
    const job = queue.shift();
    const jobDir = path.join(cacheRoot, 'jobs', job.id);
    try {
      job.status = 'running';
      job.stage = '读取实际音频';
      await fs.promises.mkdir(jobDir, { recursive: true });
      const requestPath = path.join(jobDir, 'request.json');
      const outputPath = path.join(jobDir, 'result.json');
      await fs.promises.writeFile(requestPath, JSON.stringify({
        audioPath: job.file, audioSha256: job.audio.sha256,
        language: job.language, lyrics: job.rows,
      }));
      if (job.cancelled) fail('ALIGNMENT_CANCELLED', '时间轴已清除或校正，旧任务已取消');
      await invokeWorker(requestPath, outputPath, job);
      const after = await fingerprint(job.file);
      if (after.sha256 !== job.audio.sha256) fail('AUDIO_CHANGED', '对齐期间音频文件发生了变化');
      const output = JSON.parse(await fs.promises.readFile(outputPath, 'utf8'));
      if (output.audioSha256 !== job.audio.sha256) fail('AUDIO_VERSION_MISMATCH', '对齐结果不属于当前音频版本');
      const alignment = validateAlignment(output, job.rows);
      const record = {
        audio: job.audio, lyricsHash: job.lyricsHash,
        savedAt: Date.now(), revision: crypto.randomBytes(16).toString('hex'), alignment,
      };
      await withAudioLock(job.audio.sha256, async () => {
        if (job.cancelled) fail('ALIGNMENT_CANCELLED', '时间轴已清除或校正，旧任务已取消');
        if (job.automatic) {
          const cache = await readCache(job.file);
          if (cache.audio.sha256 !== job.audio.sha256) fail('AUDIO_CHANGED', '对齐期间音频文件发生了变化');
          if (cache.hit && cache.alignment.corrected) {
            fail('ALIGNMENT_CORRECTED_CACHE_PROTECTED', '已保留人工校正时间轴', 409);
          }
        }
        await persist(record);
        job.status = 'complete';
        job.stage = '完成';
        job.result = record;
      });
    } catch (error) {
      job.status = 'failed';
      job.error = error.code || 'ALIGNMENT_FAILED';
      job.message = error.message;
    } finally {
      job.finishedAt = Date.now();
      // Audio paths and temporary model output are unnecessary once the job settles.
      await fs.promises.rm(jobDir, { recursive: true, force: true }).catch(() => {});
      running = false;
      void drain();
    }
  }

  function enqueue(file, rows, language, audio, automatic = false) {
    const hash = lyricHash(rows);
    for (const job of jobs.values()) {
      if (job.file === file && job.audio.sha256 === audio.sha256 && job.lyricsHash === hash && job.language === language &&
          JSON.stringify(job.rows) === JSON.stringify(rows) &&
          (job.status === 'queued' || job.status === 'running')) {
        if (!automatic) job.automatic = false;
        return publicJob(job);
      }
    }
    if ([...jobs.values()].filter(job => job.status === 'queued' || job.status === 'running').length >= MAX_ACTIVE_JOBS) {
      fail('ALIGNMENT_QUEUE_FULL', '对齐任务已满，请等待当前任务完成', 429);
    }
    const job = {
      id: crypto.randomBytes(16).toString('hex'), file, rows, audio, automatic,
      lyricsHash: hash, language,
      createdAt: Date.now(), status: 'queued', stage: '等待对齐',
    };
    jobs.set(job.id, job);
    queue.push(job);
    for (const [id, old] of jobs) {
      if (jobs.size > 64 && old.finishedAt) jobs.delete(id);
    }
    void drain();
    return publicJob(job);
  }

  async function start(file, input, language = 'Chinese') {
    if (!runtimeStatus().available) fail('ALIGNMENT_RUNTIME_MISSING', '本地音频对齐模型未安装', 503);
    const rows = normalizeLyrics(input);
    if (!LANGUAGES.has(language)) fail('ALIGNMENT_LANGUAGE_INVALID', '不支持该对齐语言');
    return enqueue(file, rows, language, await fingerprint(file));
  }

  async function ensure(file, input, language = 'Chinese') {
    const rows = normalizeLyrics(input);
    if (!LANGUAGES.has(language)) fail('ALIGNMENT_LANGUAGE_INVALID', '不支持该对齐语言');
    const audio = await fingerprint(file);
    return withAudioLock(audio.sha256, async () => {
      const cache = await readCache(file, rows);
      if (cache.audio.sha256 !== audio.sha256) fail('AUDIO_CHANGED', '读取期间音频文件发生了变化', 409);
      if (cache.hit && (cache.matches || cache.alignment.corrected && cache.textMatches)) {
        return { ok: true, status: 'complete', cached: true, result: {
          audio: cache.audio, lyricsHash: cache.lyricsHash, savedAt: cache.savedAt,
          revision: cache.revision, alignment: cache.alignment,
        } };
      }
      if (cache.hit && cache.alignment.corrected) {
        return { ok: true, status: 'skipped', reason: 'ALIGNMENT_CORRECTED_CACHE_PROTECTED' };
      }
      if (!runtimeStatus().available) fail('ALIGNMENT_RUNTIME_MISSING', '本地音频对齐模型未安装', 503);
      return enqueue(file, rows, language, audio, true);
    });
  }

  function status(id, file) {
    const job = jobs.get(String(id));
    if (!job || job.file !== file) fail('ALIGNMENT_JOB_NOT_FOUND', '对齐任务不存在', 404);
    return publicJob(job);
  }

  function cancelAudioJobs(audioHash) {
    for (const job of jobs.values()) {
      if (job.audio.sha256 !== audioHash || !['queued', 'running'].includes(job.status)) continue;
      job.cancelled = true;
      if (job.status === 'queued') {
        queue.splice(queue.indexOf(job), 1);
        job.status = 'failed'; job.error = 'ALIGNMENT_CANCELLED';
        job.message = '时间轴已清除或校正，旧任务已取消'; job.finishedAt = Date.now();
      }
      if (job.child) job.child.kill();
    }
  }

  async function correct(file, input, expectedAudioHash, sourceLyricsHash, expectedRevision) {
    const audio = await fingerprint(file);
    if (expectedAudioHash !== audio.sha256) fail('AUDIO_VERSION_MISMATCH', '时间轴不属于当前音频版本', 409);
    return withAudioLock(audio.sha256, async () => {
      const cache = await readCache(file);
      if (cache.audio.sha256 !== audio.sha256) fail('AUDIO_CHANGED', '校正期间音频文件发生了变化', 409);
      if (!cache.hit || cache.lyricsHash !== sourceLyricsHash || cache.revision !== expectedRevision) {
        fail('ALIGNMENT_REVISION_MISMATCH', '歌词时间轴已改变，请重新打开校正', 409);
      }
      if (!input || input.audioDuration !== cache.alignment.audioDuration) fail('ALIGNMENT_DURATION_INVALID', '校正不能改变音频时长');
      const alignment = validateAlignment({ ...input, engine: cache.alignment.engine,
        model: cache.alignment.model, modelRevision: cache.alignment.modelRevision,
        language: cache.alignment.language, warnings: cache.alignment.warnings, corrected: true }, cache.alignment.lines);
      cancelAudioJobs(audio.sha256);
      return { ok: true, record: await persist({
        audio, lyricsHash: sourceLyricsHash, savedAt: Date.now(),
        revision: crypto.randomBytes(16).toString('hex'), alignment,
      }) };
    });
  }

  async function clear(file) {
    const audio = await fingerprint(file);
    return withAudioLock(audio.sha256, async () => {
      cancelAudioJobs(audio.sha256);
      try { await fs.promises.unlink(cachePath(audio.sha256)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      return { ok: true };
    });
  }

  return { start, ensure, status, readCache, correct, clear, runtimeStatus, fingerprint };
}

module.exports = {
  createLyricAlignmentService, normalizeLyrics, lyricHash, validateAlignment,
  resolveAlignmentPaths, defaultAlignmentRuntimeRoot,
};
