/* Credentials are owned by the desktop process, never browser storage or backups. */
(function (global) {
  'use strict';
  var doc = global.document, bridge = global.desktopWindow, sessionPromise = null, busy = false, testing = false, previousFocus = null, openGeneration = 0;
  var state = { ready: false, configured: false, enabled: false, revision: 0, endpoint: '', model: '', hasApiKey: false };
  function node(id) { return doc.getElementById(id); }
  function english() { return global.uiLanguage === 'en' || doc.documentElement.lang === 'en'; }
  function text(zh, en) { return english() ? en : zh; }
  function status(message, error) { var el = node('translation-source-status'); if (el) { el.textContent = message; el.classList.toggle('error', !!error); } }
  function render() {
    var modal = node('translation-source-modal'); if (!modal) return;
    modal.querySelectorAll('[data-translation-zh]').forEach(function (el) { el.textContent = el.getAttribute(english() ? 'data-translation-en' : 'data-translation-zh'); });
    node('translation-source-close').setAttribute('aria-label', text('关闭', 'Close'));
    if (node('translation-source-open')) node('translation-source-open').textContent = text('自定义翻译源', 'Custom translation source');
    node('translation-source-key').placeholder = state.hasApiKey ? text('已保存；留空保留原密钥', 'Saved; leave empty to keep the key') : text('本地服务可留空', 'Optional for local services');
    var summary = node('translation-source-summary');
    if (summary) summary.textContent = state.configured && state.enabled ? text('已配置 · ', 'Configured · ') + state.model
      : state.defaultAvailable ? text('使用默认翻译源', 'Using default translation') : text('尚未启用自定义翻译源', 'Custom translation is not enabled');
    node('translation-source-storage').textContent = state.keyUnavailable
      ? text('无法读取保存的密钥，请重新填写或清除后再保存。', 'The saved key cannot be read. Enter it again or clear it, then save.')
      : state.hasApiKey && state.keyPersistent === false
      ? text('当前系统无法加密保存密钥，仅本次运行有效。', 'Secure key storage is unavailable; the key is kept for this session only.')
      : text('密钥由系统加密保存在本机，不随备份导出。', 'Keys are encrypted on this computer and excluded from backups.');
  }
  function accept(value) {
    value = value || {};
    // An older IPC read must not overwrite settings saved while it was pending.
    if (state.ready && Number(value.revision || 0) < state.revision) return Object.assign({}, state);
    var translationReady = value.translationReady == null ? !!(value.configured && value.enabled) : !!value.translationReady;
    var changed = !state.ready || state.revision !== Number(value.revision || 0) || state.translationReady !== translationReady
      || state.configured !== !!value.configured || state.enabled !== !!value.enabled || state.unavailable !== !!value.unavailable;
    state = { ready: true, configured: !!value.configured, enabled: !!value.enabled, revision: Number(value.revision || 0),
      endpoint: String(value.endpoint || ''), model: String(value.model || ''), hasApiKey: !!value.hasApiKey,
      keyPersistent: !!value.keyPersistent, keyUnavailable: !!value.keyUnavailable, unavailable: !!value.unavailable,
      defaultAvailable: !!value.defaultAvailable, translationReady: translationReady };
    render();
    if (changed && typeof global.scheduleLyricLlmTranslation === 'function') global.scheduleLyricLlmTranslation(true);
    return Object.assign({}, state);
  }
  async function refresh() {
    if (!bridge || !bridge.getTranslationSettings) return accept({ configured: false, enabled: false, unavailable: true, revision: 0 });
    try { return accept(await bridge.getTranslationSettings()); }
    catch (_) { return accept({ configured: false, enabled: false, unavailable: true, revision: 0 }); }
  }
  async function authorizedFetch(url, options) {
    var destination = new URL(url, global.location.href);
    if (destination.origin !== global.location.origin || !/^\/api\/(?:lyric-translate$|update\/(?:download|cancel|patch)$)/.test(destination.pathname)) return global.fetch(url, options);
    if (!bridge || !bridge.getApiSessionToken) { var unavailable = new Error('LOCAL_API_SESSION_UNAVAILABLE'); unavailable.retryable = false; throw unavailable; }
    if (!sessionPromise) sessionPromise = Promise.resolve().then(function () { return bridge.getApiSessionToken(); }).catch(function () {
      sessionPromise = null; var unavailable = new Error('LOCAL_API_SESSION_UNAVAILABLE'); unavailable.retryable = false; throw unavailable;
    });
    var token = await sessionPromise;
    if (typeof token !== 'string' || !token) { sessionPromise = null; var invalid = new Error('LOCAL_API_SESSION_UNAVAILABLE'); invalid.retryable = false; throw invalid; }
    if (options && options.signal && options.signal.aborted) { var aborted = new Error('Aborted'); aborted.name = 'AbortError'; throw aborted; }
    var headers = new Headers(options && options.headers || {}); headers.set('X-Mineradio-Session', token);
    return global.fetch(url, Object.assign({}, options, { headers: headers }));
  }
  function setBusy(value) { busy = value; ['translation-source-save', 'translation-source-test', 'translation-source-clear-key'].forEach(function (id) { if (node(id)) node(id).disabled = value; }); }
  function form() { return { endpoint: node('translation-source-endpoint').value.trim(), model: node('translation-source-model').value.trim(), apiKey: node('translation-source-key').value, enabled: node('translation-source-enabled').checked }; }
  async function save(test) {
    if (busy) return;
    if (!bridge || !bridge.saveTranslationSettings) { status(text('请在电脑版中配置翻译源。', 'Configure translation in the desktop app.'), true); return; }
    setBusy(true); testing = !!test; var saved = false; status(text('正在保存…', 'Saving…'));
    try {
      var result = await bridge.saveTranslationSettings(form());
      if (result.ok === false) throw new Error(result.message || 'TRANSLATION_SETTINGS_INVALID');
      node('translation-source-key').value = ''; accept(result); saved = true;
      if (test) {
        status(text('正在测试连接…', 'Testing connection…'));
        var reply = await bridge.testTranslationSettings();
        status(reply.ok ? text('连接成功，翻译源可用。', 'Connection succeeded; translation is available.') : String(reply.message || text('连接失败。', 'Connection failed.')), !reply.ok);
      } else status(text('已保存。已缓存译文继续使用，未译歌词使用此翻译源。', 'Saved. Cached translations are retained; untranslated lyrics use this source.'));
    } catch (error) { status(String(error.message || error), true); }
    finally {
      testing = false; setBusy(false);
      if (test && saved && typeof global.scheduleLyricLlmTranslation === 'function') global.scheduleLyricLlmTranslation();
    }
  }
  async function clearKey() {
    if (busy || !bridge || !bridge.saveTranslationSettings) return;
    setBusy(true);
    try {
      var values = form(); values.apiKey = ''; values.clearApiKey = true;
      var result = await bridge.saveTranslationSettings(values);
      if (result.ok === false) throw new Error(result.message || 'TRANSLATION_SETTINGS_INVALID');
      node('translation-source-key').value = ''; accept(result); status(text('已清除保存的密钥。', 'Saved key cleared.'));
    } catch (error) { status(String(error.message || error), true); }
    finally { setBusy(false); }
  }
  async function open() {
    var modal = node('translation-source-modal'); if (!modal) return;
    var generation = ++openGeneration;
    if (!modal.classList.contains('show')) previousFocus = doc.activeElement;
    modal.classList.add('show'); modal.setAttribute('aria-hidden', 'false');
    var initialEndpoint = state.endpoint || '', initialModel = state.model || '';
    node('translation-source-endpoint').value = initialEndpoint; node('translation-source-model').value = initialModel;
    node('translation-source-key').value = ''; node('translation-source-enabled').checked = state.configured ? !!state.enabled : true;
    render(); node('translation-source-endpoint').focus();
    await refresh();
    if (generation !== openGeneration || !modal.classList.contains('show')) return;
    if (node('translation-source-endpoint').value === initialEndpoint) node('translation-source-endpoint').value = state.endpoint || '';
    if (node('translation-source-model').value === initialModel) node('translation-source-model').value = state.model || '';
    status(state.unavailable ? text('请在电脑版中配置翻译源。', 'Configure translation in the desktop app.') : text('未设置或停用自定义源时使用默认翻译；默认配置不在界面显示。', 'Default translation is used when custom translation is empty or disabled; its configuration is private.'), !!state.unavailable);
    render(); node('translation-source-endpoint').focus();
  }
  function close() {
    var modal = node('translation-source-modal'); if (!modal) return;
    openGeneration += 1;
    modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true'); node('translation-source-key').value = '';
    if (previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus(); previousFocus = null;
  }
  global.mineradioAuthorizedFetch = authorizedFetch;
  global.isCustomTranslationReady = function () { return state.ready && state.translationReady && !state.unavailable && !testing; };
  global.customTranslationRevision = function () { return state.revision || 0; };
  global.openTranslationSourceSettings = function () { void open(); };
  global.refreshTranslationSourceUi = render;
  global.MineradioTranslationSettings = Object.freeze({ getState: function () { return Object.assign({}, state); }, refresh: refresh });
  if (node('translation-source-save')) {
    node('translation-source-save').addEventListener('click', function () { void save(false); });
    node('translation-source-test').addEventListener('click', function () { void save(true); });
    node('translation-source-clear-key').addEventListener('click', function () { void clearKey(); });
    node('translation-source-close').addEventListener('click', close);
    node('translation-source-modal').addEventListener('click', function (event) { if (event.target === this) close(); });
    node('translation-source-modal').addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key !== 'Tab') return;
      var inputs = Array.from(this.querySelectorAll('input,button')).filter(function (el) { return !el.disabled; }), first = inputs[0], last = inputs[inputs.length - 1];
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  void refresh();
})(window);
