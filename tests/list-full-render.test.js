'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
function slice(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return source.slice(a, b);
}
function songs(count) {
  return Array.from({ length: count }, (_, i) => ({ id: String(i), name: '歌曲 ' + i, artist: '歌手 ' + i, type: 'local' }));
}
function queueContext() {
  const nodes = Object.fromEntries(['queue-list', 'mini-queue-list', 'mini-queue-count'].map(id => [id, { innerHTML: '', textContent: '', querySelector: () => null }]));
  const context = {
    document: { getElementById: id => nodes[id] || null },
    playQueue: songs(700), currentIdx: 699, playMode: 'loop', stopAfterCurrentTrack: false,
    LOCAL_ONLY_MODE: true, miniQueueOpen: true, queueRenderSeq: 0,
    queuePanelLastDomSignature: '', miniQueueLastDomSignature: '',
    queueItemKey: song => song.id, songDisplaySubtitle: song => song.artist,
    songCoverSignature: song => song.id, songCoverSrc: () => '', isSongLiked: () => false,
    songArtistText: song => song.artist, nextQueueIndexPreview: () => 0,
    escHtml: value => String(value || ''), heartIconSvg: () => '', playlistPlusIconSvg: () => '',
    requestAnimationFrame: fn => fn(), smoothScrollToItem: () => {},
    bindQueueDragReorder: () => {}, bindQueuePanelExtras: () => {}, renderQueueNextUp: () => {},
    renderQueueSnapshots: () => {}, updatePlayModeButtonRow: () => {}, updateStopAfterCurrentButton: () => {},
  };
  vm.runInNewContext(slice('function queueVisibleRows(', 'async function refreshUserPlaylists(')
    + slice('function renderMiniQueuePanel(', "document.addEventListener('click', function(e){"), context);
  return { context, nodes };
}

test('主队列和迷你队列首次渲染全部700首，末项保留操作入口', () => {
  const { context, nodes } = queueContext();
  context.renderQueuePanel();
  for (const id of ['queue-list', 'mini-queue-list']) {
    const html = nodes[id].innerHTML;
    assert.equal((html.match(/onclick="playQueueAt\(/g) || []).length, 700);
    assert.match(html, /歌曲 699/);
    assert.match(html, /playQueueAt\(699\)/);
    assert.doesNotMatch(html, /load-more|jump-current/);
  }
  assert.match(nodes['mini-queue-count'].textContent, /700 首/);
});

test('队列重绘、增长和空态不依赖已删除的分页状态', () => {
  const { context, nodes } = queueContext();
  context.renderQueuePanel();
  const initial = nodes['queue-list'].innerHTML;
  context.renderQueuePanel();
  assert.equal(nodes['queue-list'].innerHTML, initial);
  context.playQueue = songs(701);
  context.renderQueuePanel();
  assert.match(nodes['queue-list'].innerHTML, /歌曲 700/);
  assert.match(nodes['mini-queue-list'].innerHTML, /歌曲 700/);
  context.playQueue = [];
  context.renderQueuePanel();
  assert.match(nodes['queue-list'].innerHTML, /队列为空/);
  assert.match(nodes['mini-queue-list'].innerHTML, /队列为空/);
});

test('歌单详情首次展示全部歌曲并保留加载中和空态', () => {
  const context = {
    playlistPanelDetailState: { key: 'local:test', tracks: songs(700), loading: false },
    songCoverSrc: () => '', escHtml: value => String(value || ''),
  };
  vm.runInNewContext(slice('function playlistPanelKey(', 'function renderPlaylistPanelDetailState('), context);
  const render = () => context.playlistPanelDetailHtml({ id: 'test', name: '测试歌单' }, 'local');
  const html = render();
  assert.equal((html.match(/data-pl-detail-row="/g) || []).length, 700);
  assert.match(html, /data-pl-detail-row="699"/);
  assert.match(html, /data-pl-detail-artist="699"/);
  assert.doesNotMatch(html, /load-more/);
  context.playlistPanelDetailState.loading = true;
  assert.match(render(), /正在载入歌单/);
  assert.doesNotMatch(render(), /data-pl-detail-row=/);
  context.playlistPanelDetailState.loading = false;
  context.playlistPanelDetailState.tracks = [];
  assert.match(render(), /歌单暂无可播放歌曲/);
});

test('界面不再保留加载更多接线，资产缓存仍分批读取', () => {
  assert.doesNotMatch(source, /data-(?:mini-queue|queue|pl|pl-detail)-load-more|resetPlaylistPanelRenderLimit|grow\w+RenderLimit|bind(?:MiniQueue|PlaylistPanel)LazyRender/);
  assert.match(source, /firstChunkSize: Math\.max\(localAssetInitialBatchSize\(\), opts\.restored \? 72 : 96\)/);
});
