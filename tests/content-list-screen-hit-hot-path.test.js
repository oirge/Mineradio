'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readRendererSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
}

function readSourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码区段：${startMarker}`);
  return source.slice(start, end);
}

test('歌单详情屏幕命中复用几何 scratch 并避免临时排序', () => {
  const source = readRendererSource();
  const contentSource = readSourceBetween(source, 'function makeContentListManager() {', '\nfunction compactCount');
  const pickSource = readSourceBetween(contentSource, 'pickRowAtScreen: function(sx, sy) {', '\n    raycastPanel: function');
  const actionSource = readSourceBetween(contentSource, 'rowActionAtScreen: function(row, sx, sy) {', '\n    playRow: function');

  assert.match(contentSource, /var rowScreenCorners = \[new THREE\.Vector3\(\), new THREE\.Vector3\(\), new THREE\.Vector3\(\), new THREE\.Vector3\(\)\];/);
  assert.match(contentSource, /var rowScreenBounds = \{ minX: 0, minY: 0, maxX: 0, maxY: 0 \};/);
  assert.match(contentSource, /function measureRowScreenBounds\(row\)/);
  assert.match(pickSource, /measureRowScreenBounds\(row\)/);
  assert.match(actionSource, /measureRowScreenBounds\(row\)/);
  assert.doesNotMatch(pickSource, /\.filter\(|\.sort\(|new THREE\.Vector3/);
  assert.doesNotMatch(actionSource, /new THREE\.Vector3/);
});
