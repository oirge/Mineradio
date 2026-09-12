'use strict';
// 「显示与翻译」移植（对齐上游 XxHuberrr/Mineradio）：歌词行数模式、双语翻译模式、
// 译文三参数，以及本地无译文歌词的 LLM 翻译服务。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const serverJs = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function slice(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `slice start not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  assert.ok(end > start, `slice end not found: ${endMarker}`);
  return src.slice(start, end);
}

// ---------- 1. 默认值与快照 ----------
test('fxDefaults 六键默认值与上游一致', () => {
  const defaults = slice(appJs, 'var fxDefaults = {', '\n};');
  assert.match(defaults, /lyricDisplayMode: 'cinema',/);
  assert.match(defaults, /lyricTranslationMode: 'multi',/);
  assert.match(defaults, /lyricCustomLineCount: 10,/);
  assert.match(defaults, /lyricTranslationGap: 0\.92,/);
  assert.match(defaults, /lyricTranslationScale: 0\.65,/);
  assert.match(defaults, /lyricTranslationOpacity: 0\.86,/);
  const snapshot = slice(appJs, 'var PACKAGED_DEFAULT_FX_SNAPSHOT = Object.freeze({', '\n});');
  assert.match(snapshot, /lyricDisplayMode: 'cinema',/);
  assert.match(snapshot, /lyricTranslationMode: 'multi',/);
  assert.match(snapshot, /lyricTranslationGap: 0\.92,/);
});

// ---------- 2. 值函数公式（vm 跑真实切片） ----------
function loadValueFns(fxOverrides) {
  const chunk = slice(appJs, 'var LYRIC_STAGE_CONTEXT_OPACITY = 0.54;', 'function measureTextWithLetterSpacing');
  const ctx = {
    fxDefaults: {
      lyricCustomLineCount: 10, lyricTranslationGap: 0.92, lyricTranslationScale: 0.65, lyricTranslationOpacity: 0.86,
    },
    fx: Object.assign({ lyricCustomLineCount: 10, lyricTranslationGap: 0.92, lyricTranslationScale: 0.65, lyricTranslationOpacity: 0.86 }, fxOverrides || {}),
    clampRange: (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0)),
    isFinite,
    Math,
  };
  vm.runInNewContext(chunk + '\nglobalThis.__api = { normalizeLyricDisplayMode, normalizeLyricTranslationMode, lyricCustomLineCountValue, lyricDisplayLineCountForMode, lyricDisplayOffsetsForMode, lyricTranslationModeActive, lyricTranslationGapValue, lyricTranslationScaleValue, lyricTranslationOpacityValue, lyricTranslationVisualGapValue, lyricContextLineAlphaForDelta };', ctx);
  return ctx.__api;
}

test('显示模式归一：非法值回落 single（上游语义）', () => {
  const api = loadValueFns();
  assert.equal(api.normalizeLyricDisplayMode('cinema'), 'cinema');
  assert.equal(api.normalizeLyricDisplayMode('xxx'), 'single');
  assert.equal(api.normalizeLyricDisplayMode(''), 'single');
  assert.equal(api.normalizeLyricTranslationMode('multi'), 'multi');
  assert.equal(api.normalizeLyricTranslationMode('xxx'), 'off');
});

test('行数与偏移：single 1 / dual [0,1] 当前行在上 / triple 居中 / cinema 5 行 / custom 用滑条值', () => {
  const api = loadValueFns();
  assert.equal(api.lyricDisplayLineCountForMode('single'), 1);
  assert.deepEqual(Array.from(api.lyricDisplayOffsetsForMode('single')), [0]);
  assert.deepEqual(Array.from(api.lyricDisplayOffsetsForMode('dual')), [0, 1]);
  assert.deepEqual(Array.from(api.lyricDisplayOffsetsForMode('triple')), [-1, 0, 1]);
  assert.deepEqual(Array.from(api.lyricDisplayOffsetsForMode('cinema')), [-2, -1, 0, 1, 2]);
  assert.equal(api.lyricDisplayLineCountForMode('custom'), 10);
});

test('译文三参数 clamp 与视觉间距公式（默认值时 visualGap≈1.21）', () => {
  const api = loadValueFns();
  assert.equal(api.lyricTranslationGapValue(), 0.92);
  assert.equal(api.lyricTranslationScaleValue(), 0.65);
  assert.equal(api.lyricTranslationOpacityValue(), 0.86);
  const gap = api.lyricTranslationVisualGapValue();
  assert.ok(gap > 1.20 && gap < 1.22, 'visualGap default ≈1.21, got ' + gap);
  const api2 = loadValueFns({ lyricTranslationGap: 9, lyricTranslationScale: 0.2, lyricTranslationOpacity: 5 });
  assert.equal(api2.lyricTranslationGapValue(), 2.20);
  assert.equal(api2.lyricTranslationScaleValue(), 0.46);
  assert.equal(api2.lyricTranslationOpacityValue(), 1);
});

test('context 行透明度：cinema 比其他模式更实（上游 near/far 差异）', () => {
  const api = loadValueFns();
  assert.ok(api.lyricContextLineAlphaForDelta(1, 'cinema') > api.lyricContextLineAlphaForDelta(1, 'triple'));
  assert.ok(api.lyricContextLineAlphaForDelta(2, 'cinema') > api.lyricContextLineAlphaForDelta(2, 'triple'));
  assert.ok(api.lyricContextLineAlphaForDelta(1, 'triple') > api.lyricContextLineAlphaForDelta(2, 'triple'));
});

// ---------- 3. 解析层：双语 LRC 拆 translation ----------
test('解析层：双语同时间行写入 line.translation 且保持 text 合并不变', () => {
  const chunk = slice(appJs, 'var bucketTranslation = bucket.texts.length > 1', 'if (line.text && !isNoLyricText(line.text)) lines.push(line);');
  assert.match(chunk, /bucketTranslation !== String\(bucket\.texts\[0\] \|\| ''\)\.trim\(\)\) line\.translation = bucketTranslation;/);
  assert.ok(/var text = bucket\.texts\.join\('\\n'\);/.test(appJs));
});

// ---------- 4. LLM 翻译服务 ----------
test('翻译服务：端点/模型/调度门控/批处理/缓存齐全', () => {
  assert.match(serverJs, /const LYRIC_TRANSLATE_ENDPOINT = 'http:\/\/129\.204\.9\.16:8000\/v1\/chat\/completions';/);
  assert.match(serverJs, /const LYRIC_TRANSLATE_API_KEY = 'g2a_752333ba7025_t_S90cSbpFq_9qMEOuXoUl12bctaXvaP';/);
  assert.match(serverJs, /const LYRIC_TRANSLATE_MODEL = 'grok-chat-fast';/);
  assert.match(serverJs, /Authorization: 'Bearer ' \+ LYRIC_TRANSLATE_API_KEY,/);
  assert.match(appJs, /fetch\('\/api\/lyric-translate', \{/);
  assert.match(appJs, /var LYRIC_LLM_TRANSLATE_STORE_KEY = 'mineradio-lyric-llm-translation-v1';/);
  assert.match(appJs, /function scheduleLyricLlmTranslation\(\) \{[\s\S]*?if \(!lyricTranslationModeActive\(\)\) return;[\s\S]*?if \(lyricLlmTranslateState\.running \|\| lyricLlmTranslateState\.scheduled\) return;[\s\S]*?if \(Date\.now\(\) < lyricLlmTranslateState\.missUntil\) return;/);
  assert.match(appJs, /var LYRIC_LLM_TRANSLATE_BATCH = 24;/);
  // 空译文也写空串缓存，防止同批失败行无限重试
  assert.match(appJs, /if \(!translated \|\| translated === item\.text\) \{\s*cache\[item\.key\] = '';/);
  // 歌词应用后调度
  assert.match(appJs, /scheduleLyricLlmTranslation\(\);[\s\S]{0,60}renderLyrics\(\);/);
});

// ---------- 5. 渲染行池 ----------
test('渲染层：行池管理/轨道滚动/译文门控/接线齐全', () => {
  assert.match(appJs, /function buildLyricRowMesh\(text, opts\) \{/);
  assert.match(appJs, /function updateStageLyricRows\(activeIdx\) \{/);
  assert.match(appJs, /function tickStageLyricRows\(dt\) \{/);
  assert.match(appJs, /function stageLyricRowsClear\(\) \{/);
  assert.match(appJs, /if \(mode === 'single' \|\| !lines\.length \|\| activeIdx == null \|\| activeIdx < 0\) \{\s*\n\s*if \(stageLyrics\.rows\.length\) stageLyricRowsClear\(\);/);
  assert.match(appJs, /rows: \[\],\n  rowsScroll: 0,\n  rowsSignature: '',/);
  // updateStageLyrics3D 接线
  assert.match(appJs, /stageLyricTickCtx\.skullMouthLyrics = skullMouthLyrics;\s*\n\s*tickStageLyricRows\(dt\);\s*\n\s*tickStageLyricMesh\(stageLyrics\.current, true\);/);
  // clearStageLyrics 清池
  assert.match(appJs, /while \(stageLyrics\.outgoing\.length\) disposeLyricMesh\(stageLyrics\.outgoing\.pop\(\)\);\s*\n\s*stageLyricRowsClear\(\);/);
  // refreshCurrentLyricStyle 失效签名
  assert.match(appJs, /function refreshCurrentLyricStyle\(\) \{\s*\n\s*stageLyrics\.styleVersion \+= 1;\s*\n\s*stageLyrics\.rowsSignature = '';/);
  // 译文行 650 字重与 dual 半亮门控
  assert.match(appJs, /weight: isTranslation \? 650 : null,/);
  assert.match(appJs, /translationOpacity \* 0\.56/);
  // 池更新签名短路（含 custom 行数）
  assert.match(appJs, /lyricCustomLineCountValue\(\), lines\.length, stageLyrics\.styleVersion/);
});

// ---------- 6. 持久化 ----------
test('readSaved/save 双向带六键且模式归一回落正确', () => {
  const readChunk = slice(appJs, 'function readSavedLyricLayout() {', 'function saveLyricLayout() {');
  assert.match(readChunk, /lyricDisplayMode: normalizeLyricDisplayMode\(raw\.lyricDisplayMode \|\| fxDefaults\.lyricDisplayMode\),/);
  assert.match(readChunk, /lyricTranslationMode: normalizeLyricTranslationMode\(raw\.lyricTranslationMode \|\| fxDefaults\.lyricTranslationMode\),/);
  assert.match(readChunk, /lyricCustomLineCount: clampRange\(Math\.round\(isFinite\(Number\(raw\.lyricCustomLineCount\)\) \? Number\(raw\.lyricCustomLineCount\) : fxDefaults\.lyricCustomLineCount\), 1, 10\),/);
  assert.match(readChunk, /lyricTranslationGap: clampRange\(isFinite\(Number\(raw\.lyricTranslationGap\)\) \? Number\(raw\.lyricTranslationGap\) : fxDefaults\.lyricTranslationGap, 0\.28, 2\.20\),/);
  const saveChunk = slice(appJs, 'function saveLyricLayout() {', 'function normalizeHexColor(value, fallback) {');
  for (const key of ['lyricDisplayMode', 'lyricTranslationMode', 'lyricCustomLineCount', 'lyricTranslationGap', 'lyricTranslationScale', 'lyricTranslationOpacity']) {
    assert.ok(new RegExp(`${key}:`).test(saveChunk), `saveLyricLayout missing ${key}`);
  }
  assert.match(appJs, /archiveNumber\(raw, 'lyricTranslationGap', fxDefaults\.lyricTranslationGap, 0\.28, 2\.20\)/);
});

// ---------- 7. UI ----------
test('index.html：行数分段/翻译分段/四滑条与上游一致', () => {
  assert.match(indexHtml, /<div class="fx-seg" id="lyric-display-mode-seg">/);
  for (const [mode, label] of [['single', '单行'], ['dual', '双行'], ['triple', '三行'], ['cinema', '沉浸'], ['custom', '自定']]) {
    assert.match(indexHtml, new RegExp(`data-mode="${mode}"[^>]*>${label}</button>`));
  }
  assert.match(indexHtml, /<div class="fx-seg" id="lyric-translation-mode-seg">/);
  for (const [mode, label] of [['off', '关闭'], ['current', '当前'], ['dual', '双行'], ['multi', '多行']]) {
    assert.match(indexHtml, new RegExp(`data-translation="${mode}"[^>]*>${label}</button>`));
  }
  const rows = {
    'fx-lyriccustomlines': { min: '1', max: '10', step: '1' },
    'fx-lyrictranslationgap': { min: '0.28', max: '2.20', step: '0.01' },
    'fx-lyrictranslationscale': { min: '0.46', max: '1.12', step: '0.01' },
    'fx-lyrictranslationopacity': { min: '0.20', max: '1', step: '0.01' },
  };
  for (const [id, want] of Object.entries(rows)) {
    const m = indexHtml.match(new RegExp(`<input id="${id}"[^>]*>`));
    assert.ok(m, id);
    assert.ok(m[0].includes(`min="${want.min}"`) && m[0].includes(`max="${want.max}"`) && m[0].includes(`step="${want.step}"`), id + ' range');
  }
});

test('绑定/回填/setter 接线齐全', () => {
  assert.match(appJs, /\['fx-lyriccustomlines','lyricCustomLineCount'\],\['fx-lyrictranslationgap','lyricTranslationGap'\],\['fx-lyrictranslationscale','lyricTranslationScale'\],\['fx-lyrictranslationopacity','lyricTranslationOpacity'\],/);
  assert.match(appJs, /if \(pair\[1\] === 'lyricCustomLineCount'\) \{\s*\n\s*fx\.lyricCustomLineCount = lyricCustomLineCountValue\(\);\s*\n\s*fx\.lyricDisplayMode = 'custom';\s*\n\s*updateLyricDisplayModeControls\(\);/);
  assert.match(appJs, /function setLyricDisplayMode\(mode\) \{[\s\S]*?showToast\('歌词行数已切换'\);/);
  assert.match(appJs, /function setLyricTranslationMode\(mode\) \{[\s\S]*?showToast\('双语翻译已切换'\);/);
  assert.match(appJs, /setRange\('fx-lyrictranslationgap', fx\.lyricTranslationGap == null \? fxDefaults\.lyricTranslationGap : fx\.lyricTranslationGap\);/);
  assert.match(appJs, /updateLyricDisplayModeControls\(\);\s*\n\s*updateLyricTranslationModeControls\(\);/);
});
