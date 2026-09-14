'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/wallpaper-engine.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../public/wallpaper-engine.css'), 'utf8');
function slice(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + 1);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}
function classList(...initial) {
  const values = new Set(initial);
  return {
    contains: value => values.has(value),
    add: value => values.add(value),
    remove: value => values.delete(value),
  };
}
function projects(count = 601) {
  return Array.from({ length: count }, (_, i) => ({
    id: (i + 1).toString(16).padStart(24, '0'),
    title: 'Wallpaper ' + String(i).padStart(4, '0'),
    projectType: i % 2 ? 'web' : 'scene',
    sourceLabel: i % 2 ? 'Steam' : 'Local',
    workshopId: String(100000 + i),
    hasPreview: true,
    previewAnimated: true,
  }));
}
function harness({ observer = true, list } = {}) {
  const timers = new Map();
  const observers = [];
  let timerId = 0;
  const grid = {
    html: '', images: [], writes: 0,
    get innerHTML() { return this.html; },
    set innerHTML(html) {
      this.html = html;
      this.writes++;
      this.images = Array.from(html.matchAll(/<img\b[^>]*>/g), (match, index) => {
        const tag = match[0];
        return {
          dataset: {
            src: /data-src="([^"]*)"/.exec(tag)[1],
            animated: /data-animated="([^"]*)"/.exec(tag)[1],
          },
          src: '', classList: classList(), top: Math.floor(index / 4) * 150,
          getAttribute(name) { return name === 'src' ? this.src : null; },
          removeAttribute(name) { if (name === 'src') this.src = ''; },
          getBoundingClientRect() { return { top: this.top, bottom: this.top + 140 }; },
        };
      });
    },
    querySelectorAll(selector) {
      assert.equal(selector, 'img[data-src]');
      return this.images;
    },
    getBoundingClientRect() { return { top: 0, bottom: 600 }; },
  };
  const modal = { classList: classList('show') };
  const search = { value: '' };
  const elements = {
    'wallpaper-engine-grid': grid,
    'wallpaper-engine-modal': modal,
    'wallpaper-engine-search': search,
  };
  const context = {
    document: { getElementById: id => elements[id] || null },
    wallpaperEngineProjects: projects(),
    wallpaperEngineSelection: { active: false },
    favoriteWallpaperEngineIds: new Set(), hiddenWallpaperEngineIds: new Set(),
    wallpaperEngineLibraryBusy: false, wallpaperEngineLibrarySnapshot: {},
    wallpaperEngineLibraryLoadPromise: null, wallpaperEngineMediaToken: '',
    wallpaperEnginePreviewObserver: null, wallpaperEnginePreviewScrollTimer: 0,
    wallpaperEngineSearchRenderTimer: 0,
    escHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    wallpaperEngineDesktopApi: () => ({ listWallpaperEngineProjects: list }),
    showToast() {},
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  if (observer) context.IntersectionObserver = class {
    constructor(callback, options) {
      this.callback = callback; this.options = options; this.images = []; this.disconnected = false;
      observers.push(this);
    }
    observe(image) { this.images.push(image); }
    disconnect() { this.disconnected = true; }
  };
  vm.runInNewContext([
    slice('function normalizeWallpaperEngineProject(item)', 'function updateWallpaperEngineEntryUi('),
    slice('function wallpaperEngineFilteredProjects()', 'function normalizeWallpaperEngineProjectDetails('),
    slice('function scheduleWallpaperEngineLibraryRender()', 'function closeWallpaperEngineLibrary()'),
    slice('async function refreshWallpaperEngineLibrary()', 'async function chooseWallpaperEngineDirectory()'),
  ].join('\n'), context);
  return { context, grid, modal, search, timers, observers };
}
function cardIds(grid) {
  return Array.from(grid.innerHTML.matchAll(/<article\b[^>]*data-wallpaper-id="([^"]+)"/g), match => match[1]);
}

test('打开已索引壁纸库一次渲染全部 601 项，包括末项，无加载更多', async () => {
  const { context, grid, modal } = harness();
  modal.classList.remove('show');
  await context.openWallpaperEngineLibrary();
  assert.equal(modal.classList.contains('show'), true);
  assert.deepEqual(cardIds(grid), projects().map(item => item.id));
  assert.match(grid.innerHTML, /Wallpaper 0600/);
  assert.doesNotMatch(grid.innerHTML, /load-more|继续加载/);
  assert.doesNotMatch(source, /wallpaperEngineRenderLimit|WALLPAPER_ENGINE_RENDER_BATCH|extendWallpaperEngineLibraryNearEnd|load-more/);
  assert.doesNotMatch(css, /wallpaper-engine-load-more/);
});

test('筛选返回超过 240 项的全部匹配结果，隐藏、排序与末项搜索仍生效', () => {
  const { context, grid, search } = harness();
  const items = projects();
  search.value = '  SCENE  ';
  context.hiddenWallpaperEngineIds.add(items[0].id);
  context.favoriteWallpaperEngineIds.add(items[598].id);
  context.wallpaperEngineSelection = { active: true, id: items[596].id };
  context.renderWallpaperEngineLibrary();
  const expected = [items[596], items[598], ...items.filter((_, i) => i % 2 === 0 && i !== 0 && i !== 596 && i !== 598)];
  assert.equal(expected.length, 300);
  assert.deepEqual(cardIds(grid), expected.map(item => item.id));
  search.value = 'Wallpaper 0600';
  context.renderWallpaperEngineLibrary();
  assert.deepEqual(cardIds(grid), [items[600].id]);
  search.value = 'not-a-wallpaper';
  context.renderWallpaperEngineLibrary();
  assert.deepEqual(cardIds(grid), []);
  assert.match(grid.innerHTML, /没有符合筛选条件/);
  search.value = '';
  context.renderWallpaperEngineLibrary();
  assert.equal(cardIds(grid).length, 600);
});

test('重复渲染替换而不追加卡片，断开旧观察器且滚动不重绘列表', () => {
  const { context, grid, observers, timers } = harness();
  context.renderWallpaperEngineLibrary();
  const first = grid.innerHTML;
  for (let i = 0; i < 3; i++) context.renderWallpaperEngineLibrary();
  assert.equal(grid.innerHTML, first);
  assert.equal(new Set(cardIds(grid)).size, 601);
  assert.ok(observers.slice(0, -1).every(item => item.disconnected));
  assert.equal(observers.at(-1).images.length, 601);
  const writes = grid.writes;
  context.scheduleWallpaperEnginePreviewViewportUpdate();
  assert.equal(grid.writes, writes);
  assert.equal(timers.size, 0);
});

test('全量卡片仍懒加载图片，末项进入视口才读取，离开后释放动态预览', () => {
  const { context, grid, observers } = harness();
  context.renderWallpaperEngineLibrary();
  assert.equal(grid.images.length, 601);
  assert.match(grid.innerHTML, /loading="lazy" decoding="async"/);
  assert.ok(grid.images[0].src);
  const last = grid.images.at(-1);
  assert.equal(last.src, '');
  const observer = observers.at(-1);
  assert.equal(observer.options.root, grid);
  observer.callback([{ target: last, isIntersecting: true }]);
  assert.equal(last.src, last.dataset.src);
  last.onload();
  assert.equal(last.classList.contains('loaded'), true);
  observer.callback([{ target: last, isIntersecting: false }]);
  assert.equal(last.src, '');
  assert.equal(last.classList.contains('loaded'), false);
});

test('无 IntersectionObserver 时保留 60ms 预览节流，搜索保留 90ms 防抖', () => {
  const { context, grid, timers, search } = harness({ observer: false });
  context.renderWallpaperEngineLibrary();
  const last = grid.images.at(-1);
  assert.equal(last.src, '');
  last.top = 200;
  context.scheduleWallpaperEnginePreviewViewportUpdate();
  context.scheduleWallpaperEnginePreviewViewportUpdate();
  assert.equal(timers.size, 1);
  const [id, timer] = [...timers][0];
  assert.equal(timer.delay, 60);
  const writes = grid.writes;
  timers.delete(id);
  timer.callback();
  assert.equal(last.src, last.dataset.src);
  assert.equal(grid.writes, writes);
  search.value = 'Wallpaper 0600';
  context.scheduleWallpaperEngineLibraryRender();
  context.scheduleWallpaperEngineLibraryRender();
  assert.equal(timers.size, 1);
  const renderTimer = [...timers.values()][0];
  assert.equal(renderTimer.delay, 90);
  renderTimer.callback();
  assert.deepEqual(cardIds(grid), [projects()[600].id]);
});

test('并发刷新共用一次后台读取，重复刷新后完整替换索引结果', async () => {
  const calls = [];
  const pending = [];
  const { context, grid } = harness({ list(options) {
    calls.push(options);
    return new Promise(resolve => pending.push(resolve));
  } });
  const first = context.refreshWallpaperEngineLibrary();
  const concurrent = context.refreshWallpaperEngineLibrary();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].force, true);
  pending.shift()({ ok: true, projects: projects(), count: 601 });
  await Promise.all([first, concurrent]);
  assert.deepEqual(cardIds(grid), projects().map(item => item.id));
  const next = context.refreshWallpaperEngineLibrary();
  assert.equal(calls.length, 2);
  pending.shift()({ ok: true, projects: projects(481), count: 481 });
  await next;
  assert.deepEqual(cardIds(grid), projects(481).map(item => item.id));
  assert.equal(context.wallpaperEngineLibraryBusy, false);
  assert.equal(context.wallpaperEngineLibraryLoadPromise, null);
});
