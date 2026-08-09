'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 读取歌单详情渲染器源码，验证可见窗口热路径的行为契约。
 * @returns {string} 主渲染页面源码。
 */
function readRendererSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
}

/**
 * 截取详情列表管理器中的可见行同步函数。
 * @param {string} source 主渲染页面源码。
 * @returns {string} 可在隔离上下文执行的函数源码。
 */
function readSyncRenderedRowsSource(source) {
  const start = source.indexOf('  function syncRenderedRows(force, frameShelfLook) {');
  const end = source.indexOf('\n\n  return {', start);
  assert.ok(start >= 0 && end > start, '未找到歌词可见行同步函数');
  return source.slice(start, end);
}

/**
 * 验证窗口复用时先更新歌曲引用，并且仅在脏状态下绘制一次。
 * @returns {void}
 */
function testVisibleRowReuseContract() {
  const source = readSyncRenderedRowsSource(readRendererSource());
  assert.doesNotMatch(source, /rows\.forEach\(/, '窗口复用路径不得创建两次回调遍历');

  const drawCalls = [];
  const context = {
    Math,
    group: {},
    uniforms: { uTime: { value: 12 } },
    isLoadingContent: () => false,
    drawPanelIfNeeded: () => {},
    allTracks: [{ name: '新歌一' }, { name: '新歌二' }],
    CONTENT_VISIBLE_RADIUS: 1,
    CONTENT_MAX_RENDER: 3,
    centerTarget: 0,
    centerSmooth: 0,
    renderedStart: 0,
    rows: [
      { index: 0, song: { name: '旧歌一' }, lastCenter: false },
      { index: 1, song: { name: '旧歌二' }, lastCenter: true },
    ],
    rowsDirty: true,
    rowDrawAt: -10,
    drawRow: (row, song, isCenter) => drawCalls.push({ row, song, isCenter }),
    disposeRows: () => {},
  };
  vm.runInNewContext(`${source}\nthis.sync = syncRenderedRows;`, context);

  context.sync(false, { bgOpacity: 0.78, accent: '#f7c66a' });
  assert.deepEqual(drawCalls.map((call) => call.song.name), ['新歌一', '新歌二']);
  assert.equal(context.rowsDirty, false);
  assert.equal(context.rowDrawAt, 12);

  const drawCount = drawCalls.length;
  context.sync(false, { bgOpacity: 0.78, accent: '#f7c66a' });
  assert.equal(drawCalls.length, drawCount, '无脏状态且无加载动画时不得重复绘制');
}

test('歌单详情可见行复用合并更新与绘制热路径', testVisibleRowReuseContract);
