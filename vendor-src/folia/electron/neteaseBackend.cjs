"use strict";

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createLoginQrCheck,
  refreshAnonymousToken,
  resolveXeapiPublicKey,
  withQrNetworkRetry,
  withoutImplicitClientIp,
} = require('./neteaseApiStartup.cjs');
const { createNeteaseLoginDiagnostics } = require('./neteaseLoginDiagnostics.cjs');
const { createNeteaseLoginIdentity } = require('./neteaseLoginIdentity.cjs');
const {
  createBackendStatus,
  createStartupRecorder,
  describeError,
  findFreePort,
  keepServerErrorsLogged,
  waitUntilListening,
} = require('./backendLifecycle.cjs');

// electron/neteaseBackend.cjs
// 网易云本地 API（@neteasecloudmusicapienhanced/api）在主进程里的完整生命周期，按顺序分三段：
// 1. 加载前的准备（createNeteaseBackend 同步完成，必须在任何代码 require 上游之前调用）：
//    上游的 util/request 在首次 require 时同步读临时目录里的 anonymous_token，文件不存在会直接抛 ENOENT，所以先建好。
// 2. 替换上游模块：经 require.cache 换掉 util/request（请求管线）与 module/login_qr_check（修正上游吞错的 bug），
//    必须赶在上游 main / server 首次 require 它们之前，它们拿到的才是替换后的版本。
//    请求管线从外到内：身份轮换 → 扫码网络层重试 → 来源 IP 策略 → 登录请求记录 → 上游 request。
//    记录在最里层，看到的是每一次真正发出去的请求（重试的每一次都单独成行）；身份轮换在最外层，只看重试之后的结局。
// 3. start()：拉起服务，步骤是 port → runtime（cnIp、deviceId）→ xeapi-key → anonymous-token → listen，
//    每一步经启动记录留下耗时与结果；并发调用共用同一次拉起（serveNcmApi 没有关闭入口，第二次会泄漏一个监听端口）。
// getDiagnostics() 给诊断报告：后端状态、各轮拉起的步骤、登录请求记录（含连接层细节）、扫码身份、最近的上游连接。

const NCM_PACKAGE = '@neteasecloudmusicapienhanced/api';
const STATUS_CHANNEL = 'netease-api-status-changed';
// 只监听 IPv4 回环：本地 API 只给本进程和渲染进程用，不该暴露到局域网；固定地址也让渲染进程
// 不再随 localhost 解析到 ::1 还是 127.0.0.1 而走不同的来源 IP 分支（见 withoutImplicitClientIp）。
const LISTEN_HOST = '127.0.0.1';
// 自检时要连的上游：扫码走 eapi（interfacepc）；拉起时取 xeapi 公钥与匿名注册走 interface3；其余接口多走 interface。
const SELF_CHECK_HOSTS = ['interfacepc.music.163.com', 'interface3.music.163.com', 'interface.music.163.com'];
// 报告里附带的最近上游连接条数（登录请求自带的连接不算在内）。
const RECENT_CONNECTIONS = 20;

// 读缓存的 xeapi 公钥：不存在、读不出都不算错，交给刷新步骤处理；返回值同时说明缓存的状态。
const readCachedXeapiKey = (keyPath) => {
  if (!fs.existsSync(keyPath)) return { key: {}, cache: 'missing' };
  try {
    return { key: JSON.parse(fs.readFileSync(keyPath, 'utf-8')), cache: 'present' };
  } catch (error) {
    return { key: {}, cache: `unreadable: ${describeError(error)}` };
  }
};

/**
 * 准备并替换上游模块，返回网易后端的控制面。broadcast(channel, status) 把状态推给所有窗口；
 * networkRecorder 是已经 start() 的连接层记录器。
 */
function createNeteaseBackend({
  broadcast,
  networkRecorder = null,
  logger = console,
  now = Date.now,
}) {
  // ── 1. 加载前的准备 ────────────────────────────────────────────────
  // Provide Netease API unblock parameter as requested
  process.env.ENABLE_GENERAL_UNBLOCK = 'false';
  // Issue: Netease API module reads 'anonymous_token' synchronously from tmp dir upon require.
  // If not present, Electron crashes with ENOENT. Pre-create the file, then hydrate the
  // package's runtime state in the order required by the current api-enhanced build.
  // 上游自己按 os.tmpdir() 读这两个文件，路径必须一致，不能另选目录。
  const tokenPath = path.resolve(os.tmpdir(), 'anonymous_token');
  const xeapiPublicKeyPath = path.resolve(os.tmpdir(), 'xeapi_public_key');
  if (!fs.existsSync(tokenPath)) fs.writeFileSync(tokenPath, '', 'utf-8');
  // util/request 只在加载时读一次匿名 token 并缓存到进程结束，之后写回的新 token 要到下次启动才生效。
  // 记下这一刻文件是否为空，诊断时才知道登录请求有没有匿名凭据兜底。
  const anonymousTokenAtLoad = fs.readFileSync(tokenPath, 'utf-8');

  const loginDiagnostics = createNeteaseLoginDiagnostics({ networkRecorder, logger });
  loginDiagnostics.noteStartup({ anonymousTokenAtLoad: anonymousTokenAtLoad.trim() ? 'present' : 'empty' });

  // util/index 不依赖 util/request，可以先取：身份轮换要用它生成新的 deviceId。
  const ncmUtil = require(`${NCM_PACKAGE}/util/index`);
  const loginIdentity = createNeteaseLoginIdentity({
    generateDeviceId: () => ncmUtil.generateDeviceId(),
    readAnonymousToken: () => fs.readFileSync(tokenPath, 'utf-8'),
    initialAnonymousToken: anonymousTokenAtLoad,
    logger,
  });

  // ── 2. 替换上游模块 ────────────────────────────────────────────────
  // 先 require 再改缓存项：赋值左侧会先求值，写成一行时缓存项还不存在。
  const requestPath = require.resolve(`${NCM_PACKAGE}/util/request`);
  const upstreamRequest = require(requestPath);
  require.cache[requestPath].exports = loginIdentity.wrapRequest(
    withQrNetworkRetry(
      withoutImplicitClientIp(loginDiagnostics.wrapRequest(upstreamRequest)),
      { logger },
    ),
  );
  const qrCheckPath = require.resolve(`${NCM_PACKAGE}/module/login_qr_check`);
  require(qrCheckPath);
  require.cache[qrCheckPath].exports = createLoginQrCheck(require(`${NCM_PACKAGE}/util/option`));

  // ── 3. 加载上游 ────────────────────────────────────────────────────
  const { register_anonimous: registerAnonymous } = require(`${NCM_PACKAGE}/main`);
  const { getXeapiPublicKey } = require(`${NCM_PACKAGE}/util/xeapiKey`);
  const { serveNcmApi } = require(`${NCM_PACKAGE}/server`);

  const status = createBackendStatus({ channel: STATUS_CHANNEL, broadcast, now });
  const startup = createStartupRecorder({ name: 'Netease API', now, logger });
  let startPromise = null;

  // 一次完整的拉起。失败时状态里的错误带上失败的那一步，界面上的故障原因一眼能看出卡在哪。
  const startOnce = async () => {
    status.update({ status: 'starting', port: null, error: null });
    startup.begin();
    let currentStep = '';
    const step = (id, fn) => {
      currentStep = id;
      return startup.step(id, fn);
    };
    try {
      const port = await step('port', async (note) => {
        const freePort = await findFreePort();
        note({ port: freePort });
        return freePort;
      });

      await step('runtime', async (note) => {
        global.cnIp = ncmUtil.generateRandomChineseIP();
        const reused = Boolean(global.deviceId);
        if (!reused) global.deviceId = ncmUtil.generateDeviceId();
        note({ deviceId: global.deviceId, deviceIdReused: reused });
      });

      await step('xeapi-key', async (note) => {
        const cached = readCachedXeapiKey(xeapiPublicKeyPath);
        note({ cache: cached.cache });
        const retries = [];
        const { publicKey, refreshed } = await resolveXeapiPublicKey({
          currentPublicKey: cached.key,
          deviceId: global.deviceId,
          getXeapiPublicKey,
          logger,
          retryOptions: { onRetry: (error) => retries.push(describeError(error)) },
          onFailure: (error) => note({ refreshError: describeError(error) }),
        });
        if (refreshed) fs.writeFileSync(xeapiPublicKeyPath, JSON.stringify(publicKey), 'utf-8');
        note({
          source: refreshed ? 'network' : 'cache',
          version: publicKey?.version ?? 'unknown',
          ...(retries.length > 0 ? { retries } : {}),
        });
      });

      await step('anonymous-token', async (note) => {
        const retries = [];
        const refreshed = await refreshAnonymousToken({
          registerAnonymous,
          cookieToJson: ncmUtil.cookieToJson,
          persistToken: (token) => fs.writeFileSync(tokenPath, token, 'utf-8'),
          logger,
          retryOptions: { onRetry: (error) => retries.push(describeError(error)) },
          onFailure: (error) => note({ error: describeError(error) }),
        });
        note({ refreshed, ...(retries.length > 0 ? { retries } : {}) });
      });

      await step('listen', async (note) => {
        const app = await serveNcmApi({ port, host: LISTEN_HOST });
        // serveNcmApi 调了 listen() 就返回，不等绑定结果；端口被抢时只会在 server 上发 'error'。
        await waitUntilListening(app.server);
        keepServerErrorsLogged(app.server, 'Netease API');
        note({ host: LISTEN_HOST, port });
      });

      status.update({ status: 'running', port, error: null });
      startup.finish('running');
    } catch (error) {
      status.update({ status: 'error', port: null, error: `${currentStep}: ${describeError(error)}` });
      startup.finish('failed');
    }
    return status.get();
  };

  const start = () => {
    if (status.get().status === 'running') return Promise.resolve(status.get());
    if (!startPromise) {
      startPromise = startOnce().finally(() => {
        startPromise = null;
      });
    }
    return startPromise;
  };

  const getDiagnostics = () => ({
    backend: { ...status.get() },
    startup: startup.snapshot(),
    login: loginDiagnostics.snapshot(),
    identity: loginIdentity.describe(),
    connections: networkRecorder
      ? networkRecorder.snapshot('netease').filter(entry => entry.tag === null).slice(-RECENT_CONNECTIONS)
      : [],
  });

  return {
    statusChannel: STATUS_CHANNEL,
    start,
    getStatus: () => status.get(),
    /** 服务真正在监听时的端口；没起来时为 null（渲染进程据此等待或显示故障，而不是去连一个假端口）。 */
    getPort: () => (status.get().status === 'running' ? status.get().port : null),
    getDiagnostics,
    selfCheckHosts: SELF_CHECK_HOSTS,
  };
}

module.exports = {
  NETEASE_SELF_CHECK_HOSTS: SELF_CHECK_HOSTS,
  createNeteaseBackend,
};
