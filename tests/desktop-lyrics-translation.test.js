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

test('单行舞台开启翻译时译文做静态子网格，不合进 karaoke 主纹理', () => {
  // 主 mesh 永远只放原文（单行），逐字高亮不受译文影响
  assert.match(appJs, /var maxLines = rowMode \? 1 : STAGE_LYRIC_MAX_LINES;/);
  // showStageLine 在单行 + 翻译开启时把译文单独作为 translationText 传入，主 mesh 仍只建原文
  assert.match(appJs, /if \(!multilineStage && lyricTranslationModeActive\(\)\) \{/);
  assert.match(appJs, /if \(trText && trText !== stageLyricRenderText\(text\)\) translationText = trText;/);
  assert.match(appJs, /buildLyricMesh\(text, \{ rowMode: multilineStage, translationText: translationText \}\)/);
  // buildLyricMesh 里译文是独立静态子网格（MeshBasicMaterial，不走 karaoke shader）
  assert.match(appJs, /var translationText = !rowMode && opts\.translationText \? stageLyricRenderText\(opts\.translationText\) : '';/);
  assert.match(appJs, /group\.userData\.lyric\.translationMat = trMat;/);
  // 译文子网格透明度跟随原文、随调色板换色
  assert.match(appJs, /function syncLyricTranslationOpacity\(data, textOpacity, readabilityFactor\) \{/);
  assert.match(appJs, /if \(data\.translationMat\) data\.translationMat\.color\.copy\(lyricThreeColor\(pal\.secondary \|\| pal\.primary/);
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
  // applyState 计算合并文本，但原文/译文分开建段：逐字扫描只在原文段 .ly-src，译文段 .ly-tr 静态副色
  assert.match(desktopLyricsHtml, /var text = hasTr \? srcText \+ '\\n' \+ trText : srcText;/);
  assert.match(desktopLyricsHtml, /setLineContent\(srcText, hasTr \? trText : ''\);/);
  assert.match(desktopLyricsHtml, /function setLineContent\(srcText, trText\) \{/);
  // 高亮扫描的渐变落在 .ly-src 段上（按原文自身宽度归一化），译文段 .ly-tr 恒为副色
  assert.match(desktopLyricsHtml, /body\.highlight \.line \.ly-src,body\.flowing \.line \.ly-src\{/);
  assert.match(desktopLyricsHtml, /\.line \.ly-tr\{[\s\S]*?color:var\(--lyric-secondary\)/);
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
