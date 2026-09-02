'use strict';

// 音乐文件夹自动监控：把 fs.watch 的原始抖动收敛成"每个曲库根一次变更通知"。
// 复制整张专辑会在毫秒级触发上百个事件，这里用防抖 + 最长等待双阀门合并，
// 保证长时间拷贝也能中途上报，而不是等到全部写完才动。
const nodeFs = require('node:fs');
const nodePath = require('node:path');

const WATCH_DEBOUNCE_MS = 900;
const WATCH_MAX_WAIT_MS = 4500;
const WATCH_RETRY_BASE_MS = 5000;
const WATCH_RETRY_MAX_MS = 60000;
const WATCH_PATH_LIMIT = 512;

/**
 * 规整监控根路径。空值、非字符串和纯空白都视为无效。
 * @param {string} value 原始路径。
 * @returns {string} 规整后的绝对路径；无效时返回空串。
 */
function normalizeWatchRootPath(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  let resolved = '';
  try {
    resolved = nodePath.resolve(text);
  } catch (_e) {
    return '';
  }
  if (!resolved) return '';
  const parsed = nodePath.parse(resolved);
  if (resolved !== parsed.root) resolved = resolved.replace(/[\\/]+$/, '');
  return resolved || parsed.root || '';
}

/**
 * 生成监控根的比较键。Windows 与 macOS 的路径大小写不敏感，键统一转小写去重。
 * @param {string} folderPath 已规整的根路径。
 * @returns {string} 比较键。
 */
function watchRootKey(folderPath) {
  const text = String(folderPath || '');
  if (!text) return '';
  return process.platform === 'win32' || process.platform === 'darwin' ? text.toLowerCase() : text;
}

/**
 * 判断子路径是否落在父目录内。只按分隔符边界比较，`E:\Music2` 不算 `E:\Music` 的子目录。
 * @param {string} parentKey 父目录比较键。
 * @param {string} childKey 子目录比较键。
 * @returns {boolean} 子路径是否在父目录内。
 */
function isWatchRootInside(parentKey, childKey) {
  if (!parentKey || !childKey || parentKey === childKey) return false;
  if (childKey.length <= parentKey.length) return false;
  if (childKey.indexOf(parentKey) !== 0) return false;
  const boundary = childKey.charAt(parentKey.length);
  const tail = parentKey.charAt(parentKey.length - 1);
  return boundary === '\\' || boundary === '/' || tail === '\\' || tail === '/';
}

/**
 * 规整监控根列表：去空、去重、丢掉已被父目录递归覆盖的子目录。
 * @param {Array<string>} list 原始根列表。
 * @returns {Array<string>} 去重后的监控根列表，顺序保持输入顺序。
 */
function normalizeWatchRoots(list) {
  const source = Array.isArray(list) ? list : [];
  const picked = [];
  const seen = new Set();
  for (const item of source) {
    const folderPath = normalizeWatchRootPath(item);
    if (!folderPath) continue;
    const key = watchRootKey(folderPath);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({ folderPath, key });
  }
  const kept = [];
  for (const entry of picked) {
    const covered = picked.some((other) => other !== entry && isWatchRootInside(other.key, entry.key));
    if (!covered) kept.push(entry.folderPath);
  }
  return kept;
}

/**
 * 创建曲库文件夹监控器。定时器与 fs 都可注入，测试里不必真的落盘或等真实时钟。
 * @param {{fs?: object, setTimer?: Function, clearTimer?: Function, debounceMs?: number, maxWaitMs?: number,
 *   retryBaseMs?: number, retryMaxMs?: number, pathLimit?: number, isTrackedPath?: Function,
 *   onFlush?: Function, onStatusChange?: Function}} options 监控参数与回调。
 * @returns {object} 监控器实例。
 */
function createLocalLibraryWatcher(options) {
  const config = options || {};
  const fsModule = config.fs || nodeFs;
  const setTimer = typeof config.setTimer === 'function' ? config.setTimer : setTimeout;
  const clearTimer = typeof config.clearTimer === 'function' ? config.clearTimer : clearTimeout;
  const debounceMs = Number(config.debounceMs) > 0 ? Number(config.debounceMs) : WATCH_DEBOUNCE_MS;
  const maxWaitMs = Number(config.maxWaitMs) > 0 ? Number(config.maxWaitMs) : WATCH_MAX_WAIT_MS;
  const retryBaseMs = Number(config.retryBaseMs) > 0 ? Number(config.retryBaseMs) : WATCH_RETRY_BASE_MS;
  const retryMaxMs = Number(config.retryMaxMs) > 0 ? Number(config.retryMaxMs) : WATCH_RETRY_MAX_MS;
  const pathLimit = Number(config.pathLimit) > 0 ? Number(config.pathLimit) : WATCH_PATH_LIMIT;
  const isTrackedPath = typeof config.isTrackedPath === 'function' ? config.isTrackedPath : () => true;
  const onFlush = typeof config.onFlush === 'function' ? config.onFlush : null;
  const onStatusChange = typeof config.onStatusChange === 'function' ? config.onStatusChange : null;
  const states = new Map();
  let closed = false;

  /**
   * 通知外部监控状态变化。回调抛错不允许打断监控自身。
   * @returns {void}
   */
  function notifyStatusChange() {
    if (!onStatusChange || closed) return;
    try {
      onStatusChange(getStatus());
    } catch (_e) {}
  }

  /**
   * 清掉某个根上挂着的所有定时器。
   * @param {object} state 根状态。
   * @returns {void}
   */
  function clearStateTimers(state) {
    if (state.debounceTimer) { clearTimer(state.debounceTimer); state.debounceTimer = null; }
    if (state.maxWaitTimer) { clearTimer(state.maxWaitTimer); state.maxWaitTimer = null; }
    if (state.retryTimer) { clearTimer(state.retryTimer); state.retryTimer = null; }
  }

  /**
   * 上报一次已合并的变更，并清空该根的待处理集合。
   * @param {object} state 根状态。
   * @param {string} reason 触发原因：debounce / max-wait / manual。
   * @returns {void}
   */
  function flushState(state, reason) {
    if (state.debounceTimer) { clearTimer(state.debounceTimer); state.debounceTimer = null; }
    if (state.maxWaitTimer) { clearTimer(state.maxWaitTimer); state.maxWaitTimer = null; }
    const paths = Array.from(state.pending);
    const overflow = state.overflow;
    state.pending.clear();
    state.overflow = false;
    state.firstEventAt = 0;
    state.flushes += 1;
    if (!paths.length && !overflow) return;
    if (!onFlush || closed) return;
    try {
      onFlush({ folderPath: state.folderPath, paths, overflow, reason: String(reason || '') });
    } catch (_e) {}
  }

  /**
   * 收到一条原始 fs 事件后重排防抖与最长等待阀门。
   * @param {object} state 根状态。
   * @returns {void}
   */
  function scheduleFlush(state) {
    if (closed) return;
    if (state.debounceTimer) clearTimer(state.debounceTimer);
    state.debounceTimer = setTimer(() => {
      state.debounceTimer = null;
      flushState(state, 'debounce');
    }, debounceMs);
    if (state.maxWaitTimer) return;
    state.maxWaitTimer = setTimer(() => {
      state.maxWaitTimer = null;
      flushState(state, 'max-wait');
    }, maxWaitMs);
  }

  /**
   * 记录一条原始 fs 事件。只收录曲库关心的扩展名；目录级改名没有扩展名，按整根粗粒度变更处理。
   * @param {object} state 根状态。
   * @param {string|null} filename fs.watch 给出的相对路径，可能为空。
   * @returns {void}
   */
  function recordEvent(state, filename) {
    if (closed) return;
    state.events += 1;
    const rel = typeof filename === 'string' ? filename : (filename ? String(filename) : '');
    if (!rel) {
      state.overflow = true;
    } else if (nodePath.extname(rel) && !isTrackedPath(rel)) {
      return;
    } else if (state.pending.size >= pathLimit) {
      state.overflow = true;
    } else {
      state.pending.add(rel.split('\\').join('/'));
    }
    if (!state.firstEventAt) state.firstEventAt = Date.now();
    scheduleFlush(state);
  }

  /**
   * 安排一次监控重试。磁盘拔出或权限拒绝后按指数退避重连，不刷屏也不永久放弃。
   * @param {object} state 根状态。
   * @returns {void}
   */
  function scheduleRetry(state) {
    if (closed || state.retryTimer) return;
    const delay = Math.min(retryMaxMs, state.retryDelay || retryBaseMs);
    state.retryDelay = Math.min(retryMaxMs, delay * 2);
    state.retryTimer = setTimer(() => {
      state.retryTimer = null;
      if (closed || !states.has(state.key)) return;
      startState(state);
    }, delay);
  }

  /**
   * 处理监控失败。关掉旧句柄、记错并排重试，状态里保留最后一次错误码供设置面板读取。
   * @param {object} state 根状态。
   * @param {Error} error 失败原因。
   * @returns {void}
   */
  function failState(state, error) {
    if (state.watcher) {
      try { state.watcher.close(); } catch (_e) {}
      state.watcher = null;
    }
    state.active = false;
    state.error = (error && (error.code || error.message)) ? String(error.code || error.message) : 'LOCAL_LIBRARY_WATCH_FAILED';
    scheduleRetry(state);
    notifyStatusChange();
  }

  /**
   * 真正挂上 fs.watch。递归监控不可用时降级成只看根目录一层，至少不至于完全失明。
   * @param {object} state 根状态。
   * @returns {boolean} 是否挂载成功。
   */
  function startState(state) {
    if (closed || state.watcher) return !!state.watcher;
    const attempts = state.recursive === false ? [false] : [true, false];
    for (const recursive of attempts) {
      let watcher = null;
      try {
        watcher = fsModule.watch(state.folderPath, { recursive, persistent: false }, (_eventType, filename) => {
          recordEvent(state, filename);
        });
      } catch (e) {
        state.error = (e && (e.code || e.message)) ? String(e.code || e.message) : 'LOCAL_LIBRARY_WATCH_FAILED';
        continue;
      }
      if (!watcher) continue;
      if (typeof watcher.on === 'function') watcher.on('error', (e) => failState(state, e));
      if (typeof watcher.unref === 'function') { try { watcher.unref(); } catch (_e) {} }
      state.watcher = watcher;
      state.active = true;
      state.recursive = recursive;
      state.error = '';
      state.retryDelay = retryBaseMs;
      notifyStatusChange();
      return true;
    }
    state.active = false;
    scheduleRetry(state);
    notifyStatusChange();
    return false;
  }

  /**
   * 停掉一个根的监控并丢弃其待处理事件。
   * @param {object} state 根状态。
   * @returns {void}
   */
  function stopState(state) {
    clearStateTimers(state);
    if (state.watcher) {
      try { state.watcher.close(); } catch (_e) {}
      state.watcher = null;
    }
    state.active = false;
    state.pending.clear();
    state.overflow = false;
    state.firstEventAt = 0;
  }

  /**
   * 替换监控根列表。已在监控且仍被保留的根不重挂，避免每次刷新曲库都断一次监控。
   * @param {Array<string>} list 期望监控的根列表。
   * @returns {{ok: boolean, roots: Array<string>, added: Array<string>, removed: Array<string>}} 变更结果。
   */
  function setRoots(list) {
    if (closed) return { ok: false, roots: [], added: [], removed: [], error: 'LOCAL_LIBRARY_WATCH_CLOSED' };
    const roots = normalizeWatchRoots(list);
    const nextKeys = new Set(roots.map(watchRootKey));
    const removed = [];
    for (const [key, state] of Array.from(states)) {
      if (nextKeys.has(key)) continue;
      stopState(state);
      states.delete(key);
      removed.push(state.folderPath);
    }
    const added = [];
    for (const folderPath of roots) {
      const key = watchRootKey(folderPath);
      if (states.has(key)) continue;
      const state = {
        folderPath, key, watcher: null, active: false, recursive: true, error: '',
        pending: new Set(), overflow: false, firstEventAt: 0,
        debounceTimer: null, maxWaitTimer: null, retryTimer: null,
        retryDelay: retryBaseMs, events: 0, flushes: 0,
      };
      states.set(key, state);
      added.push(folderPath);
      startState(state);
    }
    if (removed.length && !added.length) notifyStatusChange();
    return { ok: true, roots, added, removed };
  }

  /**
   * 读取监控状态快照。
   * @returns {{ok: boolean, closed: boolean, roots: Array<object>}} 每个根的挂载与待处理情况。
   */
  function getStatus() {
    const roots = [];
    for (const state of states.values()) {
      roots.push({
        folderPath: state.folderPath,
        active: !!state.active,
        recursive: state.recursive !== false,
        error: state.error || '',
        pending: state.pending.size,
        overflow: !!state.overflow,
        events: state.events,
        flushes: state.flushes,
        retrying: !!state.retryTimer,
      });
    }
    return { ok: !closed, closed, roots };
  }

  /**
   * 立即上报所有根上积压的变更，不等防抖窗口走完。
   * @returns {number} 触发上报的根数量。
   */
  function flushNow() {
    let count = 0;
    for (const state of states.values()) {
      if (!state.pending.size && !state.overflow) continue;
      flushState(state, 'manual');
      count += 1;
    }
    return count;
  }

  /**
   * 关闭监控器。进程退出或主窗口销毁时调用，之后所有入口都不再产生副作用。
   * @returns {void}
   */
  function close() {
    if (closed) return;
    closed = true;
    for (const state of states.values()) stopState(state);
    states.clear();
  }

  return { setRoots, getStatus, flushNow, close, isClosed: () => closed };
}

module.exports = {
  createLocalLibraryWatcher,
  normalizeWatchRootPath,
  normalizeWatchRoots,
  watchRootKey,
  isWatchRootInside,
  WATCH_DEBOUNCE_MS,
  WATCH_MAX_WAIT_MS,
  WATCH_PATH_LIMIT,
};
