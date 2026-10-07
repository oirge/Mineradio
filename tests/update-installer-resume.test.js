'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const SERVER_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const RESUME_SOURCE_START = SERVER_SOURCE.indexOf('function parseUpdateContentRange(');
const RESUME_SOURCE_END = SERVER_SOURCE.indexOf('async function startUpdateDownloadJob(', RESUME_SOURCE_START);
assert.ok(RESUME_SOURCE_START >= 0 && RESUME_SOURCE_END > RESUME_SOURCE_START, '安装包续传实现接缝缺失');
const RESUME_SOURCE = SERVER_SOURCE.slice(RESUME_SOURCE_START, RESUME_SOURCE_END);

function createResponse(status, headers, chunks, options) {
  const settings = options || {};
  let index = 0;
  let cancelled = 0;
  const body = {
    getReader() {
      return {
        async read() {
          if (settings.readError && index >= settings.throwAfterChunks) throw settings.readError;
          if (index >= chunks.length) return { done: true };
          const value = chunks[index++];
          return { done: false, value: new Uint8Array(value) };
        },
        async cancel() { cancelled += 1; },
      };
    },
    async cancel() { cancelled += 1; },
  };
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get(name) { return headers[String(name).toLowerCase()] || null; } },
    body,
    get cancelled() { return cancelled; },
  };
}

function createHarness(options) {
  const settings = options || {};
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-installer-resume-'));
  const filePath = path.join(tempDir, 'Mineradio-2.2.6-Setup.exe');
  const tmpPath = filePath + '.download';
  const requests = [];
  const context = {
    fs,
    crypto,
    Buffer,
    Date,
    Math,
    Promise,
    Number,
    String,
    Object,
    Error,
    AbortController,
    console,
    APP_VERSION: '2.2.6',
    UPDATE_DOWNLOAD_DIR: tempDir,
    UPDATE_INSTALLER_MAX_BYTES: 512 * 1024 * 1024,
    UPDATE_VERIFY_CHUNK_BYTES: 1024 * 1024,
    UPDATE_DOWNLOAD_IDLE_TIMEOUT_MS: 30000,
    updateError(code, message, cause) {
      const error = new Error(message || code);
      error.code = code;
      if (cause) error.cause = cause;
      return error;
    },
    normalizeDigest(value) { return String(value || ''); },
    closeUpdateFileHandle: async (handle, error) => {
      if (!handle) return error || null;
      try { await handle.close(); return error || null; }
      catch (closeError) { return error || closeError; }
    },
    filterUpdateRouteCandidates(candidates) { return candidates.slice(); },
    rankUpdateDownloadCandidates: async (_job, candidates) => candidates.slice(),
    throwIfUpdateJobCanceled(job) {
      if (job.canceled) throw context.updateError('UPDATE_CANCELED', 'Update canceled');
    },
    ensureMirrorCanBeVerified() {},
    prepareUpdateJobAttempt(job, candidate, index, total) {
      job.status = 'downloading';
      job.sourceLabel = candidate.label;
      job.attempt = index + 1;
      job.attempts = total;
      job.received = 0;
      job.total = job.expectedSize || 0;
      job.progress = 0;
      job.speedBps = 0;
      job.etaSeconds = 0;
    },
    createUpdateDownloadIdleGuard() {
      return { signal: new AbortController().signal, touch() {}, clear() {} };
    },
    async openUpdateRouteResponse(job, url, requestOptions) {
      requests.push({ url, headers: Object.assign({}, requestOptions.headers) });
      return settings.respond(job, url, requestOptions, requests.length - 1);
    },
    verifyUpdateFile: async (target, job) => {
      const bytes = await fs.promises.readFile(target);
      if (job.expectedSize && bytes.length !== job.expectedSize) throw context.updateError('UPDATE_SIZE_MISMATCH', 'size mismatch');
      if (job.sha256 && crypto.createHash('sha256').update(bytes).digest('hex') !== job.sha256) throw context.updateError('UPDATE_SHA256_MISMATCH', 'sha256 mismatch');
      if (job.sha512 && crypto.createHash('sha512').update(bytes).digest('base64') !== job.sha512) throw context.updateError('UPDATE_SHA512_MISMATCH', 'sha512 mismatch');
    },
    verifyStreamedUpdatePayload(job, received, sha256, sha512) {
      if (job.expectedSize && received !== job.expectedSize) throw context.updateError('UPDATE_SIZE_MISMATCH', `Expected ${job.expectedSize} bytes, got ${received}`);
      if (job.sha256 && (!sha256 || sha256.digest('hex') !== job.sha256)) throw context.updateError('UPDATE_SHA256_MISMATCH', 'sha256 mismatch');
      if (job.sha512 && (!sha512 || sha512.digest('base64') !== job.sha512)) throw context.updateError('UPDATE_SHA512_MISMATCH', 'sha512 mismatch');
    },
    classifyUpdateError(error) {
      return { code: error.code || 'UPDATE_FAILED', reason: error.message, detail: error.message };
    },
    isFatalUpdateLocalError() { return false; },
    setUpdateJobError(job, error, message) {
      job.status = 'error';
      job.error = error.code || 'UPDATE_FAILED';
      job.errorReason = error.message;
      job.errorDetail = error.message;
      job.message = message || error.message;
    },
    markUpdateJobCanceled(job) { job.status = 'canceled'; job.canceled = true; },
  };
  vm.runInNewContext(RESUME_SOURCE + '\nthis.download = downloadUpdateAssetWithMirrors;', context);
  const payload = Buffer.from('Mineradio installer payload for range-resume validation.');
  const job = {
    filePath,
    status: 'queued',
    canceled: false,
    route: 'auto',
    version: '2.2.6',
    expectedSize: settings.expectedSize === undefined ? payload.length : settings.expectedSize,
    total: settings.expectedSize === undefined ? payload.length : settings.expectedSize,
    sha256: settings.sha256 === false ? '' : crypto.createHash('sha256').update(payload).digest('hex'),
    sha512: settings.sha512 ? crypto.createHash('sha512').update(payload).digest('base64') : '',
    downloadCandidates: settings.candidates || [{ url: 'https://download.example/installer.exe', label: '主线路', mirrored: false }],
  };
  return {
    context,
    tempDir,
    filePath,
    tmpPath,
    payload,
    job,
    requests,
    async run() { await context.download(job); return job; },
    dispose() { fs.rmSync(tempDir, { recursive: true, force: true }); },
  };
}

test('续传发送精确 Range、校验前缀摘要并拼接为完整安装包', async () => {
  const prefixBytes = 19;
  const h = createHarness({
    sha512: true,
    respond(_job, _url, requestOptions) {
      assert.equal(requestOptions.headers.Range, `bytes=${prefixBytes}-`);
      return createResponse(206, {
        'content-range': `bytes ${prefixBytes}-${this.payload.length - 1}/${this.payload.length}`,
        'content-length': String(this.payload.length - prefixBytes),
      }, [this.payload.subarray(prefixBytes)]);
    },
  });
  try {
    fs.writeFileSync(h.tmpPath, h.payload.subarray(0, prefixBytes));
    // respond is called as a context member, so expose the known fixture without closing over the harness.
    h.context.payloadForResponse = h.payload;
    h.context.openUpdateRouteResponse = async function(job, url, options) {
      h.requests.push({ url, headers: Object.assign({}, options.headers) });
      return createResponse(206, {
        'content-range': `bytes ${prefixBytes}-${h.payload.length - 1}/${h.payload.length}`,
        'content-length': String(h.payload.length - prefixBytes),
      }, [h.payload.subarray(prefixBytes)]);
    };
    await h.run();
    assert.equal(h.job.status, 'ready');
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].headers.Range, `bytes=${prefixBytes}-`);
    assert.deepEqual(fs.readFileSync(h.filePath), h.payload);
    assert.equal(fs.existsSync(h.tmpPath), false);
  } finally {
    h.dispose();
  }
});

test('服务器忽略 Range 返回 200 时从零截断重下，不把新文件追加到旧前缀', async () => {
  const h = createHarness({
    respond: null,
  });
  try {
    const prefixBytes = 12;
    fs.writeFileSync(h.tmpPath, h.payload.subarray(0, prefixBytes));
    h.context.openUpdateRouteResponse = async function(job, url, options) {
      h.requests.push({ url, headers: Object.assign({}, options.headers) });
      return createResponse(200, { 'content-length': String(h.payload.length) }, [h.payload]);
    };
    await h.run();
    assert.equal(h.job.status, 'ready');
    assert.equal(h.requests[0].headers.Range, `bytes=${prefixBytes}-`);
    assert.deepEqual(fs.readFileSync(h.filePath), h.payload);
  } finally {
    h.dispose();
  }
});

test('校验 Content-Range 起点和响应长度，拒绝错误区间且保留已有前缀', async () => {
  const h = createHarness({ respond: null });
  const prefix = h.payload.subarray(0, 10);
  try {
    fs.writeFileSync(h.tmpPath, prefix);
    h.context.openUpdateRouteResponse = async () => createResponse(206, {
      'content-range': `bytes 9-${h.payload.length - 1}/${h.payload.length}`,
      'content-length': String(h.payload.length - 9),
    }, [h.payload.subarray(9)]);
    await h.run();
    assert.equal(h.job.status, 'error');
    assert.equal(h.job.error, 'UPDATE_RANGE_INVALID');
    assert.deepEqual(fs.readFileSync(h.tmpPath), prefix);
  } finally {
    h.dispose();
  }
});

test('一条线路中断后换线从新增字节续传，并用整包 SHA-256 验证', async () => {
  const prefixBytes = 8;
  const firstChunk = 11;
  const candidates = [
    { url: 'https://one.example/installer.exe', label: '中断线路', mirrored: false },
    { url: 'https://two.example/installer.exe', label: '恢复线路', mirrored: false },
  ];
  const h = createHarness({ candidates, respond: null });
  try {
    fs.writeFileSync(h.tmpPath, h.payload.subarray(0, prefixBytes));
    h.context.openUpdateRouteResponse = async function(_job, url, options) {
      h.requests.push({ url, headers: Object.assign({}, options.headers) });
      const offset = Number(/^bytes=(\d+)-$/.exec(options.headers.Range || '')?.[1] || 0);
      if (url === candidates[0].url) {
        return createResponse(206, {
          'content-range': `bytes ${offset}-${offset + firstChunk - 1}/${h.payload.length}`,
          'content-length': String(firstChunk),
        }, [h.payload.subarray(offset, offset + firstChunk)]);
      }
      return createResponse(206, {
        'content-range': `bytes ${offset}-${h.payload.length - 1}/${h.payload.length}`,
        'content-length': String(h.payload.length - offset),
      }, [h.payload.subarray(offset)]);
    };
    await h.run();
    assert.equal(h.job.status, 'ready');
    assert.equal(h.requests.length, 2);
    assert.equal(h.requests[0].headers.Range, `bytes=${prefixBytes}-`);
    assert.equal(h.requests[1].headers.Range, `bytes=${prefixBytes + firstChunk}-`);
    assert.deepEqual(fs.readFileSync(h.filePath), h.payload);
  } finally {
    h.dispose();
  }
});

test('完整的临时安装包先做大小和摘要验证，通过后直接复用', async () => {
  const h = createHarness({ respond: null });
  try {
    fs.writeFileSync(h.tmpPath, h.payload);
    h.context.openUpdateRouteResponse = async () => { throw new Error('完整临时文件不应再次请求网络'); };
    await h.run();
    assert.equal(h.job.status, 'ready');
    assert.equal(h.requests.length, 0);
    assert.deepEqual(fs.readFileSync(h.filePath), h.payload);
  } finally {
    h.dispose();
  }
});
