// ====================================================================
//  Mineradio local desktop server
//  - 本地文件代理 / 本地节奏缓存 / 更新检查
//  - 默认纯本地模式，不再加载网易云 / QQ 音乐运行依赖
// ====================================================================
const http = require('http');
const https = require('https');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const tls = require('tls');
const { Readable } = require('stream');
const { fileURLToPath } = require('url');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const LOCAL_FILE_TOKEN = process.env.MINERADIO_LOCAL_FILE_TOKEN || '';
/**
 * 本地文件代理授权校验钩子。
 * 由桌面主进程注入，强制 /api/local-file 只能读取已授权曲库根目录内的文件；
 * 缺省为空表示未注入，此时一律拒绝，避免独立或异常场景退化为可读任意文件的开放代理。
 * @type {((filePath: string) => string) | null}
 */
let localFileAuthorizer = null;

function resolveRuntimeAppRoots() {
  const sourceRoot = __dirname;
  const unpacked = process.resourcesPath
    ? path.join(process.resourcesPath, 'app.asar.unpacked')
    : '';
  const asar = process.resourcesPath
    ? path.join(process.resourcesPath, 'app.asar')
    : '';
  const writableRoot = unpacked && fs.existsSync(path.join(unpacked, 'server.js'))
    ? unpacked
    : sourceRoot;
  const resourceRoot = [writableRoot, asar, sourceRoot]
    .find(root => root && fs.existsSync(path.join(root, 'public', 'index.html')))
    || writableRoot;
  return { writableRoot, resourceRoot };
}
const { writableRoot: APP_ROOT, resourceRoot: RESOURCE_ROOT } = resolveRuntimeAppRoots();

/**
 * 注入本地文件代理的授权校验函数（跨进程契约：与主进程 resolveAuthorizedLocalFile 对齐）。
 * @param {(filePath: string) => string} authorizer 入参为解析后的绝对路径；越权时必须抛错，授权时返回可读绝对路径。
 * @returns {void}
 */
function setLocalFileAuthorizer(authorizer) {
  // 契约式校验：只接受函数，非法注入立即抛错（Fail-Fast），杜绝静默退化为无授权代理。
  if (typeof authorizer !== 'function') throw new TypeError('LOCAL_FILE_AUTHORIZER_INVALID');
  localFileAuthorizer = authorizer;
}
const UPDATE_WORK_DIR = process.env.MINERADIO_UPDATE_DIR || path.join(APP_ROOT, 'updates');
const UPDATE_DOWNLOAD_DIR = process.env.MINERADIO_UPDATE_DOWNLOAD_DIR || path.join(UPDATE_WORK_DIR, 'downloads');
const UPDATE_PATCH_BACKUP_DIR = process.env.MINERADIO_PATCH_BACKUP_DIR || path.join(UPDATE_WORK_DIR, 'backups', 'patches');
const BEATMAP_CACHE_DIR = process.env.MINERADIO_BEAT_CACHE_DIR || 'D:\\MineradioCache\\beatmaps';
const APP_PACKAGE = readPackageInfo();
const APP_VERSION = process.env.MINERADIO_VERSION || APP_PACKAGE.version || '0.9.11';
const UPDATE_CONFIG = readUpdateConfig(APP_PACKAGE);
const PATCH_MAX_BYTES = 12 * 1024 * 1024;
const UPDATE_INSTALLER_MAX_BYTES = 512 * 1024 * 1024;
const UPDATE_CHECK_CACHE_TTL_MS = 5 * 60 * 1000;
const UPDATE_DOWNLOAD_IDLE_TIMEOUT_MS = 30 * 1000;
const UPDATE_ROUTE_PROBE_BYTES = 128 * 1024;
const UPDATE_ROUTE_PROBE_TIMEOUT_MS = 4 * 1000;
const UPDATE_PROXY_CONNECT_TIMEOUT_MS = 12 * 1000;
const UPDATE_PROXY_MAX_REDIRECTS = 5;
const UPDATE_VERIFY_CHUNK_BYTES = 1024 * 1024;
const PATCH_ALLOWED_ROOTS = new Set(['public', 'desktop', 'build']);
const PATCH_ALLOWED_FILES = new Set(['server.js', 'package.json', 'package-lock.json']);
const UPDATE_FALLBACK_NOTES = [
  '电影镜头节奏更松',
  '音源失败自动换源',
  '右上角更新提示',
];
const updateDownloadJobs = new Map();
const installerReusePromises = new Map();
let updateVerifyChunkBuffer = null;
let updateInfoCache = null;
let latestUpdateInfoPromise = null;

function applySystemCertificateAuthorities() {
  try {
    if (typeof tls.getCACertificates !== 'function' || typeof tls.setDefaultCACertificates !== 'function') return;
    const bundled = tls.getCACertificates('default') || [];
    const system = tls.getCACertificates('system') || [];
    if (!system.length) return;
    const seen = new Set();
    const merged = [];
    bundled.concat(system).forEach(cert => {
      if (!cert || seen.has(cert)) return;
      seen.add(cert);
      merged.push(cert);
    });
    if (merged.length > bundled.length) tls.setDefaultCACertificates(merged);
  } catch (e) {
    console.warn('[TLS] system CA merge skipped:', e.message);
  }
}

applySystemCertificateAuthorities();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

const LOCAL_FILE_MIME = {
  '.mp3': 'audio/mpeg',
  '.mp2': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.m4b': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/ogg',
  '.webm': 'audio/webm',
  '.weba': 'audio/webm',
  '.aif': 'audio/x-aiff',
  '.aiff': 'audio/x-aiff',
  '.aifc': 'audio/x-aiff',
  '.lrc': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.srt': 'application/x-subrip; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.ass': 'text/x-ssa; charset=utf-8',
  '.yrc': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jpe': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

function localContentTypeForPath(filePath) {
  return LOCAL_FILE_MIME[path.extname(String(filePath || '')).toLowerCase()] || 'application/octet-stream';
}

function parseLocalFileRange(rangeHeader, total) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader).trim());
  if (!match || total <= 0 || (!match[1] && !match[2])) return { invalid: true };
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return { invalid: true };
    start = Math.max(0, total - suffixLength);
    end = total - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : total - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= total) {
    return { invalid: true };
  }
  return { start, end: Math.min(end, total - 1) };
}

// ---------- 工具 ----------
function serveStatic(req, res, filePath, cacheControl) {
  const ext = path.extname(filePath);
  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) { res.writeHead(404); res.end('Not Found'); return; }
    const etag = '"' + stat.size.toString(16) + '-' + Math.floor(Number(stat.mtimeMs) || 0).toString(16) + '"';
    const headers = {
      'Content-Type': MIME[ext] || 'text/plain',
      'Cache-Control': cacheControl || 'no-cache',
      'ETag': etag,
      'Last-Modified': stat.mtime.toUTCString(),
    };
    const ifNoneMatch = String(req && req.headers && req.headers['if-none-match'] || '');
    if (ifNoneMatch === '*' || ifNoneMatch.split(',').some(value => value.trim() === etag)) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    headers['Content-Length'] = String(stat.size);
    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.once('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      res.destroy(err);
    });
    stream.pipe(res);
  });
}
function sendJSON(res, data, status) {
  res.writeHead(status || 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(JSON.stringify(data));
}
function readPackageInfo() {
  try {
    const raw = fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}
function parseGitHubRepository(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const direct = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (direct) return { owner: direct[1], repo: direct[2].replace(/\.git$/i, '') };
  const github = raw.match(/github\.com[:/]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[#/?].*)?$/i);
  if (github) return { owner: github[1], repo: github[2].replace(/\.git$/i, '') };
  return null;
}
function readUpdateConfig(pkg) {
  const local = (pkg && pkg.mineradio && pkg.mineradio.update) || {};
  const repoHint = process.env.MINERADIO_UPDATE_REPOSITORY
    || process.env.GITHUB_REPOSITORY
    || local.repository
    || local.github
    || (pkg && pkg.repository && (pkg.repository.url || pkg.repository))
    || '';
  const parsed = parseGitHubRepository(repoHint) || {};
  const owner = process.env.MINERADIO_UPDATE_OWNER || local.owner || parsed.owner || '';
  const repo = process.env.MINERADIO_UPDATE_REPO || local.repo || parsed.repo || '';
  return {
    provider: local.provider || 'github',
    owner,
    repo,
    configured: !!(owner && repo),
    preview: local.preview !== false,
    preferMirrors: local.preferMirrors !== false,
    mirrors: readUpdateMirrors(local),
    proxy: process.env.MINERADIO_UPDATE_PROXY || local.proxy || '',
    manifest: process.env.MINERADIO_UPDATE_MANIFEST
      || process.env.MINERADIO_UPDATE_MANIFEST_URL
      || process.env.MINERADIO_UPDATE_MANIFEST_FILE
      || '',
  };
}
function parseUpdateMirrorList(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(/[\n,;]/);
}
function readUpdateMirrors(local) {
  const envMirrors = process.env.MINERADIO_UPDATE_MIRRORS || process.env.MINERADIO_UPDATE_MIRROR || '';
  const raw = envMirrors
    ? parseUpdateMirrorList(envMirrors)
    : parseUpdateMirrorList(local.mirrors || local.downloadMirrors || []);
  const seen = new Set();
  const mirrors = [];
  raw.forEach(item => {
    const url = String(item || '').trim();
    if (!/^https?:\/\//i.test(url)) return;
    const key = url.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    mirrors.push(url);
  });
  return mirrors.slice(0, 6);
}
function normalizeDigest(value, algorithm) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const prefix = new RegExp('^' + algorithm + ':', 'i');
  return raw.replace(prefix, '').trim().replace(/^['"]|['"]$/g, '');
}
function assetDigestInfo(asset) {
  const digest = String(asset && asset.digest || '').trim();
  return {
    sha256: normalizeDigest((asset && asset.sha256) || (/^sha256:/i.test(digest) ? digest : ''), 'sha256').toLowerCase(),
    sha512: normalizeDigest((asset && asset.sha512) || (/^sha512:/i.test(digest) ? digest : ''), 'sha512'),
  };
}
function buildMirrorUrl(originalUrl, mirror) {
  const source = String(originalUrl || '').trim();
  const base = String(mirror || '').trim();
  if (!/^https?:\/\//i.test(source) || !/^https?:\/\//i.test(base)) return '';
  if (base.includes('{encodedUrl}')) return base.replace(/\{encodedUrl\}/g, encodeURIComponent(source));
  if (base.includes('{url}')) return base.replace(/\{url\}/g, source);
  return base.replace(/\/+$/, '/') + source;
}
function isKnownMirrorDownloadUrl(value) {
  const url = String(value || '').trim().toLowerCase();
  if (!url) return false;
  const mirrors = UPDATE_CONFIG.mirrors || [];
  for (let i = 0; i < mirrors.length; i++) {
    const mirror = String(mirrors[i] || '').trim().toLowerCase();
    if (!mirror) continue;
    const encodedIndex = mirror.indexOf('{encodedurl}');
    const plainIndex = mirror.indexOf('{url}');
    let prefix = mirror;
    if (encodedIndex >= 0 && (plainIndex < 0 || encodedIndex < plainIndex)) prefix = mirror.slice(0, encodedIndex);
    else if (plainIndex >= 0) prefix = mirror.slice(0, plainIndex);
    prefix = prefix.replace(/\/+$/, '');
    if (prefix && url.startsWith(prefix)) return true;
  }
  return false;
}
const UPDATE_ROUTE_MODES = ['auto', 'direct', 'mirror', 'proxy'];
/**
 * 归一化用户选择的更新下载线路，未知值一律退回自动测速。
 * @param {*} value 前端传入的线路标识。
 * @returns {string} `auto` / `direct` / `mirror` / `proxy` 之一。
 */
function normalizeUpdateRouteMode(value) {
  const mode = String(value == null ? '' : value).trim().toLowerCase();
  return UPDATE_ROUTE_MODES.indexOf(mode) > 0 ? mode : 'auto';
}
/**
 * 返回线路的中文展示名，供任务状态和前端提示共用同一份文案。
 * @param {string} mode 线路标识。
 * @returns {string} 中文线路名。
 */
function updateRouteModeLabel(mode) {
  const value = normalizeUpdateRouteMode(mode);
  if (value === 'direct') return 'GitHub 直连';
  if (value === 'mirror') return '国内加速';
  if (value === 'proxy') return '本机代理';
  return '自动测速';
}
/**
 * 按用户选定线路裁剪候选，保持候选生成逻辑单一来源，只做过滤不改写标签或顺序。
 * @param {object[]} candidates 已生成的候选线路。
 * @param {string} mode 线路标识。
 * @returns {object[]} 该线路允许使用的候选线路。
 */
function filterUpdateRouteCandidates(candidates, mode) {
  const list = Array.isArray(candidates) ? candidates : [];
  const route = normalizeUpdateRouteMode(mode);
  if (route === 'mirror') return list.filter(item => !!(item && item.mirrored));
  // 直连与本机代理都只走 GitHub 原始地址，代理线路再叠加镜像没有意义。
  if (route === 'direct' || route === 'proxy') return list.filter(item => !!item && !item.mirrored);
  return list.slice();
}
/**
 * 解析代理地址；只接受 http/https 代理，socks 等无法用 CONNECT 隧道承载的形式一律拒绝。
 * @param {*} value 代理地址，允许省略协议的 `host:port` 形式。
 * @returns {{protocol: string, hostname: string, port: number, auth: string, label: string}|null} 解析结果，非法时为 null。
 */
function parseUpdateProxyTarget(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'http://' + raw;
  let url = null;
  try {
    url = new URL(withScheme);
  } catch (_) {
    return null;
  }
  const protocol = String(url.protocol || '').toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') return null;
  const hostname = String(url.hostname || '').trim();
  const port = Number(url.port || (protocol === 'https:' ? 443 : 80));
  if (!hostname || !Number.isFinite(port) || port < 1 || port > 65535) return null;
  const user = url.username ? decodeURIComponent(url.username) : '';
  const pass = url.password ? decodeURIComponent(url.password) : '';
  return {
    protocol,
    hostname,
    port,
    auth: user ? user + ':' + pass : '',
    // 展示名不带账号密码，避免代理凭据顺着任务状态泄漏到前端。
    label: protocol.replace(':', '') + '://' + hostname + ':' + port,
  };
}
/**
 * 读取显式配置的更新代理地址（环境变量优先，其次 package.json 更新配置）。
 * @returns {string} 代理地址字符串，未配置时为空。
 */
function readConfiguredUpdateProxyAddress() {
  const envValue = process.env.MINERADIO_UPDATE_PROXY
    || process.env.HTTPS_PROXY
    || process.env.https_proxy
    || process.env.HTTP_PROXY
    || process.env.http_proxy
    || process.env.ALL_PROXY
    || process.env.all_proxy
    || '';
  if (String(envValue || '').trim()) return String(envValue).trim();
  return String(UPDATE_CONFIG.proxy || '').trim();
}
/**
 * 解析 Electron `resolveProxy` 的 PAC 风格结果，取第一条可用的 http 代理。
 * @param {string} result `PROXY host:port` / `DIRECT` 形式的结果串。
 * @returns {string} 代理地址，DIRECT 或仅 socks 时为空。
 */
function parseSystemProxyResolveResult(result) {
  const entries = String(result || '').split(';');
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i].trim();
    if (!entry) continue;
    const match = entry.match(/^(PROXY|HTTPS)\s+(\S+)$/i);
    if (!match) continue;
    const scheme = match[1].toUpperCase() === 'HTTPS' ? 'https://' : 'http://';
    return scheme + match[2];
  }
  return '';
}
/**
 * 通过 Electron 会话查询系统代理；纯 Node 运行或查询失败时安静返回空值。
 * @param {string} targetUrl 目标下载地址。
 * @returns {Promise<string>} 系统代理地址，未取到时为空。
 */
async function resolveSystemUpdateProxyAddress(targetUrl) {
  try {
    const electron = require('electron');
    const session = electron && electron.session && electron.session.defaultSession;
    if (!session || typeof session.resolveProxy !== 'function') return '';
    return parseSystemProxyResolveResult(await session.resolveProxy(targetUrl));
  } catch (_) {
    return '';
  }
}
/**
 * 按“显式地址 → 环境变量/配置 → 系统代理”的顺序解析本机代理线路。
 * @param {*} explicit 前端显式指定的代理地址。
 * @param {string} targetUrl 目标下载地址，用于系统代理查询。
 * @returns {Promise<object|null>} 解析后的代理目标，未配置时为 null。
 */
async function resolveUpdateProxyTarget(explicit, targetUrl) {
  const direct = parseUpdateProxyTarget(explicit);
  if (direct) return direct;
  const configured = parseUpdateProxyTarget(readConfiguredUpdateProxyAddress());
  if (configured) return configured;
  return parseUpdateProxyTarget(await resolveSystemUpdateProxyAddress(targetUrl));
}
function uniqueDownloadCandidates(urls, opts) {
  opts = opts || {};
  const rawEntries = Array.isArray(urls) ? urls : [urls];
  const entries = [];
  const entryByUrl = new Map();
  for (let i = 0; i < rawEntries.length; i++) {
    const raw = rawEntries[i];
    const object = raw && typeof raw === 'object' ? raw : null;
    const url = String(object ? (object.url || object.downloadUrl || object.href || '') : raw || '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const explicitlyMirrored = object && object.mirrored === true
      ? true
      : isKnownMirrorDownloadUrl(url);
    const label = String(object && object.label || '').trim();
    const key = url.toLowerCase();
    const existing = entryByUrl.get(key);
    if (existing) {
      existing.mirrored = existing.mirrored || explicitlyMirrored;
      if (label) existing.label = label;
      continue;
    }
    const entry = {
      url,
      label,
      mirrored: explicitlyMirrored,
    };
    entries.push(entry);
    entryByUrl.set(key, entry);
  }
  const directEntries = entries.filter(item => !item.mirrored);
  const mirrors = opts.useMirrors === false ? [] : (UPDATE_CONFIG.mirrors || []);
  const mirrored = [];
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].mirrored) {
      mirrored.push({
        url: entries[i].url,
        label: entries[i].label || '国内加速线路',
        mirrored: true,
      });
    }
  }
  const generatedSources = new Set();
  directEntries.forEach(entry => {
    const source = entry.url;
    const sourceKey = source.toLowerCase();
    if (generatedSources.has(sourceKey)) return;
    generatedSources.add(sourceKey);
    mirrors.forEach((mirror, index) => {
      const url = buildMirrorUrl(source, mirror);
      if (url) mirrored.push({
        url,
        label: '国内加速线路 ' + (index + 1),
        mirrored: true,
      });
    });
  });
  const direct = directEntries.map(entry => ({
    url: entry.url,
    label: entry.label || 'GitHub 直连',
    mirrored: false,
  }));
  const ordered = UPDATE_CONFIG.preferMirrors === false ? direct.concat(mirrored) : mirrored.concat(direct);
  const seen = new Set();
  const result = [];
  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    const key = item.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
function publicDownloadUrls(candidates) {
  return (Array.isArray(candidates) ? candidates : [])
    .map(item => item && item.url)
    .filter(Boolean);
}
function downloadCandidateInputs(primaryUrl, source) {
  const candidates = source && Array.isArray(source.downloadCandidates) && source.downloadCandidates.length
    ? source.downloadCandidates
    : (source && Array.isArray(source.downloadUrls) ? source.downloadUrls : []);
  return [primaryUrl].concat(candidates);
}
function normalizeVersion(value) {
  return String(value || '').trim().replace(/^v/i, '').replace(/[+].*$/, '').replace(/-.+$/, '');
}
function compareVersions(a, b) {
  const aa = normalizeVersion(a).split('.').map(n => parseInt(n, 10) || 0);
  const bb = normalizeVersion(b).split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(aa.length, bb.length, 3);
  for (let i = 0; i < len; i++) {
    const left = aa[i] || 0;
    const right = bb[i] || 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}
function releaseLineEncodingPenalty(value) {
  let penalty = 0;
  for (const char of String(value || '')) {
    const code = char.charCodeAt(0);
    if (code === 0xfffd) return Number.MAX_SAFE_INTEGER;
    if (code >= 0x80 && code <= 0x9f) penalty += 2;
  }
  return penalty;
}
function repairReleaseLineEncoding(line) {
  const text = String(line || '').replace(/^(?:\uFEFF|ï»¿)+/, '');
  if (!text || !/^[\u0000-\u00ff]*$/.test(text) || !/[\u0080-\u00ff]/.test(text)) return text;
  const repaired = Buffer.from(text, 'latin1').toString('utf8');
  if (!repaired || repaired.includes('\uFFFD')) return text;
  const originalCjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const repairedCjk = (repaired.match(/[\u3400-\u9fff]/g) || []).length;
  return releaseLineEncodingPenalty(repaired) < releaseLineEncodingPenalty(text) || repairedCjk > originalCjk
    ? repaired
    : text;
}
function cleanReleaseLine(line) {
  return repairReleaseLineEncoding(line)
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*[-*]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function releaseSectionAction(text) {
  const heading = String(text || '').replace(/[：:]+$/, '').trim();
  if (/^(?:what'?s changed|changes|changelog|full changelog|release notes?|highlights?|更新日志|更新内容|本次更新|主要更新|重点更新|修复内容|问题修复|新增功能|功能更新|优化内容)$/i.test(heading)) return 'skip';
  if (/^(?:verification|validation|tests?|downloads?|installation|assets?|checksums?|验证|测试|下载|安装|发布资产|校验|哈希)$/i.test(heading)) return 'stop';
  return '';
}
function normalizeReleaseNotes(lines) {
  const notes = [];
  const seen = new Set();
  const source = Array.isArray(lines) ? lines : [lines];
  for (const line of source) {
    const raw = String(line || '').trim();
    if (!raw || /^(?:```|~~~)/.test(raw) || /^!\[/.test(raw)) continue;
    const text = cleanReleaseLine(raw);
    if (!text) continue;
    const sectionAction = releaseSectionAction(text);
    if (sectionAction === 'stop' && notes.length) break;
    if (sectionAction) continue;
    if (/^https?:\/\//i.test(text) || /^[-=_]{3,}$/.test(text)) continue;
    if (/[\uFFFD\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(text)) continue;
    if (/\bsha(?:256|512)\b/i.test(text) || /^[a-f0-9]{32,}\s+/i.test(text)) continue;
    if (text.length > 96) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push(text);
    if (notes.length >= 4) break;
  }
  return notes;
}
function extractReleaseNotes(body) {
  return normalizeReleaseNotes(String(body || '').split(/\r?\n/));
}
function pickReleaseAsset(assets) {
  const list = Array.isArray(assets) ? assets : [];
  const preferred = list.find(a => /\.(exe|msi)$/i.test(a && a.name || ''))
    || list.find(a => /\.(zip|7z)$/i.test(a && a.name || ''))
    || list[0];
  if (!preferred) return null;
  const digest = assetDigestInfo(preferred);
  const candidates = uniqueDownloadCandidates(preferred.browser_download_url || '');
  return {
    name: preferred.name || '',
    size: preferred.size || 0,
    contentType: preferred.content_type || '',
    downloadUrl: preferred.browser_download_url || '',
    downloadUrls: publicDownloadUrls(candidates),
    downloadCandidates: candidates,
    sha256: digest.sha256 || '',
    sha512: digest.sha512 || '',
  };
}
function patchAssetVersions(name) {
  const matches = String(name || '').match(/\d+(?:[._-]\d+){1,3}/g) || [];
  return matches.map(item => normalizeVersion(item.replace(/[._-]/g, '.'))).filter(Boolean);
}
function pickPatchAsset(assets, currentVersion, latestVersion) {
  const list = Array.isArray(assets) ? assets : [];
  const current = normalizeVersion(currentVersion || APP_VERSION);
  const latest = normalizeVersion(latestVersion || '');
  const preferred = list.find(a => {
    const name = String(a && a.name || '');
    if (!/\.(patch\.json|patch|json)$/i.test(name)) return false;
    const versions = patchAssetVersions(name);
    if (latest) return versions[0] === current && versions[versions.length - 1] === latest;
    return versions[0] === current && name.toLowerCase().includes('patch');
  }) || list.find(a => {
    const name = String(a && a.name || '');
    if (!/\.(patch\.json|patch|json)$/i.test(name)) return false;
    const versions = patchAssetVersions(name);
    return versions[0] === current && name.toLowerCase().includes('patch');
  }) || list.find(a => /\.(patch\.json|patch)$/i.test(a && a.name || ''));
  if (!preferred) return null;
  const digest = assetDigestInfo(preferred);
  const candidates = uniqueDownloadCandidates(preferred.browser_download_url || '');
  return {
    name: preferred.name || '',
    size: preferred.size || 0,
    contentType: preferred.content_type || '',
    downloadUrl: preferred.browser_download_url || '',
    downloadUrls: publicDownloadUrls(candidates),
    downloadCandidates: candidates,
    sha256: digest.sha256 || '',
    sha512: digest.sha512 || '',
  };
}
function updateAssetNameFromUrl(value) {
  try {
    const u = new URL(String(value || ''));
    const base = path.basename(decodeURIComponent(u.pathname || ''));
    if (base) return base;
  } catch (_) {}
  return path.basename(String(value || '').split('?')[0]) || '';
}
function normalizeManifestUpdateInfo(data) {
  data = data || {};
  const release = data.release || {};
  const asset = release.asset || data.asset || {};
  const latestVersion = normalizeVersion(
    data.latestVersion
    || data.version
    || release.version
    || release.tagName
    || release.tag_name
    || release.name
    || APP_VERSION
  ) || APP_VERSION;
  const downloadUrl = release.downloadUrl || data.downloadUrl || asset.downloadUrl || asset.browser_download_url || '';
  const patch = release.patch || data.patch || null;
  const assetCandidates = uniqueDownloadCandidates(downloadCandidateInputs(downloadUrl, asset));
  const patchCandidates = patch ? uniqueDownloadCandidates(downloadCandidateInputs(patch.downloadUrl, patch)) : [];
  const patchInfo = patch && patch.downloadUrl ? {
    name: patch.name || updateAssetNameFromUrl(patch.downloadUrl) || `Mineradio-${APP_VERSION}→${latestVersion}.patch.json`,
    size: Number(patch.size || 0) || 0,
    contentType: patch.contentType || patch.content_type || 'application/json',
    downloadUrl: patch.downloadUrl,
    downloadUrls: publicDownloadUrls(patchCandidates),
    downloadCandidates: patchCandidates,
    from: normalizeVersion(patch.from || APP_VERSION),
    to: normalizeVersion(patch.to || latestVersion),
    sha256: normalizeDigest(patch.sha256 || '', 'sha256').toLowerCase(),
    sha512: normalizeDigest(patch.sha512 || '', 'sha512'),
  } : null;
  const explicitNotes = Array.isArray(release.notes) && release.notes.length
    ? normalizeReleaseNotes(release.notes)
    : [];
  const bodyNotes = explicitNotes.length ? [] : extractReleaseNotes(release.body || data.body);
  const notes = explicitNotes.length ? explicitNotes : (bodyNotes.length ? bodyNotes : UPDATE_FALLBACK_NOTES);
  const summaryNotes = normalizeReleaseNotes([release.summary || data.summary || '']);
  const assetInfo = downloadUrl ? {
    name: asset.name || updateAssetNameFromUrl(downloadUrl) || `Mineradio-${latestVersion}-Setup.exe`,
    size: Number(asset.size || 0) || 0,
    contentType: asset.contentType || asset.content_type || '',
    downloadUrl,
    downloadUrls: publicDownloadUrls(assetCandidates),
    downloadCandidates: assetCandidates,
    sha256: normalizeDigest(asset.sha256 || '', 'sha256').toLowerCase(),
    sha512: normalizeDigest(asset.sha512 || release.sha512 || data.sha512 || '', 'sha512'),
  } : null;
  return {
    configured: true,
    preview: false,
    updateAvailable: data.updateAvailable != null ? !!data.updateAvailable : compareVersions(latestVersion, APP_VERSION) > 0,
    currentVersion: APP_VERSION,
    latestVersion,
    release: {
      tagName: release.tagName || release.tag_name || data.tagName || ('v' + latestVersion),
      name: release.name || data.name || ('Mineradio v' + latestVersion),
      version: latestVersion,
      publishedAt: release.publishedAt || release.published_at || data.publishedAt || '',
      htmlUrl: release.htmlUrl || release.html_url || data.htmlUrl || '',
      downloadUrl,
      asset: assetInfo,
      patch: patchInfo,
      patchAvailable: !!(patchInfo && patchInfo.downloadUrl && compareVersions(latestVersion, APP_VERSION) > 0),
      summary: summaryNotes[0] || notes[0] || '发现新版本，建议更新。',
      notes,
    },
    source: 'manifest',
  };
}
async function readUpdateManifest(ref) {
  const value = String(ref || '').trim();
  if (!value) throw new Error('UPDATE_MANIFEST_MISSING');
  if (/^https:\/\//i.test(value)) {
    const resp = await fetch(value, {
      headers: { 'User-Agent': `Mineradio/${APP_VERSION}` },
    });
    if (!resp.ok) throw new Error('Update manifest ' + resp.status);
    return resp.json();
  }
  const file = /^file:/i.test(value) ? fileURLToPath(value) : path.resolve(value);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
async function fetchManifestUpdateInfo(ref) {
  try {
    const data = await readUpdateManifest(ref);
    return normalizeManifestUpdateInfo(data);
  } catch (err) {
    return localUpdateFallback(err.message || 'Update manifest failed', { configured: true });
  }
}
function beatCacheRootInfo() {
  const dir = path.resolve(BEATMAP_CACHE_DIR);
  const root = path.parse(dir).root;
  const drive = root ? root.replace(/[\\\/]+$/, '').toUpperCase() : '';
  const allowed = !!root && !/^C:$/i.test(drive);
  const available = allowed && fs.existsSync(root);
  return { dir, root, drive, allowed, available };
}
function ensureBeatMapCacheDir() {
  const info = beatCacheRootInfo();
  if (!info.allowed) {
    const err = new Error('BEAT_CACHE_ON_C_DRIVE_DISABLED');
    err.code = 'BEAT_CACHE_ON_C_DRIVE_DISABLED';
    err.info = info;
    throw err;
  }
  if (!info.available) {
    const err = new Error('BEAT_CACHE_DRIVE_UNAVAILABLE');
    err.code = 'BEAT_CACHE_DRIVE_UNAVAILABLE';
    err.info = info;
    throw err;
  }
  fs.mkdirSync(info.dir, { recursive: true });
  return info.dir;
}
function safeBeatMapCacheFile(key) {
  const raw = String(key || '').trim();
  if (!raw || raw.length > 240) return null;
  const hash = crypto.createHash('sha1').update(raw).digest('hex');
  const label = raw.replace(/[^a-z0-9_.-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'beatmap';
  return path.join(ensureBeatMapCacheDir(), `${label}-${hash}.json`);
}
function compactBeatMapCachePayload(body) {
  const key = String(body && body.key || '').trim();
  const map = body && body.map;
  if (!key || !map || typeof map !== 'object') return null;
  return {
    v: 1,
    key,
    savedAt: Date.now(),
    meta: {
      provider: String(body.provider || '').slice(0, 32),
      title: String(body.title || '').slice(0, 160),
      artist: String(body.artist || '').slice(0, 160),
      mode: String(body.mode || 'mr').slice(0, 32),
    },
    map,
  };
}
function readBeatMapCache(key) {
  const file = safeBeatMapCacheFile(key);
  if (!file || !fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return raw && raw.map ? raw : null;
}
function writeBeatMapCache(body) {
  const payload = compactBeatMapCachePayload(body);
  if (!payload) return { ok: false, error: 'INVALID_BEATMAP_CACHE_PAYLOAD' };
  const file = safeBeatMapCacheFile(payload.key);
  if (!file) return { ok: false, error: 'INVALID_BEATMAP_CACHE_KEY' };
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload));
  fs.renameSync(tmp, file);
  return { ok: true, key: payload.key, savedAt: payload.savedAt, dir: path.dirname(file) };
}
function localUpdateFallback(reason, opts) {
  opts = opts || {};
  const configured = !!(opts.configured != null ? opts.configured : false);
  return {
    configured,
    preview: UPDATE_CONFIG.preview,
    updateAvailable: false,
    currentVersion: APP_VERSION,
    latestVersion: APP_VERSION,
    release: {
      tagName: 'v' + APP_VERSION,
      name: 'Mineradio v' + APP_VERSION,
      version: APP_VERSION,
      htmlUrl: '',
      downloadUrl: '',
      summary: '当前版本，更新检测已就绪。',
      notes: UPDATE_FALLBACK_NOTES,
    },
    reason: reason || '',
  };
}
/**
 * 复制更新检测结果，避免缓存对象被下载任务或响应处理流程意外改写。
 * @param {object} info 更新检测结果对象。
 * @returns {object} 可独立返回给调用方的检测结果副本。
 */
function cloneUpdateInfo(info) {
  return JSON.parse(JSON.stringify(info || localUpdateFallback()));
}
/**
 * 写入更新检测缓存；失败兜底结果只短暂缓存，避免临时网络问题长时间挡住新版提示。
 * @param {object} info 更新检测结果对象。
 * @returns {object} 原始更新检测结果对象。
 */
function rememberUpdateInfo(info) {
  const ttl = info && info.reason ? 45 * 1000 : UPDATE_CHECK_CACHE_TTL_MS;
  updateInfoCache = {
    value: cloneUpdateInfo(info),
    expiresAt: Date.now() + ttl,
  };
  return info;
}
/**
 * 创建下载读流空闲计时器，防止线路响应头成功但正文长时间卡死。
 * @param {number} timeoutMs 空闲超时时间，单位毫秒。
 * @param {AbortSignal=} cancelSignal 任务级取消信号，用户点“取消更新”时立刻中断正文读取。
 * @returns {{signal: AbortSignal, touch: Function, clear: Function}} fetch 可使用的中止信号和计时控制函数。
 */
function createUpdateDownloadIdleGuard(timeoutMs, cancelSignal) {
  const controller = new AbortController();
  const timeout = Math.max(5000, Number(timeoutMs) || UPDATE_DOWNLOAD_IDLE_TIMEOUT_MS);
  let timer = null;
  let unlinkCancel = null;
  const touch = (nextTimeoutMs) => {
    if (timer) clearTimeout(timer);
    const delay = Math.max(5000, Number(nextTimeoutMs) || timeout);
    timer = setTimeout(() => controller.abort(), delay);
  };
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (unlinkCancel) unlinkCancel();
    unlinkCancel = null;
  };
  touch();
  if (cancelSignal && typeof cancelSignal.addEventListener === 'function') {
    if (cancelSignal.aborted) controller.abort();
    else {
      const onCancel = () => controller.abort();
      cancelSignal.addEventListener('abort', onCancel, { once: true });
      // 单次下载结束就摘掉监听，避免长任务在任务级信号上堆积回调。
      unlinkCancel = () => {
        if (typeof cancelSignal.removeEventListener === 'function') cancelSignal.removeEventListener('abort', onCancel);
      };
    }
  }
  return { signal: controller.signal, touch, clear };
}
function updateError(code, message, cause) {
  const err = new Error(message || code);
  err.code = code;
  if (cause) err.cause = cause;
  return err;
}
function classifyUpdateError(err) {
  const code = String(err && err.code || '').trim();
  const name = String(err && err.name || '').trim();
  const message = String(err && err.message || err || '').trim();
  const cause = err && err.cause;
  const causeCode = String(cause && cause.code || '').trim();
  const causeName = String(cause && cause.name || '').trim();
  const causeMessage = String(cause && cause.message || '').trim();
  const causeDetail = causeMessage || causeCode;
  const detail = message && causeDetail && causeDetail !== message
    ? message + ': ' + causeDetail
    : (message || causeDetail || code || '未知错误');
  const classificationText = [code, name, message, causeCode, causeName, causeMessage].join(' ');
  // 取消是用户主动行为，必须排在超时/中止分类之前，否则会被误报成网络超时。
  if (/UPDATE_CANCELED/i.test(classificationText)) {
    return { code: 'UPDATE_CANCELED', reason: '更新已取消。', detail };
  }
  if (/UPDATE_ROUTE_UNAVAILABLE/i.test(classificationText)) {
    return { code: 'UPDATE_ROUTE_UNAVAILABLE', reason: '当前选择的更新线路没有可用地址，请换一条线路。', detail };
  }
  if (/UPDATE_PROXY_NOT_CONFIGURED/i.test(classificationText)) {
    return { code: 'UPDATE_PROXY_NOT_CONFIGURED', reason: '没有检测到可用的本机代理，请先在系统里设置代理或改用其它线路。', detail };
  }
  if (/UPDATE_PROXY_/i.test(classificationText)) {
    return { code: code || 'UPDATE_PROXY_FAILED', reason: '通过本机代理连接更新线路失败，请检查代理是否正常。', detail };
  }
  if (/PATCH_ROLLBACK_FAILED/i.test(classificationText)) {
    return { code: code || 'PATCH_ROLLBACK_FAILED', reason: '快速补丁回滚失败，请改用完整安装包修复。', detail };
  }
  if (/HASH|DIGEST|CHECKSUM/i.test(classificationText)) {
    return { code: code || 'UPDATE_HASH_MISMATCH', reason: '文件校验失败，可能是线路缓存异常，已拦截该安装包。', detail };
  }
  if (/SIZE_MISMATCH|content length/i.test(classificationText)) {
    return { code: code || 'UPDATE_SIZE_MISMATCH', reason: '下载文件大小不一致，可能是网络中断或线路缓存不完整。', detail };
  }
  if (/UPDATE_WRITE_FAILED|UPDATE_LOCAL_IO_FAILED|EACCES|EPERM|ENOSPC|EIO|EBUSY|EROFS|EMFILE|ENFILE|ENOTDIR|EISDIR|ENOENT|ENAMETOOLONG|EEXIST|EXDEV|ENOTEMPTY/i.test(classificationText)) {
    return { code: code || 'UPDATE_LOCAL_IO_FAILED', reason: '本地保存更新文件失败，请检查磁盘空间或文件占用。', detail };
  }
  if (/AbortError|TIMEOUT|ETIMEDOUT|timeout/i.test(classificationText)) {
    const domTimeout = /^(?:AbortError|TimeoutError)$/i.test(name) || /^(?:AbortError|TimeoutError)$/i.test(causeName);
    const timeoutCode = domTimeout ? 'UPDATE_TIMEOUT' : (code || 'UPDATE_TIMEOUT');
    return { code: timeoutCode, reason: '连接超时，当前网络到更新线路不稳定。', detail };
  }
  if (/ENOTFOUND|EAI_AGAIN|DNS|getaddrinfo/i.test(classificationText)) {
    return { code: code || 'UPDATE_DNS_FAILED', reason: '域名解析失败，可能是当前网络无法连接该更新线路。', detail };
  }
  if (/ECONNRESET|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|socket|network|fetch failed/i.test(classificationText)) {
    return { code: code || 'UPDATE_NETWORK_FAILED', reason: '网络连接被中断，已尝试切换更新线路。', detail };
  }
  const http = message.match(/\bHTTP[_\s-]?(\d{3})\b/i) || message.match(/\b(\d{3})\b/);
  if (http) {
    const status = Number(http[1]);
    if (status === 403) return { code: code || 'UPDATE_HTTP_403', reason: '更新线路返回 403，可能被限流或拦截。', detail };
    if (status === 404) return { code: code || 'UPDATE_HTTP_404', reason: '更新文件不存在，可能 release 资源还没有同步完成。', detail };
    if (status >= 500) return { code: code || 'UPDATE_HTTP_5XX', reason: '更新线路服务器异常，请稍后重试。', detail };
    return { code: code || ('UPDATE_HTTP_' + status), reason: '更新线路返回 HTTP ' + status + '。', detail };
  }
  return { code: code || 'UPDATE_FAILED', reason: '更新失败：' + detail, detail };
}
async function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 12000);
  try {
    return await fetch(url, Object.assign({}, opts || {}, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}
async function fetchTextFromCandidates(candidates, timeoutMs) {
  const list = Array.isArray(candidates) && candidates.length ? candidates : [];
  const failures = [];
  for (let i = 0; i < list.length; i++) {
    const candidate = list[i];
    try {
      const resp = await fetchWithTimeout(candidate.url, {
        headers: { 'User-Agent': `Mineradio/${APP_VERSION}` },
      }, timeoutMs || 6500);
      if (!resp.ok) throw updateError('HTTP_' + resp.status, 'HTTP ' + resp.status);
      return { text: await resp.text(), candidate };
    } catch (err) {
      const info = classifyUpdateError(err);
      failures.push(candidate.label + ': ' + info.reason);
    }
  }
  throw updateError('UPDATE_ALL_LINES_FAILED', failures.join('；') || 'All update lines failed');
}
/**
 * 从 electron-builder 的 latest.yml 里提取指定顶层标量字段。
 * latest.yml 的 files 数组项会用相同缩进重复出现 url/sha512/size，若只按任意缩进匹配，
 * 多资产场景下会错误命中 files 首项（例如 blockmap）的值。这里优先锚定行首无缩进的顶层字段，
 * 顶层缺失时才回退到任意缩进，确保拿到的是权威的主安装包信息。
 * @param {string} text latest.yml 全文。
 * @param {string} key 待提取的字段名。
 * @returns {string} 去除首尾引号后的标量值；未命中返回空串。
 */
function yamlScalar(text, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const src = String(text || '');
  const topPattern = new RegExp('^' + escaped + '\\s*:\\s*(.+?)\\s*$', 'm');
  const anyPattern = new RegExp('^\\s*' + escaped + '\\s*:\\s*(.+?)\\s*$', 'm');
  const match = src.match(topPattern) || src.match(anyPattern);
  if (!match) return '';
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}
function githubReleaseDownloadUrl(version, fileName) {
  const tag = 'v' + normalizeVersion(version);
  const encodedOwner = encodeURIComponent(UPDATE_CONFIG.owner);
  const encodedRepo = encodeURIComponent(UPDATE_CONFIG.repo);
  const encodedName = String(fileName || '').split('/').map(part => encodeURIComponent(part)).join('/');
  return `https://github.com/${encodedOwner}/${encodedRepo}/releases/download/${tag}/${encodedName}`;
}
function parseLatestYmlUpdateInfo(text, reason) {
  const latestVersion = normalizeVersion(yamlScalar(text, 'version') || APP_VERSION) || APP_VERSION;
  const assetPath = yamlScalar(text, 'path') || yamlScalar(text, 'url') || `Mineradio-${latestVersion}-Setup.exe`;
  const sha512 = normalizeDigest(yamlScalar(text, 'sha512'), 'sha512');
  const size = Number(yamlScalar(text, 'size') || 0) || 0;
  const releaseDate = yamlScalar(text, 'releaseDate');
  const downloadUrl = githubReleaseDownloadUrl(latestVersion, assetPath);
  const candidates = uniqueDownloadCandidates(downloadUrl);
  const asset = {
    name: updateAssetNameFromUrl(downloadUrl) || assetPath,
    size,
    contentType: 'application/octet-stream',
    downloadUrl,
    downloadUrls: publicDownloadUrls(candidates),
    downloadCandidates: candidates,
    sha256: '',
    sha512,
  };
  return {
    configured: true,
    preview: false,
    updateAvailable: compareVersions(latestVersion, APP_VERSION) > 0,
    currentVersion: APP_VERSION,
    latestVersion,
    release: {
      tagName: 'v' + latestVersion,
      name: 'Mineradio v' + latestVersion,
      version: latestVersion,
      publishedAt: releaseDate,
      htmlUrl: `https://github.com/${UPDATE_CONFIG.owner}/${UPDATE_CONFIG.repo}/releases/tag/v${latestVersion}`,
      downloadUrl,
      asset,
      patch: null,
      patchAvailable: false,
      summary: '发现新版本，已启用备用更新线路。',
      notes: ['更新检测已切换到备用线路', '下载时会自动选择国内加速线路', '下载失败会显示具体原因和当前速度'],
    },
    source: 'latest-yml',
    reason: reason || '',
  };
}
async function fetchLatestYmlUpdateInfo(reason) {
  if (!UPDATE_CONFIG.configured || UPDATE_CONFIG.provider !== 'github') throw updateError('UPDATE_REPOSITORY_NOT_CONFIGURED');
  const latestYmlUrl = `https://github.com/${encodeURIComponent(UPDATE_CONFIG.owner)}/${encodeURIComponent(UPDATE_CONFIG.repo)}/releases/latest/download/latest.yml`;
  const candidates = uniqueDownloadCandidates(latestYmlUrl);
  const result = await fetchTextFromCandidates(candidates, 6500);
  return parseLatestYmlUpdateInfo(result.text, reason);
}
async function fetchLatestUpdateInfoUncached() {
  if (UPDATE_CONFIG.manifest) return fetchManifestUpdateInfo(UPDATE_CONFIG.manifest);
  if (!UPDATE_CONFIG.configured || UPDATE_CONFIG.provider !== 'github') return localUpdateFallback();
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(UPDATE_CONFIG.owner)}/${encodeURIComponent(UPDATE_CONFIG.repo)}/releases/latest`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const resp = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': `Mineradio/${APP_VERSION}`,
        'Accept': 'application/vnd.github+json',
      },
    });
    if (!resp.ok) {
      try { return await fetchLatestYmlUpdateInfo('GitHub Releases ' + resp.status); }
      catch (_) { return localUpdateFallback('GitHub Releases ' + resp.status, { configured: true }); }
    }
    const data = await resp.json();
    const latestVersion = normalizeVersion(data.tag_name || data.name || APP_VERSION) || APP_VERSION;
    const asset = pickReleaseAsset(data.assets);
    const patch = pickPatchAsset(data.assets, APP_VERSION, latestVersion);
    const extractedNotes = extractReleaseNotes(data.body);
    const notes = extractedNotes.length ? extractedNotes : UPDATE_FALLBACK_NOTES;
    return {
      configured: true,
      preview: false,
      updateAvailable: compareVersions(latestVersion, APP_VERSION) > 0,
      currentVersion: APP_VERSION,
      latestVersion,
      release: {
        tagName: data.tag_name || ('v' + latestVersion),
        name: data.name || ('Mineradio v' + latestVersion),
        version: latestVersion,
        publishedAt: data.published_at || '',
        htmlUrl: data.html_url || '',
        downloadUrl: asset ? asset.downloadUrl : '',
        asset,
        patch,
        patchAvailable: !!(patch && patch.downloadUrl && compareVersions(latestVersion, APP_VERSION) > 0),
        summary: notes[0] || '发现新版本，建议更新。',
        notes,
      },
    };
  } catch (err) {
    const reason = err && err.message || 'Update check failed';
    try { return await fetchLatestYmlUpdateInfo(reason); }
    catch (fallbackErr) { return localUpdateFallback((fallbackErr && fallbackErr.message) || reason, { configured: true }); }
  } finally {
    clearTimeout(timer);
  }
}
/**
 * 读取最新版本信息，自动复用短期缓存和正在进行的检测请求，减少启动和点击下载时的重复 GitHub 请求。
 * @param {{force?: boolean}=} opts force 为 true 时跳过已有缓存，但仍复用正在进行的检测。
 * @returns {Promise<object>} 更新检测结果副本。
 */
async function fetchLatestUpdateInfo(opts) {
  opts = opts || {};
  const now = Date.now();
  if (!opts.force && updateInfoCache && updateInfoCache.expiresAt > now) {
    return cloneUpdateInfo(updateInfoCache.value);
  }
  if (!latestUpdateInfoPromise) {
    latestUpdateInfoPromise = fetchLatestUpdateInfoUncached()
      .then(rememberUpdateInfo)
      .finally(() => {
        latestUpdateInfoPromise = null;
      });
  }
  return cloneUpdateInfo(await latestUpdateInfoPromise);
}
function safeUpdateFileName(name, version) {
  const raw = String(name || '').trim() || `Mineradio-${version || APP_VERSION}.exe`;
  const cleaned = raw
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return cleaned || `Mineradio-${version || APP_VERSION}.exe`;
}
function publicUpdateJob(job) {
  if (!job) return { ok: false, error: 'UPDATE_JOB_NOT_FOUND' };
  return {
    ok: job.status !== 'error',
    id: job.id,
    status: job.status,
    progress: job.progress || 0,
    received: job.received || 0,
    total: job.total || 0,
    speedBps: job.speedBps || 0,
    etaSeconds: job.etaSeconds || 0,
    sourceLabel: job.sourceLabel || '',
    attempt: job.attempt || 0,
    attempts: job.attempts || 0,
    mode: job.mode || 'installer',
    route: job.route || 'auto',
    routeLabel: job.routeLabel || '',
    proxyLabel: job.proxyLabel || '',
    canceled: job.status === 'canceled',
    // 补丁进入写盘/回滚阶段后不能再中断，否则会留下半套文件。
    canCancel: (job.status === 'queued' || job.status === 'downloading') && !job.applying && !job.canceled,
    message: job.message || '',
    restartRequired: !!job.restartRequired,
    cached: !!job.cached,
    fileName: job.fileName || '',
    filePath: job.status === 'ready' ? job.filePath : '',
    version: job.version || '',
    releaseUrl: job.releaseUrl || '',
    error: job.error || '',
    errorReason: job.errorReason || '',
    errorDetail: job.errorDetail || '',
    failedAttempts: Array.isArray(job.failedAttempts) ? job.failedAttempts.slice(0, 6) : [],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
function isActiveUpdateJob(job) {
  return job && (job.status === 'queued' || job.status === 'downloading' || job.status === 'ready');
}
function latestUpdateDownloadJob(predicate) {
  let latest = null;
  let latestCreatedAt = -1;
  for (const job of updateDownloadJobs.values()) {
    if (predicate && !predicate(job)) continue;
    const createdAt = job.createdAt || 0;
    if (!latest || createdAt > latestCreatedAt) {
      latest = job;
      latestCreatedAt = createdAt;
    }
  }
  return latest;
}
function newestUpdateDownloadJobs(limit) {
  const max = Math.max(0, Number(limit) || 0);
  const newest = [];
  if (!max) return newest;
  for (const job of updateDownloadJobs.values()) {
    const createdAt = job.createdAt || 0;
    let insertAt = newest.length;
    while (insertAt > 0 && createdAt > (newest[insertAt - 1].createdAt || 0)) insertAt--;
    if (insertAt >= max) continue;
    newest.splice(insertAt, 0, job);
    if (newest.length > max) newest.length = max;
  }
  return newest;
}
function activeUpdateJobFor(version) {
  return latestUpdateDownloadJob(job => job.version === version && isActiveUpdateJob(job));
}
function trimUpdateJobs() {
  if (updateDownloadJobs.size <= 8) return;
  const keep = new Set();
  const newest = newestUpdateDownloadJobs(8);
  for (let i = 0; i < newest.length; i++) keep.add(newest[i].id);
  for (const job of updateDownloadJobs.values()) {
    if (!keep.has(job.id)) updateDownloadJobs.delete(job.id);
  }
}
function getUpdateVerifyChunkBuffer() {
  if (!updateVerifyChunkBuffer || updateVerifyChunkBuffer.length !== UPDATE_VERIFY_CHUNK_BYTES) {
    updateVerifyChunkBuffer = Buffer.allocUnsafe(UPDATE_VERIFY_CHUNK_BYTES);
  }
  return updateVerifyChunkBuffer;
}
async function closeUpdateFileHandle(handle, primaryErr) {
  if (!handle) return primaryErr || null;
  try {
    await handle.close();
    return primaryErr || null;
  } catch (closeErr) {
    if (primaryErr) return primaryErr;
    return updateError("UPDATE_WRITE_FAILED", "Update file handle close failed", closeErr);
  }
}
function verifyStreamedUpdatePayload(job, received, sha256, sha512) {
  const expectedSize = Number(job && (job.expectedSize || job.total) || 0) || 0;
  const actualSize = Number(received) || 0;
  if (expectedSize > 0 && actualSize !== expectedSize) {
    throw updateError("UPDATE_SIZE_MISMATCH", `Expected ${expectedSize} bytes, got ${actualSize}`);
  }
  const expectedSha256 = normalizeDigest(job && job.sha256 || "", "sha256").toLowerCase();
  if (expectedSha256) {
    if (!sha256) throw updateError("UPDATE_SHA256_MISMATCH", "Downloaded sha256 missing during stream");
    if (sha256.digest("hex") !== expectedSha256) {
      throw updateError("UPDATE_SHA256_MISMATCH", "Downloaded sha256 mismatch");
    }
  }
  const expectedSha512 = normalizeDigest(job && job.sha512 || "", "sha512");
  if (expectedSha512) {
    if (!sha512) throw updateError("UPDATE_SHA512_MISMATCH", "Downloaded sha512 missing during stream");
    const actual = sha512.digest();
    const actualBase64 = actual.toString("base64");
    const actualHex = actual.toString("hex");
    if (actualBase64 !== expectedSha512 && actualHex !== expectedSha512.toLowerCase()) {
      throw updateError("UPDATE_SHA512_MISMATCH", "Downloaded sha512 mismatch");
    }
  }
}
function verifyUpdateBuffer(buffer, job) {
  const expectedSize = Number(job.expectedSize || job.total || 0) || 0;
  if (expectedSize > 0 && buffer.length !== expectedSize) {
    throw updateError('UPDATE_SIZE_MISMATCH', `Expected ${expectedSize} bytes, got ${buffer.length}`);
  }
  const expectedSha256 = normalizeDigest(job.sha256 || '', 'sha256').toLowerCase();
  if (expectedSha256 && sha256Hex(buffer) !== expectedSha256) {
    throw updateError('UPDATE_SHA256_MISMATCH', 'Downloaded sha256 mismatch');
  }
  const expectedSha512 = normalizeDigest(job.sha512 || '', 'sha512');
  if (expectedSha512) {
    const actual = crypto.createHash('sha512').update(buffer).digest();
    const actualBase64 = actual.toString('base64');
    const actualHex = actual.toString('hex');
    if (actualBase64 !== expectedSha512 && actualHex !== expectedSha512.toLowerCase()) {
      throw updateError('UPDATE_SHA512_MISMATCH', 'Downloaded sha512 mismatch');
    }
  }
}
async function verifyUpdateFile(filePath, job) {
  const expectedSize = Number(job.expectedSize || job.total || 0) || 0;
  const expectedSha256 = normalizeDigest(job.sha256 || '', 'sha256').toLowerCase();
  const expectedSha512 = normalizeDigest(job.sha512 || '', 'sha512');
  const stat = await fs.promises.stat(filePath);
  if (!stat.isFile()) {
    throw updateError('EISDIR', `EISDIR: illegal operation on a directory, read '${filePath}'`);
  }
  if (expectedSize > 0 && stat.size !== expectedSize) {
    throw updateError('UPDATE_SIZE_MISMATCH', `Expected ${expectedSize} bytes, got ${stat.size}`);
  }
  if (!expectedSha256 && !expectedSha512) return;

  const sha256 = expectedSha256 ? crypto.createHash('sha256') : null;
  const sha512 = expectedSha512 ? crypto.createHash('sha512') : null;
  let actualSize = 0;
  let handle = null;
  let verifyErr = null;
  try {
    handle = await fs.promises.open(filePath, 'r');
    const buffer = getUpdateVerifyChunkBuffer();
    let position = 0;
    while (true) {
      const result = await handle.read(buffer, 0, buffer.length, position);
      if (!result.bytesRead) break;
      position += result.bytesRead;
      actualSize += result.bytesRead;
      const chunk = result.bytesRead === buffer.length ? buffer : buffer.subarray(0, result.bytesRead);
      if (sha256) sha256.update(chunk);
      if (sha512) sha512.update(chunk);
    }
  } catch (err) {
    verifyErr = err;
  } finally {
    verifyErr = await closeUpdateFileHandle(handle, verifyErr);
  }
  if (verifyErr) throw verifyErr;
  if (expectedSize > 0 && actualSize !== expectedSize) {
    throw updateError('UPDATE_SIZE_MISMATCH', `Expected ${expectedSize} bytes, got ${actualSize}`);
  }
  if (sha256 && sha256.digest('hex') !== expectedSha256) {
    throw updateError('UPDATE_SHA256_MISMATCH', 'Downloaded sha256 mismatch');
  }
  if (sha512) {
    const actual = sha512.digest();
    const actualBase64 = actual.toString('base64');
    const actualHex = actual.toString('hex');
    if (actualBase64 !== expectedSha512 && actualHex !== expectedSha512.toLowerCase()) {
      throw updateError('UPDATE_SHA512_MISMATCH', 'Downloaded sha512 mismatch');
    }
  }
}
function moveInvalidUpdateFile(filePath, reason) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return;
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const invalidPath = path.join(dir, `${base}.invalid-${Date.now()}${ext || '.bin'}`);
    fs.renameSync(filePath, invalidPath);
    console.warn('[UpdateDownload] cached installer moved aside:', reason || 'invalid', invalidPath);
  } catch (e) {
    console.warn('[UpdateDownload] failed to move invalid cached installer:', e.message);
  }
}
function normalizeInstallerReuseIdentity(opts) {
  const rawFilePath = String(opts && opts.filePath || '').trim();
  if (!rawFilePath) return null;
  let rawExpectedSize = 0;
  try { rawExpectedSize = Number(opts && opts.expectedSize); } catch (_) {}
  const expectedSize = Number.isFinite(rawExpectedSize) && rawExpectedSize > 0 ? rawExpectedSize : 0;
  const sha256 = normalizeDigest(opts && opts.sha256 || '', 'sha256').toLowerCase();
  const sha512 = normalizeDigest(opts && opts.sha512 || '', 'sha512');
  if (!expectedSize && !sha256 && !sha512) return null;
  return {
    filePath: path.resolve(rawFilePath),
    version: String(opts && opts.version || ''),
    expectedSize,
    sha256,
    sha512,
  };
}
function installerReuseKey(identity) {
  return JSON.stringify([
    identity.filePath,
    identity.version,
    identity.expectedSize,
    identity.sha256,
    identity.sha512,
  ]);
}
async function reuseVerifiedInstallerJobUnshared(opts, identity) {
  let stat;
  try {
    stat = fs.statSync(identity.filePath);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
  const now = Date.now();
  const job = {
    id: 'cached-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    status: 'ready',
    progress: 100,
    received: stat.size || 0,
    total: identity.expectedSize,
    speedBps: 0,
    etaSeconds: 0,
    sourceLabel: '本地缓存',
    attempt: 0,
    attempts: opts.attempts || 0,
    mode: 'installer',
    message: '安装包已下载，可直接打开安装',
    fileName: opts.fileName || path.basename(identity.filePath),
    filePath: identity.filePath,
    version: identity.version,
    downloadUrl: opts.downloadUrl || '',
    downloadCandidates: opts.downloadCandidates || [],
    expectedSize: identity.expectedSize,
    sha256: identity.sha256,
    sha512: identity.sha512,
    releaseUrl: opts.releaseUrl || '',
    failedAttempts: [],
    cached: true,
    createdAt: now,
    updatedAt: now,
    error: '',
  };
  try {
    await verifyUpdateFile(identity.filePath, job);
    if (!job.total) job.total = stat.size || 0;
    const existing = activeUpdateJobFor(job.version);
    if (existing) return existing;
    updateDownloadJobs.set(job.id, job);
    trimUpdateJobs();
    return job;
  } catch (err) {
    moveInvalidUpdateFile(identity.filePath, (err && err.message) || 'cache verification failed');
    return null;
  }
}
function reuseVerifiedInstallerJob(opts) {
  const identity = normalizeInstallerReuseIdentity(opts);
  if (!identity) return Promise.resolve(null);
  const key = installerReuseKey(identity);
  const existing = installerReusePromises.get(key);
  if (existing) return existing;
  let promise = reuseVerifiedInstallerJobUnshared(opts, identity);
  promise = promise.finally(() => {
    if (installerReusePromises.get(key) === promise) installerReusePromises.delete(key);
  });
  installerReusePromises.set(key, promise);
  return promise;
}
function setUpdateJobError(job, err, fallbackMessage) {
  const info = classifyUpdateError(err);
  job.status = 'error';
  job.error = info.code;
  job.errorReason = info.reason;
  job.errorDetail = info.detail;
  job.message = fallbackMessage || info.reason;
  job.updatedAt = Date.now();
}
/**
 * 把任务落到终态“已取消”，并清理进度数字，避免前端把旧速度当成还在下载。
 * @param {object} job 更新任务。
 * @returns {object} 同一个任务对象。
 */
function markUpdateJobCanceled(job) {
  if (!job) return job;
  job.canceled = true;
  job.status = 'canceled';
  job.error = '';
  job.errorReason = '';
  job.errorDetail = '';
  job.message = '更新已取消';
  job.speedBps = 0;
  job.etaSeconds = 0;
  job.updatedAt = Date.now();
  return job;
}
/**
 * 请求取消一个进行中的更新任务；已完成、已失败或正在写盘的任务不受影响。
 * @param {object} job 更新任务。
 * @returns {{ok: boolean, reason?: string}} 是否受理本次取消。
 */
function cancelUpdateDownloadJob(job) {
  if (!job) return { ok: false, reason: 'UPDATE_JOB_NOT_FOUND' };
  if (job.status === 'canceled') return { ok: true };
  if (job.status === 'ready' || job.status === 'done' || job.status === 'error') {
    return { ok: false, reason: 'UPDATE_JOB_NOT_CANCELABLE' };
  }
  // 补丁已经在写文件或回滚，中途打断会留下半套文件，只能等它自己收尾。
  if (job.applying) return { ok: false, reason: 'UPDATE_JOB_APPLYING' };
  job.canceled = true;
  job.message = '正在取消更新…';
  job.updatedAt = Date.now();
  if (job.cancelController) {
    try { job.cancelController.abort(); } catch (_) {}
  }
  return { ok: true };
}
/**
 * 任务已被取消时抛出统一错误，让下载循环走同一条收尾路径。
 * @param {object} job 更新任务。
 * @returns {void}
 */
function throwIfUpdateJobCanceled(job) {
  if (job && job.canceled) throw updateError('UPDATE_CANCELED', 'Update canceled');
}
/**
 * 给任务挂上取消控制器与线路信息，下载循环和测速都从任务上读这些字段。
 * @param {object} job 更新任务。
 * @param {{route?: string, proxyTarget?: object}=} opts 线路选择结果。
 * @returns {object} 同一个任务对象。
 */
function attachUpdateJobRoute(job, opts) {
  const settings = opts || {};
  const controller = new AbortController();
  job.cancelController = controller;
  job.cancelSignal = controller.signal;
  job.canceled = false;
  job.applying = false;
  job.route = normalizeUpdateRouteMode(settings.route);
  job.routeLabel = updateRouteModeLabel(job.route);
  job.proxyTarget = settings.proxyTarget || null;
  job.proxyLabel = job.proxyTarget ? job.proxyTarget.label : '';
  return job;
}
function isFatalUpdateLocalError(err) {
  const code = String(err && err.code || '').trim();
  const causeCode = String(err && err.cause && err.cause.code || '').trim();
  return /^(?:UPDATE_WRITE_FAILED|UPDATE_LOCAL_IO_FAILED|EACCES|EPERM|ENOSPC|EIO|EBUSY|EROFS|EMFILE|ENFILE|ENOTDIR|EISDIR|ENOENT|ENAMETOOLONG|EEXIST|EXDEV|ENOTEMPTY)$/i.test(code)
    || /^(?:UPDATE_WRITE_FAILED|UPDATE_LOCAL_IO_FAILED|EACCES|EPERM|ENOSPC|EIO|EBUSY|EROFS|EMFILE|ENFILE|ENOTDIR|EISDIR|ENOENT|ENAMETOOLONG|EEXIST|EXDEV|ENOTEMPTY)$/i.test(causeCode);
}
/**
 * 生成当前下载尝试的展示名；代理线路必须显式标出传输方式，避免把 GitHub 目标地址误读成绕过代理。
 * @param {object} job 更新任务，携带已生效的线路标识。
 * @param {object} candidate 当前候选地址及其原始标签。
 * @returns {string} 前端进度条使用的下载来源名称。
 */
function updateDownloadSourceLabel(job, candidate) {
  if (job && job.route === 'proxy') return '本机代理访问 GitHub';
  return candidate && candidate.label || '下载线路';
}
function prepareUpdateJobAttempt(job, candidate, index, total) {
  const expectedSize = Number(job.expectedSize);
  job.status = 'downloading';
  job.sourceLabel = updateDownloadSourceLabel(job, candidate);
  job.attempt = index + 1;
  job.attempts = total;
  job.received = 0;
  job.total = Number.isFinite(expectedSize) && expectedSize > 0 ? expectedSize : 0;
  job.progress = 0;
  job.speedBps = 0;
  job.etaSeconds = 0;
  job.error = '';
  job.errorReason = '';
  job.errorDetail = '';
  job.updatedAt = Date.now();
}
/**
 * 生成代理认证头；无账号密码时返回空对象，避免发出空 Proxy-Authorization。
 * @param {object} proxy 已解析的代理目标。
 * @returns {object} 可直接合并进请求头的对象。
 */
function updateProxyAuthHeaders(proxy) {
  if (!proxy || !proxy.auth) return {};
  return { 'Proxy-Authorization': 'Basic ' + Buffer.from(proxy.auth).toString('base64') };
}
/**
 * 判断是否为需要继续跟随的重定向状态码；GitHub Release 资产必然经过 302 跳转。
 * @param {number} status HTTP 状态码。
 * @returns {boolean} 需要跟随时为 true。
 */
function isUpdateRedirectStatus(status) {
  const code = Number(status) || 0;
  return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
}
/**
 * 通过 HTTP 代理建立到目标主机的 CONNECT 隧道。
 * @param {object} proxy 已解析的代理目标。
 * @param {URL} target 目标地址。
 * @param {AbortSignal=} signal 外部中止信号。
 * @returns {Promise<import('net').Socket>} 已建立隧道的 socket。
 */
function connectUpdateProxyTunnel(proxy, target, signal) {
  return new Promise((resolve, reject) => {
    const targetPort = Number(target.port || (target.protocol === 'https:' ? 443 : 80));
    const authority = target.hostname + ':' + targetPort;
    const transport = proxy.protocol === 'https:' ? https : http;
    const request = transport.request({
      host: proxy.hostname,
      port: proxy.port,
      method: 'CONNECT',
      path: authority,
      agent: false,
      headers: Object.assign({ Host: authority }, updateProxyAuthHeaders(proxy)),
    });
    let settled = false;
    /**
     * 单次结算门：隧道建立与失败路径共用，防止 abort/error/connect 竞争重复结算。
     * @param {Error|null} err 失败原因，成功时为 null。
     * @param {import('net').Socket|null} socket 已建立的 socket。
     * @returns {void}
     */
    function settle(err, socket) {
      if (settled) return;
      settled = true;
      if (signal && typeof signal.removeEventListener === 'function') signal.removeEventListener('abort', onAbort);
      request.removeListener('connect', onConnect);
      if (err) {
        try { request.destroy(); } catch (_) {}
        if (socket) {
          try { socket.destroy(); } catch (_) {}
        }
        reject(err);
        return;
      }
      resolve(socket);
    }
    /** @returns {void} 外部取消时立刻放弃隧道。 */
    function onAbort() {
      settle(updateError('UPDATE_CANCELED', 'Update canceled'), null);
    }
    /**
     * 代理返回 CONNECT 结果。
     * @param {import('http').IncomingMessage} res 代理响应。
     * @param {import('net').Socket} socket 隧道 socket。
     * @returns {void}
     */
    function onConnect(res, socket) {
      if (Number(res.statusCode) !== 200) {
        settle(updateError('UPDATE_PROXY_CONNECT_FAILED', 'Proxy CONNECT returned HTTP ' + res.statusCode), socket);
        return;
      }
      socket.setTimeout(0);
      settle(null, socket);
    }
    if (signal && signal.aborted) {
      settle(updateError('UPDATE_CANCELED', 'Update canceled'), null);
      return;
    }
    if (signal && typeof signal.addEventListener === 'function') signal.addEventListener('abort', onAbort, { once: true });
    request.setTimeout(UPDATE_PROXY_CONNECT_TIMEOUT_MS, () => {
      settle(updateError('UPDATE_PROXY_TIMEOUT', 'Proxy CONNECT timed out'), null);
    });
    request.on('connect', onConnect);
    request.on('error', err => settle(updateError('UPDATE_PROXY_CONNECT_FAILED', 'Proxy connection failed', err), null));
    request.end();
  });
}
/**
 * 把 Node 响应包装成 fetch 风格结果，让代理线路与直连线路共用同一套下载与校验循环。
 * @param {import('http').IncomingMessage} res Node 响应对象。
 * @param {AbortSignal=} signal 外部中止信号，取消时销毁响应与隧道 socket。
 * @param {import('net').Socket=} socket 隧道 socket，取消时一并释放。
 * @returns {object} 具备 ok / status / headers.get / body.getReader 的响应视图。
 */
function nodeResponseAsFetchLike(res, signal, socket) {
  const status = Number(res.statusCode) || 0;
  // 响应头到达后仍要继续跟随取消：Readable.toWeb 不认识 fetch 的 signal，
  // 少了这一段，取消后 TCP 连接会继续把整个安装包拉完。
  if (signal && typeof signal.addEventListener === 'function') {
    /** @returns {void} 取消时销毁响应流与隧道 socket，让读取端立即结束。 */
    const onAbort = () => {
      // 这里不带错误参数销毁：正文可能还没有读取端，带错误会触发无人处理的 'error' 事件。
      // 终态由下载循环的 job.canceled 判定，不依赖流抛出的具体错误。
      try { res.destroy(); } catch (_) {}
      if (socket) {
        try { socket.destroy(); } catch (_) {}
      }
    };
    if (signal.aborted) onAbort();
    else {
      signal.addEventListener('abort', onAbort, { once: true });
      res.on('close', () => {
        if (typeof signal.removeEventListener === 'function') signal.removeEventListener('abort', onAbort);
      });
    }
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      /**
       * 读取响应头，语义与 fetch Headers.get 一致。
       * @param {string} name 头名称。
       * @returns {string|null} 头值，缺失时为 null。
       */
      get(name) {
        const value = res.headers[String(name || '').toLowerCase()];
        if (value == null) return null;
        return Array.isArray(value) ? value.join(', ') : String(value);
      },
    },
    body: Readable.toWeb(res),
  };
}
/**
 * 经由本机代理发起一次更新请求，必要时跟随重定向，返回 fetch 风格响应。
 * @param {object} proxy 已解析的代理目标。
 * @param {string} url 目标地址。
 * @param {object=} options 请求参数，支持 headers 与 signal。
 * @param {number=} depth 当前重定向深度。
 * @returns {Promise<object>} fetch 风格响应。
 */
async function fetchThroughUpdateProxy(proxy, url, options, depth) {
  const hops = Number(depth) || 0;
  if (hops > UPDATE_PROXY_MAX_REDIRECTS) throw updateError('UPDATE_PROXY_TOO_MANY_REDIRECTS', 'Too many proxy redirects');
  const opts = options || {};
  const signal = opts.signal;
  if (signal && signal.aborted) throw updateError('UPDATE_CANCELED', 'Update canceled');
  let target = null;
  try {
    target = new URL(String(url || ''));
  } catch (_) {
    throw updateError('UPDATE_ASSET_MISSING', 'Invalid update download url');
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    throw updateError('UPDATE_ASSET_MISSING', 'Unsupported update download protocol');
  }
  const headers = Object.assign({ Host: target.host }, opts.headers || {});
  let socket = null;
  const response = await new Promise((resolve, reject) => {
    let settled = false;
    let request = null;
    /**
     * 单次结算门：响应、错误与取消路径共用，避免代理请求重复结算或泄漏 socket。
     * @param {Error|null} err 失败原因。
     * @param {import('http').IncomingMessage|null} res Node 响应。
     * @returns {void}
     */
    function settle(err, res) {
      if (settled) return;
      settled = true;
      if (signal && typeof signal.removeEventListener === 'function') signal.removeEventListener('abort', onAbort);
      if (err) {
        if (request) {
          try { request.destroy(); } catch (_) {}
        }
        if (socket) {
          try { socket.destroy(); } catch (_) {}
        }
        reject(err);
        return;
      }
      resolve(res);
    }
    /** @returns {void} 外部取消时中断代理请求。 */
    function onAbort() {
      settle(updateError('UPDATE_CANCELED', 'Update canceled'), null);
    }
    if (signal && typeof signal.addEventListener === 'function') signal.addEventListener('abort', onAbort, { once: true });
    connectUpdateProxyTunnel(proxy, target, signal).then(tunnel => {
      if (settled) {
        try { tunnel.destroy(); } catch (_) {}
        return;
      }
      socket = tunnel;
      const stream = target.protocol === 'https:'
        ? tls.connect({ socket: tunnel, servername: target.hostname, ALPNProtocols: ['http/1.1'] })
        : tunnel;
      stream.on('error', err => settle(updateError('UPDATE_PROXY_STREAM_FAILED', 'Proxy stream failed', err), null));
      request = http.request({
        // 隧道已经完成握手，这里只在既有连接上发普通 HTTP 请求，不再让 Node 重新建连。
        // 绝对不能传 agent: false —— 那会让 Node 新建一个默认 Agent 并忽略 createConnection，
        // 结果是请求跑去连 localhost:80 拿到 ECONNREFUSED。只有不传 agent 时 createConnection 才生效。
        createConnection: () => stream,
        method: opts.method || 'GET',
        path: target.pathname + target.search,
        headers,
      });
      request.on('response', res => settle(null, res));
      request.on('error', err => settle(updateError('UPDATE_PROXY_REQUEST_FAILED', 'Proxy request failed', err), null));
      request.end();
    }).catch(err => settle(err, null));
  });
  if (isUpdateRedirectStatus(response.statusCode) && response.headers.location) {
    const next = new URL(response.headers.location, target).toString();
    response.resume();
    try { response.destroy(); } catch (_) {}
    try { if (socket) socket.destroy(); } catch (_) {}
    return fetchThroughUpdateProxy(proxy, next, options, hops + 1);
  }
  return nodeResponseAsFetchLike(response, signal, socket);
}
function ensureMirrorCanBeVerified(job, candidate) {
  if (!candidate || !candidate.mirrored) return;
  if (job.sha256 || job.sha512) return;
  throw updateError('MIRROR_HASH_MISSING', 'Mirror download skipped because no digest is available');
}
/**
 * 统一的更新请求出口：默认直连，任务选定本机代理时改走 CONNECT 隧道，返回同一套 fetch 风格响应。
 * 测速、完整安装包和快速补丁都必须经过这里，避免线路选择在不同下载路径上分叉。
 * @param {object} job 当前更新任务，携带已解析的代理目标。
 * @param {string} url 请求地址。
 * @param {object} options fetch 请求参数。
 * @returns {Promise<object>} fetch 风格响应。
 */
function openUpdateRouteResponse(job, url, options) {
  const proxy = job && job.proxyTarget;
  if (!proxy) return fetch(url, options);
  return fetchThroughUpdateProxy(proxy, url, options);
}
/**
 * 把任务级取消信号接到单次请求的中止控制器上，取消更新时正在跑的请求立刻断开。
 * @param {object} job 当前更新任务。
 * @param {AbortController} controller 当次请求的中止控制器。
 * @returns {Function|null} 解绑函数，无取消信号时为 null。
 */
function linkUpdateJobCancel(job, controller) {
  const signal = job && job.cancelSignal;
  if (!signal || typeof signal.addEventListener !== 'function') return null;
  /** @returns {void} 任务被取消时中止当次请求。 */
  function onCancel() {
    controller.abort();
  }
  signal.addEventListener('abort', onCancel, { once: true });
  return function unlinkUpdateJobCancel() {
    if (typeof signal.removeEventListener === 'function') signal.removeEventListener('abort', onCancel);
  };
}
/**
 * 把更新任务切换到线路测速状态，前端轮询时可明确显示自动选线进度。
 * @param {object} job 当前更新任务。
 * @param {number} total 候选线路总数。
 * @returns {void} 直接修改任务状态。
 */
function prepareUpdateRouteSelection(job, total) {
  job.status = 'downloading';
  // 非自动线路也可能有多条镜像候选，测速标签跟随任务选定的线路，避免前端误报“自动测速”。
  job.sourceLabel = job.route && job.route !== 'auto' ? ((job.routeLabel || '当前线路') + '测速') : '自动测速';
  job.attempt = 0;
  job.attempts = total;
  job.received = 0;
  job.progress = 0;
  job.speedBps = 0;
  job.etaSeconds = 0;
  job.error = '';
  job.errorReason = '';
  job.errorDetail = '';
  job.message = '正在测速更新线路';
  job.updatedAt = Date.now();
}
/**
 * 生成成功的线路测速结果，使完整样本与超时前部分样本使用同一计算口径。
 * @param {object} candidate 已完成测速的候选线路。
 * @param {number} index 候选在原始顺序中的位置。
 * @param {number} received 测速窗口内收到的字节数。
 * @param {number} startedAt 测速开始时间戳。
 * @returns {object} 可参与线路排序的测速结果。
 */
function successfulUpdateRouteProbe(candidate, index, received, startedAt) {
  const elapsedMs = Math.max(1, Date.now() - startedAt);
  return {
    candidate,
    index,
    ok: true,
    speedBps: Math.round((received * 1000) / elapsedMs),
    elapsedMs,
  };
}
/**
 * 比较两条成功线路的测速结果，优先吞吐量，其次耗时，最后保持原始稳定顺序。
 * @param {object} left 左侧测速结果。
 * @param {object} right 右侧测速结果。
 * @returns {number} Array.sort 使用的比较值。
 */
function compareUpdateRouteProbeResults(left, right) {
  return right.speedBps - left.speedBps
    || left.elapsedMs - right.elapsedMs
    || left.index - right.index;
}
/**
 * 读取候选线路的固定首段并计算包含连接耗时的实际吞吐量。
 * @param {object} job 当前更新任务，用于执行镜像摘要门禁。
 * @param {object} candidate 待测速的下载候选。
 * @param {number} index 候选在原始顺序中的位置。
 * @returns {Promise<object>} 包含成功状态、实测速率和原始位置的测速结果。
 */
async function probeUpdateDownloadCandidate(job, candidate, index) {
  const startedAt = Date.now();
  let controller = null;
  let timer = null;
  let reader = null;
  let received = 0;
  let probeTimedOut = false;
  let unlinkCancel = null;
  try {
    ensureMirrorCanBeVerified(job, candidate);
    if (job && job.canceled) throw updateError('UPDATE_CANCELED', 'Update canceled');
    controller = new AbortController();
    unlinkCancel = linkUpdateJobCancel(job, controller);
    /**
     * 结束超过统一测速窗口的请求；已收到的样本仍由外层按实测速率保留。
     * @returns {void} 中止当前候选线路请求。
     */
    function abortSlowUpdateRouteProbe() {
      probeTimedOut = true;
      controller.abort();
    }
    timer = setTimeout(abortSlowUpdateRouteProbe, UPDATE_ROUTE_PROBE_TIMEOUT_MS);
    const resp = await openUpdateRouteResponse(job, candidate.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': `Mineradio/${APP_VERSION}`,
        Range: `bytes=0-${UPDATE_ROUTE_PROBE_BYTES - 1}`,
      },
    });
    if (!resp.ok) throw updateError('HTTP_' + resp.status, 'HTTP ' + resp.status);
    if (!resp.body || typeof resp.body.getReader !== 'function') {
      throw updateError('UPDATE_EMPTY_RESPONSE', 'Update route probe has no readable body');
    }
    reader = resp.body.getReader();
    while (received < UPDATE_ROUTE_PROBE_BYTES) {
      // 测速样本是有界的，但取消后没必要把剩下的首段读完。
      if (job && job.canceled) break;
      const chunk = await reader.read();
      if (chunk.done) break;
      const chunkBytes = Number(chunk.value && chunk.value.byteLength || 0);
      received += Math.min(chunkBytes, UPDATE_ROUTE_PROBE_BYTES - received);
    }
    if (!received) throw updateError('UPDATE_EMPTY_RESPONSE', 'Update route probe returned no bytes');
    return successfulUpdateRouteProbe(candidate, index, received, startedAt);
  } catch (err) {
    if (probeTimedOut && received > 0) {
      return successfulUpdateRouteProbe(candidate, index, received, startedAt);
    }
    const info = classifyUpdateError(err);
    return {
      candidate,
      index,
      ok: false,
      speedBps: 0,
      elapsedMs: Math.max(1, Date.now() - startedAt),
      error: info,
    };
  } finally {
    if (unlinkCancel) unlinkCancel();
    if (timer) clearTimeout(timer);
    if (reader) {
      try { await reader.cancel(); } catch (_) {}
    }
    if (controller) controller.abort();
  }
}
/**
 * 并行测速全部候选线路，把实测最快线路放在首位，并保留失败线路作为后续兜底。
 * @param {object} job 当前更新任务。
 * @param {object[]} candidates 原始候选线路。
 * @returns {Promise<object[]>} 按实测速度排序后的候选线路。
 */
async function rankUpdateDownloadCandidates(job, candidates) {
  const list = Array.isArray(candidates) ? candidates.slice() : [];
  if (list.length < 2) return list;
  prepareUpdateRouteSelection(job, list.length);
  const probePromises = [];
  for (let i = 0; i < list.length; i++) {
    probePromises.push(probeUpdateDownloadCandidate(job, list[i], i));
  }
  const results = await Promise.all(probePromises);
  // 取消发生在测速阶段时不再重排线路，交给下载循环立刻收尾。
  if (job && job.canceled) return list;
  const successful = [];
  const failed = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].ok) successful.push(results[i]);
    else failed.push(results[i]);
  }
  if (!successful.length) return list;
  successful.sort(compareUpdateRouteProbeResults);
  const ordered = [];
  for (let i = 0; i < successful.length; i++) ordered.push(successful[i].candidate);
  for (let i = 0; i < failed.length; i++) ordered.push(failed[i].candidate);
  return ordered;
}
async function downloadUpdateAssetWithMirrors(job) {
  const tmpPath = job.filePath + '.download';
  const allCandidates = Array.isArray(job.downloadCandidates) && job.downloadCandidates.length
    ? job.downloadCandidates
    : uniqueDownloadCandidates(job.downloadUrl || '');
  if (!allCandidates.length) throw updateError('UPDATE_ASSET_MISSING', 'No usable installer download candidate');
  const rawCandidates = filterUpdateRouteCandidates(allCandidates, job.route);
  if (!rawCandidates.length) throw updateError('UPDATE_ROUTE_UNAVAILABLE', 'No download candidate for route ' + (job.route || 'auto'));
  throwIfUpdateJobCanceled(job);
  const candidates = await rankUpdateDownloadCandidates(job, rawCandidates);
  const failures = [];
  fs.mkdirSync(UPDATE_DOWNLOAD_DIR, { recursive: true });
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      throwIfUpdateJobCanceled(job);
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
      ensureMirrorCanBeVerified(job, candidate);
      prepareUpdateJobAttempt(job, candidate, i, candidates.length);
      job.message = job.total ? '正在下载完整安装包' : '正在下载完整安装包，等待服务器返回大小';

      const idleGuard = createUpdateDownloadIdleGuard(UPDATE_DOWNLOAD_IDLE_TIMEOUT_MS, job.cancelSignal);
      idleGuard.touch(12000);
      const expectedSha256 = normalizeDigest(job.sha256 || '', 'sha256').toLowerCase();
      const expectedSha512 = normalizeDigest(job.sha512 || '', 'sha512');
      const sha256 = expectedSha256 ? crypto.createHash('sha256') : null;
      const sha512 = expectedSha512 ? crypto.createHash('sha512') : null;
      try {
        const resp = await openUpdateRouteResponse(job, candidate.url, {
          signal: idleGuard.signal,
          headers: { 'User-Agent': `Mineradio/${APP_VERSION}` },
        });
        if (!resp.ok) throw updateError('HTTP_' + resp.status, 'HTTP ' + resp.status);

        idleGuard.touch();
        const totalHeader = parseInt(resp.headers.get('content-length') || '0', 10) || 0;
        const expectedSize = job.total;
        if (expectedSize > 0 && totalHeader > 0 && totalHeader !== expectedSize) {
          throw updateError('UPDATE_SIZE_MISMATCH', `Expected ${expectedSize} bytes, response declared ${totalHeader}`);
        }
        if (!expectedSize && totalHeader > UPDATE_INSTALLER_MAX_BYTES) {
          throw updateError('UPDATE_SIZE_MISMATCH', `Installer exceeds ${UPDATE_INSTALLER_MAX_BYTES} byte safety limit`);
        }
        job.total = expectedSize || totalHeader;
        job.updatedAt = Date.now();
        let speedWindowAt = Date.now();
        let speedWindowBytes = 0;
        const maxBytes = expectedSize || totalHeader || UPDATE_INSTALLER_MAX_BYTES;

        if (!resp.body || typeof resp.body.getReader !== 'function') {
          throw updateError('UPDATE_EMPTY_RESPONSE', 'Installer response has no readable body');
        }
        const reader = resp.body.getReader();
        let fileHandle = null;
        let readComplete = false;
        let streamErr = null;
        try {
          fileHandle = await fs.promises.open(tmpPath, 'w');
          while (true) {
            idleGuard.touch();
            // 逐块检查取消，取消必须与传输实现无关：代理线路的响应体来自 Readable.toWeb，
            // 只依赖 fetch signal 会让取消后正文继续流下去，任务停不下来。
            throwIfUpdateJobCanceled(job);
            const chunk = await reader.read();
            if (chunk.done) {
              readComplete = true;
              break;
            }
            idleGuard.touch();
            throwIfUpdateJobCanceled(job);
            const buf = Buffer.from(chunk.value);
            job.received += buf.length;
            if (job.received > maxBytes) {
              throw updateError('UPDATE_SIZE_MISMATCH', `Installer exceeded ${maxBytes} byte limit`);
            }
            if (sha256) sha256.update(buf);
            if (sha512) sha512.update(buf);
            speedWindowBytes += buf.length;
            const now = Date.now();
            if (now - speedWindowAt >= 900) {
              job.speedBps = Math.round(speedWindowBytes / Math.max(0.001, (now - speedWindowAt) / 1000));
              speedWindowAt = now;
              speedWindowBytes = 0;
            }
            if (job.total > 0) {
              job.progress = Math.max(1, Math.min(99, Math.round((job.received / job.total) * 100)));
              job.etaSeconds = job.speedBps > 0 ? Math.max(0, Math.round((job.total - job.received) / job.speedBps)) : 0;
            } else {
              const kb = Math.max(1, job.received / 1024);
              job.progress = Math.max(1, Math.min(88, Math.round(Math.log10(kb + 1) * 24)));
            }
            job.message = job.total > 0 ? '正在下载完整安装包' : '正在下载完整安装包，服务器未提供总大小';
            job.updatedAt = Date.now();
            let offset = 0;
            while (offset < buf.length) {
              const result = await fileHandle.write(buf, offset, buf.length - offset, null);
              if (!result.bytesWritten) throw updateError('UPDATE_WRITE_FAILED', 'Installer write returned zero bytes');
              offset += result.bytesWritten;
            }
          }
        } catch (err) {
          streamErr = err;
        } finally {
          if (!readComplete) await reader.cancel().catch(() => {});
          streamErr = await closeUpdateFileHandle(fileHandle, streamErr);
          fileHandle = null;
        }
        if (streamErr) throw streamErr;
      } finally {
        idleGuard.clear();
      }

      // 下载过程中已流式累计摘要，避免完整安装包二次整文件读盘校验。
      verifyStreamedUpdatePayload(job, job.received, sha256, sha512);
      if (fs.existsSync(job.filePath)) fs.unlinkSync(job.filePath);
      fs.renameSync(tmpPath, job.filePath);
      job.status = 'ready';
      job.progress = 100;
      job.etaSeconds = 0;
      job.message = '安装包已下载';
      job.updatedAt = Date.now();
      return;
    } catch (err) {
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
      // 用户取消要立刻收尾，不再换线、不写失败线路列表。
      if (job.canceled) {
        markUpdateJobCanceled(job);
        return;
      }
      const info = classifyUpdateError(err);
      failures.push({ source: candidate.label || '下载线路', reason: info.reason, detail: info.detail });
      job.failedAttempts = failures.slice(-6);
      if (isFatalUpdateLocalError(err)) {
        if (err && typeof err === 'object') err.fatalUpdate = true;
        setUpdateJobError(job, err, info.reason);
        return;
      }
      job.message = i < candidates.length - 1 ? ((candidate.label || '当前线路') + '失败，正在切换线路') : info.reason;
      job.updatedAt = Date.now();
      if (i >= candidates.length - 1) setUpdateJobError(job, err, '下载失败：' + info.reason);
    }
  }
}
async function startUpdateDownloadJob(info, opts) {
  const release = info && info.release ? info.release : {};
  const asset = release.asset || {};
  const downloadUrl = release.downloadUrl || asset.downloadUrl || '';
  if (!info || !info.configured) return { ok: false, error: 'UPDATE_REPOSITORY_NOT_CONFIGURED' };
  if (!info.updateAvailable) return { ok: false, error: 'NO_UPDATE_AVAILABLE' };
  if (!/^https?:\/\//i.test(downloadUrl)) return { ok: false, error: 'UPDATE_ASSET_MISSING' };

  const version = info.latestVersion || release.version || '';
  const existing = activeUpdateJobFor(version);
  if (existing) return publicUpdateJob(existing);

  const settings = opts || {};
  const route = normalizeUpdateRouteMode(settings.route);
  let proxyTarget = null;
  if (route === 'proxy') {
    proxyTarget = await resolveUpdateProxyTarget(settings.proxy, downloadUrl);
    if (!proxyTarget) return { ok: false, error: 'UPDATE_PROXY_NOT_CONFIGURED' };
  }

  const fileName = safeUpdateFileName(asset.name || '', version);
  const filePath = path.join(UPDATE_DOWNLOAD_DIR, fileName);
  const downloadCandidates = uniqueDownloadCandidates(downloadCandidateInputs(downloadUrl, asset), {
    useMirrors: route !== 'direct' && route !== 'proxy',
  });
  const routeCandidates = filterUpdateRouteCandidates(downloadCandidates, route);
  if (!routeCandidates.length) return { ok: false, error: 'UPDATE_ROUTE_UNAVAILABLE' };
  const expectedSize = asset.size || 0;
  const sha256 = normalizeDigest(asset.sha256 || '', 'sha256').toLowerCase();
  const sha512 = normalizeDigest(asset.sha512 || '', 'sha512');
  const cached = await reuseVerifiedInstallerJob({
    fileName,
    filePath,
    version,
    downloadUrl,
    downloadCandidates,
    expectedSize,
    sha256,
    sha512,
    releaseUrl: release.htmlUrl || '',
    attempts: routeCandidates.length,
  });
  if (cached) return publicUpdateJob(cached);
  const current = activeUpdateJobFor(version);
  if (current) return publicUpdateJob(current);

  const now = Date.now();
  const job = {
    id: now.toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    status: 'queued',
    progress: 0,
    received: 0,
    total: expectedSize,
    mode: 'installer',
    fileName,
    filePath,
    version,
    downloadUrl,
    downloadCandidates,
    expectedSize,
    sha256,
    sha512,
    releaseUrl: release.htmlUrl || '',
    sourceLabel: '',
    attempt: 0,
    attempts: routeCandidates.length,
    failedAttempts: [],
    createdAt: now,
    updatedAt: now,
    error: '',
  };
  attachUpdateJobRoute(job, { route, proxyTarget });
  updateDownloadJobs.set(job.id, job);
  trimUpdateJobs();
  void downloadUpdateAssetWithMirrors(job).catch(err => {
    if (job.canceled) {
      markUpdateJobCanceled(job);
      return;
    }
    const info = classifyUpdateError(err);
    setUpdateJobError(job, err, '下载失败：' + info.reason);
  });
  return publicUpdateJob(job);
}
function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
function safePatchRelativePath(value) {
  const rel = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!rel || rel.includes('\0')) return '';
  const parts = rel.split('/').filter(Boolean);
  if (!parts.length || parts.some(part => part === '..' || part === '.')) return '';
  const root = parts[0];
  if (PATCH_ALLOWED_FILES.has(rel)) return rel;
  if (!PATCH_ALLOWED_ROOTS.has(root)) return '';
  if (/\.(exe|dll|node|msi|bat|cmd|ps1|pfx|pem|key)$/i.test(rel)) return '';
  return parts.join('/');
}
function patchTargetPath(rel) {
  const safeRel = safePatchRelativePath(rel);
  if (!safeRel) return null;
  const target = path.resolve(APP_ROOT, safeRel);
  const root = path.resolve(APP_ROOT);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}
function decodePatchFile(file) {
  if (!file || typeof file !== 'object') return null;
  if (typeof file.contentBase64 === 'string') return Buffer.from(file.contentBase64, 'base64');
  if (typeof file.content === 'string') return Buffer.from(file.content, file.encoding === 'base64' ? 'base64' : 'utf8');
  return null;
}
function preparePatchFileEntries(files) {
  const entries = [];
  const seen = new Set();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const rel = safePatchRelativePath(file && (file.path || file.name));
    const target = rel ? patchTargetPath(rel) : null;
    const content = decodePatchFile(file);
    if (!rel || !target || !content) throw new Error('INVALID_PATCH_FILE');
    if (/\.(?:mineradio-patch|mineradio-rollback)$/i.test(rel)) throw new Error('PATCH_RESERVED_PATH:' + rel);
    const key = rel.toLowerCase();
    if (seen.has(key)) throw new Error('PATCH_DUPLICATE_FILE:' + rel);
    seen.add(key);
    if (content.length > PATCH_MAX_BYTES) throw new Error('PATCH_FILE_TOO_LARGE');
    const expected = normalizeDigest(file.sha256 || '', 'sha256').toLowerCase();
    if (expected && sha256Hex(content) !== expected) throw new Error('PATCH_HASH_MISMATCH:' + rel);
    entries.push({ rel, target, content, expected, originalExists: false, backupPath: '', replaced: false });
  }
  return entries;
}
/**
 * 删除某次补丁任务的备份目录。补丁成功应用或失败回滚完成后，`job.id` 下的原文件备份不再需要，
 * 若不清理会随每次快速补丁升级在 updates/backups/patches 下无限累积（单份 index.html 备份约 2MB）。
 * 清理失败只记录、不影响更新结果，因为备份此刻已无回滚价值。
 * @param {object} job 补丁更新任务，需含唯一 id。
 * @returns {void}
 */
function removePatchBackupDir(job) {
  if (!job || !job.id) return;
  const dir = path.join(UPDATE_PATCH_BACKUP_DIR, job.id);
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    console.warn('[update] failed to clean patch backup dir:', dir, err && err.message || err);
  }
}
function backupPatchFileEntries(job, entries) {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    entry.originalExists = fs.existsSync(entry.target);
    if (!entry.originalExists) continue;
    entry.backupPath = path.join(UPDATE_PATCH_BACKUP_DIR, job.id, entry.rel);
    fs.mkdirSync(path.dirname(entry.backupPath), { recursive: true });
    fs.copyFileSync(entry.target, entry.backupPath);
  }
}
function writePatchFileEntry(entry) {
  fs.mkdirSync(path.dirname(entry.target), { recursive: true });
  const tmp = entry.target + '.mineradio-patch';
  try {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    fs.writeFileSync(tmp, entry.content);
    fs.renameSync(tmp, entry.target);
    entry.replaced = true;
    if (entry.expected && sha256Hex(fs.readFileSync(entry.target)) !== entry.expected) {
      throw new Error('PATCH_WRITE_VERIFY_FAILED:' + entry.rel);
    }
  } finally {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
  }
}
function rollbackPatchFileEntries(entries) {
  const failures = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const tmp = entry.target + '.mineradio-patch';
    const rollbackTmp = entry.target + '.mineradio-rollback';
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      if (fs.existsSync(rollbackTmp)) fs.unlinkSync(rollbackTmp);
      if (!entry.replaced) continue;
      if (entry.originalExists) {
        if (!entry.backupPath || !fs.existsSync(entry.backupPath)) throw new Error('PATCH_BACKUP_MISSING');
        fs.mkdirSync(path.dirname(entry.target), { recursive: true });
        fs.copyFileSync(entry.backupPath, rollbackTmp);
        fs.renameSync(rollbackTmp, entry.target);
      } else if (fs.existsSync(entry.target)) {
        fs.unlinkSync(entry.target);
      }
    } catch (err) {
      failures.push(entry.rel + ': ' + (err && err.message || err));
    } finally {
      try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
      try { if (fs.existsSync(rollbackTmp)) fs.unlinkSync(rollbackTmp); } catch (_) {}
    }
  }
  if (failures.length) throw updateError('PATCH_ROLLBACK_FAILED', failures.join('; '));
}
function applyPatchFiles(job, files) {
  const entries = preparePatchFileEntries(files);
  try {
    backupPatchFileEntries(job, entries);
  } catch (err) {
    if (err && typeof err === 'object') err.fatalUpdate = true;
    throw err;
  }
  const changed = [];
  try {
    for (let i = 0; i < entries.length; i++) {
      writePatchFileEntry(entries[i]);
      changed.push(entries[i].rel);
    }
    removePatchBackupDir(job);
    return changed;
  } catch (err) {
    try {
      rollbackPatchFileEntries(entries);
    } catch (rollbackErr) {
      const fatal = updateError(
        'PATCH_ROLLBACK_FAILED',
        (err && err.message || err) + '; rollback: ' + (rollbackErr && rollbackErr.message || rollbackErr),
        err
      );
      fatal.fatalUpdate = true;
      throw fatal;
    }
    removePatchBackupDir(job);
    if (err && typeof err === 'object') err.fatalUpdate = true;
    throw err;
  }
}
function normalizePatchPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('INVALID_PATCH_PAYLOAD');
  const type = String(payload.type || payload.kind || '');
  if (type && type !== 'mineradio-resource-patch') throw new Error('UNSUPPORTED_PATCH_TYPE');
  const from = normalizeVersion(payload.from || payload.baseVersion || '');
  const to = normalizeVersion(payload.to || payload.version || payload.targetVersion || '');
  const files = Array.isArray(payload.files) ? payload.files : [];
  if (!from || compareVersions(from, APP_VERSION) !== 0) throw new Error('PATCH_VERSION_MISMATCH');
  if (!to || compareVersions(to, APP_VERSION) <= 0) throw new Error('PATCH_TARGET_VERSION_INVALID');
  if (!files.length) throw new Error('PATCH_EMPTY');
  if (files.length > 40) throw new Error('PATCH_TOO_MANY_FILES');
  return { from, to, files, restartRequired: payload.restartRequired !== false };
}
async function downloadPatchBufferFromCandidate(job, candidate, index, total) {
  throwIfUpdateJobCanceled(job);
  ensureMirrorCanBeVerified(job, candidate);
  prepareUpdateJobAttempt(job, candidate, index, total);
  job.mode = 'patch';
  job.message = '正在下载快速补丁';
  job.progress = 0;
  job.updatedAt = Date.now();

  const idleGuard = createUpdateDownloadIdleGuard(UPDATE_DOWNLOAD_IDLE_TIMEOUT_MS, job.cancelSignal);
  idleGuard.touch(12000);
  try {
    const resp = await openUpdateRouteResponse(job, candidate.url, {
      signal: idleGuard.signal,
      headers: { 'User-Agent': `Mineradio/${APP_VERSION}` },
    });
    if (!resp.ok) throw updateError('HTTP_' + resp.status, 'HTTP ' + resp.status);

    idleGuard.touch();
    const totalHeader = parseInt(resp.headers.get('content-length') || '0', 10) || 0;
    const expectedSize = job.total;
    if (expectedSize > 0 && totalHeader > 0 && totalHeader !== expectedSize) {
      throw updateError('UPDATE_SIZE_MISMATCH', `Expected ${expectedSize} bytes, response declared ${totalHeader}`);
    }
    if (totalHeader > PATCH_MAX_BYTES) throw updateError('PATCH_TOO_LARGE', 'Patch package is too large');
    job.total = expectedSize || totalHeader;
    job.received = 0;
    const chunks = [];
    if (!resp.body || typeof resp.body.getReader !== 'function') {
      throw updateError('UPDATE_EMPTY_RESPONSE', 'Patch response has no readable body');
    }
    const reader = resp.body.getReader();
    let speedWindowAt = Date.now();
    let speedWindowBytes = 0;
    let readComplete = false;
    try {
      while (true) {
        idleGuard.touch();
        // 与完整安装包一致：逐块检查取消，不依赖具体传输是否响应 abort 信号。
        throwIfUpdateJobCanceled(job);
        const chunk = await reader.read();
        if (chunk.done) {
          readComplete = true;
          break;
        }
        idleGuard.touch();
        throwIfUpdateJobCanceled(job);
        const buf = Buffer.from(chunk.value);
        job.received += buf.length;
        speedWindowBytes += buf.length;
        if (job.received > PATCH_MAX_BYTES) throw updateError('PATCH_TOO_LARGE', 'Patch package is too large');
        chunks.push(buf);
        const now = Date.now();
        if (now - speedWindowAt >= 700) {
          job.speedBps = Math.round(speedWindowBytes / Math.max(0.001, (now - speedWindowAt) / 1000));
          speedWindowAt = now;
          speedWindowBytes = 0;
        }
        job.progress = job.total > 0
          ? Math.max(1, Math.min(84, Math.round((job.received / job.total) * 84)))
          : Math.max(1, Math.min(76, Math.round(Math.log10(job.received / 1024 + 1) * 24)));
        job.etaSeconds = job.total > 0 && job.speedBps > 0 ? Math.max(0, Math.round((job.total - job.received) / job.speedBps)) : 0;
        job.updatedAt = Date.now();
      }
    } finally {
      if (!readComplete) await reader.cancel().catch(() => {});
    }
    const raw = Buffer.concat(chunks);
    verifyUpdateBuffer(raw, job);
    return raw;
  } finally {
    idleGuard.clear();
  }
}
async function downloadAndApplyPatchWithMirrors(job) {
  const allCandidates = Array.isArray(job.downloadCandidates) && job.downloadCandidates.length
    ? job.downloadCandidates
    : uniqueDownloadCandidates(job.downloadUrl || '');
  if (!allCandidates.length) throw updateError('PATCH_ASSET_MISSING', 'No usable patch download candidate');
  const rawCandidates = filterUpdateRouteCandidates(allCandidates, job.route);
  if (!rawCandidates.length) throw updateError('UPDATE_ROUTE_UNAVAILABLE', 'No patch candidate for route ' + (job.route || 'auto'));
  throwIfUpdateJobCanceled(job);
  const candidates = await rankUpdateDownloadCandidates(job, rawCandidates);
  const failures = [];
  fs.mkdirSync(UPDATE_DOWNLOAD_DIR, { recursive: true });
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const raw = await downloadPatchBufferFromCandidate(job, candidate, i, candidates.length);
      throwIfUpdateJobCanceled(job);
      const patch = normalizePatchPayload(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, '')));
      job.version = patch.to;
      job.message = '正在应用快速补丁';
      job.progress = 88;
      job.etaSeconds = 0;
      job.updatedAt = Date.now();
      // 进入写盘阶段后不能再被取消，否则会留下半套文件。
      job.applying = true;
      try {
        job.changedFiles = applyPatchFiles(job, patch.files);
      } finally {
        job.applying = false;
      }
      job.status = 'ready';
      job.progress = 100;
      job.restartRequired = patch.restartRequired;
      job.message = patch.restartRequired ? '快速补丁已应用，重启后生效' : '快速补丁已应用';
      job.updatedAt = Date.now();
      return;
    } catch (err) {
      // 用户取消要立刻收尾，不再换线、不写失败线路列表。
      if (job.canceled) {
        markUpdateJobCanceled(job);
        return;
      }
      const info = classifyUpdateError(err);
      failures.push({ source: candidate.label || '下载线路', reason: info.reason, detail: info.detail });
      job.failedAttempts = failures.slice(-6);
      if (err && err.fatalUpdate) {
        setUpdateJobError(job, err, info.reason);
        return;
      }
      job.message = i < candidates.length - 1 ? ((candidate.label || '当前线路') + '失败，正在切换线路') : info.reason;
      job.updatedAt = Date.now();
      if (i >= candidates.length - 1) setUpdateJobError(job, err, '快速补丁失败：' + info.reason);
    }
  }
}
async function startUpdatePatchJob(info, opts) {
  const release = info && info.release ? info.release : {};
  const patch = release.patch || {};
  const downloadUrl = patch.downloadUrl || '';
  if (!info || !info.configured) return { ok: false, error: 'UPDATE_REPOSITORY_NOT_CONFIGURED' };
  if (!info.updateAvailable) return { ok: false, error: 'NO_UPDATE_AVAILABLE' };
  if (!release.patchAvailable || !/^https?:\/\//i.test(downloadUrl)) return { ok: false, error: 'PATCH_ASSET_MISSING' };

  const version = info.latestVersion || release.version || patch.to || '';
  const existing = latestUpdateDownloadJob(job => job.mode === 'patch' && job.version === version && isActiveUpdateJob(job));
  if (existing) return publicUpdateJob(existing);

  const settings = opts || {};
  const route = normalizeUpdateRouteMode(settings.route);
  let proxyTarget = null;
  if (route === 'proxy') {
    proxyTarget = await resolveUpdateProxyTarget(settings.proxy, downloadUrl);
    if (!proxyTarget) return { ok: false, error: 'UPDATE_PROXY_NOT_CONFIGURED' };
  }

  const now = Date.now();
  const downloadCandidates = uniqueDownloadCandidates(downloadCandidateInputs(downloadUrl, patch), {
    useMirrors: route !== 'direct' && route !== 'proxy',
  });
  const routeCandidates = filterUpdateRouteCandidates(downloadCandidates, route);
  if (!routeCandidates.length) return { ok: false, error: 'UPDATE_ROUTE_UNAVAILABLE' };
  const job = {
    id: 'patch-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    status: 'queued',
    progress: 0,
    received: 0,
    total: patch.size || 0,
    mode: 'patch',
    fileName: patch.name || safeUpdateFileName('', version).replace(/\.exe$/i, '.patch.json'),
    filePath: '',
    version,
    downloadUrl,
    downloadCandidates,
    releaseUrl: release.htmlUrl || '',
    expectedSize: patch.size || 0,
    sha256: normalizeDigest(patch.sha256 || '', 'sha256').toLowerCase(),
    sha512: normalizeDigest(patch.sha512 || '', 'sha512'),
    restartRequired: true,
    sourceLabel: '',
    attempt: 0,
    attempts: routeCandidates.length,
    failedAttempts: [],
    message: '等待下载快速补丁',
    createdAt: now,
    updatedAt: now,
    error: '',
  };
  attachUpdateJobRoute(job, { route, proxyTarget });
  updateDownloadJobs.set(job.id, job);
  trimUpdateJobs();
  void downloadAndApplyPatchWithMirrors(job).catch(err => {
    if (job.canceled) {
      markUpdateJobCanceled(job);
      return;
    }
    const info = classifyUpdateError(err);
    setUpdateJobError(job, err, '快速补丁失败：' + info.reason);
  });
  return publicUpdateJob(job);
}
/**
 * 读取并解析请求体（JSON 优先，失败回退表单编码）。
 * 请求体超过 8MB 上限时销毁连接并以 REQUEST_BODY_TOO_LARGE 拒绝（Fail-Fast）。
 * 契约：promise 必须在 end/error/close 任一终止路径上恰好结算一次；`req.destroy()` 不会触发 end，
 * 若仅监听 end/error 会在超限或客户端中断时泄漏请求而永不响应，因此必须同时兜底 close。
 * @param {import('http').IncomingMessage} req 入站请求。
 * @returns {Promise<object>} 解析后的请求体对象。
 */
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let settled = false;
    // 单次结算门：无论哪条流事件先到（end/error/close）都只能 resolve/reject 一次，防止连接悬挂与重复回调。
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    req.on('data', chunk => {
      if (settled) return;
      raw += chunk;
      if (raw.length > 8 * 1024 * 1024) {
        const err = new Error('REQUEST_BODY_TOO_LARGE');
        err.code = 'REQUEST_BODY_TOO_LARGE';
        // 先置位再销毁：destroy() 只触发 close/aborted 而非 end，必须在此处主动结算。
        settle(reject, err);
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) { settle(resolve, {}); return; }
      try { settle(resolve, JSON.parse(raw)); }
      catch (e) {
        const params = new URLSearchParams(raw);
        const out = {};
        params.forEach((v, k) => { out[k] = v; });
        settle(resolve, out);
      }
    });
    req.on('error', () => settle(resolve, {}));
    // 兜底：流在未正常 end 就关闭（客户端中断等）时仍需结算，避免处理器永久挂起。
    req.on('close', () => settle(resolve, {}));
  });
}
// ====================================================================
//  HTTP Server
// ====================================================================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  const pn = url.pathname;

  if (pn === '/api/app/version') {
    sendJSON(res, {
      name: APP_PACKAGE.name || 'mineradio',
      productName: APP_PACKAGE.productName || 'Mineradio',
      version: APP_VERSION,
      update: {
        provider: UPDATE_CONFIG.provider,
        configured: UPDATE_CONFIG.configured,
        owner: UPDATE_CONFIG.owner,
        repo: UPDATE_CONFIG.repo,
        preview: UPDATE_CONFIG.preview,
        manifestOverride: !!UPDATE_CONFIG.manifest,
      },
    });
    return;
  }

  if (pn === '/api/update/latest') {
    try {
      const force = url.searchParams.get('force') === '1' || url.searchParams.get('refresh') === '1';
      sendJSON(res, await fetchLatestUpdateInfo({ force }));
    } catch (err) {
      sendJSON(res, {
        ...localUpdateFallback(err.message || 'Update check failed', { configured: UPDATE_CONFIG.configured }),
        error: err.message || 'Update check failed',
      });
    }
    return;
  }

  if (pn === '/api/update/routes') {
    const mirrors = Array.isArray(UPDATE_CONFIG.mirrors) ? UPDATE_CONFIG.mirrors : [];
    let proxyLabel = '';
    try {
      const proxy = await resolveUpdateProxyTarget('', githubReleaseDownloadUrl(APP_VERSION, 'latest.yml'));
      if (proxy) proxyLabel = proxy.label;
    } catch (_) {}
    sendJSON(res, {
      ok: true,
      routes: UPDATE_ROUTE_MODES.map(mode => ({
        mode,
        label: updateRouteModeLabel(mode),
        available: mode === 'mirror' ? mirrors.length > 0 : (mode === 'proxy' ? !!proxyLabel : true),
      })),
      mirrorCount: mirrors.length,
      proxyLabel,
    });
    return;
  }

  if (pn === '/api/update/download') {
    try {
      const info = await fetchLatestUpdateInfo();
      const job = await startUpdateDownloadJob(info, {
        route: url.searchParams.get('route') || '',
        proxy: url.searchParams.get('proxy') || '',
      });
      sendJSON(res, job, job.ok ? 200 : 400);
    } catch (err) {
      console.error('[UpdateDownload]', err);
      sendJSON(res, { ok: false, error: err.message || 'UPDATE_DOWNLOAD_START_FAILED' }, 500);
    }
    return;
  }

  if (pn === '/api/update/cancel') {
    const id = url.searchParams.get('id') || '';
    const job = id ? updateDownloadJobs.get(id) : latestUpdateDownloadJob(isActiveUpdateJob);
    if (!job) {
      sendJSON(res, { ok: false, error: 'UPDATE_JOB_NOT_FOUND' }, 404);
      return;
    }
    const result = cancelUpdateDownloadJob(job);
    if (!result.ok) {
      // error 必须放在快照之后，否则会被 publicUpdateJob 里的空 error 覆盖掉原因。
      sendJSON(res, Object.assign(publicUpdateJob(job), { ok: false, error: result.reason || 'UPDATE_JOB_NOT_CANCELABLE' }), 409);
      return;
    }
    sendJSON(res, publicUpdateJob(job));
    return;
  }

  if (pn === '/api/update/download/status') {
    const id = url.searchParams.get('id') || '';
    const job = id
      ? updateDownloadJobs.get(id)
      : latestUpdateDownloadJob();
    sendJSON(res, publicUpdateJob(job), job ? 200 : 404);
    return;
  }

  if (pn === '/api/update/patch') {
    try {
      const info = await fetchLatestUpdateInfo();
      const job = await startUpdatePatchJob(info, {
        route: url.searchParams.get('route') || '',
        proxy: url.searchParams.get('proxy') || '',
      });
      sendJSON(res, job, job.ok ? 200 : 400);
    } catch (err) {
      console.error('[UpdatePatch]', err);
      sendJSON(res, { ok: false, error: err.message || 'UPDATE_PATCH_START_FAILED' }, 500);
    }
    return;
  }

  if (pn === '/api/update/patch/status') {
    const id = url.searchParams.get('id') || '';
    const job = id
      ? updateDownloadJobs.get(id)
      : latestUpdateDownloadJob(item => item.mode === 'patch');
    sendJSON(res, publicUpdateJob(job), job ? 200 : 404);
    return;
  }

  if (pn === '/api/beatmap/cache/status') {
    const info = beatCacheRootInfo();
    sendJSON(res, {
      enabled: info.allowed && info.available,
      dir: info.dir,
      drive: info.drive,
      reason: !info.allowed ? 'C_DRIVE_DISABLED' : (!info.available ? 'TARGET_DRIVE_UNAVAILABLE' : ''),
      mode: info.allowed && info.available ? 'disk' : 'memory-only',
    });
    return;
  }

  if (pn === '/api/beatmap/cache') {
    if (req.method === 'GET') {
      const key = url.searchParams.get('key') || '';
      try {
        const entry = readBeatMapCache(key);
        sendJSON(res, entry
          ? { ok: true, hit: true, key: entry.key || key, map: entry.map, meta: entry.meta || {}, savedAt: entry.savedAt || 0 }
          : { ok: true, hit: false, key });
      } catch (err) {
        const info = err.info || beatCacheRootInfo();
        sendJSON(res, {
          ok: false,
          hit: false,
          enabled: false,
          mode: 'memory-only',
          key,
          reason: err.code || err.message || 'BEAT_CACHE_READ_FAILED',
          dir: info.dir,
        });
      }
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await readRequestBody(req);
        sendJSON(res, writeBeatMapCache(body));
      } catch (err) {
        const info = err.info || beatCacheRootInfo();
        sendJSON(res, {
          ok: false,
          enabled: false,
          mode: 'memory-only',
          reason: err.code || err.message || 'BEAT_CACHE_WRITE_FAILED',
          dir: info.dir,
        });
      }
      return;
    }

    sendJSON(res, { ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
    return;
  }

  // ---------- 本地文件代理 (支持 Range，用于持久化本地库) ----------
  if (pn === '/api/local-file') {
    try {
      if (!LOCAL_FILE_TOKEN || url.searchParams.get('token') !== LOCAL_FILE_TOKEN) {
        res.writeHead(403, { 'Access-Control-Allow-Origin': '*' });
        res.end('Forbidden');
        return;
      }
      const requestedPath = path.resolve(String(url.searchParams.get('path') || ''));
      // 授权门：仅放行已授权曲库根目录内的文件，缺省拒绝，堵住 HTTP 代理越权读取任意文件（与 IPC resolveAuthorizedLocalFile 一致）。
      if (!localFileAuthorizer) {
        res.writeHead(403, { 'Access-Control-Allow-Origin': '*' });
        res.end('Forbidden');
        return;
      }
      let target;
      try {
        // 授权函数按契约在越权时抛错，这里将其明确转换为 403（已知异常路径，非兜底吞异常）。
        target = localFileAuthorizer(requestedPath);
      } catch (authErr) {
        res.writeHead(403, { 'Access-Control-Allow-Origin': '*' });
        res.end('Forbidden');
        return;
      }
      const stat = fs.statSync(target);
      if (!stat.isFile()) {
        res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
        res.end('Not found');
        return;
      }
      const total = stat.size;
      let start = 0;
      let end = Math.max(0, total - 1);
      let status = 200;
      const parsedRange = parseLocalFileRange(req.headers.range, total);
      if (parsedRange && parsedRange.invalid) {
          res.writeHead(416, {
            'Access-Control-Allow-Origin': '*',
            'Content-Range': `bytes */${total}`,
          });
          res.end();
          return;
      }
      if (parsedRange) {
        start = parsedRange.start;
        end = parsedRange.end;
        status = 206;
      }
      const headers = {
        'Content-Type': localContentTypeForPath(target),
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cache-Control': 'no-store',
      };
      if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
      res.writeHead(status, headers);
      fs.createReadStream(target, { start, end })
        .on('error', (err) => {
          console.error('[LocalFile]', err);
          if (!res.headersSent) res.writeHead(500);
          res.end();
        })
        .pipe(res);
    } catch (err) {
      console.error('[LocalFile]', err);
      res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
      res.end();
    }
    return;
  }

  // ---------- 静态资源 ----------
  if (pn === '/favicon.ico') {
    serveStatic(req, res, path.join(RESOURCE_ROOT, 'build', 'icon.ico'));
    return;
  }

  let filePath = pn === '/' ? '/index.html' : pn;
  filePath = path.join(RESOURCE_ROOT, 'public', filePath);
  // vendor 库随安装包版本一起走、不单独热替换，7 天新鲜期内免 304 重验证，加快下次启动。
  const vendorCacheControl = pn.startsWith('/vendor/')
    ? 'public, max-age=604800'
    : undefined;
  serveStatic(req, res, filePath, vendorCacheControl);
});

server.listen(PORT, HOST, () => {
  console.log('======================================================');
  console.log(' 粒子音乐可视化 v2  →  http://localhost:' + PORT);
  console.log('======================================================');
});

server.setLocalFileAuthorizer = setLocalFileAuthorizer;

module.exports = server;
