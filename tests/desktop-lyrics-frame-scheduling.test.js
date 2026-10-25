'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'desktop-lyrics.html'), 'utf8');

function readFunction(name) {
  const start = source.indexOf('    function ' + name + '(');
  assert.ok(start >= 0, 'missing ' + name);
  const end = source.indexOf('\n    }', start);
  assert.ok(end > start, 'unterminated ' + name);
  return source.slice(start, end + 6);
}

function harness(enabled = true) {
  let id = 0;
  const frames = new Map();
  const timers = new Map();
  const context = {
    state: { enabled },
    overlayRenderPaused: false,
    overlayDrawFrame: null,
    overlayDrawTimer: null,
    lastDrawAt: 123,
    drawn: 0,
    requestAnimationFrame(fn) { frames.set(++id, fn); return id; },
    cancelAnimationFrame(key) { frames.delete(key); },
    setTimeout(fn, delay) { timers.set(++id, { fn, delay }); return id; },
    clearTimeout(key) { timers.delete(key); },
  };
  const helpers = source.includes('    function cancelScheduledDraw(')
    ? readFunction('cancelScheduledDraw') : '';
  vm.runInNewContext(helpers + '\n' + readFunction('scheduleNextDraw') + '\n'
    + readFunction('setOverlayRenderPaused')
    + '\nfunction draw() { drawn += 1; scheduleNextDraw(); }', context);
  function runFrame() {
    const [key, fn] = frames.entries().next().value;
    frames.delete(key);
    fn(1000);
  }
  function runTimer() {
    const [key, timer] = timers.entries().next().value;
    timers.delete(key);
    timer.fn();
  }
  return { context, frames, timers, runFrame, runTimer };
}

test('rapid hiding and revealing cancels the pending frame instead of multiplying draw loops', () => {
  const h = harness();
  h.context.scheduleNextDraw();
  for (let i = 0; i < 20; i += 1) {
    h.context.setOverlayRenderPaused(true);
    assert.equal(h.frames.size, 0, 'hidden windows must cancel their frame');
    h.context.setOverlayRenderPaused(false);
    assert.equal(h.frames.size, 1, 'revealing must schedule exactly one frame');
  }
  h.runFrame();
  assert.equal(h.context.drawn, 1);
  assert.equal(h.frames.size, 1, 'the next frame must remain a single chain');
});

test('repeated scheduler calls share one outstanding frame', () => {
  const h = harness();
  h.context.scheduleNextDraw();
  h.context.scheduleNextDraw();
  h.context.scheduleNextDraw(true);
  assert.equal(h.frames.size, 1);
});

test('disabled lyrics keep one 250 ms timer and pause cancels it', () => {
  const h = harness(false);
  h.context.scheduleNextDraw();
  h.context.scheduleNextDraw();
  assert.equal(h.timers.size, 1);
  assert.equal(h.timers.values().next().value.delay, 250);
  assert.equal(h.frames.size, 0);
  h.context.setOverlayRenderPaused(true);
  assert.equal(h.timers.size, 0);
  assert.equal(h.frames.size, 0);
});

test('late canceled frames cannot draw or replace the newly resumed frame', () => {
  const h = harness();
  h.context.scheduleNextDraw();
  const staleFrame = h.frames.values().next().value;
  h.context.setOverlayRenderPaused(true);
  h.context.setOverlayRenderPaused(false);
  staleFrame(999);
  assert.equal(h.context.drawn, 0);
  assert.equal(h.frames.size, 1);
  h.runFrame();
  assert.equal(h.context.drawn, 1);
  assert.equal(h.frames.size, 1);
});

test('late canceled idle timers cannot enqueue a frame while hidden', () => {
  const h = harness(false);
  h.context.scheduleNextDraw();
  const staleTimer = h.timers.values().next().value.fn;
  h.context.setOverlayRenderPaused(true);
  staleTimer();
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
});

test('idle timeout schedules one clearing frame before returning to the idle interval', () => {
  const h = harness(false);
  h.context.scheduleNextDraw();
  h.runTimer();
  assert.equal(h.timers.size, 0);
  assert.equal(h.frames.size, 1);
  h.runFrame();
  assert.equal(h.context.drawn, 1);
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 1);
});

test('enabling lyrics promotes an idle timer to one immediate frame', () => {
  const h = harness(false);
  h.context.scheduleNextDraw();
  const staleTimer = h.timers.values().next().value.fn;
  h.context.state.enabled = true;
  h.context.scheduleNextDraw(true);
  assert.equal(h.timers.size, 0);
  assert.equal(h.frames.size, 1);
  staleTimer();
  assert.equal(h.frames.size, 1);
});

test('initial and resumed drawing use the same scheduler even while lyrics are disabled', () => {
  const h = harness(false);
  h.context.scheduleNextDraw(true);
  assert.equal(h.frames.size, 1);
  assert.equal(h.timers.size, 0);
  h.runFrame();
  assert.equal(h.timers.size, 1);
  h.context.setOverlayRenderPaused(true);
  h.context.setOverlayRenderPaused(false);
  assert.equal(h.frames.size, 1);
  assert.equal(h.timers.size, 0);
  assert.equal(h.context.lastDrawAt, 0);
  assert.match(source, /scheduleNextDraw\(true\);\s*<\/script>/);
  assert.match(readFunction('applyState'), /wasEnabledBeforeApply[\s\S]*scheduleNextDraw\(true\)/);
});
