'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从 renderer 源码截取更新线路提示函数，避免启动 Electron 才能验证文案契约。
 * @returns {string} 可在隔离上下文执行的函数源码。
 */
function readUpdateRouteHintSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function normalizeUpdateRoute(value) {');
  const end = source.indexOf('function updateRouteAvailability(mode) {', start);
  assert.ok(start >= 0 && end > start, '未找到更新线路提示源码接缝');
  return source.slice(start, end) + '\nthis.updateRouteHintText = updateRouteHintText;';
}

/**
 * 构造代理线路提示的最小 renderer 状态。
 * @param {string} proxyLabel 已解析的本机代理展示地址。
 * @returns {object} 可调用生产提示函数的隔离上下文。
 */
function createProxyHintContext(proxyLabel) {
  const context = {
    String,
    Number,
    UPDATE_ROUTE_MODES: ['auto', 'direct', 'mirror', 'proxy'],
    updatePreviewState: {
      route: 'proxy',
      routeInfo: { proxyLabel, mirrorCount: 0 },
    },
  };
  vm.runInNewContext(readUpdateRouteHintSource(), context);
  return context;
}

test('本机代理提示明确表示代理访问 GitHub，不使用“直连”避免误解', () => {
  const hint = createProxyHintContext('http://127.0.0.1:7897').updateRouteHintText();

  assert.match(hint, /通过本机代理/);
  assert.match(hint, /访问 GitHub/);
  assert.doesNotMatch(hint, /直连 GitHub/);
});

/**
 * 从主进程源码截取下载来源标签函数，锁定代理线路的实际传输语义。
 * @returns {string} 可在隔离上下文执行的函数源码。
 */
function readDownloadSourceLabelSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = source.indexOf('function updateDownloadSourceLabel(job, candidate) {');
  const end = source.indexOf('function prepareUpdateJobAttempt(job, candidate, index, total) {', start);
  assert.ok(start >= 0 && end > start, '未找到下载来源标签源码接缝');
  return source.slice(start, end) + '\nthis.updateDownloadSourceLabel = updateDownloadSourceLabel;';
}

test('本机代理下载来源明确显示代理访问 GitHub，不沿用 GitHub 直连标签', () => {
  const context = { String, Number };
  vm.runInNewContext(readDownloadSourceLabelSource(), context);

  assert.equal(
    context.updateDownloadSourceLabel({ route: 'proxy' }, { label: 'GitHub 直连' }),
    '本机代理访问 GitHub',
  );
  assert.equal(
    context.updateDownloadSourceLabel({ route: 'direct' }, { label: 'GitHub 直连' }),
    'GitHub 直连',
  );
});
