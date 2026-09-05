'use strict';

// GPU 档位阶梯。`default` 是历史行为（全部性能开关都拍上去），`compatible` 不再对 GPU 做任何
// 指定、把决定权交回 Chromium 自己的屏蔽名单，`software` 彻底关掉硬件加速。
// 黑屏与持续卡顿几乎都出在 `default` 档强行越过屏蔽名单之后：屏蔽名单里躺着的正是那些
// 会把画面渲染成全黑的驱动组合，而 GPU 进程反复崩溃再退回软件合成，就是肉眼看到的卡顿。
// 所以这三档必须能自动逐级降级，并且换过 Electron 或驱动之后要能自动退回 `default` 重试一次。
const GPU_MODES = ['default', 'compatible', 'software'];

// 连续多少次 GPU 进程异常退出就降一档。设成 2 是因为单次崩溃可能只是驱动瞬时抽风，
// 连着两次才说明这台机器在当前档位上真的走不通。
const DEFAULT_GPU_FAILURE_THRESHOLD = 2;

// 任何档位都必须保留的非 GPU 开关。`autoplay-policy` 决定的是能不能自动起播，
// 属于功能开关而不是性能开关，降级时绝对不能跟着被摘掉。
const BASE_SWITCHES = [['autoplay-policy', 'no-user-gesture-required']];

// 只有 `default` 档才加的激进开关。`ignore-gpu-blocklist` 会强行越过 Chromium 对已知有问题的
// 驱动组合的屏蔽，`use-angle=d3d11` 把后端钉死不让它自己挑，`force_high_performance_gpu`
// 在双显卡机器上强选独显 —— 独显渲染、核显输出的跨适配器呈现正是黑帧的常见来源。
const PERFORMANCE_GPU_SWITCHES = [
  ['ignore-gpu-blocklist'],
  ['enable-gpu-rasterization'],
  ['enable-oop-rasterization'],
  ['enable-zero-copy'],
  ['enable-accelerated-2d-canvas'],
  ['force_high_performance_gpu'],
  ['use-angle', 'd3d11'],
];

// `software` 档要显式关掉 GPU 合成。只调 `app.disableHardwareAcceleration()` 有可能仍留在
// 半 GPU 的合成路径上，而透明无边框窗口正是在那条路径上变黑的。
const SOFTWARE_SWITCHES = [['disable-gpu-compositing']];

/**
 * 归一化 GPU 档位取值，无法识别时返回空串交给调用方决定回退。
 * @param {unknown} value 待归一化的档位名。
 * @returns {string} 合法档位名，或空串。
 */
function normalizeGpuMode(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  return GPU_MODES.includes(text) ? text : '';
}

/**
 * 取下一个更保守的档位；已经在最低档时原样返回。
 * @param {unknown} mode 当前档位。
 * @returns {string} 降一级后的档位。
 */
function escalateGpuMode(mode) {
  const current = normalizeGpuMode(mode) || GPU_MODES[0];
  const next = GPU_MODES[GPU_MODES.indexOf(current) + 1];
  return next || current;
}

/**
 * 判断某个档位是否已经到了最低档，没有再往下降的空间。
 * @param {unknown} mode 待判断的档位。
 * @returns {boolean} 已在最低档时返回 true。
 */
function isLowestGpuMode(mode) {
  return (normalizeGpuMode(mode) || GPU_MODES[0]) === GPU_MODES[GPU_MODES.length - 1];
}

/**
 * 决定本次启动实际使用的 GPU 档位。
 * 环境变量优先级最高且不写盘，方便用户在黑屏时用一次性环境变量把界面救出来；
 * 记录里的档位属于上一次自动降级的结论；而只要 `appVersion` 与记录不同，就退回 `default`
 * 重试一次 —— 换了 Electron 或换了显卡驱动之后原来的黑屏可能已经不复存在，
 * 不重试会让用户被永久钉在软件渲染上，那本身就是卡顿。
 * @param {{gpuMode?: string, appVersion?: string}} saved 已持久化的 GPU 守卫记录。
 * @param {{envMode?: string, appVersion?: string}} options 本次启动的环境覆盖与当前版本号。
 * @returns {{mode: string, reason: string, forced: boolean, resetOnVersionChange: boolean}} 档位决议。
 */
function resolveGpuMode(saved, options) {
  const opts = options || {};
  const record = saved && typeof saved === 'object' ? saved : {};
  const envMode = normalizeGpuMode(opts.envMode);
  if (envMode) return { mode: envMode, reason: 'env', forced: true, resetOnVersionChange: false };

  const savedMode = normalizeGpuMode(record.gpuMode);
  if (!savedMode || savedMode === GPU_MODES[0]) {
    return { mode: GPU_MODES[0], reason: 'default', forced: false, resetOnVersionChange: false };
  }

  const currentVersion = String(opts.appVersion == null ? '' : opts.appVersion);
  const savedVersion = String(record.appVersion == null ? '' : record.appVersion);
  if (currentVersion && savedVersion && currentVersion !== savedVersion) {
    return { mode: GPU_MODES[0], reason: 'version-changed', forced: false, resetOnVersionChange: true };
  }
  return { mode: savedMode, reason: 'saved', forced: false, resetOnVersionChange: false };
}

/**
 * 给出某个档位应当追加的全部 Chromium 开关。
 * @param {unknown} mode GPU 档位。
 * @returns {Array<[string, string?]>} 开关名与可选取值组成的列表。
 */
function gpuSwitchesForMode(mode) {
  const current = normalizeGpuMode(mode) || GPU_MODES[0];
  if (current === 'default') return BASE_SWITCHES.concat(PERFORMANCE_GPU_SWITCHES);
  if (current === 'software') return BASE_SWITCHES.concat(SOFTWARE_SWITCHES);
  return BASE_SWITCHES.slice();
}

/**
 * 判断某个档位是否需要在 app ready 之前关掉硬件加速。
 * @param {unknown} mode GPU 档位。
 * @returns {boolean} 需要关掉时返回 true。
 */
function shouldDisableHardwareAcceleration(mode) {
  return (normalizeGpuMode(mode) || GPU_MODES[0]) === 'software';
}

/**
 * 记一次 GPU 进程异常退出，并在连续失败达到阈值时给出降级结论。
 * 计数按档位归零：换档之后旧档位的失败次数不该继续累加，否则一次降级会连带把下一档也判死。
 * @param {{gpuMode?: string, gpuFailureCount?: number}} saved 已持久化的 GPU 守卫记录。
 * @param {{mode?: string, appVersion?: string, threshold?: number, at?: number, reason?: string}} options 本次失败的上下文。
 * @returns {{state: object, mode: string, escalated: boolean, failureCount: number}} 待写盘的记录与是否发生降级。
 */
function noteGpuFailure(saved, options) {
  const opts = options || {};
  const record = saved && typeof saved === 'object' ? saved : {};
  const activeMode = normalizeGpuMode(opts.mode) || normalizeGpuMode(record.gpuMode) || GPU_MODES[0];
  const recordedMode = normalizeGpuMode(record.gpuFailureMode);
  const previous = recordedMode === activeMode ? Number(record.gpuFailureCount) || 0 : 0;
  const failureCount = previous + 1;
  const threshold = Number(opts.threshold) > 0 ? Number(opts.threshold) : DEFAULT_GPU_FAILURE_THRESHOLD;
  const escalated = failureCount >= threshold && !isLowestGpuMode(activeMode);
  const mode = escalated ? escalateGpuMode(activeMode) : activeMode;
  const state = {
    ...record,
    gpuMode: mode,
    gpuFailureMode: mode,
    gpuFailureCount: escalated ? 0 : failureCount,
    gpuFailureAt: Number(opts.at) || 0,
    gpuFailureReason: String(opts.reason == null ? '' : opts.reason).slice(0, 120),
    appVersion: String(opts.appVersion == null ? (record.appVersion || '') : opts.appVersion),
  };
  return { state, mode, escalated, failureCount };
}

/**
 * 生成一行给日志用的档位描述。
 * @param {unknown} mode GPU 档位。
 * @param {string} [reason] 档位来源。
 * @returns {string} 人读得懂的一行描述。
 */
function describeGpuMode(mode, reason) {
  const current = normalizeGpuMode(mode) || GPU_MODES[0];
  const label = current === 'default'
    ? '全部性能开关'
    : current === 'compatible'
      ? '尊重 Chromium 屏蔽名单，不指定 GPU 开关'
      : '关闭硬件加速，走软件合成';
  return reason ? `${current}（${label}，来源：${reason}）` : `${current}（${label}）`;
}

module.exports = {
  GPU_MODES,
  DEFAULT_GPU_FAILURE_THRESHOLD,
  BASE_SWITCHES,
  PERFORMANCE_GPU_SWITCHES,
  SOFTWARE_SWITCHES,
  normalizeGpuMode,
  escalateGpuMode,
  isLowestGpuMode,
  resolveGpuMode,
  gpuSwitchesForMode,
  shouldDisableHardwareAcceleration,
  noteGpuFailure,
  describeGpuMode,
};
