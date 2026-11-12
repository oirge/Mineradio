'use strict';

const TRANSLATION_RESPONSE_MAX_BYTES = 400000;
const TRANSLATION_TIMEOUT_MS = 45000;

function translationError(code, message, status = 502, retryable = true, retryAfterMs = 0) {
  return Object.assign(new Error(message), { code, status, retryable, retryAfterMs });
}
function redactTranslationMessage(value, configuration) {
  if (configuration && configuration.builtin) return '默认翻译服务暂不可用，请稍后重试或使用自定义源';
  let message = String(value || '连接翻译服务失败');
  if (configuration && configuration.apiKey) message = message.split(configuration.apiKey).join('[REDACTED]');
  return message.replace(/https?:\/\/[^\s"'<>]+/gi, '[接口地址]').slice(0, 240);
}
async function readBoundedTranslationResponse(response, controller) {
  const declared = Number(response.headers && response.headers.get('content-length'));
  if (declared > TRANSLATION_RESPONSE_MAX_BYTES) {
    controller.abort();
    if (response.body) void response.body.cancel().catch(() => {});
    throw translationError('UPSTREAM_RESPONSE_TOO_LARGE', '翻译服务响应过大', 502, false);
  }
  if (!response.body || typeof response.body.getReader !== 'function') throw translationError('UPSTREAM_INVALID_RESPONSE', '翻译服务返回空内容', 502, true);
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  controller.signal.addEventListener('abort', cancel, { once: true });
  let bytes = 0, text = '';
  try {
    while (true) {
      if (controller.signal.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
      const result = await reader.read();
      if (controller.signal.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > TRANSLATION_RESPONSE_MAX_BYTES) {
        controller.abort();
        void reader.cancel().catch(() => {});
        throw translationError('UPSTREAM_RESPONSE_TOO_LARGE', '翻译服务响应过大', 502, false);
      }
      text += decoder.decode(result.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { controller.signal.removeEventListener('abort', cancel); reader.releaseLock(); }
}
async function requestTranslation(configuration, messages, options = {}) {
  if (!configuration || !configuration.enabled || !configuration.endpoint || !configuration.model || configuration.keyUnavailable) {
    throw translationError('NOT_CONFIGURED', '请先在设置中配置并启用自己的翻译源', 400, false);
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) cancel();
    else options.signal.addEventListener('abort', cancel, { once: true });
  }
  const timer = setTimeout(cancel, options.timeoutMs || TRANSLATION_TIMEOUT_MS);
  try {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (configuration.apiKey) headers.Authorization = 'Bearer ' + configuration.apiKey;
    const response = await (options.fetch || fetch)(configuration.endpoint, {
      method: 'POST', headers, redirect: 'error', signal: controller.signal,
      body: JSON.stringify({ model: configuration.model, temperature: options.temperature == null ? .1 : options.temperature, messages, stream: false }),
    });
    const text = await readBoundedTranslationResponse(response, controller);
    let data;
    try { data = JSON.parse(text); } catch (_) { throw translationError('UPSTREAM_INVALID_RESPONSE', '翻译服务返回格式异常', 502, true); }
    if (!response.ok || data && data.error) {
      const status = response.ok ? 502 : response.status;
      const detail = data && data.error;
      const message = typeof detail === 'string' ? detail : detail && detail.message;
      const retryAfter = response.headers.get('retry-after');
      const seconds = Number(retryAfter);
      const retryAfterMs = retryAfter && Number.isFinite(seconds) ? Math.max(0, seconds * 1000)
        : Math.max(0, (Date.parse(retryAfter || '') || 0) - Date.now());
      throw translationError('UPSTREAM_HTTP_' + status, redactTranslationMessage(message || '翻译请求失败（HTTP ' + status + '）', configuration),
        status, status === 408 || status === 429 || status >= 500, retryAfterMs);
    }
    return { text, data, status: response.status };
  } catch (error) {
    if (error.name === 'AbortError') throw translationError('UPSTREAM_TIMEOUT', '翻译服务超过 45 秒未响应', 502, true);
    if (!error.code || !/^(NOT_CONFIGURED|UPSTREAM_[A-Z0-9_]+)$/.test(error.code)) {
      throw translationError('UPSTREAM_NETWORK_ERROR', '连接翻译服务失败，请检查地址、网络和证书', 502, true);
    }
    error.message = redactTranslationMessage(error.message, configuration);
    throw error;
  } finally {
    clearTimeout(timer);
    if (options.signal) options.signal.removeEventListener('abort', cancel);
  }
}
async function testTranslationConfiguration(configuration, options) {
  try {
    const result = await requestTranslation(configuration && { ...configuration, enabled: true }, [{ role: 'user', content: 'Reply with OK only.' }], options);
    const content = result.data && result.data.choices && result.data.choices[0] && result.data.choices[0].message && result.data.choices[0].message.content;
    if (typeof content !== 'string' || !content.trim()) return { ok: false, message: '接口已连接，但模型未返回有效内容' };
    return { ok: true, message: '连接成功，模型可用' };
  } catch (error) { return { ok: false, code: error.code || 'UPSTREAM_NETWORK_ERROR', message: redactTranslationMessage(error.message, configuration) }; }
}

module.exports = { TRANSLATION_RESPONSE_MAX_BYTES, TRANSLATION_TIMEOUT_MS, requestTranslation, testTranslationConfiguration, redactTranslationMessage };
