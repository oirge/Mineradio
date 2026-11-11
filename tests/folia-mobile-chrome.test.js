'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// tests/folia-mobile-chrome.test.js
// Exercise the real chrome owner at interrupted viewport boundaries, without a renderer mock loop.
function harness() {
  const visible = { left: 0, top: 60, width: 412, height: 508 };
  const full = { left: 0, top: 0, width: 412, height: 842 };
  const classes = new Set(), timers = new Map(), docListeners = new Map(), windowListeners = new Map();
  const mediaListeners = new Map(), animations = [];
  let timer = 0, focused = false;
  const media = { matches: false,
    addEventListener: (name, callback) => mediaListeners.set(name, callback),
    removeEventListener: name => mediaListeners.delete(name) };
  const classList = { contains: name => classes.has(name),
    add: name => classes.add(name), remove: (...names) => names.forEach(name => classes.delete(name)),
    toggle(name, value) { if (value) classes.add(name); else classes.delete(name); } };
  const lerp = (first, last, progress) => first + (last - first) * progress;
  const numbers = value => value.match(/-?[\d.]+/g).map(Number);
  const stage = { isConnected: true, running: null, styleWrites: [],
    matches: selector => selector === '.local-visualizer',
    querySelector: selector => selector === ':scope > .local-visualizer-content' ? {} : null,
    style: { getPropertyValue: () => '', getPropertyPriority: () => '',
      setProperty(name) { stage.styleWrites.push(name); }, removeProperty(name) { stage.styleWrites.push(name); } },
    getBoundingClientRect() {
      const box = classes.has('mineradio-mobile-chrome-hidden') || focused ? full : visible;
      const frames = stage.running?.frames;
      const first = frames ? numbers(frames[0].translate) : [0, 0];
      const last = frames ? numbers(frames[1].translate) : [0, 0];
      const progress = stage.running?.progress ?? 0;
      return { ...box, left: box.left + lerp(first[0], last[0], progress),
        top: box.top + lerp(first[1], last[1], progress) };
    },
    animate(frames, options) {
      const animation = { frames, options, progress: 0, cancelled: false, onfinish: null, oncancel: null,
        cancel() { this.cancelled = true; if (stage.running === this) stage.running = null; this.oncancel?.(); },
        finish() { this.progress = 1; this.onfinish?.(); } };
      stage.running = animation; animations.push(animation);
      return animation;
    } };
  const clipPath = () => {
    const animation = stage.running;
    if (!animation) return 'inset(0px)';
    const first = numbers(animation.frames[0].clipPath), last = numbers(animation.frames[1].clipPath);
    return 'inset(' + first.map((value, index) => lerp(value, last[index], animation.progress) + 'px').join(' ') + ')';
  };
  const view = { matchMedia: () => media, getComputedStyle: () => ({ clipPath: clipPath() }),
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout(callback, delay) { const id = ++timer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    addEventListener: (name, callback) => windowListeners.set(name, callback),
    removeEventListener: name => windowListeners.delete(name) };
  const doc = { defaultView: view, hidden: false, body: { classList },
    getElementById: () => ({}),
    querySelector(selector) { return selector === '.local-player[data-mobile-focus="true"]' && focused ? {} : null; },
    querySelectorAll: selector => selector.includes('.local-visualizer') ? [stage] : [],
    addEventListener: (name, callback) => docListeners.set(name, callback),
    removeEventListener: name => docListeners.delete(name) };
  const context = vm.createContext({ window: view, console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/folia-mobile-chrome.js'), 'utf8'), context);
  const controller = view.MineradioFoliaMobileChrome.create(doc, () => true);
  const painted = () => {
    const box = stage.getBoundingClientRect(), values = numbers(clipPath());
    const top = values[0], right = values[1] ?? top, bottom = values[2] ?? top, left = values[3] ?? right;
    return { left: box.left + left, top: box.top + top,
      width: box.width - left - right, height: box.height - top - bottom };
  };
  const fireIdle = () => {
    const entry = [...timers].find(([, value]) => value.delay === 2500);
    assert.ok(entry, 'Chrome needs one complete idle interval');
    timers.delete(entry[0]); entry[1].callback();
  };
  const event = (type, extra = {}) => {
    const input = { type, pointerId: 1, pointerType: 'touch', prevented: false,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() {}, ...extra };
    docListeners.get(type)(input); return input;
  };
  return { stage, painted, fireIdle, event, visible, full, media, mediaListeners, windowListeners,
    docListeners, timers, animations, controller, setFocus: value => { focused = value; } };
}

function sameRect(actual, expected) {
  for (const key of ['left', 'top', 'width', 'height']) assert.ok(Math.abs(actual[key] - expected[key]) < .001,
    `${key}: ${actual[key]} must match ${expected[key]}`);
}

test('idle hiding starts at the drawn safe viewport and ends full-screen without a size restoration', () => {
  const env = harness();
  env.fireIdle();
  sameRect(env.painted(), env.visible);
  assert.equal(env.stage.running.options.duration, 560);
  env.stage.running.progress = .5;
  const middle = env.painted();
  assert.ok(middle.top > env.full.top && middle.top < env.visible.top);
  assert.ok(middle.height > env.visible.height && middle.height < env.full.height);
  env.stage.running.finish();
  sameRect(env.painted(), env.full);
  assert.deepEqual(env.stage.styleWrites, []);
  env.controller.destroy();
});

test('waking uses an expanded clip over the same renderer and reaches the safe viewport continuously', () => {
  const env = harness();
  env.fireIdle(); env.stage.running.finish();
  assert.ok(env.event('pointerdown').prevented, 'The first tap only wakes the chrome');
  sameRect(env.painted(), env.full);
  assert.ok(env.stage.running.frames[0].clipPath.includes('-'), 'A shrinking viewport must retain the full old image');
  env.stage.running.progress = .5;
  const middle = env.painted();
  assert.ok(middle.top > env.full.top && middle.top < env.visible.top);
  assert.ok(middle.height > env.visible.height && middle.height < env.full.height);
  env.stage.running.finish();
  sameRect(env.painted(), env.visible);
  assert.deepEqual(env.stage.styleWrites, []);
  env.controller.destroy();
});

test('a touch during hiding reverses both clipping edges from the current painted rectangle', () => {
  const env = harness();
  env.fireIdle();
  const interrupted = env.stage.running;
  interrupted.progress = .37;
  const before = env.painted();
  env.event('pointerdown');
  sameRect(env.painted(), before);
  assert.ok(interrupted.cancelled);
  assert.notEqual(env.stage.running, interrupted);
  env.stage.running.finish(); env.event('pointerup');
  sameRect(env.painted(), env.visible);
  assert.equal(env.timers.size, 1);
  env.controller.destroy();
});

test('manual focus reverses an interrupted wake through the same viewport owner', () => {
  const env = harness();
  env.fireIdle(); env.stage.running.finish();
  env.event('pointerdown'); env.stage.running.progress = .62;
  const before = env.painted();
  env.event('mineradio-mobile-focus-before'); env.setFocus(true);
  env.event('mineradio-mobile-focus-after', { detail: { focus: true } });
  sameRect(env.painted(), before);
  env.stage.running.finish();
  sameRect(env.painted(), env.full);
  env.controller.destroy();
});

test('reduce motion and teardown cancel the clip and release its timers and handlers', () => {
  const env = harness();
  env.fireIdle(); env.stage.running.progress = .4;
  env.media.matches = true; env.mediaListeners.get('change')({ type: 'change' });
  assert.equal(env.stage.running, null);
  sameRect(env.painted(), env.visible);
  env.controller.destroy();
  assert.equal(env.timers.size, 0);
  assert.equal(env.docListeners.size, 0);
  assert.equal(env.windowListeners.size, 0);
  assert.equal(env.mediaListeners.size, 0);
});
