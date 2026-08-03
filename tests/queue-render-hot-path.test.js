'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 读取主渲染页面源码，锁定队列可见行热路径的行为契约。
 * @returns {string} 主渲染页面源码。
 */
function readRendererSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
}

/**
 * 截取队列可见行快照、签名和 HTML 生成函数。
 * @param {string} source 主渲染页面源码。
 * @returns {string} 可在隔离上下文执行的函数源码。
 */
function readQueueRendererSource(source) {
  const start = source.indexOf('function queueVisibleRows(');
  const end = source.indexOf('function growQueuePanelRenderLimit(', start);
  assert.ok(start >= 0 && end > start, '未找到队列可见行渲染函数');
  return source.slice(start, end);
}

/**
 * 验证同一轮队列渲染复用可见行快照，避免签名和 HTML 各自重复读取歌曲字段。
 * @returns {void}
 */
function testQueueVisibleRowSnapshotReuse() {
  const calls = { key: 0, subtitle: 0, coverSignature: 0, coverSrc: 0, liked: 0, artist: 0 };
  const songs = [
    { id: 'a', name: '甲', artist: '歌手甲', album: '专辑甲', type: 'remote' },
    { id: 'b', name: '乙', artist: '歌手乙', album: '专辑乙', type: 'remote' },
  ];
  const context = {
    Math,
    playQueue: songs,
    currentIdx: 1,
    LOCAL_ONLY_MODE: false,
    queueItemKey: (song) => { calls.key++; return song.id; },
    songDisplaySubtitle: (song) => { calls.subtitle++; return song.artist + ' · ' + song.album; },
    songCoverSignature: (song) => { calls.coverSignature++; return 'sig:' + song.id; },
    songCoverSrc: (song) => { calls.coverSrc++; return 'cover:' + song.id; },
    isSongLiked: (song) => { calls.liked++; return song.id === 'b'; },
    songArtistText: (song) => { calls.artist++; return song.artist; },
    escHtml: (value) => String(value || ''),
    heartIconSvg: () => '<heart>',
    playlistPlusIconSvg: () => '<plus>',
  };
  vm.runInNewContext(`${readQueueRendererSource(readRendererSource())}\nthis.rows = queueVisibleRows; this.signature = queueVisibleDomSignature; this.html = queueItemsHtml;`, context);

  const rows = context.rows(2);
  context.signature(2, false, rows);
  context.html(2, false, rows);

  assert.deepEqual(calls, {
    key: 2,
    subtitle: 2,
    coverSignature: 2,
    coverSrc: 2,
    liked: 2,
    artist: 2,
  });
  assert.match(context.html(2, false, rows), /歌手乙/);
}

test('队列可见行签名与 HTML 复用同一份歌曲快照', testQueueVisibleRowSnapshotReuse);
