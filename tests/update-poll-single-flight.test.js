'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadUpdatePollingHarness() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function clearUpdateJobPolling() {');
  const end = source.indexOf('function applyUpdateDownloadJob(job) {', start);
  assert.ok(start >= 0 && end > start, '更新轮询接缝缺失');

  const state = {
    status: 'downloading',
    mode: 'installer',
    pollTimer: null,
    pollInFlight: null,
    pollGeneration: 0,
    downloadJobId: 'job-1',
    patchJobId: '',
    progress: 0,
  };
  const pending = [];
  const timers = [];
  const applied = [];
  let apiCalls = 0;

  const context = {
    updatePreviewState: state,
    apiJson(url) {
      apiCalls++;
      return new Promise((resolve, reject) => pending.push({ url, resolve, reject }));
    },
    applyUpdateDownloadJob(job) {
      applied.push(job);
      state.progress = Number(job.progress || 0);
      state.status = job.status === 'ready' ? 'ready' : 'downloading';
    },
    updateUpdatePreviewProgress() {},
    showToast() {},
    setTimeout(fn, delay) {
      const timer = { fn, delay, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      if (timer) timer.cleared = true;
    },
    Date,
    Math,
    Number,
    Promise,
    encodeURIComponent,
  };
  vm.runInNewContext(source.slice(start, end), context);
  return { context, state, pending, timers, applied, getApiCalls: () => apiCalls };
}

test('更新状态轮询同一时刻只保留一个在途请求', async () => {
  const harness = loadUpdatePollingHarness();
  const first = harness.context.pollUpdateDownloadJob('job-1');
  const second = harness.context.pollUpdateDownloadJob('job-1');

  assert.equal(harness.getApiCalls(), 1);
  assert.equal(harness.pending.length, 1);
  harness.pending[0].resolve({ id: 'job-1', mode: 'installer', status: 'downloading', progress: 42 });
  await Promise.all([first, second]);

  assert.equal(harness.applied.length, 1);
  assert.equal(harness.state.progress, 42);
  assert.equal(harness.state.pollInFlight, null);
  assert.equal(harness.timers.length, 1);
  assert.equal(harness.timers[0].delay, 360);
});

test('旧更新任务响应不能覆盖新任务状态', async () => {
  const harness = loadUpdatePollingHarness();
  const old = harness.context.pollUpdateDownloadJob('job-1');
  assert.equal(harness.pending.length, 1);

  harness.context.clearUpdateJobPolling();
  harness.state.downloadJobId = 'job-2';
  harness.state.status = 'downloading';
  const current = harness.context.pollUpdateDownloadJob('job-2');
  assert.equal(harness.pending.length, 2);

  harness.pending[0].resolve({ id: 'job-1', mode: 'installer', status: 'downloading', progress: 99 });
  await old;
  assert.equal(harness.applied.length, 0);

  harness.pending[1].resolve({ id: 'job-2', mode: 'installer', status: 'downloading', progress: 12 });
  await current;
  assert.equal(harness.applied.length, 1);
  assert.equal(harness.applied[0].id, 'job-2');
  assert.equal(harness.state.progress, 12);
});
