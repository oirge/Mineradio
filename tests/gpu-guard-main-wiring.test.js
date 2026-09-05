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
} = require('../desktop/gpu-guard');

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
    activeGpuMode: opts.mode || 'default',
    gpuGuardDecision: { mode: opts.mode || 'default', reason: 'default', forced: Boolean(opts.forced) },
    DEFAULT_GPU_FAILURE_THRESHOLD,
    noteGpuFailure,
    describeGpuMode,
    readDesktopShellSettings: () => opts.saved || {},
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

test('达到阈值就降档写盘并立刻重启', () => {
  const h = createGpuHarness({
    saved: { gpuMode: 'default', gpuFailureMode: 'default', gpuFailureCount: 1 },
  });
  h.run('crashed', 133);
  assert.equal(h.calls.writes.length, 1);
  assert.equal(h.calls.writes[0].gpuMode, 'compatible');
  assert.equal(h.calls.writes[0].gpuFailureCount, 0, '降档后计数归零，别把下一档连带判死');
  assert.equal(h.calls.writes[0].appVersion, '1.8.3', '要记下版本号，换版本时才能退回 default 重试');
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
