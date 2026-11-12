'use strict';

const fs = require('fs');
const path = require('path');

function normalizeTranslationEndpoint(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (input.length > 2048) throw new Error('翻译接口地址过长');
  let url;
  try { url = new URL(input); } catch (_) { throw new Error('请输入有效的 HTTP 或 HTTPS 接口地址'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error('接口仅支持 HTTP 或 HTTPS，地址不能包含账号、密码或片段');
  }
  for (const name of url.searchParams.keys()) {
    if (/^(api[_-]?key|key|token|access[_-]?token|authorization|password|secret)$/i.test(name)) {
      throw new Error('接口地址不能包含密钥参数，请使用单独的 API Key 字段');
    }
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (!url.pathname.endsWith('/chat/completions')) url.pathname += '/chat/completions';
  return url.toString();
}

function createTranslationSettingsStore({ userDataPath, safeStorage, fileSystem = fs, defaultConfiguration = null }) {
  const filePath = path.join(userDataPath, 'translation-settings.json');
  let loaded = false;
  let settings = { endpoint: '', model: '', enabled: false, revision: 0 };
  let apiKey = '', encryptedApiKey = '', keyPersistent = false, keyUnavailable = false;
  function encryptionAvailable() {
    try {
      return !!(safeStorage && safeStorage.isEncryptionAvailable()
        && (!safeStorage.getSelectedStorageBackend || safeStorage.getSelectedStorageBackend() !== 'basic_text'));
    } catch (_) { return false; }
  }
  function load() {
    if (loaded) return;
    loaded = true;
    try {
      const stat = fileSystem.statSync(filePath);
      if (!stat.isFile() || stat.size > 128 * 1024) return;
      const saved = JSON.parse(fileSystem.readFileSync(filePath, 'utf8'));
      settings = { endpoint: normalizeTranslationEndpoint(saved.endpoint), model: String(saved.model || '').trim().slice(0, 200),
        enabled: saved.enabled === true, revision: Math.max(0, Number(saved.revision) || 0) };
      if (typeof saved.encryptedApiKey === 'string' && saved.encryptedApiKey) {
        encryptedApiKey = saved.encryptedApiKey;
        keyPersistent = true;
        keyUnavailable = true;
        if (encryptionAvailable()) {
          apiKey = safeStorage.decryptString(Buffer.from(saved.encryptedApiKey, 'base64'));
          keyUnavailable = !apiKey;
        }
      }
    } catch (_) { /* User settings and the private bundled service have separate ownership. */ }
  }
  function get() {
    load();
    const effective = configuration();
    return { ...settings, hasApiKey: !!(apiKey || encryptedApiKey), configured: !!(settings.endpoint && settings.model && !keyUnavailable), keyPersistent, keyUnavailable,
      defaultAvailable: !!defaultConfiguration, translationReady: !!(effective.enabled && effective.endpoint && effective.model && !effective.keyUnavailable) };
  }
  function configuration() {
    load();
    if (!settings.enabled && defaultConfiguration) return { ...defaultConfiguration, enabled: true, revision: settings.revision, builtin: true };
    return { ...settings, apiKey, keyUnavailable };
  }
  function save(input) {
    load();
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('翻译设置无效');
    const endpoint = normalizeTranslationEndpoint(input.endpoint);
    const model = String(input.model || '').trim();
    if (model.length > 200 || /[\x00-\x1f\x7f]/.test(model)) throw new Error('模型名称无效');
    if (input.enabled === true && (endpoint || model) && (!endpoint || !model)) throw new Error('启用翻译前请填写接口地址和模型名称');
    let nextKey = apiKey;
    if (input.clearApiKey === true) nextKey = '';
    else if (input.apiKey != null && input.apiKey !== '') {
      if (typeof input.apiKey !== 'string' || input.apiKey.length > 8192 || /[\r\n\x00]/.test(input.apiKey)) throw new Error('API Key 无效');
      nextKey = input.apiKey.trim() || apiKey;
    }
    const preservingKey = input.clearApiKey !== true && (!input.apiKey || !String(input.apiKey).trim() || nextKey === apiKey);
    let encrypted = preservingKey ? encryptedApiKey : '', persistent = !!encrypted;
    if (nextKey && encryptionAvailable()) {
      try { encrypted = safeStorage.encryptString(nextKey).toString('base64'); persistent = true; }
      catch (_) { /* Preserve the key in memory only if OS encryption is unavailable. */ }
    }
    const next = { endpoint, model, enabled: input.enabled === true && !!(endpoint && model), revision: settings.revision + 1 };
    fileSystem.mkdirSync(userDataPath, { recursive: true });
    const tempPath = filePath + '.' + process.pid + '.tmp';
    try {
      fileSystem.writeFileSync(tempPath, JSON.stringify({ ...next, encryptedApiKey: encrypted }), { encoding: 'utf8', mode: 0o600 });
      fileSystem.renameSync(tempPath, filePath);
    } catch (_) {
      try { fileSystem.unlinkSync(tempPath); } catch (_) {}
      throw new Error('无法保存翻译设置，请检查用户数据目录权限');
    }
    settings = next; apiKey = nextKey; encryptedApiKey = encrypted; keyPersistent = persistent;
    keyUnavailable = !!encryptedApiKey && !apiKey;
    return get();
  }
  return { get, save, configuration };
}

module.exports = { createTranslationSettingsStore, normalizeTranslationEndpoint };
