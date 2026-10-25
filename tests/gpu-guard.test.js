'use strict';
// GPU 守卫档位阶梯。黑屏与持续卡顿的根因是主进程无条件拍上 `ignore-gpu-blocklist` 等开关，
// 强行越过 Chromium 对已知有问题的驱动组合的屏蔽，而且没有任何回退 —— 崩一次崩一辈子。
// 这条测试钉住四件事：`default` 档只下发上游那份安全性能开关（高风险项改为 env opt-in）；
// 高风险项默认不进任何档位；短时间连续失败才逐级降档；软件档冷却后持续重试兼容硬件，
// 更新版本不会跳过冷却或强制退回 default。

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GPU_MODES,
  DEFAULT_GPU_FAILURE_THRESHOLD,
  GPU_FAILURE_WINDOW_MS,
  GPU_RECOVERY_FIRST_DELAY_MS,
  GPU_RECOVERY_RETRY_DELAY_MS,
  GPU_RECOVERY_STABLE_MS,
  describeGpuMode,
  escalateGpuMode,
  gpuSwitchesForMode,
  isLowestGpuMode,
  noteGpuFailure,
  noteGpuRecoverySuccess,
  normalizeGpuMode,
  OPT_IN_GPU_SWITCHES,
  resolveGpuMode,
  shouldDisableHardwareAcceleration,
  shouldCountGpuFailure,
} = require('../desktop/gpu-guard');

// 与上游 XxHuberrr/Mineradio 的 CHROMIUM_SAFE_PERFORMANCE_SWITCHES 逐项相同：
// 不含 `ignore-gpu-blocklist`，也不含 `force_high_performance_gpu`。
const SAFE_DEFAULT_SWITCHES = [
  ['autoplay-policy', 'no-user-gesture-required'],
  ['enable-gpu-rasterization'],
  ['enable-oop-rasterization'],
  ['enable-zero-copy'],
  ['enable-accelerated-2d-canvas'],
  ['use-angle', 'd3d11'],
];

test('default 档只下发安全性能开关，不再越过屏蔽名单或强选独显', () => {
  assert.deepEqual(gpuSwitchesForMode('default'), SAFE_DEFAULT_SWITCHES);
  assert.deepEqual(gpuSwitchesForMode(''), SAFE_DEFAULT_SWITCHES, '取值非法时也要回退到 default');
  assert.deepEqual(gpuSwitchesForMode(undefined), SAFE_DEFAULT_SWITCHES);
  assert.equal(shouldDisableHardwareAcceleration('default'), false);
});

test('高风险开关只作为 env opt-in 存在，任何档位都不会自动带上', () => {
  const names = OPT_IN_GPU_SWITCHES.map(([name]) => name);
  assert.deepEqual(names, ['ignore-gpu-blocklist', 'force_high_performance_gpu']);
  for (const mode of GPU_MODES) {
    const active = gpuSwitchesForMode(mode).map(([name]) => name);
    for (const risky of names) {
      assert.equal(active.includes(risky), false, `${mode} 档不应自动下发 ${risky}`);
    }
  }
  // 每个高风险开关都必须绑定一个环境变量名，否则永远无法被用户点开。
  for (const [, , envName] of OPT_IN_GPU_SWITCHES) {
    assert.equal(typeof envName, 'string');
    assert.match(envName, /^MINERADIO_/);
  }
});

test('compatible 档只留功能开关，把 GPU 决定权交回 Chromium', () => {
  const switches = gpuSwitchesForMode('compatible');
  assert.equal(switches.length, 1);
  assert.deepEqual(switches[0], ['autoplay-policy', 'no-user-gesture-required']);
  // autoplay-policy 是功能开关不是性能开关，降级时跟着被摘掉就变成「降级后不自动起播」。
  assert.equal(shouldDisableHardwareAcceleration('compatible'), false);
  const names = switches.map(([name]) => name);
  assert.equal(names.includes('ignore-gpu-blocklist'), false);
  assert.equal(names.includes('use-angle'), false);
  assert.equal(names.includes('force_high_performance_gpu'), false);
});

test('software 档关硬件加速并显式关掉 GPU 合成', () => {
  const names = gpuSwitchesForMode('software').map(([name]) => name);
  assert.equal(names.includes('autoplay-policy'), true);
  // 只调 disableHardwareAcceleration() 可能仍留在半 GPU 合成路径上，透明窗口正是在那里变黑的。
  assert.equal(names.includes('disable-gpu-compositing'), true);
  assert.equal(names.includes('ignore-gpu-blocklist'), false);
  assert.equal(shouldDisableHardwareAcceleration('software'), true);
});

test('档位阶梯逐级向下，最低档到底不再降', () => {
  assert.deepEqual(GPU_MODES, ['default', 'compatible', 'software']);
  assert.equal(escalateGpuMode('default'), 'compatible');
  assert.equal(escalateGpuMode('compatible'), 'software');
  assert.equal(escalateGpuMode('software'), 'software');
  assert.equal(escalateGpuMode('乱写的'), 'compatible', '非法取值当作 default 处理');
  assert.equal(isLowestGpuMode('software'), true);
  assert.equal(isLowestGpuMode('default'), false);
  assert.equal(normalizeGpuMode(' Compatible '), 'compatible', '大小写与空白都要容忍');
  assert.equal(normalizeGpuMode('turbo'), '');
});

test('连续失败达到阈值才降档，没到阈值只累计', () => {
  assert.equal(DEFAULT_GPU_FAILURE_THRESHOLD, 2);
  const first = noteGpuFailure({}, { mode: 'default', appVersion: '1.8.3' });
  assert.equal(first.escalated, false);
  assert.equal(first.failureCount, 1);
  assert.equal(first.mode, 'default');
  assert.equal(first.state.gpuMode, 'default');

  const second = noteGpuFailure(first.state, { mode: 'default', appVersion: '1.8.3' });
  assert.equal(second.escalated, true);
  assert.equal(second.mode, 'compatible');
  assert.equal(second.state.gpuMode, 'compatible');
  // 降档之后计数必须归零，否则下一档只要再崩一次就被连带判死。
  assert.equal(second.state.gpuFailureCount, 0);
  assert.equal(second.state.gpuFailureMode, 'compatible');
});

test('换档之后旧档位的失败次数不再累加', () => {
  // 记录里写着 compatible 崩过 1 次，但本次实际跑在 software 上：那 1 次不属于 software。
  const result = noteGpuFailure(
    { gpuMode: 'compatible', gpuFailureMode: 'compatible', gpuFailureCount: 1 },
    { mode: 'software', appVersion: '1.8.3' },
  );
  assert.equal(result.failureCount, 1);
  assert.equal(result.escalated, false);
  assert.equal(result.mode, 'software');
});

test('最低档反复失败不再降档，也不会把记录写坏', () => {
  let state = { gpuMode: 'software', gpuFailureMode: 'software', gpuFailureCount: 0 };
  for (let i = 0; i < 4; i += 1) {
    const result = noteGpuFailure(state, { mode: 'software', appVersion: '1.8.3' });
    assert.equal(result.escalated, false);
    assert.equal(result.mode, 'software');
    state = result.state;
  }
  assert.equal(state.gpuMode, 'software');
  assert.equal(state.gpuFailureCount, 4);
});

test('干净档案启动走 default，存档的降档结论会被沿用', () => {
  const fresh = resolveGpuMode({}, { appVersion: '1.8.3' });
  assert.equal(fresh.mode, 'default');
  assert.equal(fresh.forced, false);
  assert.equal(fresh.resetOnVersionChange, false);

  const saved = resolveGpuMode({ gpuMode: 'compatible', appVersion: '1.8.3' }, { appVersion: '1.8.3' });
  assert.equal(saved.mode, 'compatible');
  assert.equal(saved.reason, 'saved');
  assert.equal(saved.resetOnVersionChange, false);
});

test('换过版本保留已降到的档位、只重置失败计数，不再退回硬件造成更新后反复重启', () => {
  const upgraded = resolveGpuMode({ gpuMode: 'software', appVersion: '1.8.2' }, { appVersion: '1.8.3' });
  assert.equal(upgraded.mode, 'software', '保留已稳定的软件渲染档，不强退回 default');
  assert.equal(upgraded.reason, 'version-changed');
  assert.equal(upgraded.resetOnVersionChange, true, '仍要求调用方把失败计数清掉写盘');

  const upgradedCompat = resolveGpuMode({ gpuMode: 'compatible', appVersion: '1.8.2' }, { appVersion: '1.8.3' });
  assert.equal(upgradedCompat.mode, 'compatible', 'compatible 档同样保留');
  assert.equal(upgradedCompat.resetOnVersionChange, true);

  // 记录里没有版本号（v1.8.2 之前写下的档案）时不触发重置，避免每次启动都白白重写一遍。
  const noVersion = resolveGpuMode({ gpuMode: 'software' }, { appVersion: '1.8.3' });
  assert.equal(noVersion.mode, 'software');
  assert.equal(noVersion.resetOnVersionChange, false);
});

test('MINERADIO_GPU_MODE 覆盖优先级最高且不写盘', () => {
  const forced = resolveGpuMode({ gpuMode: 'software', appVersion: '1.8.3' }, {
    envMode: 'default',
    appVersion: '1.8.3',
  });
  assert.equal(forced.mode, 'default');
  assert.equal(forced.reason, 'env');
  assert.equal(forced.forced, true);
  assert.equal(forced.resetOnVersionChange, false, '环境变量是一次性覆盖，不许改档案');

  // 环境变量写错了不能把用户踢回 default，应当当作没写，继续沿用存档结论。
  const bogus = resolveGpuMode({ gpuMode: 'compatible', appVersion: '1.8.3' }, {
    envMode: 'turbo',
    appVersion: '1.8.3',
  });
  assert.equal(bogus.mode, 'compatible');
  assert.equal(bogus.forced, false);
});

test('档位描述带上档位名与来源，便于从日志里直接读出结论', () => {
  const text = describeGpuMode('software', 'auto');
  assert.equal(text.includes('software'), true);
  assert.equal(text.includes('auto'), true);
  assert.equal(describeGpuMode('default').includes('default'), true);
});

test('相隔超过十分钟的瞬时 GPU 故障不累计成连续故障', () => {
  const first = noteGpuFailure({}, { mode: 'default', at: 1000 });
  const later = noteGpuFailure(first.state, { mode: 'default', at: 1000 + GPU_FAILURE_WINDOW_MS + 1 });
  assert.equal(later.failureCount, 1);
  assert.equal(later.escalated, false);
  const repeated = noteGpuFailure(later.state, { mode: 'default', at: later.state.gpuFailureAt + 100 });
  assert.equal(repeated.escalated, true);
});

test('系统时钟回拨或旧记录缺少时间戳时不沿用故障计数', () => {
  for (const gpuFailureAt of [undefined, 2000, Infinity]) {
    const result = noteGpuFailure({ gpuFailureMode: 'default', gpuFailureCount: 1, gpuFailureAt }, {
      mode: 'default', at: 1000,
    });
    assert.equal(result.failureCount, 1);
    assert.equal(result.escalated, false);
  }
});

test('正常退出和外部终止不属于 GPU 驱动故障', () => {
  assert.equal(shouldCountGpuFailure('clean-exit'), false);
  assert.equal(shouldCountGpuFailure('killed'), false);
  for (const reason of ['crashed', 'abnormal-exit', 'oom', 'launch-failed', 'integrity-failure', undefined]) {
    assert.equal(shouldCountGpuFailure(reason), true);
  }
});

test('软件档冷却后只探测兼容硬件，先保留软件回退与持久化尝试标记', () => {
  const saved = { gpuMode: 'software', gpuFailureAt: 1000, appVersion: '2.5.2', customSetting: 42 };
  assert.equal(resolveGpuMode(saved, { at: 1000 + GPU_RECOVERY_FIRST_DELAY_MS - 1 }).mode, 'software');
  const probe = resolveGpuMode(saved, { at: 1000 + GPU_RECOVERY_FIRST_DELAY_MS, appVersion: '2.5.2' });
  assert.equal(probe.mode, 'compatible');
  assert.equal(probe.recoveryProbe, true);
  assert.equal(probe.startupState.gpuMode, 'software');
  assert.equal(probe.startupState.gpuRecoveryPending, true);
  assert.equal(probe.startupState.gpuRecoveryAttempts, 1);
  assert.equal(probe.startupState.customSetting, 42);
  assert.equal(saved.gpuRecoveryAttempts, undefined, '决策函数不能偷偷修改输入存档');
});

test('没有失败时间戳的旧软件档可恢复，但正常兼容档与环境覆盖不受影响', () => {
  const old = resolveGpuMode({ gpuMode: 'software' }, { at: 1000 });
  assert.equal(old.recoveryProbe, true);
  assert.equal(old.mode, 'compatible');
  assert.equal(resolveGpuMode({ gpuMode: 'compatible' }, { at: 1000 }).recoveryProbe, undefined);
  const forced = resolveGpuMode({ gpuMode: 'software' }, { at: 1000, envMode: 'software' });
  assert.equal(forced.mode, 'software');
  assert.equal(forced.startupState, undefined);
});

test('试运行崩溃第一次就回软件档，重新启动不连续试探', () => {
  const probe = resolveGpuMode({ gpuMode: 'software' }, { at: 1000 });
  const failure = noteGpuFailure(probe.startupState, { mode: probe.mode, at: 2000 });
  assert.equal(failure.escalated, true);
  assert.equal(failure.mode, 'software');
  assert.equal(failure.state.gpuRecoveryPending, false);
  assert.equal(failure.state.gpuRecoveryAttempts, 1);
  assert.equal(resolveGpuMode(failure.state, { at: 2100 }).mode, 'software');
});

test('整个应用在硬件试运行中退出后，下次启动先安全回退且不吃掉新的尝试', () => {
  const probe = resolveGpuMode({ gpuMode: 'software' }, { at: 1000 });
  const interrupted = resolveGpuMode(probe.startupState, { at: 1000 + GPU_RECOVERY_RETRY_DELAY_MS });
  assert.equal(interrupted.mode, 'software');
  assert.equal(interrupted.recoveryProbe, undefined);
  assert.equal(interrupted.startupState.gpuRecoveryPending, false);
  assert.equal(interrupted.startupState.gpuRecoveryAttempts, 1);
});

test('反复失败只延长冷却，不会耗尽终身额度而永久停在软件渲染', () => {
  const first = resolveGpuMode({ gpuMode: 'software' }, { at: 1000, appVersion: '2.5.2' });
  const failedFirst = noteGpuFailure(first.startupState, { mode: first.mode, at: 2000 });
  assert.equal(resolveGpuMode(failedFirst.state, { at: 3000, appVersion: '2.5.3' }).mode, 'software');
  const second = resolveGpuMode(failedFirst.state, { at: 2000 + GPU_RECOVERY_RETRY_DELAY_MS, appVersion: '2.5.3' });
  assert.equal(second.recoveryProbe, true);
  assert.equal(second.startupState.gpuRecoveryAttempts, 2);
  const failedSecond = noteGpuFailure(second.startupState, { mode: second.mode, at: 3000 + GPU_RECOVERY_RETRY_DELAY_MS });
  let saved = failedSecond.state;
  for (let n = 1; n <= 10; n += 1) {
    const retryAt = saved.gpuFailureAt + GPU_RECOVERY_RETRY_DELAY_MS;
    assert.equal(resolveGpuMode(saved, { at: retryAt - 1, appVersion: `3.0.${n}` }).mode, 'software');
    const retry = resolveGpuMode(saved, { at: retryAt, appVersion: `3.0.${n}` });
    assert.equal(retry.mode, 'compatible');
    assert.equal(retry.recoveryProbe, true);
    assert.equal(retry.startupState.gpuRecoveryAttempts, n + 2);
    saved = noteGpuFailure(retry.startupState, { mode: retry.mode, at: retryAt + 1000 }).state;
  }
});

test('历史大次数或异常计数不会永久取消恢复，试运行计数保持安全整数', () => {
  for (const attempts of [100, Number.MAX_SAFE_INTEGER, Infinity, -1, 'broken']) {
    const saved = { gpuMode: 'software', gpuRecoveryAttempts: attempts, gpuFailureAt: 1000 };
    assert.equal(resolveGpuMode(saved, { at: 1000 + GPU_RECOVERY_RETRY_DELAY_MS - 1 }).mode, 'software');
    const retry = resolveGpuMode(saved, { at: 1000 + GPU_RECOVERY_RETRY_DELAY_MS });
    assert.equal(retry.recoveryProbe, true);
    assert.equal(Number.isSafeInteger(retry.startupState.gpuRecoveryAttempts), true);
  }
});

test('试运行必须达到稳定时长且确认真实硬件加速后才持久化 compatible', () => {
  const probe = resolveGpuMode({ gpuMode: 'software' }, { at: 1000 });
  const early = noteGpuRecoverySuccess(probe.startupState, {
    mode: 'compatible', at: 1000 + GPU_RECOVERY_STABLE_MS - 1, hardwareAccelerated: true,
  });
  assert.equal(early, null);
  const softwareOnly = noteGpuRecoverySuccess(probe.startupState, {
    mode: 'compatible', at: 1000 + GPU_RECOVERY_STABLE_MS, hardwareAccelerated: false,
  });
  assert.equal(softwareOnly, null);
  const stable = noteGpuRecoverySuccess(probe.startupState, {
    mode: 'compatible', at: 1000 + GPU_RECOVERY_STABLE_MS, hardwareAccelerated: true,
  });
  assert.equal(stable.gpuMode, 'compatible');
  assert.equal(stable.gpuRecoveryPending, false);
  assert.equal(stable.gpuFailureCount, 0);
  assert.equal(stable.gpuRecoveryAttempts, 0);
  assert.equal(resolveGpuMode(stable, { at: 1000 + GPU_RECOVERY_STABLE_MS + 1 }).mode, 'compatible');
});

test('成功恢复后清空连续试探次数，下次故障重新使用首次冷却', () => {
  const probe = resolveGpuMode({ gpuMode: 'software', gpuRecoveryAttempts: 20 }, { at: 1000 });
  const stableAt = 1000 + GPU_RECOVERY_STABLE_MS;
  const stable = noteGpuRecoverySuccess(probe.startupState, {
    mode: 'compatible', at: stableAt, hardwareAccelerated: true,
  });
  assert.equal(stable.gpuRecoveryAttempts, 0);
  const firstFailure = noteGpuFailure(stable, { mode: 'compatible', at: stableAt + 1000 });
  const secondFailure = noteGpuFailure(firstFailure.state, { mode: 'compatible', at: stableAt + 2000 });
  assert.equal(secondFailure.mode, 'software');
  const retryAt = secondFailure.state.gpuFailureAt + GPU_RECOVERY_FIRST_DELAY_MS;
  assert.equal(resolveGpuMode(secondFailure.state, { at: retryAt - 1 }).mode, 'software');
  assert.equal(resolveGpuMode(secondFailure.state, { at: retryAt }).recoveryProbe, true);
});

test('迟到的稳定回调不允许把已失败或其他档位写回硬件', () => {
  const probe = resolveGpuMode({ gpuMode: 'software' }, { at: 1000 });
  const failure = noteGpuFailure(probe.startupState, { mode: 'compatible', at: 2000 });
  assert.equal(noteGpuRecoverySuccess(failure.state, {
    mode: 'compatible', at: 1000 + GPU_RECOVERY_STABLE_MS, hardwareAccelerated: true,
  }), null);
  assert.equal(noteGpuRecoverySuccess(probe.startupState, {
    mode: 'software', at: 1000 + GPU_RECOVERY_STABLE_MS, hardwareAccelerated: true,
  }), null);
});
