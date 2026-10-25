'use strict';
// GPU 守卫在主进程里的接线。gpu-guard.js 本身是纯函数，已经被 gpu-guard.test.js 钉住了；
// 这条测试盯的是 desktop/main.js 有没有把它接对：降档必须写盘并 relaunch（GPU 开关只能在
// app ready 之前生效，运行中改不了，不重启等于什么都没做），而用户用环境变量点了档位时
// 绝不能自作主张覆盖他的选择。切片直接跑真实实现，配上真实的档位阶梯。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  DEFAULT_GPU_FAILURE_THRESHOLD,
  describeGpuMode,
  noteGpuFailure,
  shouldCountGpuFailure,
} = require('../desktop/gpu-guard');
const gpuGuard = require('../desktop/gpu-guard');

const MAIN_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');

/**
 * 截取 GPU 进程退出处理实现。锚点是函数头与紧随其后的事件注册。
 * @returns {string} 可在隔离 VM 中执行的实现源码。
 */
function extractGpuFailureHandler() {
  const start = MAIN_SOURCE.indexOf('function handleGpuProcessGone(');
  const end = MAIN_SOURCE.indexOf("app.on('child-process-gone'", start);
  assert.ok(start >= 0 && end > start, '未找到 GPU 进程退出处理接缝');
  return MAIN_SOURCE.slice(start, end);
}

/**
 * 在隔离 VM 里跑一份 GPU 退出处理，接上真实的档位阶梯与可观测的假 app。
 * @param {{mode?: string, saved?: object, forced?: boolean, writeThrows?: boolean}} [options] 初始状态。
 * @returns {object} 上下文、假 app 的调用记录与日志。
 */
function createGpuHarness(options) {
  const opts = options || {};
  const logs = [];
  const calls = { relaunch: 0, quit: 0, writes: [] };
  const ctx = {
    console: { warn: (...args) => logs.push(args.join(' ')), log: (...args) => logs.push(args.join(' ')) },
    appQuitting: false,
    gpuGuardRelaunching: false,
    gpuRecoveryStabilityFailed: false,
    gpuRecoveryStabilityTimer: null,
    gotSingleInstanceLock: true,
    activeGpuMode: opts.mode || 'default',
    gpuGuardDecision: { mode: opts.mode || 'default', reason: 'default', forced: Boolean(opts.forced) },
    DEFAULT_GPU_FAILURE_THRESHOLD,
    noteGpuFailure,
    shouldCountGpuFailure,
    describeGpuMode,
    readDesktopShellSettings: () => opts.saved ? { gpuFailureAt: Date.now(), ...opts.saved } : {},
    writeDesktopShellSettings: (state) => {
      if (opts.writeThrows) throw new Error('磁盘满了');
      calls.writes.push(state);
    },
    app: {
      getVersion: () => opts.appVersion || '1.8.3',
      relaunch() {
        calls.relaunch += 1;
        if (opts.relaunchThrows) throw new Error('relaunch 炸了');
      },
      quit() { calls.quit += 1; },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(extractGpuFailureHandler(), ctx);
  return { ctx, calls, logs, run: (reason, exitCode) => ctx.handleGpuProcessGone(reason, exitCode) };
}

test('第一次 GPU 崩溃只写盘计数，不重启', () => {
  const h = createGpuHarness();
  h.run('crashed', 133);
  assert.equal(h.calls.writes.length, 1);
  assert.equal(h.calls.writes[0].gpuFailureCount, 1);
  assert.equal(h.calls.writes[0].gpuMode, 'default');
  // 单次崩溃可能只是驱动瞬时抽风，为此重启一次应用比黑屏还烦人。
  assert.equal(h.calls.relaunch, 0);
  assert.equal(h.calls.quit, 0);
  assert.equal(h.ctx.activeGpuMode, 'default');
  assert.equal(h.logs.some((line) => line.includes('累计 1 次')), true);
});

/** 跑完整的启动→GPU信息→故障/稳定提交接线，持久化状态在多次启动间传递。 */
function createStartupHarness(options = {}) {
  const start = MAIN_SOURCE.indexOf('// GPU 守卫。历史上');
  const end = MAIN_SOURCE.indexOf('function findOpenPort(', start);
  assert.ok(start >= 0 && end > start);
  let now = options.at || 1000000;
  let saved = { ...(options.saved || {}) };
  const calls = { writes: [], relaunch: 0, quit: 0, hardwareDisabled: 0, switches: [], order: [], timers: new Set() };
  const events = new Map();
  const ctx = {
    ...gpuGuard,
    appQuitting: false,
    console: { log() {}, warn() {} },
    process: { env: options.env || {} },
    Date: { now: () => now },
    readDesktopShellSettings: () => ({ ...saved }),
    writeDesktopShellSettings: (patch) => {
      calls.order.push('write');
      if (options.writeThrows || (options.writeThrowsAfter && calls.writes.length >= options.writeThrowsAfter)) throw new Error('write failed');
      saved = { ...saved, ...patch };
      calls.writes.push({ ...saved });
    },
    setTimeout(fn, delay) {
      const timer = { fn, delay, unref() { this.unrefed = true; } };
      calls.timers.add(timer);
      return timer;
    },
    clearTimeout(timer) { calls.timers.delete(timer); },
    app: {
      requestSingleInstanceLock() { calls.order.push('lock'); return options.lock !== false; },
      getVersion: () => options.appVersion || '2.5.3',
      commandLine: { appendSwitch(name, value) { calls.order.push('switch'); calls.switches.push([name, value]); } },
      disableHardwareAcceleration() { calls.hardwareDisabled += 1; },
      getGPUFeatureStatus() { return { gpu_compositing: options.gpuStatus || 'enabled' }; },
      on(event, listener) { events.set(event, listener); },
      relaunch() { calls.relaunch += 1; },
      quit() { calls.quit += 1; },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(MAIN_SOURCE.slice(start, end), ctx);
  return {
    ctx, calls,
    saved: () => saved,
    mode: () => vm.runInContext('activeGpuMode', ctx),
    emit(event, ...args) { events.get(event)?.(...args); },
    advance(ms) { now += ms; },
    flush() {
      for (const timer of [...calls.timers]) {
        calls.timers.delete(timer);
        now += timer.delay;
        timer.fn();
      }
    },
  };
}

test('正常/外部GPU退出不写失败计数，非GPU进程也不触发降档', () => {
  const h = createStartupHarness();
  for (const reason of ['clean-exit', 'killed']) h.emit('child-process-gone', {}, { type: 'GPU', reason });
  h.emit('child-process-gone', {}, { type: 'Utility', reason: 'crashed' });
  assert.equal(h.calls.writes.length, 0);
  assert.equal(h.calls.relaunch, 0);
});

test('跨天 GPU 故障不降档，短时间重复故障仍降档', () => {
  const h = createStartupHarness();
  h.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed' });
  h.advance(gpuGuard.GPU_FAILURE_WINDOW_MS + 1);
  h.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed' });
  assert.equal(h.calls.relaunch, 0);
  assert.equal(h.saved().gpuFailureCount, 1);
  h.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed' });
  assert.equal(h.calls.relaunch, 1);
});

test('硬件试运行先拿单实例锁并写回退记录，再配置 Chromium', () => {
  const h = createStartupHarness({ saved: { gpuMode: 'software' } });
  assert.equal(h.mode(), 'compatible');
  assert.equal(h.saved().gpuMode, 'software');
  assert.equal(h.saved().gpuRecoveryPending, true);
  assert.deepEqual(h.calls.order.slice(0, 3), ['lock', 'write', 'switch']);
  assert.equal(h.calls.hardwareDisabled, 0);
  assert.equal(h.calls.timers.size, 0, 'GPU 信息事件前不确认硬件是否可用');
});

test('第二实例不修改未完成试运行，也不写版本重置', () => {
  for (const saved of [
    { gpuMode: 'software', gpuRecoveryPending: true, gpuRecoveryAttempts: 1, appVersion: '2.5.2' },
    { gpuMode: 'compatible', gpuFailureCount: 1, appVersion: '2.5.2' },
  ]) {
    const h = createStartupHarness({ saved, lock: false });
    h.emit('gpu-info-update');
    h.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed' });
    assert.equal(h.calls.writes.length, 0);
    assert.equal(h.calls.relaunch, 0);
    assert.equal(h.calls.timers.size, 0);
    assert.deepEqual(h.saved(), saved);
  }
});

test('写不下硬件试运行标记时继续使用软件档', () => {
  const h = createStartupHarness({ saved: { gpuMode: 'software' }, writeThrows: true });
  assert.equal(h.mode(), 'software');
  assert.equal(h.calls.hardwareDisabled, 1);
  h.emit('gpu-info-update');
  assert.equal(h.calls.timers.size, 0);
});

test('稳定硬件试运行只调度一次并在确认合成状态后保存 compatible', () => {
  const h = createStartupHarness({ saved: { gpuMode: 'software' } });
  h.emit('gpu-info-update');
  h.emit('gpu-info-update');
  assert.equal(h.calls.timers.size, 1);
  assert.equal([...h.calls.timers][0].unrefed, true);
  h.flush();
  assert.equal(h.saved().gpuMode, 'compatible');
  assert.equal(h.saved().gpuRecoveryPending, false);
  h.emit('gpu-info-update');
  assert.equal(h.calls.timers.size, 0);
});

test('实际仍为软件合成时不把试运行标记为硬件成功', () => {
  const h = createStartupHarness({ saved: { gpuMode: 'software' }, gpuStatus: 'unavailable_software' });
  h.emit('gpu-info-update');
  h.flush();
  assert.equal(h.saved().gpuMode, 'software');
  assert.equal(h.calls.writes.length, 1);
});

test('多次失败的存档冷却后仍自动恢复，主进程仅依赖硬件功能状态而无需显卡型号', () => {
  // harness 不提供 getGPUInfo/品牌/型号，完整恢复路径只能依据通用功能状态。
  for (const gpuStatus of ['enabled', 'enabled_force', 'enabled_readback']) {
    const h = createStartupHarness({
      saved: { gpuMode: 'software', gpuRecoveryAttempts: 8, gpuFailureAt: 1000 },
      at: 1000 + gpuGuard.GPU_RECOVERY_RETRY_DELAY_MS,
      gpuStatus,
    });
    assert.equal(h.mode(), 'compatible');
    assert.equal(h.calls.hardwareDisabled, 0);
    assert.deepEqual(h.calls.switches, [['autoplay-policy', 'no-user-gesture-required']]);
    h.emit('gpu-info-update');
    h.flush();
    assert.equal(h.saved().gpuMode, 'compatible');
    assert.equal(h.saved().gpuRecoveryAttempts, 0);
    assert.equal(h.saved().gpuRecoveryPending, false);
    assert.equal(h.calls.relaunch, 0);
  }
});

test('稳定结果写盘失败时保留软件回退，不重复检查或重启', () => {
  const h = createStartupHarness({ saved: { gpuMode: 'software' }, writeThrowsAfter: 1, gpuStatus: 'enabled_readback' });
  h.emit('gpu-info-update');
  assert.doesNotThrow(() => h.flush());
  assert.equal(h.saved().gpuMode, 'software');
  assert.equal(h.saved().gpuRecoveryPending, true);
  assert.equal(h.calls.writes.length, 1);
  h.emit('gpu-info-update');
  assert.equal(h.calls.timers.size, 0);
  assert.equal(h.calls.relaunch, 0);
});

test('试运行GPU首次故障回退且重启一次，迟到稳定回调不能覆盖失败', () => {
  const h = createStartupHarness({ saved: { gpuMode: 'software' } });
  h.emit('gpu-info-update');
  const staleTimer = [...h.calls.timers][0];
  h.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed' });
  h.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed' });
  assert.equal(h.calls.relaunch, 1);
  assert.equal(h.calls.quit, 1);
  assert.equal(h.saved().gpuMode, 'software');
  assert.equal(h.saved().gpuRecoveryPending, false);
  h.advance(gpuGuard.GPU_RECOVERY_STABLE_MS);
  staleTimer.fn();
  assert.equal(h.saved().gpuMode, 'software');
  const restart = createStartupHarness({ saved: h.saved(), at: 1000001 });
  assert.equal(restart.mode(), 'software');
});

test('试运行故障写盘失败也禁止稳定回调误报成功', () => {
  const h = createStartupHarness({ saved: { gpuMode: 'software' }, writeThrowsAfter: 1 });
  h.emit('gpu-info-update');
  const staleTimer = [...h.calls.timers][0];
  h.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed' });
  assert.equal(h.calls.relaunch, 0);
  h.advance(gpuGuard.GPU_RECOVERY_STABLE_MS);
  assert.doesNotThrow(() => staleTimer.fn());
  assert.equal(h.saved().gpuMode, 'software');
});

test('退出期间和环境强制档位都不提交硬件试运行', () => {
  const quitting = createStartupHarness({ saved: { gpuMode: 'software' } });
  quitting.emit('gpu-info-update');
  quitting.ctx.appQuitting = true;
  quitting.flush();
  assert.equal(quitting.saved().gpuMode, 'software');
  const forced = createStartupHarness({ saved: { gpuMode: 'software' }, env: { MINERADIO_GPU_MODE: 'compatible' } });
  forced.emit('gpu-info-update');
  assert.equal(forced.calls.timers.size, 0);
  assert.equal(forced.calls.writes.length, 0);
});

test('达到阈值就降档写盘并立刻重启', () => {
  const h = createGpuHarness({
    saved: { gpuMode: 'default', gpuFailureMode: 'default', gpuFailureCount: 1 },
  });
  h.run('crashed', 133);
  assert.equal(h.calls.writes.length, 1);
  assert.equal(h.calls.writes[0].gpuMode, 'compatible');
  assert.equal(h.calls.writes[0].gpuFailureCount, 0, '降档后计数归零，别把下一档连带判死');
  assert.equal(h.calls.writes[0].appVersion, '1.8.3', '要记下版本号，换版本时才能只重置失败计数、保留档位');
  assert.equal(h.calls.writes[0].gpuFailureReason.includes('crashed'), true);
  // GPU 开关只能在 app ready 之前生效，所以降档必须配一次真重启。
  assert.equal(h.calls.relaunch, 1);
  assert.equal(h.calls.quit, 1);
  assert.equal(h.ctx.activeGpuMode, 'compatible');
  assert.equal(h.ctx.gpuGuardRelaunching, true, '置位后重复事件不会再触发第二次重启');
});

test('重启期间再来的 GPU 事件被忽略', () => {
  const h = createGpuHarness({
    saved: { gpuMode: 'default', gpuFailureMode: 'default', gpuFailureCount: 1 },
  });
  h.run('crashed', 133);
  h.run('crashed', 133);
  assert.equal(h.calls.relaunch, 1);
  assert.equal(h.calls.quit, 1);
  assert.equal(h.calls.writes.length, 1);
});

test('正在退出时不做任何事', () => {
  const h = createGpuHarness({ saved: { gpuFailureCount: 1, gpuFailureMode: 'default' } });
  h.ctx.appQuitting = true;
  h.run('crashed', 133);
  assert.equal(h.calls.writes.length, 0);
  assert.equal(h.calls.relaunch, 0);
  assert.equal(h.logs.length, 0);
});

test('MINERADIO_GPU_MODE 点定的档位不会被自动降级覆盖', () => {
  const h = createGpuHarness({
    mode: 'default',
    forced: true,
    saved: { gpuMode: 'default', gpuFailureMode: 'default', gpuFailureCount: 1 },
  });
  h.run('crashed', 133);
  // 用户显式指定了档位，哪怕它崩了也不许偷偷换掉 —— 否则环境变量就成了空话。
  assert.equal(h.calls.writes.length, 0, '被强制指定时连计数都不写，档案里不留假结论');
  assert.equal(h.calls.relaunch, 0);
  assert.equal(h.ctx.activeGpuMode, 'default');
  assert.equal(h.logs.some((line) => line.includes('MINERADIO_GPU_MODE')), true);
});

test('写盘失败就地停手，不在没记录的情况下重启', () => {
  const h = createGpuHarness({
    writeThrows: true,
    saved: { gpuMode: 'default', gpuFailureMode: 'default', gpuFailureCount: 1 },
  });
  h.run('crashed', 133);
  // 记不下来就重启，等于每次开机都重新崩一遍再重启一遍，直接变成重启循环。
  assert.equal(h.calls.relaunch, 0);
  assert.equal(h.calls.quit, 0);
  assert.equal(h.ctx.gpuGuardRelaunching, false);
  assert.equal(h.logs.some((line) => line.includes('写盘失败')), true);
});

test('relaunch 抛异常时不 quit，也把重启标记退回去', () => {
  const h = createGpuHarness({
    relaunchThrows: true,
    saved: { gpuMode: 'default', gpuFailureMode: 'default', gpuFailureCount: 1 },
  });
  h.run('crashed', 133);
  assert.equal(h.calls.relaunch, 1);
  // relaunch 没成功还 quit，用户就是「软件自己关了再也不开」。
  assert.equal(h.calls.quit, 0);
  assert.equal(h.ctx.gpuGuardRelaunching, false, '标记不退回就会永久锁死后续恢复');
});

test('已经在最低档反复崩溃只累计，不再重启', () => {
  const h = createGpuHarness({
    mode: 'software',
    saved: { gpuMode: 'software', gpuFailureMode: 'software', gpuFailureCount: 7 },
  });
  h.run('crashed', 133);
  assert.equal(h.calls.relaunch, 0);
  assert.equal(h.calls.quit, 0);
  assert.equal(h.calls.writes[0].gpuMode, 'software');
  assert.equal(h.calls.writes[0].gpuFailureCount, 8);
});

test('缺参数的事件也能安全落地，日志里有兜底文案', () => {
  const h = createGpuHarness();
  assert.doesNotThrow(() => h.run(undefined, undefined));
  assert.equal(h.calls.writes.length, 1);
  assert.equal(h.logs.some((line) => line.includes('unknown')), true);
});
