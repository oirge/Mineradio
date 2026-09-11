'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const INDEX_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const PRELOAD_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'preload.js'), 'utf8');
const MAIN_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');

/**
 * 按源码边界切出一段真实实现。
 * @param {string} startMarker 起始标记。
 * @param {string} endMarker 结束标记。
 * @returns {string} 源码片段。
 */
function sliceSource(startMarker, endMarker) {
  const start = APP_SOURCE.indexOf(startMarker);
  assert.ok(start > 0, `missing start marker: ${startMarker}`);
  const end = APP_SOURCE.indexOf(endMarker, start);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return APP_SOURCE.slice(start, end);
}

// 文件夹列表的读写与根归属：从 normalizeLocalLibraryFolderList 到 localLibraryRootForSong 结束。
const FOLDER_SOURCE = sliceSource(
  'function normalizeLocalLibraryFolderList(list) {',
  '/**\n * 生成本地曲库快照签名'
);
// 备份里的相对路径切分复用（localLibraryRootForSong 依赖）。
const RELPATH_SOURCE = sliceSource(
  'function mineradioBackupRelPath(root, absPath) {',
  'function mineradioBackupIdentity(entry, folders) {'
);
// 路径归一化是列表去重与根归属的公共依赖，定义在别处，照真实实现注入。
const PATH_KEY_SOURCE = sliceSource(
  'function normalizeLocalLibraryPathKey(value) {',
  'function localLibraryPathKeyFromFile(file) {'
);

const EXPORTS = [
  'normalizeLocalLibraryFolderList',
  'savedLocalLibraryFolderPaths',
  'savedLocalLibraryFolderPath',
  'saveLocalLibraryFolderPaths',
  'saveLocalLibraryFolderPath',
  'addLocalLibraryFolderPath',
  'removeLocalLibraryFolderPath',
  'clearSavedLocalLibraryFolderPaths',
  'localLibraryRootForSong',
  'normalizeLocalLibraryPathKey',
].map((name) => `this.${name} = ${name};`).join('\n');

/**
 * 用内存 localStorage 跑真实的文件夹列表读写。
 * @param {object} initial 初始键值。
 * @returns {{context:object, store:object}} 沙箱与存储。
 */
function createFolderSandbox(initial) {
  const store = Object.assign(Object.create(null), initial || {});
  const context = {
    console,
    JSON, Object, Array, String, Number, Math, Boolean,
    localStorage: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
      setItem(key, value) { store[key] = String(value); },
      removeItem(key) { delete store[key]; },
    },
    setPersistentLocalStorageItem(key, value) { store[key] = String(value); },
    removePersistentLocalStorageItem(key) { delete store[key]; },
    deleteLocalLibraryPersistentRecords() {},
    LOCAL_LIBRARY_FOLDER_STORE_KEY: 'mineradio-local-library-folder-v1',
    LOCAL_LIBRARY_FOLDERS_STORE_KEY: 'mineradio-local-library-folders-v1',
    LOCAL_LIBRARY_SNAPSHOT_STORE_KEY: 'mineradio-local-library-snapshot-v1',
    LOCAL_LIBRARY_INDEX_STORE_KEY: 'mineradio-local-library-index-v1',
  };
  vm.runInNewContext(`${PATH_KEY_SOURCE}\n${RELPATH_SOURCE}\n${FOLDER_SOURCE}\n${EXPORTS}`, context);
  return { context, store };
}

test('多根列表：追加、去重、移除，主根恒为首项', () => {
  const h = createFolderSandbox();
  assert.deepEqual(Array.from(h.context.savedLocalLibraryFolderPaths()), [], 'empty by default');
  h.context.addLocalLibraryFolderPath('D:/Music/A');
  h.context.addLocalLibraryFolderPath('D:/Music/B');
  // 重复加入同一目录（大小写与斜杠归一后相同）不得产生第二行。
  h.context.addLocalLibraryFolderPath('d:\\music\\a');
  assert.deepEqual(Array.from(h.context.savedLocalLibraryFolderPaths()), ['D:/Music/A', 'D:/Music/B']);
  assert.equal(h.context.savedLocalLibraryFolderPath(), 'D:/Music/A', '主根是首个根');
  // 移除第一个后主根顺延到第二个。
  assert.equal(h.context.removeLocalLibraryFolderPath('D:/Music/A'), true);
  assert.deepEqual(Array.from(h.context.savedLocalLibraryFolderPaths()), ['D:/Music/B']);
  assert.equal(h.context.savedLocalLibraryFolderPath(), 'D:/Music/B');
  // 移除最后一个返回 false（曲库清空），标量镜像键一并清掉。
  assert.equal(h.context.removeLocalLibraryFolderPath('D:/Music/B'), false);
  assert.deepEqual(Array.from(h.context.savedLocalLibraryFolderPaths()), []);
});

test('旧安装的单根标量设置迁移成单元素列表', () => {
  const h = createFolderSandbox({ 'mineradio-local-library-folder-v1': 'E:\\旧根\\音乐' });
  assert.deepEqual(Array.from(h.context.savedLocalLibraryFolderPaths()), ['E:\\旧根\\音乐']);
  assert.equal(h.context.savedLocalLibraryFolderPath(), 'E:\\旧根\\音乐');
});

test('写列表时同步维护标量镜像键指向首根', () => {
  const h = createFolderSandbox();
  h.context.saveLocalLibraryFolderPaths(['D:/A', 'D:/B']);
  assert.equal(h.store['mineradio-local-library-folders-v1'], JSON.stringify(['D:/A', 'D:/B']));
  assert.equal(h.store['mineradio-local-library-folder-v1'], 'D:/A');
});

test('localLibraryRootForSong 按绝对路径前缀认根，不越界到相邻目录', () => {
  const h = createFolderSandbox();
  const roots = ['D:/Music', 'E:/Other'];
  const inFirst = h.context.localLibraryRootForSong({ localFilePathAbsolute: 'D:/Music/Rock/a.mp3' }, roots);
  const inSecond = h.context.localLibraryRootForSong({ localFilePathAbsolute: 'E:/Other/b.flac' }, roots);
  // E:/Music2 不属于 D:/Music：只在分隔符边界判定。
  const sibling = h.context.localLibraryRootForSong({ localFilePathAbsolute: 'D:/Music2/c.mp3' }, roots);
  const outside = h.context.localLibraryRootForSong({ localFilePathAbsolute: 'F:/Elsewhere/d.mp3' }, roots);
  assert.equal(inFirst, 'D:/Music');
  assert.equal(inSecond, 'E:/Other');
  assert.equal(sibling, '');
  assert.equal(outside, '');
});

test('曲库监控按根列表注册，单根变化只重扫那一根', () => {
  // 渲染层把整个列表交给 IPC，且不再把数组再包一层。
  assert.match(APP_SOURCE, /api\.setLocalLibraryWatchRoots\(list\.slice\(\)\)/);
  // 变更通知只在属于当前监控列表时才安排重扫。
  assert.match(APP_SOURCE, /if \(!isLocalLibraryWatchRoot\(folderPath\)\) return false;/);
  // 待扫根攒进列表而不是单值覆盖，多根时一次运行逐根扫。
  assert.match(APP_SOURCE, /localLibraryWatchPendingRoots\.push\(root\)/);
  assert.match(APP_SOURCE, /for \(var p = 0; p < pending\.length; p\+\+\) \{/);
});

test('就地自动同步只对变化的那一根做差异，别的根原地保留', () => {
  assert.match(APP_SOURCE, /var multiRoot = roots\.length > 1 && !!root;/);
  assert.match(APP_SOURCE, /if \(ownRoot && localLibraryWatchRootMatches\(ownRoot, root\)\) owned\.push\(ownSong\);/);
  // 索引按根保存，绝不把合并后的整库写进某一个根。
  assert.match(APP_SOURCE, /scheduleLocalLibraryIndexSave\(folderPath \|\| savedLocalLibraryFolderPath\(\), Array\.isArray\(ownedSongs\) \? ownedSongs : songs, 240\);/);
});

test('导入是追加根语义：选第二个文件夹不覆盖第一个', () => {
  // openLocalFolderImport 先并入列表，再用全部根重建曲库。
  assert.match(APP_SOURCE, /if \(newRoot\) addLocalLibraryFolderPath\(newRoot\);\n      await reloadLocalLibraryFromAllRoots\(/);
  // handleLocalFolderFiles 的 persist 分支逐个根 addLocalLibraryFolderPath，不是 saveLocalLibraryFolderPath。
  assert.match(APP_SOURCE, /if \(groups\[addIdx\]\.root\) addLocalLibraryFolderPath\(groups\[addIdx\]\.root\);/);
  assert.ok(!/if \(opts\.folderPath && opts\.persist !== false\) saveLocalLibraryFolderPath\(opts\.folderPath\)/.test(APP_SOURCE),
    '导入不能再回落到覆盖单根');
});

test('恢复逐根取回并合并，取不到的根从设置里摘掉', () => {
  assert.match(APP_SOURCE, /var folderPaths = savedLocalLibraryFolderPaths\(\);/);
  assert.match(APP_SOURCE, /var loaded = await loadSingleLocalLibraryRoot\(folderPaths\[i\], api\);/);
  assert.match(APP_SOURCE, /rootGroups: groups,/);
  assert.match(APP_SOURCE, /if \(survivors\.length !== folderPaths\.length\) saveLocalLibraryFolderPaths\(survivors\);/);
});

test('备份导出全部根、导入逐根解析（不再只取 folders[0]）', () => {
  assert.match(APP_SOURCE, /function mineradioBackupMusicFolders\(\) \{\n  \/\/ 多根列表在整机备份切片/);
  assert.match(APP_SOURCE, /if \(typeof savedLocalLibraryFolderPaths === 'function'\) return savedLocalLibraryFolderPaths\(\);/);
  // 导入侧循环每一根，取消就整体放弃（return null）。
  assert.match(APP_SOURCE, /for \(var i = 0; i < folders\.length; i\+\+\) \{\n    var probe = null;/);
  assert.match(APP_SOURCE, /if \(!picked \|\| !picked\.ok \|\| !picked\.folderPath\) return null;/);
});

test('播放会话记住歌曲所属的根，多根恢复时按任意根放行', () => {
  assert.match(APP_SOURCE, /var roots = typeof savedLocalLibraryFolderPaths === 'function' \? savedLocalLibraryFolderPaths\(\) : \[\];/);
  assert.match(APP_SOURCE, /var folderPath = typeof localLibraryRootForSong === 'function' && roots\.length/);
  assert.match(APP_SOURCE, /if \(localLibraryWatchRootMatches\(roots\[r\], session\.folderPath\)\) \{ rootMatches = true; break; \}/);
});

test('设置面板有音乐文件夹折叠区，列表与移除按钮由运行时生成', () => {
  assert.match(INDEX_SOURCE, /id="fx-library-fold"[\s\S]*?id="library-folder-list"[\s\S]*?onclick="openLocalFolderImport\(\)"/);
  assert.match(APP_SOURCE, /function renderLocalLibraryFolderSettings\(\) \{/);
  assert.match(APP_SOURCE, /remove\.setAttribute\('data-library-folder-remove', roots\[i\]\);/);
  // 移除按钮走事件委托，避免每次重绘都重挂监听。
  assert.match(APP_SOURCE, /closest\('\[data-library-folder-remove\]'\)/);
  assert.match(APP_SOURCE, /async function removeLocalLibraryFolder\(folderPath\) \{/);
});

test('新文件夹列表键在渲染层与桌面壳两侧都登记为持久化键', () => {
  assert.match(APP_SOURCE, /LOCAL_LIBRARY_FOLDERS_STORE_KEY = 'mineradio-local-library-folders-v1'/);
  assert.match(APP_SOURCE, /LOCAL_LIBRARY_FOLDERS_STORE_KEY,\n  PLAYBACK_SESSION_STORE_KEY,/);
  assert.ok(PRELOAD_SOURCE.includes("'mineradio-local-library-folders-v1'"), 'preload 要镜像新键');
  assert.ok(MAIN_SOURCE.includes("'mineradio-local-library-folders-v1'"), '主进程要镜像新键');
});
