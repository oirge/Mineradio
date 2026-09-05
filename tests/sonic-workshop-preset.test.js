'use strict';
// 音域回响 · Wallpaper Engine 原作 (视觉预设 8) 的壁纸层守卫。
// 这一层不是重写: public/vendor/sonic-workshop/ 是 CmzYa 的 WE 作品打包产物,
// public/sonic-workshop-preset.js 只负责把本项目的音频 / 封面 / 播放状态按 WE 的格式喂进 iframe。
// 所以这里既钉住出处和"整层不可命中", 也用假 DOM 真跑一遍 update(), 断言推送节流与音频整形。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function readSourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码块: ${startMarker}`);
  return source.slice(start, end);
}

const app = readProjectFile('public/app.js');
const presetSource = readProjectFile('public/sonic-workshop-preset.js');
const indexHtml = readProjectFile('public/index.html');
const appCss = readProjectFile('public/app.css');
const VENDOR_DIR = 'public/vendor/sonic-workshop';
const BRIDGE_SRC = 'vendor/sonic-workshop/mineradio-bridge.html';

/** 够用的假 DOM: 只实现壁纸层要用的那几样 —— 插入位置、属性、class、iframe 查找。 */
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.id = '';
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = {};
    this.tabIndex = 0;
    this.draggable = true;
    this.onload = null;
    this.contentWindow = null;
    const classes = new Set();
    this.classList = {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, on) => {
        const next = on === undefined ? !classes.has(c) : !!on;
        if (next) classes.add(c); else classes.delete(c);
        return next;
      },
    };
  }

  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node; }

  insertBefore(node, ref) {
    const at = this.children.indexOf(ref);
    node.parentNode = this;
    if (at < 0) this.children.push(node);
    else this.children.splice(at, 0, node);
    return node;
  }

  removeChild(node) {
    const at = this.children.indexOf(node);
    if (at >= 0) this.children.splice(at, 1);
    node.parentNode = null;
    return node;
  }

  get firstChild() { return this.children[0] || null; }

  querySelector(selector) {
    const want = String(selector).toLowerCase();
    for (const child of this.children) {
      if (child.tagName.toLowerCase() === want) return child;
      const hit = child.querySelector(selector);
      if (hit) return hit;
    }
    return null;
  }
}

/** 假 iframe 宿主: 默认带着桥接层的三个直调入口, 删掉它们就回落到 postMessage。 */
function createBridgeWindow(recorder) {
  return {
    __mineradioApplyAudio(samples) { recorder.audio.push(samples); },
    __mineradioApplyMedia(media) { recorder.media.push(media); },
    __mineradioApplyProperties(properties) { recorder.properties.push(properties); },
    postMessage(message, origin) { recorder.posted.push({ message, origin }); },
  };
}

function createDom(recorder) {
  const body = new El('body');
  const albumBg = new El('div');
  albumBg.id = 'album-bg';
  const canvasContainer = new El('div');
  canvasContainer.id = 'canvas-container';
  body.appendChild(albumBg);
  body.appendChild(canvasContainer);

  function walk(node, id) {
    if (node.id === id) return node;
    for (const child of node.children) {
      const hit = walk(child, id);
      if (hit) return hit;
    }
    return null;
  }

  const document = {
    body,
    createElement(tag) {
      const el = new El(tag);
      if (el.tagName === 'IFRAME') el.contentWindow = createBridgeWindow(recorder);
      return el;
    },
    getElementById(id) { return walk(body, id); },
  };
  return { document, body, albumBg, canvasContainer };
}

/**
 * 把壁纸层脚本装进假 window 里跑起来。
 * @param {object} [globals] 覆盖 fx / frequencyData / playing / stageLyrics 等窗口全局
 * @returns {object} 模块本体 + 假 DOM + 推送记录 + 可控时钟
 */
function bootstrap(globals) {
  const recorder = { audio: [], media: [], properties: [], posted: [] };
  const dom = createDom(recorder);
  const clock = { now: 10000 };
  const messageHandlers = [];
  const sandbox = {
    document: dom.document,
    performance: { now: () => clock.now },
    setTimeout: () => 0,
    clearTimeout: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    addEventListener(type, fn) { if (type === 'message') messageHandlers.push(fn); },
    fx: { preset: 8, performanceQuality: 'high' },
    playing: true,
    audio: { paused: false, currentTime: 0, duration: 0 },
    frequencyData: null,
    stageLyrics: null,
    playQueue: [],
    currentIdx: -1,
  };
  Object.assign(sandbox, globals || {});
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(presetSource, sandbox, { filename: 'public/sonic-workshop-preset.js' });
  return {
    mod: sandbox.MineradioSonicWorkshop,
    sandbox,
    dom,
    recorder,
    clock,
    fireMessage: (data) => messageHandlers.forEach((fn) => fn({ data })),
    layer: () => dom.document.getElementById('sonic-workshop-layer'),
    iframe: () => {
      const layer = dom.document.getElementById('sonic-workshop-layer');
      return layer && layer.querySelector('iframe');
    },
    reset: () => {
      recorder.audio.length = 0;
      recorder.media.length = 0;
      recorder.properties.length = 0;
      recorder.posted.length = 0;
    },
  };
}

/** 推着假时钟跑若干帧 update()。 */
function run(h, frames, audioFrame, dt) {
  const step = dt || 1 / 60;
  for (let i = 0; i < frames; i++) {
    h.clock.now += step * 1000;
    h.mod.update(step, { fx: h.sandbox.fx, audio: audioFrame || {} });
  }
}

function opacity(h) {
  const layer = h.layer();
  return layer ? Number(layer.style.opacity) : 0;
}

/** 取最后一次推进去的主题配色。 */
function lastTheme(h) {
  const props = h.recorder.properties[h.recorder.properties.length - 1];
  assert.ok(props && props.mineradioCustomTheme, '没有推送过配色');
  return props.mineradioCustomTheme;
}

function luminance(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
}

test('壁纸层登记成预设 8，只在这个预设上活跃，加载本身不碰页面', () => {
  const h = bootstrap();
  assert.equal(h.mod.INDEX, 8);
  assert.deepEqual(Object.keys(h.mod).sort(), ['INDEX', 'clear', 'isActive', 'onPresetChange', 'pushProperties', 'update']);
  assert.equal(h.mod.isActive({ preset: 8 }), true);
  assert.equal(h.mod.isActive({ preset: '8' }), true);
  assert.equal(h.mod.isActive({ preset: 7 }), false, '预设 7 是 three.js 移植版, 两层不能同时亮');
  assert.equal(h.mod.isActive(null), false);
  assert.equal(h.layer(), null, '光加载脚本不该往页面里塞东西');
  assert.equal(h.recorder.audio.length, 0);
});

test('壁纸层紧贴在画布之前，整层与 iframe 一律不可命中', () => {
  const h = bootstrap();
  run(h, 1);
  const layer = h.layer();
  assert.ok(layer, 'update 到预设 8 就该挂出壁纸层');
  const siblings = h.dom.body.children;
  assert.equal(
    siblings.indexOf(layer) + 1,
    siblings.indexOf(h.dom.canvasContainer),
    '必须紧贴 #canvas-container 之前: 压住其余背景层, 又不许盖住粒子画布',
  );
  assert.equal(layer.style.pointerEvents, 'none');
  assert.equal(layer.getAttribute('aria-hidden'), 'true');
  assert.equal(layer.getAttribute('inert'), '');
  assert.equal(layer.tabIndex, -1);

  const iframe = h.iframe();
  assert.equal(iframe.src, BRIDGE_SRC);
  assert.equal(iframe.style.pointerEvents, 'none');
  assert.equal(iframe.getAttribute('inert'), '');
  assert.equal(iframe.getAttribute('aria-hidden'), 'true');
  assert.equal(iframe.getAttribute('tabindex'), '-1');
  assert.equal(iframe.draggable, false, 'iframe 可拖会被拖出一张幽灵图');
  assert.equal(h.dom.body.classList.contains('sonic-workshop-active'), true);
});

test('淡入淡出到位后整层摘掉，WE 那套 three.js 不留在后台空转', () => {
  const h = bootstrap();
  run(h, 1);
  const first = opacity(h);
  assert.ok(first > 0 && first < 1, `第一帧只该淡入一部分, 实际 ${first}`);
  run(h, 60);
  assert.ok(opacity(h) > 0.99, '一秒内要淡满');

  h.sandbox.fx.preset = 0;
  run(h, 1);
  assert.ok(h.layer(), '刚切走还在淡出, 不能直接抠掉');
  assert.ok(opacity(h) < 0.99);
  run(h, 240);
  assert.equal(h.layer(), null, '淡完就该把 iframe 摘掉');
  assert.equal(h.dom.body.classList.contains('sonic-workshop-active'), false);
});

test('切进预设 8 当帧就挂层补推全量，切走留给淡出收尾', () => {
  const h = bootstrap({ fx: { preset: 0, performanceQuality: 'high' } });
  h.mod.onPresetChange(0, 8, { fx: h.sandbox.fx });
  assert.ok(h.layer(), '切换那一刻就要挂好, 不能等下一帧');
  assert.equal(h.recorder.properties.length, 1);
  assert.equal(h.recorder.media.length, 1);
  assert.equal(h.recorder.audio.length, 1);
  assert.equal(h.dom.body.classList.contains('sonic-workshop-active'), true);

  h.mod.onPresetChange(8, 0, { fx: h.sandbox.fx });
  assert.ok(h.layer(), '切走时留着让它淡出, 由 update 收尾');

  h.mod.clear();
  assert.equal(h.layer(), null);
  assert.equal(h.dom.body.classList.contains('sonic-workshop-active'), false);
});

test('没挂层的时候推送全是空转，不会抛错', () => {
  const h = bootstrap({ fx: { preset: 0 } });
  h.mod.pushProperties(true);
  run(h, 3);
  assert.equal(h.recorder.properties.length, 0);
  assert.equal(h.recorder.audio.length, 0);
  assert.equal(h.layer(), null);
});

/** 挂层并强推一次属性, 返回推进 iframe 的那份 WE 用户属性。 */
function propsFor(globals) {
  const h = bootstrap(globals);
  h.mod.onPresetChange(0, 8, {});
  const props = h.recorder.properties[h.recorder.properties.length - 1];
  assert.ok(props, '没有推送过属性');
  return { h, props };
}

test('网格精度固定在原作 project.json 的 320，不跟画质档位联动', () => {
  // 曾经按画质档位改过 (eco 224 / ultra 384), 但原作的地形密度、涟漪半径、流星尺度
  // 都是照 320 调的, 一改网格数整个画面比例就跟 CmzYa 那份不一样了。
  ['eco', 'balanced', 'high', 'ultra', 'turbo'].forEach((quality) => {
    const { props } = propsFor({ fx: { preset: 8, performanceQuality: quality } });
    assert.equal(props.gridSize, 320, `${quality} 档不该改网格数`);
  });
  // 默认档必须等于原作自己的默认值, 否则开箱效果就不是 CmzYa 那份了。
  const project = JSON.parse(readProjectFile(`${VENDOR_DIR}/project.json`));
  assert.equal(project.general.properties.gridSize.value, 320);
  assert.equal(String(project.workshopid), '3747222633');
  // 画质档位不再参与属性推导, 源码里不该再留档位到网格数的映射表。
  assert.doesNotMatch(presetSource, /QUALITY_GRID_SIZE/);
});

test('除了本机适配的一处，其余参数保持原作原值', () => {
  const { props } = propsFor();
  assert.equal(props.audioIntensity, 1.15);
  assert.equal(props.responseRange, 1.3);
  assert.equal(props.cameraDistance, 80);
  assert.equal(props.autoRotateEnabled, true);
  assert.equal(props.autoRotateSpeed, 7);
  assert.equal(props.cameraAngleX, 150);
  assert.equal(props.cameraAngleY, 30);
  assert.equal(props.pulseEnabled, true);
  assert.equal(props.meteorEnabled, true);
  assert.equal(props.idleWaveEnabled, true);
  assert.equal(props.showAlbumCover, true);
  // 壁纸自带的播放器控件要关掉: 本项目有自己的播放器, 两套叠着是重影。
  assert.equal(props.showPlayerController, false);

  const project = JSON.parse(readProjectFile(`${VENDOR_DIR}/project.json`));
  ['audioIntensity', 'responseRange', 'cameraDistance', 'autoRotateSpeed'].forEach((key) => {
    assert.equal(props[key], project.general.properties[key].value, `${key} 与原作默认值不一致`);
  });
});

test('音频与响应强度按 WE 的合法区间夹住', () => {
  const high = propsFor({
    fx: {
      preset: 8,
      performanceQuality: 'high',
      sonicWorkshopAudioIntensity: 99,
      sonicWorkshopResponseRange: 99,
      sonicWorkshopPeakIntensity: 99,
    },
  }).props;
  assert.equal(high.audioIntensity, 2.5);
  assert.equal(high.responseRange, 2);
  assert.equal(high.peakColorIntensity, 1.4);

  const low = propsFor({
    fx: {
      preset: 8,
      performanceQuality: 'high',
      sonicWorkshopAudioIntensity: -9,
      sonicWorkshopResponseRange: -9,
      sonicWorkshopPeakIntensity: -9,
    },
  }).props;
  assert.equal(low.audioIntensity, 0.3);
  assert.equal(low.responseRange, 0.3);
  assert.equal(low.peakColorIntensity, 0);
});

// 上游 app.js 交给壁纸层的是原始封面取色 (raw*), 不是给歌词用的可读性调整色。
const RAW_COVER_PALETTE = {
  // 歌词文字色: 本仓库为了可读性会抬亮/压深, 壁纸层只能拿它们兜底。
  primary: '#8fd0ff', secondary: '#ffc9a8', highlight: '#d9f4ff',
  // 原始封面色: 加权采样出来的五个角色 + 平均色。
  rawPrimary: '#3aa0ff', rawWarm: '#ff7a2f', rawCool: '#7ef9ff',
  rawLight: '#eef7ff', rawDark: '#12161e', rawAccent: '#ff9abe', rawAverage: '#5a6472',
};

test('配色吃原始封面取色而不是歌词可读性色，分角色与上游一致', () => {
  const { props } = propsFor({ stageLyrics: { coverPalette: RAW_COVER_PALETTE } });
  assert.equal(props.theme, 'mineradio-custom', '配色是本项目算出来的, 不走 WE 自带的十套主题');
  const theme = props.mineradioCustomTheme;
  // 冷色=rawCool、暖色=rawWarm、涟漪=rawLight、峰值=rawCool —— 与上游 workshopCoverHex 的链一致。
  assert.equal(theme.uCoolCore, '#7ef9ff');
  assert.equal(theme.uWarmCore, '#ff7a2f');
  assert.equal(theme.uRippleColor, '#eef7ff');
  assert.equal(theme.uPeakColor, '#7ef9ff');
  assert.equal(theme.__primaryColor, '#3aa0ff', '主色取 rawPrimary, 不是被抬亮过的 primary');
  assert.equal(props.__mineradioColorHex, '#3aa0ff');
  // 基面走 rawDark (封面里最暗的一块) 再压到两成, 于是天然是近黑的夜景底。
  assert.ok(luminance(theme.uBaseColor1) < 0.05, `基面第一层太亮: ${theme.uBaseColor1}`);
  assert.ok(luminance(theme.uBaseColor2) < 0.3, `基面第二层太亮: ${theme.uBaseColor2}`);
  assert.ok(luminance(theme.uCoolEdge) < luminance(theme.uCoolCore), '边缘要比核心暗');
  assert.ok(luminance(theme.uWarmEdge) < luminance(theme.uWarmCore));
  // schemecolor 是 WE 自己的格式: 三个 0~1 的通道, 空格分隔。
  const scheme = props.schemecolor.split(' ').map(Number);
  assert.equal(scheme.length, 3);
  assert.ok(Math.abs(scheme[0] - 58 / 255) < 1e-6);
  assert.ok(Math.abs(scheme[1] - 160 / 255) < 1e-6);
  assert.ok(Math.abs(scheme[2] - 1) < 1e-6);
  assert.equal(props.__mineradioNearestTheme, 'arctic-aurora');
});

test('封面分区取色 (rawArea*) 优先于全图加权取色', () => {
  const { props } = propsFor({
    stageLyrics: {
      coverPalette: Object.assign({}, RAW_COVER_PALETTE, {
        rawAreaPrimary: '#00c2a8', rawAreaBase: '#0a0f14', rawAreaWarm: '#ffb300',
        rawAreaCool: '#4d7cff', rawAreaLight: '#fff2e0', rawAreaAccent: '#ff4d94',
      }),
    },
  });
  const theme = props.mineradioCustomTheme;
  assert.equal(theme.__primaryColor, '#00c2a8');
  assert.equal(theme.uWarmCore, '#ffb300');
  assert.equal(theme.uCoolCore, '#4d7cff');
  assert.equal(theme.uRippleColor, '#fff2e0');
  assert.equal(theme.uPeakColor, '#ff4d94', '峰值优先 rawAreaAccent');
  assert.ok(luminance(theme.uBaseColor1) < 0.05);
});

test('认不出封面颜色就退回原作那套兜底色，主题色不再插手壁纸配色', () => {
  const bare = propsFor().props.mineradioCustomTheme;
  // 这四个兜底值直接抄上游: 主色/暖色 #cb6c89、冷色与峰值 #99c4ff、涟漪 #f8d8ff、基面 #16060f。
  assert.equal(bare.__primaryColor, '#cb6c89');
  assert.equal(bare.uCoolCore, '#99c4ff');
  assert.equal(bare.uWarmCore, '#cb6c89');
  assert.equal(bare.uRippleColor, '#f8d8ff');
  assert.equal(bare.uPeakColor, '#99c4ff');
  assert.ok(luminance(bare.uBaseColor1) < 0.05, '基面兜底 #16060f 压两成, 还是近黑');

  // 上游的取色链不看 visualTintColor, 本仓库也不许偷偷掺进去, 否则换个主题色就跟原作不一样了。
  const tinted = propsFor({
    fx: { preset: 8, performanceQuality: 'high', visualTintColor: 'rgb(255, 0, 128)' },
  }).props.mineradioCustomTheme;
  assert.equal(JSON.stringify(tinted), JSON.stringify(bare), '全局主题色不该影响壁纸层配色');
  assert.doesNotMatch(presetSource, /visualTint/);

  // 只有一个颜色的调色板也不能崩, 缺的角色各自兜底。
  const single = propsFor({ stageLyrics: { coverPalette: { rawPrimary: '#7ef9ff' } } }).props.mineradioCustomTheme;
  assert.equal(single.uCoolCore, '#7ef9ff');
  assert.equal(single.uWarmCore, '#7ef9ff');
  assert.equal(single.uRippleColor, '#f8d8ff', '涟漪链里没有主色这一档, 缺光色就用原作的 #f8d8ff');
});

// v1.9.0 的实际故障: 没在放歌时 stageLyrics.coverPalette 是 app.js 里那份初值 ——
// 只有歌词文字三色, 而且为了压在封面上读得清一律近白。上游的取色链末尾正是这三个字段
// (上游拿同一份颜色既画歌词又画地形), 照搬过来就把八个 uniform 一起顶到近白, 壁纸糊成一片惨白。
test('歌词文字色永远不许当地形色：没封面就走原作兜底，不许泛白', () => {
  // 与 public/app.js 里 stageLyrics.coverPalette 的初值逐字一致。
  const IDLE_LYRIC_PALETTE = {
    primary: '#d6f8ff',
    secondary: '#9cffdf',
    highlight: '#eef7ff',
    shadow: 'rgba(2,8,12,0.42)',
    glow: 'rgba(143,233,255,0.34)',
  };
  const initial = readSourceBlock(app, '  coverPalette: {', '  },');
  Object.keys(IDLE_LYRIC_PALETTE).forEach((key) => {
    assert.ok(
      initial.includes(`${key}: '${IDLE_LYRIC_PALETTE[key]}'`),
      `app.js 的 coverPalette 初值变了 (${key}), 这条守卫要跟着更新`,
    );
  });

  const idle = propsFor({ stageLyrics: { coverPalette: IDLE_LYRIC_PALETTE } }).props.mineradioCustomTheme;
  const bare = propsFor().props.mineradioCustomTheme;
  assert.equal(JSON.stringify(idle), JSON.stringify(bare), '没有 raw* 封面色就该和空调色板走同一套兜底');
  assert.equal(idle.__primaryColor, '#cb6c89');
  assert.equal(idle.uCoolCore, '#99c4ff');
  assert.equal(idle.uRippleColor, '#f8d8ff');
  assert.ok(luminance(idle.uBaseColor1) < 0.05, `基面被歌词色顶亮了: ${idle.uBaseColor1}`);
  // 惨白现场的两层基面亮度分别约 0.17 / 0.91, 这两条就是那次故障的直接判据。
  assert.ok(luminance(idle.uBaseColor2) < 0.4, `基面第二层被歌词色顶亮了: ${idle.uBaseColor2}`);
  // 故障时 冷色/涟漪/峰值 会同时取到歌词高光色, 三个挤成同一个近白值。
  assert.notEqual(idle.uCoolCore, idle.uRippleColor, '冷色与涟漪撞成同一个值');
  assert.notEqual(idle.uWarmCore, idle.uCoolCore, '暖色与冷色撞成同一个值');
  // 只剩歌词色时地形至少还得有明暗层次, 不能全是同一片。
  assert.ok(luminance(idle.uCoolCore) - luminance(idle.uBaseColor1) > 0.3, '地形没有明暗层次');

  // 取色链里不许再出现歌词文字三色 —— 只要它们回来, 惨白就会复发。
  const chain = readSourceBlock(presetSource, '  function workshopCoverHex(role)', '  function colorDistance');
  assert.doesNotMatch(chain, /pal\.primary/, '取色链不许退到歌词主色');
  assert.doesNotMatch(chain, /pal\.highlight/, '取色链不许退到歌词高光色');
  assert.doesNotMatch(chain, /pal\.secondary/, '取色链不许退到歌词副色');
});

test('自定义配色压过封面：整体色改主色，分区色各改各的', () => {
  const overall = propsFor({
    fx: {
      preset: 8,
      performanceQuality: 'high',
      sonicWorkshopColorMode: 'custom',
      sonicWorkshopCustomColor: '#22ffaa',
      sonicWorkshopTheme: 'aurora',
    },
    stageLyrics: { coverPalette: { primary: '#3aa0ff' } },
  }).props;
  assert.equal(overall.__mineradioColorHex, '#22ffaa');
  assert.equal(overall.mineradioCustomTheme.__primaryColor, '#22ffaa');
  // 自定义模式下 nearestTheme 直接用用户选的主题, 别名要归一。
  assert.equal(overall.__mineradioNearestTheme, 'arctic-aurora');

  const regions = propsFor({
    fx: {
      preset: 8,
      performanceQuality: 'high',
      sonicWorkshopCoolColorMode: 'custom',
      sonicWorkshopCoolColor: 'rgb(18, 52, 86)',
      sonicWorkshopWarmColorMode: 'custom',
      sonicWorkshopWarmColor: '#abc',
      sonicWorkshopRippleColorMode: 'custom',
      sonicWorkshopRippleColor: '#ff00ff',
    },
    stageLyrics: { coverPalette: { primary: '#3aa0ff', secondary: '#ff7a2f', highlight: '#7ef9ff' } },
  }).props.mineradioCustomTheme;
  assert.equal(regions.uCoolCore, '#123456');
  assert.equal(regions.uWarmCore, '#aabbcc', '三位简写要展开成六位');
  assert.equal(regions.uRippleColor, '#ff00ff');

  const garbage = propsFor({
    fx: { preset: 8, performanceQuality: 'high', sonicWorkshopColorMode: 'custom', sonicWorkshopTheme: '不存在的主题' },
  }).props;
  assert.equal(garbage.__mineradioNearestTheme, 'coral-mirage', '主题认不出就回原作默认');
});

/** 强推一帧音频, 返回喂给壁纸的 512 段。 */
function samplesFor(globals, audioFrame) {
  const h = bootstrap(globals);
  h.mod.onPresetChange(0, 8, { audio: audioFrame || {} });
  const samples = h.recorder.audio[h.recorder.audio.length - 1];
  assert.ok(samples, '没有推送过音频');
  return samples;
}

test('音频按 WE 的 512 段喂进去，整形系数保持上游原值', () => {
  const full = samplesFor({ frequencyData: new Uint8Array(1024).fill(255) });
  assert.equal(full.length, 512);
  // 满刻度: body(1)*bodyGain(0.28) + peak(1)*peakGain(0.12) = 0.40, 再乘默认输入增益 0.82。
  const expected = (0.28 + 0.12) * 0.82;
  full.forEach((v, i) => {
    assert.ok(Math.abs(v - expected) < 1e-9, `第 ${i} 段是 ${v}, 应该是 ${expected}`);
    assert.ok(v <= 0.52, '整形结果必须封在 0.52 以内');
  });

  // 静音时壁纸要彻底躺平, 不能靠底噪自己抖。
  const silent = samplesFor({ frequencyData: new Uint8Array(1024) });
  assert.equal(silent.length, 512);
  assert.equal(Math.max(...silent), 0);

  // 频谱段数比 512 少也要重采样成 512 段。
  const coarse = samplesFor({ frequencyData: new Uint8Array([0, 64, 128, 192, 255, 192, 128, 64]) });
  assert.equal(coarse.length, 512);
  assert.ok(Math.max(...coarse) > 0);
});

test('底鼓把最低 36 段抬起来，暂停时整条压到 12%', () => {
  const flat = new Uint8Array(1024).fill(128);
  const idle = samplesFor({ frequencyData: flat }, {});
  assert.equal(idle[0], idle[200], '没有底鼓时均匀频谱不该有低频加成');

  const kick = samplesFor({ frequencyData: flat }, { beat: 1, bass: 1 });
  assert.ok(kick[0] > idle[0], '底鼓要把最低段抬起来');
  assert.ok(kick[35] > idle[35]);
  assert.ok(Math.abs(kick[200] - idle[200]) < 1e-9, '加成只作用在最低 36 段');

  const paused = samplesFor({
    frequencyData: new Uint8Array(1024).fill(255),
    playing: false,
    audio: { paused: true, currentTime: 0, duration: 0 },
  });
  assert.ok(Math.abs(paused[0] - (0.28 + 0.12) * 0.82 * 0.12) < 1e-9, '暂停时留 12% 的呼吸感');
});

test('输入增益按 40~100 夹住再折成倍率', () => {
  const base = new Uint8Array(1024).fill(255);
  const shaped = 0.28 + 0.12;
  const low = samplesFor({ frequencyData: base, fx: { preset: 8, performanceQuality: 'high', sonicWorkshopInputGain: 5 } });
  assert.ok(Math.abs(low[0] - shaped * 0.4) < 1e-9);
  const high = samplesFor({ frequencyData: base, fx: { preset: 8, performanceQuality: 'high', sonicWorkshopInputGain: 400 } });
  assert.ok(Math.abs(high[0] - shaped * 1) < 1e-9);
});

test('没有频谱数据时用八段音频帧插值兜底', () => {
  const samples = samplesFor({ frequencyData: new Uint8Array(0) }, { bass: 1, mid: 1, treble: 1 });
  assert.equal(samples.length, 512);
  samples.forEach((v) => assert.ok(Math.abs(v - 0.3 * 0.82) < 1e-9));

  const quiet = samplesFor({ frequencyData: null }, {});
  assert.equal(Math.max(...quiet), 0);
});

test('推送分三档节流：音频 33ms、媒体 250ms、属性 1000ms', () => {
  const h = bootstrap({ frequencyData: new Uint8Array(64).fill(120) });
  run(h, 1);
  assert.equal(h.recorder.audio.length, 1, '第一帧要立刻推一次');
  h.reset();

  h.clock.now += 10;
  h.mod.update(1 / 60, { fx: h.sandbox.fx, audio: {} });
  assert.equal(h.recorder.audio.length, 0, '10ms 内不该再推音频');
  assert.equal(h.recorder.media.length, 0);
  assert.equal(h.recorder.properties.length, 0);

  h.clock.now += 40;
  h.mod.update(1 / 60, { fx: h.sandbox.fx, audio: {} });
  assert.equal(h.recorder.audio.length, 1, '过了 33ms 才推下一帧音频');
  assert.equal(h.recorder.media.length, 0, '媒体状态没变就别刷');
  assert.equal(h.recorder.properties.length, 0);

  h.clock.now += 300;
  h.mod.update(1 / 60, { fx: h.sandbox.fx, audio: {} });
  assert.equal(h.recorder.media.length, 1, '过了 250ms 补一次媒体状态');
  assert.equal(h.recorder.properties.length, 0, '属性 1000ms 才轮一次');

  h.clock.now += 800;
  h.mod.update(1 / 60, { fx: h.sandbox.fx, audio: {} });
  assert.equal(h.recorder.properties.length, 1);
});

test('配置一改就立刻生效，不用等下一个节流窗口', () => {
  const h = bootstrap();
  run(h, 1);
  h.reset();
  h.clock.now += 5;
  h.sandbox.fx.sonicWorkshopAudioIntensity = 2;
  h.mod.update(1 / 60, { fx: h.sandbox.fx, audio: {} });
  assert.equal(h.recorder.properties.length, 1, '参数一改要马上推下去');
  assert.equal(h.recorder.properties[0].audioIntensity, 2);

  // 画质档位对这一层没有意义 (整层都在 iframe 里, 主渲染器一分钱不花), 改了不该惊动推送。
  h.reset();
  h.clock.now += 5;
  h.sandbox.fx.performanceQuality = 'eco';
  h.mod.update(1 / 60, { fx: h.sandbox.fx, audio: {} });
  assert.equal(h.recorder.properties.length, 0, '画质档不参与属性推导, 别白推一轮');

  h.reset();
  h.clock.now += 5;
  h.sandbox.playQueue = [{ name: '换歌了', artist: '某人' }];
  h.sandbox.currentIdx = 0;
  h.mod.update(1 / 60, { fx: h.sandbox.fx, audio: {} });
  assert.equal(h.recorder.media.length, 1, '换歌要马上推下去');
  assert.equal(h.recorder.media[0].title, '换歌了');
});

test('桥接层没装好直调入口时回落到 postMessage', () => {
  const h = bootstrap();
  run(h, 1);
  const frame = h.iframe().contentWindow;
  delete frame.__mineradioApplyAudio;
  delete frame.__mineradioApplyMedia;
  delete frame.__mineradioApplyProperties;
  h.reset();

  h.mod.onPresetChange(0, 8, {});
  assert.deepEqual(h.recorder.posted.map((p) => p.message.type), [
    'mineradio-sonic-workshop-properties',
    'mineradio-sonic-workshop-media',
    'mineradio-sonic-workshop-audio',
  ]);
  assert.ok(h.recorder.posted.every((p) => p.origin === '*'));
  assert.equal(h.recorder.audio.length, 0, '直调不通就只能走消息, 不能两条都发');
  assert.equal(h.recorder.posted[2].message.samples.length, 512);
  // 桥接页那侧确实收这三个消息名。
  const bridge = readProjectFile(`${VENDOR_DIR}/mineradio-bridge.html`);
  h.recorder.posted.forEach((p) => assert.ok(bridge.includes(p.message.type), `桥接页不认识 ${p.message.type}`));
});

test('iframe 加载完和桥接层报到都会补推一次全量', () => {
  const h = bootstrap();
  run(h, 1);
  h.reset();
  h.iframe().onload();
  assert.equal(h.recorder.properties.length, 1);
  assert.equal(h.recorder.media.length, 1);
  assert.equal(h.recorder.audio.length, 1);

  h.reset();
  h.fireMessage({ type: 'mineradio-sonic-workshop-ready' });
  assert.equal(h.recorder.properties.length, 1);
  assert.equal(h.recorder.media.length, 1);
  assert.equal(h.recorder.audio.length, 1);

  h.reset();
  h.fireMessage({ type: '别的消息' });
  assert.equal(h.recorder.properties.length, 0, '别的消息不该触发推送');
});

test('媒体状态按 WE 的字段喂过去，毫秒时长折成秒', () => {
  const h = bootstrap({
    playQueue: [{ name: '夜航', artist: '某人', cover: 'c1', duration: 214000 }],
    currentIdx: 0,
    audio: { paused: false, currentTime: 42.5, duration: NaN },
    songCoverSrc: (song, size) => `covers/${song.cover}@${size}`,
    stageLyrics: { coverPalette: { primary: '#3aa0ff', highlight: '#7ef9ff' } },
  });
  h.mod.onPresetChange(0, 8, {});
  const media = h.recorder.media[h.recorder.media.length - 1];
  assert.equal(media.title, '夜航');
  assert.equal(media.artist, '某人');
  assert.equal(media.thumbnail, 'covers/c1@512');
  assert.equal(media.isPlaying, true);
  assert.equal(media.position, 42.5);
  assert.equal(media.duration, 214, '毫秒时长要折成秒, 否则进度条直接跑满');
  assert.equal(media.primaryColor, '#3aa0ff');
  assert.equal(media.textColor, '#7ef9ff');

  const empty = bootstrap({ playQueue: [], currentIdx: -1 });
  empty.mod.onPresetChange(0, 8, {});
  const blank = empty.recorder.media[empty.recorder.media.length - 1];
  assert.equal(blank.title, '');
  assert.equal(blank.artist, '');
  assert.equal(blank.thumbnail, '');
});

test('壁纸层是独立脚本，必须先于 app.js 求值，且 app.js 只通过全局访问它', () => {
  const workshopAt = indexHtml.indexOf('<script src="sonic-workshop-preset.js"></script>');
  const appAt = indexHtml.indexOf('<script src="app.js"></script>');
  assert.ok(workshopAt > 0 && appAt > workshopAt, '壁纸层脚本要排在 app.js 前面');
  const accessor = readSourceBlock(app, 'function sonicWorkshopModule() {', '\n}');
  assert.match(accessor, /typeof MineradioSonicWorkshop !== 'undefined'/, '脚本没加载上也要能开机');
  assert.match(app, /var SONIC_WORKSHOP_PRESET_INDEX = 8;/);
  // app.js 里不许直接 new 出壁纸层, 只能走模块。
  assert.doesNotMatch(app, /sonic-workshop-layer/);
  assert.doesNotMatch(app, /mineradio-bridge\.html/);
});

test('主循环只给壁纸层喂数据，粒子层整体让位', () => {
  const animate = readSourceBlock(app, 'function animate() {', "resumeMainRenderLoop('startup');");
  assert.match(animate, /workshopMod\.update\(dt, sonicWorkshopCtx\);/);
  // 上下文预分配, 60fps 下不能每帧新建对象。
  assert.doesNotMatch(animate, /workshopMod\.update\(dt, \{/);
  assert.match(app, /var sonicWorkshopCtx = \{/);
  assert.match(animate, /sonicWorkshopCtx\.audio\.beat = beatPulse;/);
  // 壁纸本身就是一整幅完成品, 原项目在这个预设下把封面粒子整层收起来。
  assert.match(animate, /var workshopPresetActive = fx && fx\.preset === SONIC_WORKSHOP_PRESET_INDEX;/);
  assert.match(animate, /particles\.visible = !skullPresetActive && !workshopPresetActive;/);
  assert.match(animate, /if \(floatGroup\) floatGroup\.visible = !skullPresetActive && !workshopPresetActive;/);
  assert.match(animate, /if \(backCoverGroup\) backCoverGroup\.visible = !skullPresetActive && !workshopPresetActive;/);

  const setPreset = readSourceBlock(app, 'function setPreset(p, opts) {', 'function syncFxUniforms()');
  assert.match(setPreset, /if \(changed && \(p === SONIC_WORKSHOP_PRESET_INDEX \|\| prev === SONIC_WORKSHOP_PRESET_INDEX\)\)/);
  assert.match(setPreset, /workshopMod\.onPresetChange\(prev, p, \{ scene: scene, fx: fx \}\);/);
});

test('样式上整层穿透指针，壁纸亮着时其余背景层让位', () => {
  const layerRule = readSourceBlock(appCss, '#sonic-workshop-layer{', '}');
  assert.match(layerRule, /position:fixed/);
  assert.match(layerRule, /inset:0/);
  assert.match(layerRule, /z-index:0/, '要压在粒子画布 (z-index:1) 之下');
  assert.match(layerRule, /pointer-events:none!important/);
  // 整层连后代一起禁止命中: 少了这条, 拖视角和点界面都会被 iframe 吃掉。
  assert.match(appCss, /#sonic-workshop-layer,#sonic-workshop-layer \*\{pointer-events:none!important\}/);
  assert.match(appCss, /#sonic-workshop-layer iframe\{[^}]*pointer-events:none!important/);
  assert.match(appCss, /body\.sonic-workshop-active #album-bg,body\.sonic-workshop-active #custom-bg,body\.sonic-workshop-active #theme-bg-tint,body\.sonic-workshop-active #wallpaper-board\{opacity:0!important\}/);
  // 深睡时要跟画布一起藏起来, 否则息屏了 iframe 还在烧 GPU。
  assert.match(appCss, /body\.render-deep-sleep #canvas-container,body\.render-deep-sleep #sonic-workshop-layer/);
  // 桌面壳的圆角要跟着走, 最大化 / 全屏时收掉。
  assert.match(appCss, /body\.desktop-shell #sonic-workshop-layer\{border-radius:34px/);
  assert.match(appCss, /body\.desktop-shell\.desktop-maximized #sonic-workshop-layer[^{]*\{border-radius:0!important/);
});

test('WE 产物四件套齐全，桥接页引的资源都在，而且随安装包一起发', () => {
  const bridge = readProjectFile(`${VENDOR_DIR}/mineradio-bridge.html`);
  ['project.json', 'mineradio-bridge.html'].forEach((name) => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', VENDOR_DIR, name)), `缺了 ${name}`);
  });
  const refs = bridge.match(/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g) || [];
  assert.ok(refs.length >= 2, '桥接页至少要引壁纸的 js 和 css');
  refs.forEach((ref) => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', VENDOR_DIR, ref)), `桥接页引了不存在的 ${ref}`);
  });
  // 桥接页顶替的是 Wallpaper Engine 的宿主 API, 少一个壁纸就收不到数据。
  ['wallpaperRegisterAudioListener', 'wallpaperRegisterMediaPropertiesListener', 'wallpaperRegisterMediaThumbnailListener',
    'wallpaperRegisterMediaPlaybackListener', 'wallpaperRegisterMediaTimelineListener', 'wallpaperMediaIntegration',
    'wallpaperPropertyListener', 'wallpaperReady'].forEach((api) => {
    assert.ok(bridge.includes(api), `桥接页少了 ${api} 的 shim`);
  });
  ['__mineradioApplyAudio', '__mineradioApplyMedia', '__mineradioApplyProperties'].forEach((entry) => {
    assert.ok(bridge.includes(entry), `桥接页少了 ${entry} 直调入口`);
    assert.ok(presetSource.includes(entry), `宿主侧没调用 ${entry}`);
  });
  const pkg = JSON.parse(readProjectFile('package.json'));
  assert.ok(pkg.build.files.includes('public/**/*'), 'vendor 目录靠这条通配进安装包');
});

test('第三方产物不许联网、不许落盘、不许 eval', () => {
  const bundle = readProjectFile(`${VENDOR_DIR}/assets/index-Z-j1MQ-r.js`);
  const bridge = readProjectFile(`${VENDOR_DIR}/mineradio-bridge.html`);
  const blob = bundle + bridge;
  ['XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'importScripts', 'eval(', 'new Function',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'navigator.geolocation'].forEach((token) => {
    assert.ok(!blob.includes(token), `第三方产物里出现了 ${token}, 要先审一遍再放行`);
  });
  // 只允许出现规范命名空间和文档链接这类不发请求的 URL。
  const allowed = new Set(['http://www.w3.org', 'https://react.dev', 'https://tailwindcss.com', 'https://jcgt.org', 'https://github.com', 'https://docs.pmnd.rs']);
  const hosts = new Set((blob.match(/https?:\/\/[^\s"'`)\\]+/g) || []).map((url) => url.replace(/^(https?:\/\/[^/]+).*$/, '$1')));
  hosts.forEach((host) => assert.ok(allowed.has(host), `产物里出现了没审过的外部地址: ${host}`));
});

test('移植出处必须写清楚：WE 原作者、Workshop 物品号、上游仓库', () => {
  const header = presetSource.slice(0, presetSource.indexOf('(function (global)'));
  assert.match(header, /CmzYa/, '这一层是 CmzYa 的 Wallpaper Engine 作品');
  assert.match(header, /3747222633/, '留下 Workshop 物品号, 别让出处只剩一个昵称');
  assert.match(header, /XxHuberrr\/Mineradio/, '桥接代码与 vendor 目录搬自这个上游仓库');
  assert.match(header, /GPL-3\.0/);
  // 预设 7 是同一件作品的 three.js 重写, 两条路别混着写。
  assert.match(header, /yin-yizhen\/sonic-topography/);
  assert.doesNotMatch(header, /原创/);

  const notice = readProjectFile('NOTICE.md');
  assert.match(notice, /CmzYa/);
  assert.match(notice, /3747222633/);
  assert.match(notice, /vendor\/sonic-workshop/, 'vendor 里的第三方产物要在 NOTICE 里点名');
  assert.match(notice, /XxHuberrr\/Mineradio/);
});
