'use strict';
// GPU 守卫档位阶梯。黑屏与持续卡顿的根因是主进程无条件拍上 `ignore-gpu-blocklist` 等开关，
// 强行越过 Chromium 对已知有问题的驱动组合的屏蔽，而且没有任何回退 —— 崩一次崩一辈子。
// 这条测试钉住四件事：`default` 档只下发上游那份安全性能开关（高风险项改为 env opt-in）；
// 高风险项默认不进任何档位；连续失败会逐级降档；换版本会退回 `default` 重试一次，
// 不把用户永久钉在软件渲染上。

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GPU_MODES,
  DEFAULT_GPU_FAILURE_THRESHOLD,
  describeGpuMode,
  escalateGpuMode,
  gpuSwitchesForMode,
  isLowestGpuMode,
  noteGpuFailure,
  normalizeGpuMode,
  OPT_IN_GPU_SWITCHES,
  resolveGpuMode,
  shouldDisableHardwareAcceleration,
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

test('换过版本就退回 default 重试一次，不把用户永久钉在软件渲染上', () => {
  const upgraded = resolveGpuMode({ gpuMode: 'software', appVersion: '1.8.2' }, { appVersion: '1.8.3' });
  assert.equal(upgraded.mode, 'default');
  assert.equal(upgraded.reason, 'version-changed');
  assert.equal(upgraded.resetOnVersionChange, true, '要求调用方把旧结论清掉写盘');

  // 记录里没有版本号（v1.8.2 之前写下的档案）时不触发重试，避免每次启动都白白重试一遍。
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
