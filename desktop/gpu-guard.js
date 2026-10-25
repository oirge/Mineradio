'use strict';

// GPU 档位阶梯。default 使用性能开关，compatible 由 Chromium 选择硬件后端，software 关闭硬件加速。
// 连续故障可以降档；所有显卡都在软件档冷却后试运行 compatible，不按品牌/型号分支，也不设终身重试上限。
const GPU_MODES = ['default', 'compatible', 'software'];

// 连续多少次 GPU 进程异常退出就降一档。设成 2 是因为单次崩溃可能只是驱动瞬时抽风，
// 连着两次才说明这台机器在当前档位上真的走不通。
const DEFAULT_GPU_FAILURE_THRESHOLD = 2;
const GPU_FAILURE_WINDOW_MS = 10 * 60 * 1000;
const GPU_RECOVERY_FIRST_DELAY_MS = 24 * 60 * 60 * 1000;
const GPU_RECOVERY_RETRY_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
const GPU_RECOVERY_STABLE_MS = 2 * 60 * 1000;

// 任何档位都必须保留的非 GPU 开关。`autoplay-policy` 决定的是能不能自动起播，
// 属于功能开关而不是性能开关，降级时绝对不能跟着被摘掉。
const BASE_SWITCHES = [['autoplay-policy', 'no-user-gesture-required']];

// 只有 `default` 档才加的性能开关。这里刻意**不含**任何会越过 Chromium 屏蔽名单的项：
// 上游 XxHuberrr/Mineradio 的无条件下发清单就是这一份（`autoplay-policy` 之外的 5 项），
// 二创版此前把 `ignore-gpu-blocklist` 与 `force_high_performance_gpu` 也塞进默认档，
// 在双显卡机器上强选独显 —— 独显渲染、核显或虚拟显示器（远控 / 投屏驱动）输出时的
// 跨适配器呈现会造成透明窗口渲染成透明或黑帧，并表现为持续卡顿。
const PERFORMANCE_GPU_SWITCHES = [
  ['enable-gpu-rasterization'],
  ['enable-oop-rasterization'],
  ['enable-zero-copy'],
  ['enable-accelerated-2d-canvas'],
  ['use-angle', 'd3d11'],
];

// 高风险开关，只在用户显式设置对应环境变量为 `1` 时才下发，默认一个都不加。
// `ignore-gpu-blocklist` 会强行越过 Chromium 对已知有问题的驱动组合的屏蔽；
// `force_high_performance_gpu` 在双显卡 / 带虚拟显示器的机器上会造成跨适配器呈现，
// 正是透明窗口黑屏与卡顿最常见的来源。对齐上游的环境变量 opt-in 行为。
const OPT_IN_GPU_SWITCHES = [
  ['ignore-gpu-blocklist', null, 'MINERADIO_IGNORE_GPU_BLOCKLIST'],
  ['force_high_performance_gpu', null, 'MINERADIO_FORCE_HIGH_PERFORMANCE_GPU'],
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
 * 记录里的档位属于上一次自动降级的结论；换版本时保留该档位，只重置失败计数重新评估，
 * 避免每次更新都退回硬件 GPU 再崩溃重启（更新后一串「一直重启」的根因）。
 * 传入启动时间 at 时，软件档按独立冷却试运行 compatible，每次启动最多一次。
 * 调用方须在拿到单实例锁后、配置 Chromium 开关前成功写入 startupState；写盘失败必须保留 software。
 * @param {{gpuMode?: string, appVersion?: string}} saved 已持久化的 GPU 守卫记录。
 * @param {{envMode?: string, appVersion?: string, at?: number}} options 本次启动的环境覆盖、版本与时间。
 * @returns {{mode: string, reason: string, forced: boolean, resetOnVersionChange: boolean, recoveryProbe?: boolean, startupState?: object}} 档位决议。
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
  const now = Number(opts.at);
  if (savedMode === 'software' && Number.isFinite(now) && now > 0) {
    if (record.gpuRecoveryPending === true) {
      // 上次可能在初始化/试运行中整个应用崩溃；这次先安全启动，不把它立即再送进硬件路径。
      return {
        mode: 'software', reason: 'recovery-interrupted', forced: false, resetOnVersionChange: false,
        startupState: { ...record, gpuRecoveryPending: false, gpuRecoveryAt: now, appVersion: currentVersion || savedVersion },
      };
    }
    const rawAttempts = Number(record.gpuRecoveryAttempts || 0);
    const attempts = Number.isFinite(rawAttempts) && rawAttempts >= 0
      ? Math.min(Number.MAX_SAFE_INTEGER - 1, Math.floor(rawAttempts)) : 1;
    const recoveryAt = Number(record.gpuRecoveryAt) || 0;
    const failureAt = Number(record.gpuFailureAt) || 0;
    const lastAttemptAt = Math.max(recoveryAt, failureAt);
    const cooldown = attempts > 0 ? GPU_RECOVERY_RETRY_DELAY_MS : GPU_RECOVERY_FIRST_DELAY_MS;
    // 次数只决定冷却，不永久停用恢复：驱动更新或临时故障消失后仍有自动恢复机会。
    if (lastAttemptAt === 0 || (Number.isFinite(lastAttemptAt) && now - lastAttemptAt >= cooldown)) {
      return {
        mode: 'compatible', reason: 'recovery-probe', forced: false, resetOnVersionChange: false,
        recoveryProbe: true,
        startupState: {
          ...record,
          gpuMode: 'software',
          gpuRecoveryPending: true,
          gpuRecoveryAttempts: attempts + 1,
          gpuRecoveryAt: now,
          gpuFailureMode: 'compatible',
          gpuFailureCount: 0,
          appVersion: currentVersion || savedVersion,
        },
      };
    }
  }
  if (currentVersion && savedVersion && currentVersion !== savedVersion) {
    // 换版本不再强退回 default（硬件）：之前已稳定在 compatible/software 的机器，更新后保留该档，
    // 只重置失败计数重新评估，避免每次更新都退回硬件 GPU → 崩溃 → 兜底重启的一串「更新后一直重启」。
    // 想在新版本重新试硬件，用一次性 MINERADIO_GPU_MODE=default 覆盖即可。
    return { mode: savedMode, reason: 'version-changed', forced: false, resetOnVersionChange: true };
  }
  return { mode: savedMode, reason: 'saved', forced: false, resetOnVersionChange: false };
}

/** 正常退出和外部终止不构成驱动故障，不应触发永久降档。 */
function shouldCountGpuFailure(reason) {
  return reason !== 'clean-exit' && reason !== 'killed';
}

/** 只有试运行稳定且实测硬件加速可用，才将 compatible 作为后续启动档位。 */
function noteGpuRecoverySuccess(saved, options) {
  const record = saved && typeof saved === 'object' ? saved : {};
  const opts = options || {};
  if (record.gpuRecoveryPending !== true || record.gpuMode !== 'software'
    || opts.mode !== 'compatible' || opts.hardwareAccelerated !== true) return null;
  const now = Number(opts.at);
  const startedAt = Number(record.gpuRecoveryAt);
  if (!Number.isFinite(now) || !Number.isFinite(startedAt) || startedAt <= 0
    || now - startedAt < GPU_RECOVERY_STABLE_MS) return null;
  return {
    ...record,
    gpuMode: 'compatible',
    gpuRecoveryPending: false,
    gpuRecoveryAttempts: 0,
    gpuRecoverySucceededAt: now,
    gpuFailureMode: 'compatible',
    gpuFailureCount: 0,
  };
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
  const at = Number.isFinite(Number(opts.at)) ? Number(opts.at) : Date.now();
  const previousAt = Number(record.gpuFailureAt);
  const recentFailure = Number.isFinite(previousAt) && at >= previousAt && at - previousAt <= GPU_FAILURE_WINDOW_MS;
  const count = Number(record.gpuFailureCount);
  const previous = recordedMode === activeMode && recentFailure && Number.isFinite(count)
    ? Math.max(0, Math.floor(count)) : 0;
  const failureCount = previous + 1;
  const threshold = Number(opts.threshold) > 0 ? Number(opts.threshold) : DEFAULT_GPU_FAILURE_THRESHOLD;
  const failedProbe = record.gpuRecoveryPending === true && record.gpuMode === 'software' && activeMode === 'compatible';
  const escalated = (failedProbe || failureCount >= threshold) && !isLowestGpuMode(activeMode);
  const mode = escalated ? escalateGpuMode(activeMode) : activeMode;
  const state = {
    ...record,
    gpuMode: mode,
    gpuFailureMode: mode,
    gpuFailureCount: escalated ? 0 : failureCount,
    gpuFailureAt: at,
    gpuFailureReason: String(opts.reason == null ? '' : opts.reason).slice(0, 120),
    appVersion: String(opts.appVersion == null ? (record.appVersion || '') : opts.appVersion),
  };
  if (failedProbe) state.gpuRecoveryPending = false;
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
  GPU_FAILURE_WINDOW_MS,
  GPU_RECOVERY_FIRST_DELAY_MS,
  GPU_RECOVERY_RETRY_DELAY_MS,
  GPU_RECOVERY_STABLE_MS,
  BASE_SWITCHES,
  PERFORMANCE_GPU_SWITCHES,
  OPT_IN_GPU_SWITCHES,
  SOFTWARE_SWITCHES,
  normalizeGpuMode,
  escalateGpuMode,
  isLowestGpuMode,
  resolveGpuMode,
  gpuSwitchesForMode,
  shouldDisableHardwareAcceleration,
  noteGpuFailure,
  shouldCountGpuFailure,
  noteGpuRecoverySuccess,
  describeGpuMode,
};
