'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

/**
 * 截取队列渲染实现（可见行快照、签名、HTML 与增量修补），在隔离上下文里执行。
 * @returns {string} 队列渲染源码。
 */
function readQueueRenderSource() {
  const start = source.indexOf('function queueVisibleRows(');
  const end = source.indexOf('async function refreshUserPlaylists(', start);
  assert.ok(start >= 0 && end > start, '未找到队列渲染实现');
  return source.slice(start, end);
}

/**
 * 生成测试用歌曲列表。
 * @param {number} count 歌曲数量。
 * @returns {Array<object>} 歌曲数组。
 */
function songs(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: 'song-' + i, name: '歌曲 ' + i, sub: '本地文件', artist: '', album: '',
    cover: 'sig:' + i, type: 'local',
  }));
}

/**
 * 建立可执行队列渲染上下文，并暴露增量修补入口。
 * @param {Array<object>} queue 播放队列。
 * @param {number} current 当前播放索引。
 * @returns {object} 暴露 rows/baseline/apply/itemHtml/miniItemHtml 的上下文。
 */
function incrementalContext(queue, current) {
  const context = {
    playQueue: queue,
    currentIdx: current,
    playMode: 'loop',
    stopAfterCurrentTrack: false,
    LOCAL_ONLY_MODE: true,
    queueItemKey: song => song.id,
    songDisplaySubtitle: song => song.sub,
    songCoverSignature: song => song.cover,
    songCoverSrc: () => '',
    isSongLiked: () => false,
    songArtistText: () => '',
    nextQueueIndexPreview: () => 1,
    escHtml: value => String(value || ''),
    heartIconSvg: () => '<heart>',
    playlistPlusIconSvg: () => '<plus>',
    Math,
  };
  vm.runInNewContext(
    readQueueRenderSource() +
    '\nthis.rows = queueVisibleRows; this.baseline = queueListIncrementalState; this.apply = queueListApplyIncremental;' +
    '\nthis.itemHtml = queueItemHtml; this.miniItemHtml = queueMiniItemHtml;',
    context
  );
  return context;
}

/**
 * 构造支持类名切换与 outerHTML 记录的桩行元素。
 * @param {number} index 行索引。
 * @param {boolean} mini 是否为迷你队列行（身份标记用 onclick）。
 * @returns {object} 桩行元素。
 */
function fakeRow(index, mini) {
  const el = {
    index,
    classes: [],
    toggles: [],
    outerWrites: [],
  };
  let outer = '<row-' + index + '>';
  Object.defineProperty(el, 'outerHTML', {
    get: () => outer,
    set: value => { outer = value; el.outerWrites.push(value); },
  });
  el.getAttribute = name => {
    if (name === 'data-queue-index') return mini ? null : String(index);
    if (name === 'onclick') return 'playQueueAt(' + index + ')';
    return null;
  };
  el.classList = {
    toggle(name, force) {
      el.toggles.push([name, !!force]);
      const has = el.classes.indexOf(name) >= 0;
      if (force && !has) el.classes.push(name);
      else if (!force && has) el.classes.splice(el.classes.indexOf(name), 1);
    },
  };
  return el;
}

/**
 * 构造带 children 的桩列表容器。
 * @param {number} count 行数。
 * @param {boolean} mini 是否为迷你队列。
 * @returns {object} 桩容器。
 */
function fakeList(count, mini) {
  return { children: Array.from({ length: count }, (_, i) => fakeRow(i, mini)) };
}

test('切歌只切换类名，不重建任何行', () => {
  const context = incrementalContext(songs(24), 0);
  const rows = context.rows(24);
  const state = context.baseline(24, rows, false);
  const list = fakeList(24);
  context.currentIdx = 5;
  const nextRows = context.rows(24);

  assert.equal(context.apply(list, 24, nextRows, false, state), true);
  assert.deepEqual(list.children[0].classes, [], '原当前行应移除 now');
  assert.deepEqual(list.children[5].classes, ['now'], '新当前行应加上 now');
  assert.equal(list.children[5].outerWrites.length, 0);
  assert.equal(list.children.filter(row => row.outerWrites.length).length, 0, '内容未变时不得替换任何行');
  assert.equal(state.current, 5, '修补后基线游标应前进');

  // 幂等：同一状态重复修补不应再写 DOM。
  list.children.forEach(row => { row.toggles.length = 0; });
  const again = context.rows(24);
  assert.equal(context.apply(list, 24, again, false, state), true);
  assert.equal(list.children.filter(row => row.outerWrites.length || row.toggles.length).length, 0);
});

test('单行内容变化（如封面就绪）只替换该行', () => {
  const context = incrementalContext(songs(24), 0);
  const rows = context.rows(24);
  const state = context.baseline(24, rows, false);
  const list = fakeList(24);
  context.playQueue[7].cover = 'sig:hydrated';
  const nextRows = context.rows(24);

  assert.equal(context.apply(list, 24, nextRows, false, state), true);
  const touched = list.children.filter(row => row.outerWrites.length);
  assert.equal(touched.length, 1, '只应替换内容变化的行');
  assert.equal(touched[0].index, 7);
  assert.equal(touched[0].outerWrites[0], context.itemHtml(nextRows[7]), '替换内容应与整表 HTML 逐行一致');
  assert.equal(list.children.filter(row => row.toggles.length).length, 0, '游标未变时不得碰类名');
});

test('迷你队列切歌只补 now，内容变化按 onclick 校验身份', () => {
  const context = incrementalContext(songs(24), 0);
  const rows = context.rows(24);
  const state = context.baseline(24, rows, true);
  const list = fakeList(24, true);
  context.currentIdx = 3;
  const cursorRows = context.rows(24);
  assert.equal(context.apply(list, 24, cursorRows, true, state), true);
  assert.deepEqual(list.children[3].classes, ['now']);
  assert.equal(list.children.filter(row => row.toggles.some(t => t[0] === 'next-up')).length, 0, '迷你项没有 next-up 类');

  context.playQueue[9].cover = 'sig:mini-new';
  const contentRows = context.rows(24);
  assert.equal(context.apply(list, 24, contentRows, true, state), true);
  const touched = list.children.filter(row => row.outerWrites.length);
  assert.equal(touched.length, 1);
  assert.equal(touched[0].index, 9);
  assert.equal(touched[0].outerWrites[0], context.miniItemHtml(contentRows[9]));
});

test('变更过多、队列长度变化或桩 DOM 一律回退整表重建', () => {
  const context = incrementalContext(songs(24), 0);
  const rows = context.rows(24);
  const state = context.baseline(24, rows, false);

  // 超过八分之一行变化（24 >> 3 = 3，改 4 行）。
  [2, 5, 8, 11].forEach(i => { context.playQueue[i].cover = 'sig:x' + i; });
  assert.equal(context.apply(fakeList(24), 24, context.rows(24), false, state), false);

  // 队列长度变化（真实入口按 playQueue.length 传入新的渲染上限）。
  context.playQueue = songs(25);
  assert.equal(context.apply(fakeList(24), 25, context.rows(25), false, state), false);

  // 桩 DOM：没有 children。
  assert.equal(context.apply({ innerHTML: '' }, 24, context.rows(24), false, state), false);

  // 桩行元素：游标要触碰的行没有 classList。
  const noClassList = fakeList(24);
  delete noClassList.children[6].classList;
  context.currentIdx = 6;
  assert.equal(context.apply(noClassList, 24, context.rows(24), false, state), false);
});

test('主队列与迷你队列渲染入口都先尝试增量修补再整表重建', () => {
  assert.match(source, /if \(opts\.animate \|\| !queueListApplyIncremental\(\$ql, renderLimit, visibleRows, false, queuePanelIncrementalState\)\) \{/);
  assert.match(source, /if \(opts\.animate \|\| !queueListApplyIncremental\(\$list, renderLimit, visibleRows, true, miniQueueIncrementalState\)\) \{/);
  assert.match(source, /queuePanelIncrementalState = queueListIncrementalState\(renderLimit, visibleRows, false\);/);
  assert.match(source, /miniQueueIncrementalState = queueListIncrementalState\(renderLimit, visibleRows, true\);/);
  // 空队列与整表重建后必须重置基线，避免下次用陈旧签名误判。
  assert.match(source, /miniQueueLastDomSignature = '';\s*queuePanelIncrementalState = null;/);
  assert.match(source, /miniQueueLastDomSignature = 'empty';\s*miniQueueIncrementalState = null;/);
});
