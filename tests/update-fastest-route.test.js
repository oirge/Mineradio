'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从本地更新服务截取线路测速与排序模块。
 * @returns {string} 可在隔离上下文执行的生产源码。
 */
function readFastestRouteSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = source.indexOf('function ensureMirrorCanBeVerified(');
  const end = source.indexOf('async function downloadUpdateAssetWithMirrors(', start);
  assert.ok(start >= 0 && end > start, '未找到更新线路测速与排序模块');
  return source.slice(start, end);
}

/**
 * 拒绝测试未声明的真实网络请求。
 * @returns {Promise<never>} 始终抛出测试错误。
 */
async function rejectUnexpectedFetch() {
  throw new Error('UNEXPECTED_FETCH');
}

/**
 * 创建带稳定错误码的测试异常。
 * @param {string} code 错误码。
 * @param {string} message 错误信息。
 * @returns {Error} 测试异常。
 */
function createTestUpdateError(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

/**
 * 把测试异常归一化为生产排序模块需要的结构。
 * @param {Error} error 原始异常。
 * @returns {object} 归一化错误信息。
 */
function classifyTestUpdateError(error) {
  return { code: error.code || 'UPDATE_FAILED', reason: error.message, detail: error.message };
}

/**
 * 提取排序结果中的线路标签，避免断言依赖隔离上下文的数组原型。
 * @param {object[]} routes 已排序线路。
 * @returns {string[]} 线路标签数组。
 */
function routeLabels(routes) {
  const labels = [];
  for (let i = 0; i < routes.length; i++) labels.push(routes[i].label);
  return labels;
}

/**
 * 加载可替换单线路测速器的隔离测试环境。
 * @returns {object} 包含生产排序函数的测试上下文。
 */
function loadFastestRouteHarness() {
  const context = {
    AbortController,
    Date,
    Promise,
    clearTimeout,
    setTimeout,
    fetch: rejectUnexpectedFetch,
    UPDATE_ROUTE_PROBE_BYTES: 128 * 1024,
    UPDATE_ROUTE_PROBE_TIMEOUT_MS: 4000,
    APP_VERSION: '1.5.0',
    updateError: createTestUpdateError,
    classifyUpdateError: classifyTestUpdateError,
  };
  vm.runInNewContext(
    readFastestRouteSource() + '\nthis.rankUpdateDownloadCandidates = rankUpdateDownloadCandidates;',
    context
  );
  return context;
}

/**
 * 从服务端源码中截取指定更新函数。
 * @param {string} startMarker 函数起始标记。
 * @param {string} endMarker 下一个函数起始标记。
 * @returns {string} 指定函数的生产源码。
 */
function readServerSourceBetween(startMarker, endMarker) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, '未找到更新下载函数接缝');
  return source.slice(start, end);
}

/**
 * 验证固定顺序中的慢线路不会挡住实测吞吐量更高的候选线路。
 * @returns {Promise<void>}
 */
async function testFastestMeasuredRouteRanksFirst() {
  const context = loadFastestRouteHarness();
  const candidates = [
    { url: 'https://slow.example/update.exe', label: '慢线路', mirrored: true, probeSpeed: 120 },
    { url: 'https://fast.example/update.exe', label: '快线路', mirrored: true, probeSpeed: 980 },
    { url: 'https://direct.example/update.exe', label: '直连', mirrored: false, probeSpeed: 360 },
  ];
  /**
   * 返回候选线路预设的测速结果。
   * @param {object} _job 未使用的更新任务。
   * @param {object} candidate 当前候选线路。
   * @param {number} index 原始线路位置。
   * @returns {Promise<object>} 成功测速结果。
   */
  async function probePresetSpeed(_job, candidate, index) {
    return { candidate, index, ok: true, speedBps: candidate.probeSpeed, elapsedMs: 100 };
  }
  context.probeUpdateDownloadCandidate = probePresetSpeed;

  const ordered = await context.rankUpdateDownloadCandidates({ sha512: 'digest' }, candidates);

  assert.deepEqual(routeLabels(ordered), ['快线路', '直连', '慢线路']);
  assert.equal(ordered[0].url, candidates[1].url);
  assert.equal(ordered[0].mirrored, true);
}

/**
 * 验证测速失败的线路不会抢占首选位置，同时继续留作完整下载兜底。
 * @returns {Promise<void>}
 */
async function testFailedProbeRoutesRemainAsFallbacks() {
  const context = loadFastestRouteHarness();
  const candidates = [
    { url: 'https://failed-a.example/update.exe', label: '失败线路 A', mirrored: true },
    { url: 'https://working.example/update.exe', label: '可用线路', mirrored: false },
    { url: 'https://failed-b.example/update.exe', label: '失败线路 B', mirrored: true },
  ];
  /**
   * 只让指定候选返回成功结果，用于验证失败线路位置。
   * @param {object} _job 未使用的更新任务。
   * @param {object} candidate 当前候选线路。
   * @param {number} index 原始线路位置。
   * @returns {Promise<object>} 测速结果。
   */
  async function probeSingleWorkingRoute(_job, candidate, index) {
    const ok = candidate.label === '可用线路';
    return { candidate, index, ok, speedBps: ok ? 500 : 0, elapsedMs: 100 };
  }
  context.probeUpdateDownloadCandidate = probeSingleWorkingRoute;

  const ordered = await context.rankUpdateDownloadCandidates({ sha512: 'digest' }, candidates);

  assert.deepEqual(routeLabels(ordered), ['可用线路', '失败线路 A', '失败线路 B']);
  assert.equal(ordered.length, candidates.length);
}

/**
 * 验证所有测速都失败时不凭空改写原有兜底顺序。
 * @returns {Promise<void>}
 */
async function testAllProbeFailuresKeepOriginalOrder() {
  const context = loadFastestRouteHarness();
  const candidates = [
    { url: 'https://one.example/update.exe', label: '线路 1', mirrored: true },
    { url: 'https://two.example/update.exe', label: '线路 2', mirrored: false },
  ];
  /**
   * 让所有候选测速失败，用于验证原始顺序保留。
   * @param {object} _job 未使用的更新任务。
   * @param {object} candidate 当前候选线路。
   * @param {number} index 原始线路位置。
   * @returns {Promise<object>} 失败测速结果。
   */
  async function failEveryProbe(_job, candidate, index) {
    return { candidate, index, ok: false, speedBps: 0, elapsedMs: 4000 };
  }
  context.probeUpdateDownloadCandidate = failEveryProbe;

  const ordered = await context.rankUpdateDownloadCandidates({ sha512: 'digest' }, candidates);

  assert.deepEqual(routeLabels(ordered), ['线路 1', '线路 2']);
}

/**
 * 验证线路测速只读取固定首段，并在取得样本后主动取消剩余响应体。
 * @returns {Promise<void>}
 */
async function testProbeUsesBoundedRangeSample() {
  const context = loadFastestRouteHarness();
  let requestOptions = null;
  let cancelled = 0;
  /**
   * 返回一个大于测速上限的响应块并记录请求参数。
   * @param {string} _url 未使用的请求地址。
   * @param {object} options fetch 请求参数。
   * @returns {Promise<object>} 模拟的范围响应。
   */
  async function fetchOversizedProbeChunk(_url, options) {
    requestOptions = options;
    return {
      ok: true,
      status: 206,
      body: {
        /** @returns {object} 返回可取消的测试读取器。 */
        getReader() {
          return {
            /** @returns {Promise<object>} 返回超过上限的单个数据块。 */
            async read() { return { done: false, value: new Uint8Array(256 * 1024) }; },
            /** @returns {Promise<void>} 记录剩余响应已被取消。 */
            async cancel() { cancelled += 1; },
          };
        },
      },
    };
  }
  context.fetch = fetchOversizedProbeChunk;

  const result = await context.probeUpdateDownloadCandidate(
    { sha512: 'digest' },
    { url: 'https://sample.example/update.exe', label: '样本线路', mirrored: true },
    0
  );

  assert.equal(result.ok, true);
  assert.equal(requestOptions.headers.Range, 'bytes=0-131071');
  assert.equal(cancelled, 1);
  assert.ok(result.speedBps > 0);
}

/**
 * 验证测速窗口结束前已收到的有效样本仍参与排序，避免慢线路全部被误判失败。
 * @returns {Promise<void>}
 */
async function testTimedOutProbeKeepsPartialSample() {
  const context = loadFastestRouteHarness();
  let readCount = 0;
  /**
   * 立即触发统一测速窗口，模拟线路在窗口结束时仍未读满样本。
   * @param {Function} callback 超时回调。
   * @returns {number} 固定测试计时器标识。
   */
  function runProbeTimeoutImmediately(callback) {
    callback();
    return 1;
  }
  /** @returns {void} 测试计时器已经同步完成，无需清理。 */
  function ignoreCompletedTimeout() {}
  /**
   * 先返回部分有效字节，再模拟由测速窗口触发的中止异常。
   * @returns {Promise<object>} 模拟的部分范围响应。
   */
  async function fetchPartialProbeResponse() {
    return {
      ok: true,
      status: 206,
      body: {
        /** @returns {object} 返回两阶段测试读取器。 */
        getReader() {
          return {
            /** @returns {Promise<object>} 首次返回样本，第二次抛出中止异常。 */
            async read() {
              readCount += 1;
              if (readCount === 1) return { done: false, value: new Uint8Array(64 * 1024) };
              const error = new Error('probe timeout');
              error.name = 'AbortError';
              throw error;
            },
            /** @returns {Promise<void>} 测试无需额外取消行为。 */
            async cancel() {},
          };
        },
      },
    };
  }
  context.setTimeout = runProbeTimeoutImmediately;
  context.clearTimeout = ignoreCompletedTimeout;
  context.fetch = fetchPartialProbeResponse;

  const result = await context.probeUpdateDownloadCandidate(
    { sha512: 'digest' },
    { url: 'https://partial.example/update.exe', label: '部分样本线路', mirrored: true },
    0
  );

  assert.equal(result.ok, true);
  assert.ok(result.speedBps > 0);
}

/**
 * 验证无摘要的镜像不会借测速阶段绕过现有安装包校验门禁。
 * @returns {Promise<void>}
 */
async function testMirrorProbeKeepsDigestGate() {
  const context = loadFastestRouteHarness();
  let fetchCalls = 0;
  /** @returns {Promise<never>} 记录不应发生的镜像请求。 */
  async function countUnexpectedMirrorFetch() {
    fetchCalls += 1;
    throw new Error('MIRROR_FETCH_SHOULD_NOT_START');
  }
  context.fetch = countUnexpectedMirrorFetch;

  const result = await context.probeUpdateDownloadCandidate(
    {},
    { url: 'https://mirror.example/update.exe', label: '无摘要镜像', mirrored: true },
    0
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'MIRROR_HASH_MISSING');
  assert.equal(fetchCalls, 0);
}

/**
 * 验证完整安装包和快速补丁都在正式下载前调用同一份测速排序逻辑。
 * @returns {void}
 */
function testInstallerAndPatchShareFastestRouteSelection() {
  const installerSource = readServerSourceBetween(
    'async function downloadUpdateAssetWithMirrors(job) {',
    'async function startUpdateDownloadJob(info, opts) {'
  );
  const patchSource = readServerSourceBetween(
    'async function downloadAndApplyPatchWithMirrors(job) {',
    'async function startUpdatePatchJob(info, opts) {'
  );

  assert.match(installerSource, /const candidates = await rankUpdateDownloadCandidates\(job, rawCandidates\);/);
  assert.match(patchSource, /const candidates = await rankUpdateDownloadCandidates\(job, rawCandidates\);/);
}

/**
 * 验证两条下载路径都先按用户选定线路裁剪候选，再交给同一份测速排序。
 * @returns {void}
 */
function testBothDownloadPathsFilterRouteBeforeRanking() {
  const installerSource = readServerSourceBetween(
    'async function downloadUpdateAssetWithMirrors(job) {',
    'async function startUpdateDownloadJob(info, opts) {'
  );
  const patchSource = readServerSourceBetween(
    'async function downloadAndApplyPatchWithMirrors(job) {',
    'async function startUpdatePatchJob(info, opts) {'
  );

  for (const source of [installerSource, patchSource]) {
    const filterAt = source.indexOf('filterUpdateRouteCandidates(allCandidates, job.route)');
    const rankAt = source.indexOf('rankUpdateDownloadCandidates(job, rawCandidates)');
    assert.ok(filterAt >= 0, '下载路径必须按用户选定线路裁剪候选');
    assert.ok(rankAt > filterAt, '线路裁剪必须发生在测速排序之前');
    assert.match(source, /UPDATE_ROUTE_UNAVAILABLE/, '线路裁剪后没有候选时必须给出可换线路的错误码');
  }
}

/**
 * 验证两条下载路径在开始与每次换线前都检查取消状态。
 * @returns {void}
 */
function testBothDownloadPathsHonorCancelBeforeEachAttempt() {
  const installerSource = readServerSourceBetween(
    'async function downloadUpdateAssetWithMirrors(job) {',
    'async function startUpdateDownloadJob(info, opts) {'
  );
  const patchSource = readServerSourceBetween(
    'async function downloadAndApplyPatchWithMirrors(job) {',
    'async function startUpdatePatchJob(info, opts) {'
  );

  for (const source of [installerSource, patchSource]) {
    const guards = source.match(/throwIfUpdateJobCanceled\(job\);/g) || [];
    assert.ok(guards.length >= 2, '下载路径至少要在开始和换线前各检查一次取消');
    assert.match(source, /if \(job\.canceled\) \{\s*markUpdateJobCanceled\(job\);/, '取消后必须落到已取消终态而不是下载失败');
  }
}

/**
 * 验证每一处下载空闲守卫都接入任务级取消信号，否则取消后连接仍会继续跑。
 * @returns {void}
 */
function testEveryIdleGuardHonorsJobCancelSignal() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const calls = source.match(/createUpdateDownloadIdleGuard\([^)]*\)/g) || [];
  assert.ok(calls.length >= 2, '安装包与补丁下载都必须使用空闲守卫');
  for (const call of calls) {
    if (/^createUpdateDownloadIdleGuard\(timeoutMs/.test(call)) continue;
    assert.match(call, /job\.cancelSignal/, '空闲守卫必须接入任务级取消信号：' + call);
  }
}

test('点击更新后优先选择实测最快线路', testFastestMeasuredRouteRanksFirst);
test('测速失败线路保留在成功线路之后作为兜底', testFailedProbeRoutesRemainAsFallbacks);
test('全部测速失败时保持原线路顺序', testAllProbeFailuresKeepOriginalOrder);
test('线路测速限制首段流量并取消剩余响应', testProbeUsesBoundedRangeSample);
test('测速超时前收到的部分样本仍参与最快线路排序', testTimedOutProbeKeepsPartialSample);
test('镜像测速继续执行摘要校验门禁', testMirrorProbeKeepsDigestGate);
test('完整安装包与快速补丁共用最快线路选择', testInstallerAndPatchShareFastestRouteSelection);
test('两条下载路径都先裁剪线路再测速排序', testBothDownloadPathsFilterRouteBeforeRanking);
test('两条下载路径在换线前都检查取消状态', testBothDownloadPathsHonorCancelBeforeEachAttempt);
test('下载空闲守卫全部接入任务级取消信号', testEveryIdleGuardHonorsJobCancelSignal);
