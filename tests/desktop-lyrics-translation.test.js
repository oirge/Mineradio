'use strict';
// 桌面歌词翻译显示 + 单行舞台翻译 + 桌面歌词控制界面「翻译」开关的接线校验。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const desktopLyricsHtml = fs.readFileSync(path.join(ROOT, 'public', 'desktop-lyrics.html'), 'utf8');
const mainJs = fs.readFileSync(path.join(ROOT, 'desktop', 'main.js'), 'utf8');
const preloadJs = fs.readFileSync(path.join(ROOT, 'desktop', 'preload.js'), 'utf8');
const overlayPreloadJs = fs.readFileSync(path.join(ROOT, 'desktop', 'overlay-preload.js'), 'utf8');

test('单行舞台开启翻译时把译文并进当前行画成两行', () => {
  // buildLyricMesh 支持传入 maxLines，非行轨道模式也能画两行
  assert.match(appJs, /var maxLines = opts\.maxLines != null \? Math\.max\(1, Math\.round\(Number\(opts\.maxLines\)\)\) : \(rowMode \? 1 : STAGE_LYRIC_MAX_LINES\);/);
  assert.match(appJs, /makeLyricMask\(text, \{ maxLines: maxLines \}\)/);
  // showStageLine 在单行 + 翻译开启时拼出原文 + 译文，并按 maxLines:2 建 mesh
  assert.match(appJs, /if \(!multilineStage && lyricTranslationModeActive\(\)\) \{/);
  assert.match(appJs, /composite = text \+ '\\n' \+ trText; twoLine = true;/);
  assert.match(appJs, /buildLyricMesh\(composite, \{ rowMode: multilineStage, maxLines: twoLine \? 2 : undefined \}\)/);
});

test('拉取译文的门控放宽到「舞台或桌面任一开启翻译」', () => {
  assert.match(appJs, /function lyricTranslationWanted\(\) \{[\s\S]*?desktopLyricsTranslation === true/);
  assert.match(appJs, /function scheduleLyricLlmTranslation\(\) \{\s*\n\s*if \(!lyricTranslationWanted\(\)\) return;/);
});

test('桌面歌词翻译标志：fxDefaults 两处、读写、快照归档都带上', () => {
  const defaultCount = (appJs.match(/desktopLyricsTranslation: false,/g) || []).length;
  assert.ok(defaultCount >= 2, 'fxDefaults 与打包快照都应有 desktopLyricsTranslation 默认');
  assert.match(appJs, /desktopLyricsTranslation: desktopLyricsSchemaReady \? raw\.desktopLyricsTranslation === true : fxDefaults\.desktopLyricsTranslation,/);
  assert.match(appJs, /desktopLyricsTranslation: fx\.desktopLyricsTranslation === true,/);
  assert.match(appJs, /desktopLyricsTranslation: raw\.desktopLyricsTranslation === true,/);
});

test('桌面歌词 payload 带 showTranslation / translation，且进 dedup 签名（前后端）', () => {
  assert.match(appJs, /payload\.showTranslation = fx\.desktopLyricsTranslation === true;/);
  assert.match(appJs, /payload\.translation = payload\.showTranslation \? \(lyric\.translation \|\| ''\) : '';/);
  // 快照捕获当前行译文
  assert.match(appJs, /cache\.translation = \(!curLine\.fallback && curLine\.translation\) \? normalizeDesktopLyricText\(curLine\.translation\) : '';/);
  // 前端签名
  assert.match(appJs, /parts\[i\+\+\] = payload\.showTranslation \? 1 : 0;/);
  assert.match(appJs, /parts\[i\+\+\] = payload\.translation \|\| '';/);
  // 主进程签名
  assert.match(mainJs, /payload\.showTranslation \? 1 : 0,/);
  assert.match(mainJs, /payload\.translation \|\| '',/);
});

test('desktop-lyrics.html 渲染译文并有「翻译」工具栏开关', () => {
  // state 有 showTranslation / translation
  assert.match(desktopLyricsHtml, /showTranslation:false,translation:''/);
  // applyState 把译文并到显示文本
  assert.match(desktopLyricsHtml, /if \(trText && trText !== text\) text = text \+ '\\n' \+ trText;/);
  // 工具栏按钮与切换
  assert.match(desktopLyricsHtml, /id="translateToggleBtn"/);
  assert.match(desktopLyricsHtml, /function requestLyricsTranslation\(on\) \{/);
  assert.match(desktopLyricsHtml, /requestLyricsTranslation\(state\.showTranslation !== true\);/);
});

test('桌面「翻译」开关的 IPC 全链路接线齐全', () => {
  // overlay preload 桥
  assert.match(overlayPreloadJs, /setLyricsTranslation: \(on\) => ipcRenderer\.invoke\('mineradio-desktop-lyrics-set-translation', !!on\)/);
  // 主进程 handler + 转发给主窗口
  assert.match(mainJs, /ipcMain\.handle\('mineradio-desktop-lyrics-set-translation', handleDesktopLyricsTranslationState\)/);
  assert.match(mainJs, /mainWindow\.webContents\.send\('mineradio-desktop-lyrics-translation-request', \{ on: !!on \}\)/);
  // 主窗口 preload 订阅
  assert.match(preloadJs, /onDesktopLyricsTranslationRequest:/);
  assert.match(preloadJs, /ipcRenderer\.on\('mineradio-desktop-lyrics-translation-request', listener\)/);
  // app.js 收到请求后落到 fx 并回推
  assert.match(appJs, /api\.onDesktopLyricsTranslationRequest\(function\(payload\)\{/);
  assert.match(appJs, /fx\.desktopLyricsTranslation = nextOn;/);
});

test('主界面 FX 面板有桌面歌词翻译开关且接线', () => {
  assert.match(indexHtml, /id="t-desktopLyricsTranslation" onclick="toggleFx\('desktopLyricsTranslation'\)"/);
  assert.match(appJs, /\['desktopLyricsTranslation', 't-desktopLyricsTranslation',/);
  assert.match(appJs, /if \(key === 'desktopLyricsTranslation' && fx\.desktopLyricsTranslation === true\) scheduleLyricLlmTranslation\(\);/);
});
