'use strict';
// 封面取色"两套配色"的守卫。
// 视觉预设 7「音域回响·移植 Ajin」要的是上游 XxHuberrr/Mineradio 那份高饱和地形色,
// 而本仓库的歌词文字色是更早一代 (亮封面改深色字, 护可读性)。两者共用同一次封面扫描,
// 但必须各算一份 —— 这里钉的就是这条分界线: 歌词字段一个不改, ground* 走上游公式,
// raw* / rawArea* 是给预设 8 的原始封面色。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

const app = readProjectFile('public/app.js');
const topographySource = readProjectFile('public/sonic-topography-preset.js');
const workshopSource = readProjectFile('public/sonic-workshop-preset.js');

/** 从 app.js 里精确切出一个顶层函数 (按大括号配平, 跳过注释与字符串)。 */
function functionSource(name) {
  const match = new RegExp('^function ' + name + '\\b', 'm').exec(app);
  assert.ok(match, `app.js 里找不到 function ${name}`);
  let depth = 0;
  let opened = false;
  let mode = 'code';
  for (let i = match.index; i < app.length; i++) {
    const ch = app[i];
    const next = app[i + 1];
    if (mode === 'code') {
      if (ch === '/' && next === '/') { mode = 'line'; i++; continue; }
      if (ch === '/' && next === '*') { mode = 'block'; i++; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { mode = ch; continue; }
      if (ch === '{') { depth++; opened = true; continue; }
      if (ch === '}' && opened && --depth === 0) return app.slice(match.index, i + 1);
      continue;
    }
    if (mode === 'line') { if (ch === '\n') mode = 'code'; continue; }
    if (mode === 'block') { if (ch === '*' && next === '/') { mode = 'code'; i++; } continue; }
    if (ch === '\\') { i++; continue; }
    if (ch === mode) mode = 'code';
  }
  assert.fail(`function ${name} 的大括号没配平`);
}

// 取色链上用到的全部函数, 按依赖顺序切出来单独跑, 不用把整个 app.js 拉进 vm。
const HELPERS = [
  'clampRange', 'rgbToHsl', 'hslToRgb', 'rgbCss',
  'silverBlueLyricPalette', 'lyricTextPaletteFromHsl', 'lyricHighImpactTextHsl', 'lyricGroundPaletteFromHsl',
  'lyricCoverSampleCss', 'lyricCoverSample', 'lyricCoverLooksMonochrome', 'lyricCoverPushUniqueColor',
  'lyricCoverAreaDistance', 'lyricCoverAddAreaBucket', 'lyricCoverAreaBucketList', 'lyricCoverPickAreaColor',
  'lyricCoverAreaPaletteFromBuckets', 'lyricCurrentCoverPaletteKey', 'updateLyricPaletteFromCover',
];

/** 每个测试单独起一个 realm: stageLyrics / fx 都是模块级可变状态。 */
function loadPalette(opts) {
  opts = opts || {};
  const pushed = [];
  const applied = [];
  const sandbox = {
    Math, Number, String, Object, Array, JSON, isFinite, console,
    stageLyrics: {},
    fx: Object.assign({ lyricColorMode: 'auto' }, opts.fx),
    playQueue: opts.playQueue || [],
    playlist: opts.playlist || [],
    currentIdx: opts.currentIdx == null ? -1 : opts.currentIdx,
    songCoverSrc: opts.songCoverSrc || null,
    setStageLyricPalette(palette) { applied.push(palette); },
    MineradioSonicWorkshop: { pushProperties(force) { pushed.push(force); } },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(HELPERS.map(functionSource).join('\n'), sandbox);
  return { sandbox, pushed, applied };
}

/** 跨 vm realm 的对象原型不是同一份, deepEqual 会假失败, 统一走 JSON 回环。 */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/** 造一张假封面: getImageData 之外的 canvas API 一个都用不到。 */
function cover(w, h, pixel) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = pixel(x, y) || [0, 0, 0, 255];
      const di = (y * w + x) * 4;
      data[di] = px[0];
      data[di + 1] = px[1];
      data[di + 2] = px[2];
      data[di + 3] = px[3] == null ? 255 : px[3];
    }
  }
  return { width: w, height: h, getContext: () => ({ getImageData: () => ({ data, width: w, height: h }) }) };
}

/** 把 rgb()/rgba() 颜色还原成 HSL, 用来断言"亮度被压深还是被顶亮"这类意图。 */
function hslOf(sandbox, css) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(css));
  assert.ok(m, `不是 rgb 颜色: ${css}`);
  return sandbox.rgbToHsl(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** 取 rgba() 的 alpha, glow 的透明度是配色的一部分。 */
function alphaOf(css) {
  const m = /rgba\([^)]*,\s*([0-9.]+)\)\s*$/.exec(String(css));
  assert.ok(m, `不是 rgba 颜色: ${css}`);
  return Number(m[1]);
}

const SILVER_BLUE = {
  primary: '#d8f1ff',
  secondary: '#9db8cf',
  highlight: '#eef7ff',
  shadow: 'rgba(0,7,12,0.48)',
  glow: 'rgba(138,190,255,0.26)',
};

test('歌词文字配色仍是本仓库这一代：暗封面提亮、亮封面压深', () => {
  const { sandbox } = loadPalette();
  const t = (hsl, avgL, chroma) => plain(sandbox.lyricTextPaletteFromHsl(hsl, avgL, chroma));
  const mid = { h: 0.58, s: 0.62, l: 0.55 };

  // 三道兜底: 太暗、几乎没彩色、暗色调的红紫封面 —— 都退银蓝, 免得字看不清。
  assert.deepEqual(t(mid, 0.12, 0.50), SILVER_BLUE);
  assert.deepEqual(t(mid, 0.55, 0.05), SILVER_BLUE);
  assert.deepEqual(t({ h: 0.02, s: 0.62, l: 0.55 }, 0.25, 0.50), SILVER_BLUE);
  assert.deepEqual(t({ h: 0.95, s: 0.62, l: 0.55 }, 0.25, 0.50), SILVER_BLUE);
  // 亮且寡淡的封面改深青色字 —— 这是本仓库独有的一代, 上游没有这一支。
  assert.deepEqual(t(mid, 0.86, 0.10), {
    primary: '#064b5b',
    secondary: '#168c88',
    highlight: '#315f68',
    shadow: 'rgba(255,255,255,0.48)',
    glow: 'rgba(143,233,255,0.14)',
  });

  // avgL < 0.52 才用亮字 (l 0.74), 否则压到 l 0.34。
  const light = t(mid, 0.40, 0.50);
  assert.ok(Math.abs(hslOf(sandbox, light.primary).l - 0.74) < 0.02, `实际 ${light.primary}`);
  assert.equal(light.shadow, 'rgba(0,6,10,0.44)');
  assert.equal(alphaOf(light.glow), 0.24);
  const dark = t(mid, 0.60, 0.50);
  assert.ok(Math.abs(hslOf(sandbox, dark.primary).l - 0.34) < 0.02, `实际 ${dark.primary}`);
  assert.equal(dark.shadow, 'rgba(248,253,255,0.40)');
  assert.equal(alphaOf(dark.glow), 0.14);

  // 饱和度夹在 0.42~0.78: 顶格也只到 0.78, 远低于地形层的 0.90。
  assert.ok(Math.abs(hslOf(sandbox, t({ h: 0.58, s: 0.99, l: 0.55 }, 0.60, 0.50).primary).s - 0.78) < 0.02);
  assert.ok(Math.abs(hslOf(sandbox, t({ h: 0.58, s: 0.10, l: 0.55 }, 0.60, 0.50).primary).s - 0.42) < 0.02);
});

test('地形配色走上游高饱和公式，同一封面比歌词字色更艳更亮', () => {
  const { sandbox } = loadPalette();
  const hsl = { h: 0.58, s: 0.62, l: 0.61 };
  const stats = { avgChroma: 0.30, maxChroma: 0.78, colorfulRatio: 0.90, monochrome: false };
  const text = plain(sandbox.lyricTextPaletteFromHsl(hsl, 0.55, 0.78));
  const ground = plain(sandbox.lyricGroundPaletteFromHsl(hsl, 0.55, 0.78, stats));

  // 上游: 饱和度顶到 0.90、亮度顶到 0.90; 本仓库歌词色同一封面被压到 l 0.34 / s 0.78。
  const gp = hslOf(sandbox, ground.primary);
  assert.ok(Math.abs(gp.s - 0.90) < 0.03, `地形主色饱和度该顶到 0.90, 实际 ${ground.primary}`);
  assert.ok(Math.abs(gp.l - 0.90) < 0.02, `地形主色亮度该顶到 0.90, 实际 ${ground.primary}`);
  assert.ok(Math.abs(gp.h - hsl.h) < 0.01, '色相照抄封面');
  const tp = hslOf(sandbox, text.primary);
  assert.ok(gp.l > tp.l + 0.4, `地形要比歌词字亮一大截, 实际 ${ground.primary} vs ${text.primary}`);
  assert.ok(gp.s > tp.s, '也要更艳');
  assert.notEqual(ground.primary, text.primary);

  // 次色 / 高光的色相偏移与夹取范围也照上游: +0.08 / +0.03, s 0.81 / 0.738, l 0.80 / 0.96。
  const gs = hslOf(sandbox, ground.secondary);
  assert.ok(Math.abs(gs.h - (hsl.h + 0.08)) < 0.01);
  assert.ok(Math.abs(gs.s - 0.81) < 0.03, `实际 ${ground.secondary}`);
  assert.ok(Math.abs(gs.l - 0.80) < 0.02, `实际 ${ground.secondary}`);
  const gh = hslOf(sandbox, ground.highlight);
  assert.ok(Math.abs(gh.h - (hsl.h + 0.03)) < 0.02);
  assert.ok(Math.abs(gh.s - 0.738) < 0.04, `实际 ${ground.highlight}`);
  assert.ok(Math.abs(gh.l - 0.96) < 0.02, `实际 ${ground.highlight}`);
  assert.equal(ground.shadow, 'rgba(0,6,10,0.48)');
  assert.equal(alphaOf(ground.glow), 0.30);

  // 关键的一处观感差: 亮而寡淡的封面 (chroma < 0.12), 歌词改深青字, 但地形不能跟着变深。
  const brightText = plain(sandbox.lyricTextPaletteFromHsl(hsl, 0.86, 0.10));
  const brightGround = plain(sandbox.lyricGroundPaletteFromHsl(hsl, 0.86, 0.10, stats));
  assert.equal(brightText.primary, '#064b5b');
  assert.ok(hslOf(sandbox, brightGround.primary).l > 0.66, `实际 ${brightGround.primary}`);
});

test('地形配色的兜底门槛逐条生效，缺 opts 时按采样彩度自己补齐', () => {
  const { sandbox } = loadPalette();
  const base = { hsl: { h: 0.58, s: 0.62, l: 0.61 }, avgL: 0.55, chroma: 0.20 };
  const baseStats = { avgChroma: 0.10, maxChroma: 0.40, colorfulRatio: 0.50, monochrome: false };
  const call = (over) => {
    const o = Object.assign({}, base, over);
    return plain(sandbox.lyricGroundPaletteFromHsl(o.hsl, o.avgL, o.chroma, Object.assign({}, baseStats, over && over.stats)));
  };
  assert.notDeepEqual(call(), SILVER_BLUE, '门槛都过了就该出彩色');

  // 每一条单独踩线都要退银蓝: 上游用这七道门挡住"从噪点里挑出假颜色"。
  assert.deepEqual(call({ stats: { monochrome: true } }), SILVER_BLUE, 'monochrome');
  assert.deepEqual(call({ avgL: 0.15 }), SILVER_BLUE, 'avgL < 0.16');
  assert.deepEqual(call({ chroma: 0.05 }), SILVER_BLUE, 'sampleChroma < 0.055');
  assert.deepEqual(call({ stats: { avgChroma: 0.02 } }), SILVER_BLUE, 'avgChroma < 0.026');
  assert.deepEqual(call({ stats: { maxChroma: 0.09 } }), SILVER_BLUE, 'maxChroma < 0.095');
  assert.deepEqual(call({ stats: { colorfulRatio: 0.01 } }), SILVER_BLUE, 'colorfulRatio < 0.014');
  assert.deepEqual(call({ hsl: { h: 0.58, s: 0.05, l: 0.61 } }), SILVER_BLUE, 'hsl.s < 0.060');
  // 暗色调的红 / 紫封面同样退银蓝 (和歌词那一支同一条规则)。
  [0.02, 0.95, 0.80].forEach((h) => {
    assert.deepEqual(call({ hsl: { h: h, s: 0.62, l: 0.61 }, avgL: 0.25 }), SILVER_BLUE, `hue ${h}`);
  });

  // 不传 opts: avgChroma / maxChroma 退化成采样彩度, colorfulRatio 按 0.055 二值化。
  assert.notDeepEqual(plain(sandbox.lyricGroundPaletteFromHsl(base.hsl, 0.55, 0.20)), SILVER_BLUE);
  assert.deepEqual(plain(sandbox.lyricGroundPaletteFromHsl(base.hsl, 0.55, 0.05)), SILVER_BLUE);
  // 连 hsl 都不传时用默认灰蓝, s = 0 直接退银蓝, 不许算出 NaN 颜色。
  assert.deepEqual(plain(sandbox.lyricGroundPaletteFromHsl(null, 0.55, 0.20, baseStats)), SILVER_BLUE);
});

test('高冲击色调换算照上游：饱和度顶到 minS，中性色不硬上色', () => {
  const { sandbox } = loadPalette();
  const tone = (hsl, opts) => plain(sandbox.lyricHighImpactTextHsl(hsl, opts));

  // 暗采样: s 先乘 1.20 再顶到 minS 0.88, 亮度 +0.30 后夹在 0.70~0.90。
  const dim = tone({ h: 0.50, s: 0.50, l: 0.50 });
  assert.equal(dim.h, 0.50);
  assert.ok(Math.abs(dim.s - 0.88) < 1e-9, `实际 ${dim.s}`);
  assert.ok(Math.abs(dim.l - 0.80) < 1e-9, `实际 ${dim.l}`);
  assert.equal(dim.neutral, false);
  assert.equal(dim.sampledBright, false);
  assert.equal(tone({ h: 0.50, s: 0.90, l: 0.61 }).l, 0.90, '亮度上夹 0.90');
  assert.equal(tone({ h: 0.50, s: 0.90, l: 0.00 }).l, 0.74, '亮度下限 0.74');

  // 亮采样 (自身 l ≥ 0.62 或 avgL ≥ 0.64 或调用方点名): 不再抬亮, 只补饱和度, 夹在 0.66~0.94。
  const bright = tone({ h: 0.50, s: 0.50, l: 0.70 });
  assert.equal(bright.sampledBright, true);
  assert.ok(Math.abs(bright.s - 0.88) < 1e-9);
  assert.ok(Math.abs(bright.l - 0.70) < 1e-9, '够亮就原样留着');
  assert.equal(tone({ h: 0.50, s: 0.50, l: 0.20 }, { avgL: 0.70 }).sampledBright, true);
  assert.equal(tone({ h: 0.50, s: 0.50, l: 0.20 }, { sampledBright: true }).l, 0.70, '不亮也按亮采样走时补到 0.70');
  assert.equal(tone({ h: 0.50, s: 0.50, l: 0.99 }).l, 0.94, '亮采样上夹 0.94');
  assert.ok(Math.abs(tone({ h: 0.50, s: 0.96, l: 0.70 }).s - 0.96) < 1e-9, '本来就艳就不动它');

  // 中性色: s < 0.035 判为无彩, 饱和度直接归零, 免得从灰里挑出假颜色。
  const neutral = tone({ h: 0.10, s: 0.02, l: 0.50 });
  assert.equal(neutral.neutral, true);
  assert.equal(neutral.s, 0);
  assert.equal(tone({ h: 0.10, s: 0.02, l: 0.50 }, { neutralCutoff: 0.01 }).neutral, false);
  // 地形层就是拿 minS 0.90 调的, 这里确认参数真能覆盖默认值。
  assert.ok(Math.abs(tone({ h: 0.50, s: 0.10, l: 0.70 }, { minS: 0.90 }).s - 0.90) < 1e-9);
  // 一个参数都不给时有默认色, 不会炸。
  assert.equal(tone(null).h, 0.52);
});

test('面积取色按封面占地面积挑角色色，不是按单点最优', () => {
  const { sandbox } = loadPalette();
  const buckets = {};
  const add = (n, r, g, b) => { for (let i = 0; i < n; i++) sandbox.lyricCoverAddAreaBucket(buckets, r, g, b); };
  add(50, 20, 24, 30);    // 大片暗底: 占地最大 -> primary / base
  add(30, 50, 120, 240);  // 冷蓝: 第二大 -> cool / accent
  add(20, 250, 250, 250); // 亮白 -> light
  add(12, 250, 140, 40);  // 暖橙 -> warm
  const area = sandbox.lyricCoverAreaPaletteFromBuckets(buckets);

  const css = (sample) => sandbox.lyricCoverSampleCss(sample, '');
  assert.equal(css(area.primary), 'rgb(20,24,30)', '占地最大的颜色当主色');
  assert.equal(css(area.base), 'rgb(20,24,30)');
  assert.equal(css(area.warm), 'rgb(250,140,40)');
  assert.equal(css(area.cool), 'rgb(50,120,240)');
  assert.equal(css(area.light), 'rgb(250,250,250)');
  // 强调色挑的是"面积最大的彩色", 与冷色重合是上游的行为, 不是 bug。
  assert.equal(css(area.accent), 'rgb(50,120,240)');
  assert.deepEqual(plain(area.colors), ['rgb(20,24,30)', 'rgb(50,120,240)', 'rgb(250,250,250)', 'rgb(250,140,40)']);
  assert.equal(area.primary.count, 50, '桶里的点数就是面积权重');

  // 前十色封顶: 11 个桶只留 10 个, 且按面积从大到小。
  const many = {};
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 11; i++) sandbox.lyricCoverAddAreaBucket(many, 4 + i * 24, 4 + i * 24, 4 + i * 24);
  }
  sandbox.lyricCoverAddAreaBucket(many, 4, 4, 4);
  const capped = sandbox.lyricCoverAreaPaletteFromBuckets(many);
  assert.equal(capped.colors.length, 10);
  assert.equal(plain(capped.colors)[0], 'rgb(4,4,4)', '点数最多的桶排最前');
  assert.equal(sandbox.lyricCoverAreaPaletteFromBuckets({}), null, '一个桶都没有就返回 null');

  // 没采到 (score < 0) 时走 fallback, 连 fallback 都没有时用上游的默认浅青。
  assert.equal(sandbox.lyricCoverSampleCss({ score: -1, r: 1, g: 2, b: 3 }, '#123456'), '#123456');
  assert.equal(sandbox.lyricCoverSampleCss(null), '#d6f8ff');
});

test('一次封面扫描同时产出歌词色、地形色和原始封面色', () => {
  const { sandbox, pushed, applied } = loadPalette({
    playQueue: [{ id: 's1', cover: 'covers/s1.jpg' }],
    currentIdx: 0,
    songCoverSrc: (song, size) => song.cover + '?w=' + size,
  });
  // 纯色封面 (56,160,255): best / warm / cool / light / accent 全落在同一个像素上,
  // 所以期望值可以照上游的打分公式手推, 不用猜。
  sandbox.updateLyricPaletteFromCover(cover(32, 32, () => [56, 160, 255, 255]));
  const palette = sandbox.stageLyrics.coverPalette;
  assert.ok(palette, '扫完要挂到 stageLyrics.coverPalette');

  const lum = (56 * 0.299 + 160 * 0.587 + 255 * 0.114) / 255;
  const chroma = (255 - 56) / 255;
  const score = chroma * 1.6 + (0.5 - Math.abs(lum - 0.5)) * 0.45;
  // 歌词五个字段必须与"单独调 lyricTextPaletteFromHsl"逐字一致 —— 这就是"歌词色不动"的证明。
  const expectedText = sandbox.lyricTextPaletteFromHsl(sandbox.rgbToHsl(56, 160, 255), lum, score);
  ['primary', 'secondary', 'highlight', 'shadow', 'glow'].forEach((key) => {
    assert.equal(palette[key], expectedText[key], `${key} 被地形那一支改动了`);
  });
  // 地形三个字段走另一份公式, 同一封面下明显更亮。
  const expectedGround = sandbox.lyricGroundPaletteFromHsl(sandbox.rgbToHsl(56, 160, 255), lum, chroma, {
    avgChroma: chroma, maxChroma: chroma, colorfulRatio: 1, usableColorfulRatio: 1, monochrome: false,
  });
  assert.equal(palette.groundPrimary, expectedGround.primary);
  assert.equal(palette.groundSecondary, expectedGround.secondary);
  assert.equal(palette.groundHighlight, expectedGround.highlight);
  assert.ok(hslOf(sandbox, palette.groundPrimary).l > hslOf(sandbox, palette.primary).l + 0.4);

  // 原始封面色 (预设 8 读这些): 就是取到的像素本身, 不做可读性调整。
  ['rawPrimary', 'rawWarm', 'rawCool', 'rawLight', 'rawAccent', 'rawAverage'].forEach((key) => {
    assert.equal(palette[key], 'rgb(56,160,255)', `${key} 不该被抬亮或压暗`);
  });
  assert.equal(palette.rawDark, palette.secondary, '封面里没有暗像素时按上游退回 secondary');
  assert.equal(palette.coverIsMonochrome, false);
  assert.ok(Math.abs(palette.coverAverageChroma - chroma) < 1e-9);
  assert.ok(Math.abs(palette.coverMaxChroma - chroma) < 1e-9);
  assert.equal(palette.coverColorfulRatio, 1);

  // 面积色: 只有一个颜色桶, 六个角色都落在它身上。
  ['rawAreaPrimary', 'rawAreaBase', 'rawAreaWarm', 'rawAreaCool', 'rawAreaLight', 'rawAreaAccent'].forEach((key) => {
    assert.equal(palette[key], 'rgb(56,160,255)', key);
  });
  assert.deepEqual(plain(palette.sonicWorkshopColors), ['rgb(56,160,255)']);
  // coverColors 是去重后的调色板, 重复的角色色只留一份。
  assert.deepEqual(plain(palette.coverColors), ['rgb(56,160,255)', palette.secondary, palette.primary, palette.highlight]);
  assert.equal(palette.coverSourceKey, 'covers/s1.jpg?w=400');
  assert.equal(palette.sonicWorkshopCoverKey, palette.coverSourceKey);

  // 歌词层照旧收到新配色, 壁纸层被强制推一次属性 (封面换了要立刻重画)。
  assert.equal(applied.length, 1);
  assert.equal(applied[0], palette);
  assert.deepEqual(pushed, [true]);
});

test('灰度封面判为无彩：地形退银蓝，暖 / 冷 / 强调塌回平均色', () => {
  const { sandbox } = loadPalette();
  // 纯灰渐变: maxChroma 恒为 0, 触发 lyricCoverLooksMonochrome。
  sandbox.updateLyricPaletteFromCover(cover(32, 32, (x, y) => {
    const v = 40 + Math.round((x + y) * 2.5);
    return [v, v, v, 255];
  }));
  const palette = sandbox.stageLyrics.coverPalette;
  assert.equal(palette.coverIsMonochrome, true);
  assert.equal(palette.coverMaxChroma, 0);
  assert.equal(palette.coverColorfulRatio, 0);
  // 地形色按真彩度判断, 灰封面退银蓝。
  assert.equal(palette.groundPrimary, SILVER_BLUE.primary);
  assert.equal(palette.groundSecondary, SILVER_BLUE.secondary);
  assert.equal(palette.groundHighlight, SILVER_BLUE.highlight);
  // 歌词那一支拿 best.score 当彩度 (不是真彩度), 灰封面照旧算出这个偏红的暖灰 ——
  // 这是本仓库的老行为, 地形层单算一份的意义就在于不必去动它。
  assert.equal(palette.primary, 'rgb(217,161,161)');
  assert.equal(palette.secondary, 'rgb(193,157,123)');
  assert.equal(palette.highlight, 'rgb(229,213,209)');
  assert.notEqual(palette.primary, SILVER_BLUE.primary);
  // 无彩封面下 warm / cool / accent 一律换成整图平均色, 不再各挑一个假颜色。
  assert.equal(palette.rawAverage, 'rgb(100,100,100)');
  assert.equal(palette.rawWarm, palette.rawAverage);
  assert.equal(palette.rawCool, palette.rawAverage);
  assert.equal(palette.rawAccent, palette.rawAverage);
  // light / dark 是按亮度挑的, 灰封面照挑不误。
  assert.equal(palette.rawLight, 'rgb(160,160,160)');
  assert.equal(palette.rawDark, 'rgb(40,40,40)');
  assert.equal(palette.coverSourceKey, '', '没有当前歌曲时封面身份串是空的');

  // 门槛判定本身: 四个统计量各踩一条线都算无彩。
  const mono = (stats) => sandbox.lyricCoverLooksMonochrome(stats);
  const ok = { avgChroma: 0.10, maxChroma: 0.40, colorfulRatio: 0.50, usableColorfulRatio: 0.20 };
  assert.equal(mono(ok), false);
  assert.equal(mono(Object.assign({}, ok, { maxChroma: 0.09 })), true);
  assert.equal(mono(Object.assign({}, ok, { avgChroma: 0.02 })), true);
  assert.equal(mono(Object.assign({}, ok, { colorfulRatio: 0.01 })), true);
  assert.equal(mono(Object.assign({}, ok, { usableColorfulRatio: 0.005 })), true);
  assert.equal(mono(), true, '什么都没统计到时按无彩处理');
});

test('自定义歌词配色时不覆盖歌词，但封面色照旧更新；扫不到像素就整段跳过', () => {
  const custom = loadPalette({ fx: { lyricColorMode: 'custom' } });
  custom.sandbox.updateLyricPaletteFromCover(cover(32, 32, () => [56, 160, 255, 255]));
  assert.ok(custom.sandbox.stageLyrics.coverPalette, '封面色还是要算, 壁纸层要用');
  assert.equal(custom.applied.length, 0, '用户自定义了歌词色就别去改它');
  assert.deepEqual(custom.pushed, [true], '壁纸层照样要收到新封面色');

  // 没有 canvas / 全透明封面: 直接返回, 不许留下半份配色。
  const empty = loadPalette();
  empty.sandbox.updateLyricPaletteFromCover(null);
  assert.equal(empty.sandbox.stageLyrics.coverPalette, undefined);
  empty.sandbox.updateLyricPaletteFromCover(cover(32, 32, () => [56, 160, 255, 0]));
  assert.equal(empty.sandbox.stageLyrics.coverPalette, undefined, '全透明就是没采到, 不能落一份默认色');
  assert.deepEqual(empty.pushed, []);
});

test('分界线写在源码里：歌词色用 best，地形色用 rawBest，两个预设各读各的', () => {
  assert.match(app, /var palette = lyricTextPaletteFromHsl\(hsl, avgL, Math\.max\(0, best\.score\)\);/);
  assert.match(app, /var rawBest = best\.score >= 0 \? best : avgSample;/);
  assert.match(app, /palette\.groundPrimary = groundPalette\.primary;/);
  assert.match(app, /palette\.groundSecondary = groundPalette\.secondary;/);
  assert.match(app, /palette\.groundHighlight = groundPalette\.highlight;/);
  // 歌词那支函数不许沾地形那边的东西, 否则两套配色又粘回一起。
  assert.doesNotMatch(functionSource('lyricTextPaletteFromHsl'), /ground|HighImpact|minS/i);
  // 地形那支必须走 minS 0.90 的高冲击换算, 默认值 0.88 留给别的调用方 (都是上游原值)。
  assert.match(functionSource('lyricGroundPaletteFromHsl'), /lyricHighImpactTextHsl\(hsl, \{ avgL: avgL, minS: 0\.90/);
  assert.match(functionSource('lyricHighImpactTextHsl'), /opts\.minS == null \? 0\.88/);

  // 预设 7 只读 ground*, 预设 8 只读 raw* / rawArea*: 谁也别去读对方的字段。
  assert.match(topographySource, /palette\.groundPrimary \|\| palette\.primary/);
  assert.doesNotMatch(topographySource, /rawArea|rawPrimary/);
  assert.match(workshopSource, /pal\.rawAreaPrimary \|\| pal\.rawPrimary/);
  assert.doesNotMatch(workshopSource, /ground/);
});
