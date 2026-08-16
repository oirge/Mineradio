'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Readable } = require('node:stream');

/**
 * 从本地更新服务截取指定源码片段。
 * @param {string} startMarker 片段起始标记。
 * @param {string} endMarker 片段结束标记。
 * @returns {string} 可在隔离上下文执行的生产源码。
 */
function readServerSourceBetween(startMarker, endMarker) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, '未找到更新线路源码接缝：' + startMarker);
  return source.slice(start, end);
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
 * 把隔离上下文里的对象转成本地领域的普通值，避免跨领域原型导致断言失败。
 * @param {*} value 隔离上下文返回值。
 * @returns {*} 本地领域的普通值。
 */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 加载线路选择、取消状态机与错误分类的隔离测试环境。
 * @param {object=} configOverrides 更新配置覆盖项。
 * @returns {object} 包含生产函数的测试上下文。
 */
function loadUpdateRouteHarness(configOverrides) {
  const context = {
    String,
    Number,
    Boolean,
    Array,
    Object,
    Date,
    URL,
    RegExp,
    AbortController,
    JSON,
    process: { env: {} },
    UPDATE_CONFIG: Object.assign({ proxy: '', mirrors: [] }, configOverrides || {}),
    /** @returns {never} 隔离环境不允许加载 electron。 */
    require() { throw new Error('MODULE_NOT_AVAILABLE'); },
    updateError: createTestUpdateError,
  };
  const source = [
    readServerSourceBetween('const UPDATE_ROUTE_MODES = ', 'function uniqueDownloadCandidates('),
    readServerSourceBetween('function classifyUpdateError(err) {', 'async function fetchWithTimeout('),
    readServerSourceBetween('function markUpdateJobCanceled(job) {', 'function isFatalUpdateLocalError('),
    readServerSourceBetween('function publicUpdateJob(job) {', 'function latestUpdateDownloadJob('),
    'this.normalizeUpdateRouteMode = normalizeUpdateRouteMode;',
    'this.updateRouteModeLabel = updateRouteModeLabel;',
    'this.filterUpdateRouteCandidates = filterUpdateRouteCandidates;',
    'this.parseUpdateProxyTarget = parseUpdateProxyTarget;',
    'this.parseSystemProxyResolveResult = parseSystemProxyResolveResult;',
    'this.resolveUpdateProxyTarget = resolveUpdateProxyTarget;',
    'this.classifyUpdateError = classifyUpdateError;',
    'this.markUpdateJobCanceled = markUpdateJobCanceled;',
    'this.cancelUpdateDownloadJob = cancelUpdateDownloadJob;',
    'this.throwIfUpdateJobCanceled = throwIfUpdateJobCanceled;',
    'this.attachUpdateJobRoute = attachUpdateJobRoute;',
    'this.publicUpdateJob = publicUpdateJob;',
    'this.isActiveUpdateJob = isActiveUpdateJob;',
  ].join('\n');
  vm.runInNewContext(source, context);
  return context;
}

/**
 * 构造一份最小可用的下载候选列表。
 * @returns {object[]} 候选线路。
 */
function sampleCandidates() {
  return [
    { url: 'https://mirror-a.example/update.exe', label: '国内加速线路 1', mirrored: true },
    { url: 'https://github.com/update.exe', label: 'GitHub 直连', mirrored: false },
    { url: 'https://mirror-b.example/update.exe', label: '国内加速线路 2', mirrored: true },
  ];
}

/**
 * 提取候选线路标签，避免断言依赖隔离上下文的数组原型。
 * @param {object[]} routes 候选线路。
 * @returns {string[]} 线路标签数组。
 */
function routeLabels(routes) {
  const labels = [];
  for (let i = 0; i < routes.length; i++) labels.push(routes[i].label);
  return labels;
}

/**
 * 验证自动线路保留全部候选，且不改写顺序与标签。
 * @returns {void}
 */
function testAutoRouteKeepsEveryCandidate() {
  const context = loadUpdateRouteHarness();
  const filtered = context.filterUpdateRouteCandidates(sampleCandidates(), 'auto');
  assert.deepEqual(routeLabels(filtered), ['国内加速线路 1', 'GitHub 直连', '国内加速线路 2']);
}

/**
 * 验证用户选定线路只做过滤：直连与代理只留原始地址，国内加速只留镜像。
 * @returns {void}
 */
function testExplicitRouteFiltersByMirrorFlag() {
  const context = loadUpdateRouteHarness();
  assert.deepEqual(routeLabels(context.filterUpdateRouteCandidates(sampleCandidates(), 'direct')), ['GitHub 直连']);
  assert.deepEqual(routeLabels(context.filterUpdateRouteCandidates(sampleCandidates(), 'proxy')), ['GitHub 直连']);
  assert.deepEqual(
    routeLabels(context.filterUpdateRouteCandidates(sampleCandidates(), 'mirror')),
    ['国内加速线路 1', '国内加速线路 2']
  );
}

/**
 * 验证未知线路一律退回自动测速，并共用同一份中文文案。
 * @returns {void}
 */
function testUnknownRouteFallsBackToAuto() {
  const context = loadUpdateRouteHarness();
  assert.equal(context.normalizeUpdateRouteMode('SOCKS'), 'auto');
  assert.equal(context.normalizeUpdateRouteMode(''), 'auto');
  assert.equal(context.normalizeUpdateRouteMode(null), 'auto');
  assert.equal(context.normalizeUpdateRouteMode(' Mirror '), 'mirror');
  assert.equal(context.updateRouteModeLabel('auto'), '自动测速');
  assert.equal(context.updateRouteModeLabel('direct'), 'GitHub 直连');
  assert.equal(context.updateRouteModeLabel('mirror'), '国内加速');
  assert.equal(context.updateRouteModeLabel('proxy'), '本机代理');
}

/**
 * 验证代理解析只接受 http/https，并且展示名不携带账号密码。
 * @returns {void}
 */
function testProxyTargetParsingRejectsSocksAndHidesCredentials() {
  const context = loadUpdateRouteHarness();
  assert.equal(context.parseUpdateProxyTarget('socks5://127.0.0.1:1080'), null);
  assert.equal(context.parseUpdateProxyTarget(''), null);
  assert.equal(context.parseUpdateProxyTarget('not a proxy'), null);

  const bare = plain(context.parseUpdateProxyTarget('127.0.0.1:7897'));
  assert.equal(bare.protocol, 'http:');
  assert.equal(bare.hostname, '127.0.0.1');
  assert.equal(bare.port, 7897);
  assert.equal(bare.auth, '');
  assert.equal(bare.label, 'http://127.0.0.1:7897');

  const authed = plain(context.parseUpdateProxyTarget('http://user:pa%40ss@proxy.example:3128'));
  assert.equal(authed.auth, 'user:pa@ss');
  assert.equal(authed.label, 'http://proxy.example:3128');
  assert.ok(!/user|pa@ss/.test(authed.label), '代理展示名不能泄漏凭据');
}

/**
 * 验证系统代理 PAC 结果解析只取可用的 http 代理。
 * @returns {void}
 */
function testSystemProxyResolveParsing() {
  const context = loadUpdateRouteHarness();
  assert.equal(context.parseSystemProxyResolveResult('DIRECT'), '');
  assert.equal(context.parseSystemProxyResolveResult(''), '');
  assert.equal(context.parseSystemProxyResolveResult('SOCKS5 127.0.0.1:1080'), '');
  assert.equal(context.parseSystemProxyResolveResult('PROXY 127.0.0.1:7897'), 'http://127.0.0.1:7897');
  assert.equal(context.parseSystemProxyResolveResult('HTTPS proxy.example:443'), 'https://proxy.example:443');
  assert.equal(
    context.parseSystemProxyResolveResult('SOCKS5 127.0.0.1:1080; PROXY 127.0.0.1:7897; DIRECT'),
    'http://127.0.0.1:7897'
  );
}

/**
 * 验证显式代理优先于配置代理，且纯 Node 环境不会因缺少 electron 报错。
 * @returns {Promise<void>}
 */
async function testProxyResolutionPrefersExplicitAddress() {
  const context = loadUpdateRouteHarness({ proxy: '127.0.0.1:1234' });
  const explicit = plain(await context.resolveUpdateProxyTarget('127.0.0.1:7897', 'https://example.com/a.exe'));
  assert.equal(explicit.label, 'http://127.0.0.1:7897');

  const configured = plain(await context.resolveUpdateProxyTarget('', 'https://example.com/a.exe'));
  assert.equal(configured.label, 'http://127.0.0.1:1234');

  const noneContext = loadUpdateRouteHarness();
  assert.equal(await noneContext.resolveUpdateProxyTarget('', 'https://example.com/a.exe'), null);
}

/**
 * 验证取消进行中的任务会中止下载信号并落到已取消终态。
 * @returns {void}
 */
function testCancelAbortsRunningDownload() {
  const context = loadUpdateRouteHarness();
  const job = context.attachUpdateJobRoute({ id: 'job-1', status: 'downloading', speedBps: 999, etaSeconds: 12 }, { route: 'mirror' });
  assert.equal(job.route, 'mirror');
  assert.equal(job.routeLabel, '国内加速');
  assert.equal(job.cancelSignal.aborted, false);

  const result = plain(context.cancelUpdateDownloadJob(job));
  assert.equal(result.ok, true);
  assert.equal(job.canceled, true);
  assert.equal(job.cancelSignal.aborted, true, '取消必须中止下载信号，否则连接会继续跑');
  assert.throws(() => context.throwIfUpdateJobCanceled(job), /Update canceled/);

  context.markUpdateJobCanceled(job);
  assert.equal(job.status, 'canceled');
  assert.equal(job.speedBps, 0);
  assert.equal(job.etaSeconds, 0);
  assert.equal(job.error, '');
}

/**
 * 验证补丁写盘阶段拒绝取消，避免留下半套文件。
 * @returns {void}
 */
function testApplyingPatchRefusesCancel() {
  const context = loadUpdateRouteHarness();
  const job = context.attachUpdateJobRoute({ id: 'job-2', status: 'downloading', mode: 'patch' }, { route: 'auto' });
  job.applying = true;

  const result = plain(context.cancelUpdateDownloadJob(job));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'UPDATE_JOB_APPLYING');
  assert.equal(job.canceled, false);
  assert.equal(job.cancelSignal.aborted, false);
}

/**
 * 验证已就绪或已失败的任务不再受理取消。
 * @returns {void}
 */
function testFinishedJobIsNotCancelable() {
  const context = loadUpdateRouteHarness();
  for (const status of ['ready', 'done', 'error']) {
    const job = context.attachUpdateJobRoute({ id: 'job-' + status, status }, {});
    const result = plain(context.cancelUpdateDownloadJob(job));
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'UPDATE_JOB_NOT_CANCELABLE');
  }
  assert.equal(plain(context.cancelUpdateDownloadJob(null)).reason, 'UPDATE_JOB_NOT_FOUND');
}

/**
 * 验证已取消任务对外暴露终态，且不再算作活跃任务，用户可以换线路重来。
 * @returns {void}
 */
function testCanceledJobLeavesActiveSetAndReportsCancelAbility() {
  const context = loadUpdateRouteHarness();
  const job = context.attachUpdateJobRoute({
    id: 'job-3',
    status: 'downloading',
    mode: 'installer',
    proxyTarget: null,
  }, { route: 'proxy', proxyTarget: { label: 'http://127.0.0.1:7897' } });

  const running = plain(context.publicUpdateJob(job));
  assert.equal(running.canCancel, true);
  assert.equal(running.canceled, false);
  assert.equal(running.route, 'proxy');
  assert.equal(running.routeLabel, '本机代理');
  assert.equal(running.proxyLabel, 'http://127.0.0.1:7897');
  assert.equal(context.isActiveUpdateJob(job), true);

  context.cancelUpdateDownloadJob(job);
  context.markUpdateJobCanceled(job);
  const canceled = plain(context.publicUpdateJob(job));
  assert.equal(canceled.ok, true, '取消是正常终态，不能当成下载失败');
  assert.equal(canceled.status, 'canceled');
  assert.equal(canceled.canceled, true);
  assert.equal(canceled.canCancel, false);
  assert.equal(context.isActiveUpdateJob(job), false, '已取消任务必须离开活跃集合，否则无法重新下载');

  job.applying = true;
  job.status = 'downloading';
  job.canceled = false;
  assert.equal(plain(context.publicUpdateJob(job)).canCancel, false, '写盘阶段不能对外声明可取消');
}

/**
 * 验证取消不会被归类成网络超时，代理与线路错误也各有专属提示。
 * @returns {void}
 */
function testCancelAndProxyErrorsClassifyBeforeTimeout() {
  const context = loadUpdateRouteHarness();
  const aborted = new Error('The operation was aborted');
  aborted.name = 'AbortError';
  aborted.code = 'UPDATE_CANCELED';
  const canceled = plain(context.classifyUpdateError(aborted));
  assert.equal(canceled.code, 'UPDATE_CANCELED');
  assert.equal(canceled.reason, '更新已取消。');

  const routeMissing = plain(context.classifyUpdateError(createTestUpdateError('UPDATE_ROUTE_UNAVAILABLE', 'No download candidate for route mirror')));
  assert.equal(routeMissing.code, 'UPDATE_ROUTE_UNAVAILABLE');
  assert.match(routeMissing.reason, /换一条线路/);

  const proxyMissing = plain(context.classifyUpdateError(createTestUpdateError('UPDATE_PROXY_NOT_CONFIGURED', 'no proxy')));
  assert.equal(proxyMissing.code, 'UPDATE_PROXY_NOT_CONFIGURED');
  assert.match(proxyMissing.reason, /没有检测到可用的本机代理/);

  const proxyTimeout = plain(context.classifyUpdateError(createTestUpdateError('UPDATE_PROXY_TIMEOUT', 'CONNECT timeout')));
  assert.equal(proxyTimeout.code, 'UPDATE_PROXY_TIMEOUT');
  assert.match(proxyTimeout.reason, /本机代理/, '代理超时要提示检查代理，而不是笼统的网络超时');

  const plainTimeout = plain(context.classifyUpdateError(createTestUpdateError('ETIMEDOUT', 'connect ETIMEDOUT')));
  assert.equal(plainTimeout.code, 'ETIMEDOUT');
  assert.match(plainTimeout.reason, /连接超时/);
}

/**
 * 加载代理响应包装的隔离环境，使用真实的 stream 与 Readable.toWeb。
 * @returns {object} 包含 nodeResponseAsFetchLike 的测试上下文。
 */
function loadProxyResponseHarness() {
  const context = {
    String,
    Number,
    Array,
    Object,
    Buffer,
    Readable,
    updateError: createTestUpdateError,
  };
  const source = [
    readServerSourceBetween('function nodeResponseAsFetchLike(res, signal, socket) {', 'async function fetchThroughUpdateProxy('),
    'this.nodeResponseAsFetchLike = nodeResponseAsFetchLike;',
  ].join('\n');
  vm.runInNewContext(source, context);
  return context;
}

/**
 * 验证取消会销毁代理响应流与隧道 socket。
 * 响应头到达后 settle() 已经摘掉 abort 监听，若正文不再跟随取消，
 * 取消后 TCP 连接会继续把整个安装包拉完，任务表面停下实际没停。
 * @returns {Promise<void>} 断言完成。
 */
async function testProxyResponseBodyFollowsCancel() {
  const context = loadProxyResponseHarness();
  const res = new Readable({ read() {} });
  res.statusCode = 200;
  res.headers = { 'content-length': '1024' };
  let socketDestroyed = false;
  const socket = { destroy() { socketDestroyed = true; } };
  const controller = new AbortController();

  const wrapped = context.nodeResponseAsFetchLike(res, controller.signal, socket);
  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.headers.get('Content-Length'), '1024');
  assert.equal(res.destroyed, false, '未取消时不得提前销毁响应流');

  const reader = wrapped.body.getReader();
  res.push(Buffer.from('first-chunk'));
  const first = await reader.read();
  assert.equal(Buffer.from(first.value).toString(), 'first-chunk');

  controller.abort();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(res.destroyed, true, '取消后必须销毁代理响应流');
  assert.equal(socketDestroyed, true, '取消后必须释放隧道 socket');
  await reader.read().then(() => {}, () => {});
}

/**
 * 验证响应头到达前就已取消时立即销毁，不留下已连接但无人读取的隧道。
 * @returns {void}
 */
function testProxyResponseHonoursPreAbortedSignal() {
  const context = loadProxyResponseHarness();
  const res = new Readable({ read() {} });
  res.statusCode = 200;
  res.headers = {};
  let socketDestroyed = false;
  const socket = { destroy() { socketDestroyed = true; } };
  const controller = new AbortController();
  controller.abort();

  context.nodeResponseAsFetchLike(res, controller.signal, socket);
  assert.equal(res.destroyed, true, '信号已取消时必须立即销毁响应流');
  assert.equal(socketDestroyed, true, '信号已取消时必须立即释放隧道 socket');
}

/**
 * 验证两条下载读取循环都逐块检查取消，不依赖具体传输是否响应 abort 信号。
 * 代理线路的正文来自 Readable.toWeb，只靠 fetch signal 无法中断正文。
 * @returns {void}
 */
function testDownloadLoopsCheckCancelPerChunk() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const loops = [
    {
      name: '完整安装包',
      body: readServerSourceBetween('fileHandle = await fs.promises.open(tmpPath,', 'if (sha256) sha256.update(buf);'),
    },
    {
      name: '快速补丁',
      body: readServerSourceBetween('let readComplete = false;\n    try {', 'if (job.received > PATCH_MAX_BYTES)'),
    },
  ];
  for (let i = 0; i < loops.length; i++) {
    const matches = loops[i].body.match(/throwIfUpdateJobCanceled\(job\);/g) || [];
    assert.ok(matches.length >= 2, loops[i].name + '读取循环必须在 reader.read() 前后各检查一次取消');
  }
  assert.match(source, /nodeResponseAsFetchLike\(response, signal, socket\)/, '代理响应必须把取消信号和隧道 socket 交给正文包装');
}
test('自动线路保留全部候选且不改写顺序', testAutoRouteKeepsEveryCandidate);
test('用户选定线路只按镜像标记过滤候选', testExplicitRouteFiltersByMirrorFlag);
test('未知线路退回自动测速并共用中文文案', testUnknownRouteFallsBackToAuto);
test('代理地址解析拒绝 socks 且展示名不带凭据', testProxyTargetParsingRejectsSocksAndHidesCredentials);
test('系统代理 PAC 结果只取可用 http 代理', testSystemProxyResolveParsing);
test('代理解析优先使用显式地址并容忍缺少 electron', testProxyResolutionPrefersExplicitAddress);
test('取消更新会中止下载并落到已取消终态', testCancelAbortsRunningDownload);
test('补丁写盘阶段拒绝取消', testApplyingPatchRefusesCancel);
test('已完成任务不再受理取消', testFinishedJobIsNotCancelable);
test('已取消任务离开活跃集合并正确上报可取消状态', testCanceledJobLeavesActiveSetAndReportsCancelAbility);
test('取消与代理错误分类优先于超时分类', testCancelAndProxyErrorsClassifyBeforeTimeout);
test('取消会销毁代理响应流与隧道 socket', testProxyResponseBodyFollowsCancel);
test('信号已取消时代理响应立即释放', testProxyResponseHonoursPreAbortedSignal);
test('下载读取循环逐块检查取消而不依赖传输信号', testDownloadLoopsCheckCancelPerChunk);
