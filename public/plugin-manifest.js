'use strict';
// Mineradio 插件清单：JS 头注释清单与 JSON 声明式清单共用同一套归一化与校验。
// 该文件同时被渲染进程（window.MineradioPluginManifest）、沙箱 Worker 和 Node 测试（require）加载，
// 所以只能依赖纯 ECMAScript，不能引用 document / localStorage 等宿主对象。
(function(global){
  var PLUGIN_SCHEMA = 'mineradio-plugin-v1';
  // 插件只有主题一种。音源与歌单能力在 v1.7.4 整体移除，插件不再有任何网络与播放通道。
  var PLUGIN_KINDS = ['theme'];
  // 单个插件包上限。插件常驻 localStorage 与 IndexedDB 用户状态，放开体积会直接压到启动水合路径上。
  var MAX_PACKAGE_BYTES = 512 * 1024;
  var MAX_THEME_CSS_BYTES = 64 * 1024;
  var MAX_THEME_VARS = 160;
  var MAX_PLUGINS = 40;
  var ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;
  var VERSION_RE = /^[0-9]{1,4}(\.[0-9]{1,4}){0,3}(-[A-Za-z0-9.]{1,16})?$/;
  var CSS_VAR_RE = /^--[a-z0-9][a-z0-9-]{0,63}$/;
  // 变量值只允许单条声明字面量：分号/花括号会越出声明，url() 与 @import 会拉取远端资源，都必须拦掉。
  var UNSAFE_CSS_VALUE_RE = /[;{}<>]|url\s*\(|expression\s*\(|javascript\s*:|@import/i;
  // 用构造函数写控制字符区间，避免把裸控制字节写进源文件（会让 git 把文件当二进制）。
  var CONTROL_CHAR_RE = new RegExp('[\\u0000-\\u001f\\u007f]+', 'g');
  var HEADER_BLOCK_RE = /\/\*\*([\s\S]*?)\*\//;
  var HEADER_TAG_RE = /^\s*\*?\s*@([A-Za-z][A-Za-z0-9_-]{0,23})[ \t]+(.*?)\s*$/;

  /**
   * 归一化为受长度约束的单行文本。
   * @param {unknown} value 原始值。
   * @param {number} max 最大字符数。
   * @returns {string} 去掉控制字符后的文本。
   */
  function text(value, max) {
    var out = String(value == null ? '' : value).replace(CONTROL_CHAR_RE, ' ').trim();
    return out.slice(0, Math.max(0, max));
  }

  /**
   * 解析 JS 插件的头注释清单。只看文件开头的第一个块注释，避免把插件正文里的注释误当清单。
   * @param {string} source 插件脚本源码。
   * @returns {object} 原始键值表（值尚未归一化）。
   */
  function parseHeaderManifest(source) {
    var head = String(source || '').slice(0, 4096);
    var block = HEADER_BLOCK_RE.exec(head);
    var raw = {};
    if (!block) return raw;
    var lines = String(block[1]).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var m = HEADER_TAG_RE.exec(lines[i]);
      if (!m) continue;
      var key = m[1].toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(raw, key)) raw[key] = m[2];
    }
    return raw;
  }

  /**
   * 归一化主题插件的 CSS 变量表。变量名与变量值都白名单校验，非法项直接丢弃而不是整包失败。
   * @param {unknown} raw 原始变量表。
   * @returns {object} 合法的变量键值对。
   */
  function normalizeThemeVars(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    var keys = Object.keys(raw);
    var count = 0;
    for (var i = 0; i < keys.length && count < MAX_THEME_VARS; i++) {
      var name = String(keys[i] || '').trim().toLowerCase();
      if (name.indexOf('--') !== 0) name = '--' + name.replace(/^-+/, '');
      if (!CSS_VAR_RE.test(name)) continue;
      var value = text(raw[keys[i]], 200);
      if (!value || UNSAFE_CSS_VALUE_RE.test(value)) continue;
      out[name] = value;
      count++;
    }
    return out;
  }

  /**
   * 清洗主题插件附带的 CSS 文本。只拦截会拉取远端资源或越出 style 标签的写法，其余选择器交给用户自担。
   * @param {unknown} raw 原始 CSS 文本。
   * @returns {string} 清洗后的 CSS。
   */
  function sanitizeThemeCss(raw) {
    var css = String(raw == null ? '' : raw);
    if (!css) return '';
    css = css.slice(0, MAX_THEME_CSS_BYTES);
    css = css.replace(CONTROL_CHAR_RE, ' ');
    // </style> 会提前闭合注入点；@import / url() 会把第三方资源拉进渲染进程，等于绕开白名单。
    css = css.replace(/<\s*\/?\s*style/gi, '/* blocked */');
    css = css.replace(/@(import|charset|namespace)[^;}]*;?/gi, '/* blocked */');
    css = css.replace(/url\s*\(([^)]*)\)/gi, function(all, inner){
      return /^\s*['"]?data:image\//i.test(inner) ? all : 'none';
    });
    css = css.replace(/expression\s*\(/gi, 'blocked(');
    css = css.replace(/javascript\s*:/gi, 'blocked:');
    // CSS 语法用不到 `<`（`>` 是子选择器所以要留）。清掉它可以彻底断掉标签注入的可能。
    css = css.replace(/</g, ' ');
    return css.trim();
  }
  /**
   * 归一化插件清单元数据。缺 id / name / 非法 kind 视为整包失败，其余字段缺省补齐。
   * @param {object} raw 原始清单键值。
   * @returns {{ok: boolean, error?: string, manifest?: object}} 归一化结果。
   */
  function normalizeManifest(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var id = text(raw.id, 64);
    if (!ID_RE.test(id)) return { ok: false, error: 'PLUGIN_BAD_ID' };
    var name = text(raw.name, 40);
    if (!name) return { ok: false, error: 'PLUGIN_BAD_NAME' };
    var kind = text(raw.kind, 16).toLowerCase();
    if (PLUGIN_KINDS.indexOf(kind) < 0) return { ok: false, error: 'PLUGIN_BAD_KIND' };
    var version = text(raw.version, 24);
    if (!VERSION_RE.test(version)) version = '0.0.0';
    var homepage = text(raw.homepage, 200);
    if (!/^https:\/\/[^\s"']+$/.test(homepage)) homepage = '';
    return {
      ok: true,
      manifest: {
        schema: PLUGIN_SCHEMA,
        id: id,
        name: name,
        kind: kind,
        version: version,
        author: text(raw.author, 40),
        description: text(raw.description, 160),
        homepage: homepage
      }
    };
  }

  /**
   * 解析用户导入的插件文件。`.js` 走头注释清单加脚本正文，`.json` 走纯声明式主题包。
   * @param {string} fileName 原始文件名，用来判定包格式。
   * @param {string} content 文件文本内容。
   * @returns {{ok: boolean, error?: string, plugin?: object}} 解析结果。
   */
  function parsePluginPackage(fileName, content) {
    var body = String(content == null ? '' : content);
    if (!body.trim()) return { ok: false, error: 'PLUGIN_EMPTY' };
    if (body.length > MAX_PACKAGE_BYTES) return { ok: false, error: 'PLUGIN_TOO_LARGE' };
    var lower = String(fileName || '').toLowerCase();
    var isJson = /\.json$/.test(lower) || (!/\.js$/.test(lower) && /^\s*\{/.test(body));
    var raw;
    var script = '';
    var theme = null;
    if (isJson) {
      try { raw = JSON.parse(body); } catch (e) { return { ok: false, error: 'PLUGIN_BAD_JSON' }; }
      if (!raw || typeof raw !== 'object') return { ok: false, error: 'PLUGIN_BAD_JSON' };
      if (raw.schema && text(raw.schema, 64) !== PLUGIN_SCHEMA) return { ok: false, error: 'PLUGIN_BAD_SCHEMA' };
      if (!raw.kind) raw.kind = 'theme';
    } else {
      raw = parseHeaderManifest(body);
      script = body;
    }
    var normalized = normalizeManifest(raw);
    if (!normalized.ok) return normalized;
    var manifest = normalized.manifest;
    if (manifest.kind === 'theme' && raw.theme && typeof raw.theme === 'object') {
      theme = { vars: normalizeThemeVars(raw.theme.vars), css: sanitizeThemeCss(raw.theme.css) };
      if (!Object.keys(theme.vars).length && !theme.css) theme = null;
    }
    // 声明式主题包既没有可用变量也没有脚本，就是一个空壳，装上去只会让用户以为坏了。
    if (!script && !theme) return { ok: false, error: 'PLUGIN_NO_PAYLOAD' };
    return { ok: true, plugin: { manifest: manifest, script: script, theme: theme } };
  }
  /**
   * 归一化一条已安装插件记录。读取路径也要重新校验，storage 里的内容可能被外部改过。
   * @param {unknown} raw 原始记录。
   * @returns {object|null} 合法记录，或 null 表示丢弃。
   */
  function normalizePluginRecord(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var normalized = normalizeManifest(raw.manifest || raw);
    if (!normalized.ok) return null;
    var script = String(raw.script == null ? '' : raw.script);
    if (script.length > MAX_PACKAGE_BYTES) return null;
    var theme = null;
    if (raw.theme && typeof raw.theme === 'object') {
      theme = { vars: normalizeThemeVars(raw.theme.vars), css: sanitizeThemeCss(raw.theme.css) };
      if (!Object.keys(theme.vars).length && !theme.css) theme = null;
    }
    if (!script && !theme) return null;
    var installedAt = Number(raw.installedAt) || 0;
    return {
      manifest: normalized.manifest,
      script: script,
      theme: theme,
      enabled: raw.enabled !== false,
      installedAt: installedAt || Date.now(),
      updatedAt: Number(raw.updatedAt) || installedAt || Date.now()
    };
  }

  /**
   * 归一化插件列表。按 id 去重（后来的覆盖先前的），并限制总数。
   * @param {unknown} value 原始列表或 JSON 文本。
   * @returns {object[]} 合法记录数组。
   */
  function normalizePluginRecords(value) {
    var raw = value;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw || '[]') || []; } catch (e) { raw = []; }
    }
    if (!Array.isArray(raw)) raw = [];
    var out = [];
    var index = Object.create(null);
    for (var i = 0; i < raw.length; i++) {
      var record = normalizePluginRecord(raw[i]);
      if (!record) continue;
      var id = record.manifest.id;
      if (Object.prototype.hasOwnProperty.call(index, id)) {
        out[index[id]] = record;
        continue;
      }
      if (out.length >= MAX_PLUGINS) continue;
      index[id] = out.length;
      out.push(record);
    }
    return out;
  }

  var api = {
    PLUGIN_SCHEMA: PLUGIN_SCHEMA,
    PLUGIN_KINDS: PLUGIN_KINDS,
    MAX_PACKAGE_BYTES: MAX_PACKAGE_BYTES,
    MAX_PLUGINS: MAX_PLUGINS,
    parseHeaderManifest: parseHeaderManifest,
    normalizeThemeVars: normalizeThemeVars,
    sanitizeThemeCss: sanitizeThemeCss,
    normalizeManifest: normalizeManifest,
    parsePluginPackage: parsePluginPackage,
    normalizePluginRecord: normalizePluginRecord,
    normalizePluginRecords: normalizePluginRecords
  };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  global.MineradioPluginManifest = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
