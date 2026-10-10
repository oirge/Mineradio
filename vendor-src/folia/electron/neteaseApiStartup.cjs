const { isNetworkFailureMessage } = require('../shared/networkErrorText.cjs');

// electron/neteaseApiStartup.cjs
// 网易本地 API 的启动与请求管线上用到的纯函数：启动期网络调用的超时与重试、xeapi 公钥与匿名 token 的刷新、
// 来源 IP 策略、扫码请求的网络层重试、替换上游 login_qr_check。装配顺序见 electron/neteaseBackend.cjs。

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;
const DEFAULT_RETRY_JITTER_MS = 100;
const DEFAULT_OPERATION_TIMEOUT_MS = 10000;

const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

// Bounds a single startup network call. The upstream api-enhanced requests carry no axios timeout,
// so a black-holed route to interface.music.163.com would otherwise stall startup until the OS
// gives up on the socket (minutes on some platforms). Pass timeoutMs = 0 to opt out.
function withTimeout(promise, timeoutMs, label) {
  if (!(timeoutMs > 0)) {
    return promise;
  }

  let timer = null;
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    }),
  ]).finally(() => {
    if (timer !== null) {
      clearTimeout(timer);
    }
  });
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return typeof error === 'string' && error.trim() ? error : 'Unknown error';
}

function hasUsableXeapiPublicKey(publicKey) {
  return Boolean(
    publicKey
    && typeof publicKey === 'object'
    && typeof publicKey.sk === 'string'
    && publicKey.sk.trim(),
  );
}

function getAnonymousCookie(registration) {
  const bodyCookie = registration?.body?.cookie;
  if (typeof bodyCookie === 'string' && bodyCookie.trim()) {
    return bodyCookie;
  }

  const responseCookies = registration?.cookie;
  if (Array.isArray(responseCookies)) {
    return responseCookies
      .filter((cookie) => typeof cookie === 'string' && cookie.trim())
      .join(';');
  }

  return typeof responseCookies === 'string' ? responseCookies : '';
}

function describeAnonymousRegistration(registration) {
  const status = registration?.status;
  const code = registration?.body?.code;
  const message = registration?.body?.message || registration?.body?.msg;
  const details = [
    status !== undefined ? `status=${status}` : '',
    code !== undefined ? `code=${code}` : '',
    typeof message === 'string' && message.trim() ? `message=${message.trim()}` : '',
  ].filter(Boolean);

  return details.length > 0 ? ` (${details.join(', ')})` : '';
}

// Retries a short startup operation with bounded exponential backoff and jitter.
async function retryStartupOperation(operation, options = {}) {
  const attempts = options.attempts || DEFAULT_RETRY_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const jitterMs = options.jitterMs ?? DEFAULT_RETRY_JITTER_MS;
  const sleep = options.sleep || wait;
  const random = options.random || Math.random;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }

      options.onRetry?.(error, attempt);
      const exponentialDelay = baseDelayMs * (2 ** (attempt - 1));
      const jitter = Math.floor(random() * jitterMs);
      await sleep(exponentialDelay + jitter);
    }
  }

  throw new Error('Startup operation exhausted its retry attempts');
}

// Refreshes the xeapi key and falls back only when the cached key is still usable.
async function resolveXeapiPublicKey({
  currentPublicKey,
  deviceId,
  getXeapiPublicKey,
  logger = console,
  retryOptions,
  timeoutMs = DEFAULT_OPERATION_TIMEOUT_MS,
  // 所有重试都失败时调用（不论之后是回落到缓存还是抛出），启动步骤记录据此留下最终的错误原文。
  onFailure,
}) {
  try {
    const publicKey = await retryStartupOperation(
      async () => {
        const refreshedPublicKey = await withTimeout(
          getXeapiPublicKey(currentPublicKey, deviceId),
          timeoutMs,
          'xeapi public key refresh',
        );
        if (!hasUsableXeapiPublicKey(refreshedPublicKey)) {
          throw new Error('xeapi public key response missing sk');
        }
        return refreshedPublicKey;
      },
      {
        ...retryOptions,
        onRetry: (error, attempt) => {
          logger.warn(
            `[Netease API] Failed to refresh xeapi public key (attempt ${attempt}), retrying: ${getErrorMessage(error)}`,
          );
          retryOptions?.onRetry?.(error, attempt);
        },
      },
    );

    return { publicKey, refreshed: true };
  } catch (error) {
    onFailure?.(error);
    if (!hasUsableXeapiPublicKey(currentPublicKey)) {
      throw error;
    }

    logger.warn(
      `[Netease API] Failed to refresh xeapi public key, using cached key: ${getErrorMessage(error)}`,
    );
    return { publicKey: currentPublicKey, refreshed: false };
  }
}

// Refreshes the anonymous token without making this optional credential block startup.
async function refreshAnonymousToken({
  registerAnonymous,
  cookieToJson,
  persistToken,
  logger = console,
  retryOptions,
  timeoutMs = DEFAULT_OPERATION_TIMEOUT_MS,
  // 所有重试都失败时调用；匿名 token 是可选凭据，失败不阻塞启动，只把原因交给启动步骤记录。
  onFailure,
}) {
  try {
    await retryStartupOperation(async () => {
      const registration = await withTimeout(
        registerAnonymous(),
        timeoutMs,
        'anonymous registration',
      );
      const anonymousCookie = getAnonymousCookie(registration);
      if (!anonymousCookie.trim()) {
        throw new Error(
          `anonymous registration response missing cookie${describeAnonymousRegistration(registration)}`,
        );
      }

      const cookieObject = cookieToJson(anonymousCookie);
      if (typeof cookieObject.MUSIC_A !== 'string' || !cookieObject.MUSIC_A.trim()) {
        throw new Error('anonymous registration response missing MUSIC_A');
      }

      await persistToken(cookieObject.MUSIC_A);
    }, {
      ...retryOptions,
      onRetry: (error, attempt) => {
        logger.warn(
          `[Netease API] Failed to refresh anonymous token (attempt ${attempt}), retrying: ${getErrorMessage(error)}`,
        );
        retryOptions?.onRetry?.(error, attempt);
      },
    });
    return true;
  } catch (error) {
    onFailure?.(error);
    logger.warn(
      `[Netease API] Failed to refresh anonymous token, keeping existing token: ${getErrorMessage(error)}`,
    );
    return false;
  }
}

// 与 Docker 镜像（deploy/docker/scripts/patch-music-api-client-ip.mjs）同一策略：只有显式传了
// randomCNIP 的请求才带伪造的来源 IP，其余请求不写 X-Real-IP / X-Forwarded-For，由网易按连接本身
// 识别真实公网出口。上游默认会把本机请求的 127.0.0.1 写进去，从 ::1 进来的还会换成随机国内 IP；
// 后者与手机扫码时的位置对不上，会让扫码确认失败。
function withoutImplicitClientIp(request) {
  return (uri, data, options = {}) => request(uri, data, options.randomCNIP ? options : { ...options, ip: '' });
}

// 替换上游 module/login_qr_check.js。上游的 catch 分支引用了 try 块里的 result，请求一旦被拒
// （连接被重置的 502、风控 8821 等）就抛 ReferenceError，server 只能回一个 `404 Not Found`，
// 扫码时间线上看不到真实原因。这里发同样的请求，被拒时把 request 的 answer 原样抛出，
// server 会按它的状态码和正文（{ code, msg }）回给渲染进程。
function createLoginQrCheck(createOption) {
  return async (query, request) => {
    const result = await request(
      '/api/login/qrcode/client/login',
      { key: query.key, type: 3 },
      createOption(query),
    );
    return {
      status: 200,
      body: { ...result.body, cookie: result.cookie.join(';') },
      cookie: result.cookie,
    };
  };
}

// 扫码的两步：要码与轮询。两者都可以安全地重发：重发要码只是换一把新 key，重发轮询只是多问一次同一把 key。
const QR_RETRY_URIS = new Set(['/api/login/qrcode/unikey', '/api/login/qrcode/client/login']);
const DEFAULT_QR_RETRY_DELAY_MS = 300;

/** 上游 request 的网络层失败：axios 没拿到响应时上游 reject 成 { status: 502, body: { code: 502, msg } }。 */
const isUpstreamNetworkFailure = (error) => Boolean(
  error
  && typeof error === 'object'
  && Number(error.status) === 502
  && isNetworkFailureMessage(error.body?.msg),
);

// 上游每次请求都新建连接；用户贴回的报告里，被重置的扫码请求前后同一身份的请求照常成功（#445 #469 #502），
// 被重置是逐个连接的偶发事件。扫码两步遇到网络层失败时隔一小段再发一次，单次重置不再直接让登录失败。
// 每次尝试各自经过诊断记录（这一层包在诊断记录外面），报告里能看到重试本身。
// 传给上游的 data / options 每次都复制一份：上游会往 data 上写字段，重发不能带着上一次的改动。
function withQrNetworkRetry(request, {
  uris = QR_RETRY_URIS,
  delayMs = DEFAULT_QR_RETRY_DELAY_MS,
  sleep = wait,
  logger = console,
} = {}) {
  const attempt = (uri, data, options) => request(uri, { ...data }, {
    ...options,
    ...(options?.cookie && typeof options.cookie === 'object' ? { cookie: { ...options.cookie } } : {}),
  });
  return async (uri, data = {}, options = {}) => {
    try {
      return await attempt(uri, data, options);
    } catch (error) {
      if (!uris.has(uri) || !isUpstreamNetworkFailure(error)) throw error;
      logger.warn('[Netease API] QR request failed at the network level, retrying once', {
        uri,
        message: error.body?.msg,
      });
      await sleep(delayMs);
      return attempt(uri, data, options);
    }
  };
}

module.exports = {
  DEFAULT_OPERATION_TIMEOUT_MS,
  DEFAULT_QR_RETRY_DELAY_MS,
  createLoginQrCheck,
  isUpstreamNetworkFailure,
  hasUsableXeapiPublicKey,
  refreshAnonymousToken,
  resolveXeapiPublicKey,
  retryStartupOperation,
  withQrNetworkRetry,
  withTimeout,
  withoutImplicitClientIp,
};
