'use strict';
// 音域回响 (视觉预设 7) 的地形层守卫。
// 视觉算法移植自上游 XxHuberrr/Mineradio 的 public/sonic-topography-preset.js (GPL-3.0),
// 所以这里既钉住移植出处, 也用假 THREE 真跑一遍 update(), 断言涟漪 / 流星 / 尾迹的行为。

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
const presetSource = readProjectFile('public/sonic-topography-preset.js');
const indexHtml = readProjectFile('public/index.html');

/** 解析 #rrggbb / 0xrrggbb 成 0~1 三通道, 与 three r128 的 Color 语义一致 (不做 sRGB 转换)。 */
function parseColor(value) {
  if (typeof value === 'number') {
    return { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 };
  }
  const hex = String(value).trim().replace(/^#/, '');
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
  };
}

/**
 * 建一套够用的假 THREE: 记录每个实例矩阵的位置与缩放, 于是测试可以直接
 * 断言"流星缩到 0 藏起来了"这类只体现在实例矩阵上的行为。
 * @returns {object} { THREE, disposed, meshes }
 */
function createThreeStub() {
  const disposed = { geometries: 0, materials: 0 };
  const meshes = [];

  class Vec {
    constructor(x, y, z, w) { this.set(x || 0, y || 0, z || 0, w || 0); }
    set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w || 0; return this; }
    setScalar(v) { return this.set(v, v, v); }
    clone() { return new Vec(this.x, this.y, this.z, this.w); }
  }
  class Col {
    constructor(a, b, c) {
      if (a == null) { this.r = 0; this.g = 0; this.b = 0; return; }
      if (typeof a === 'number' && typeof b === 'number') { this.r = a; this.g = b; this.b = c; return; }
      const parsed = parseColor(a);
      this.r = parsed.r; this.g = parsed.g; this.b = parsed.b;
    }
    clone() { return new Col(this.r, this.g, this.b); }
    copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
    lerp(c, t) {
      this.r += (c.r - this.r) * t;
      this.g += (c.g - this.g) * t;
      this.b += (c.b - this.b) * t;
      return this;
    }
  }

  class Mat4 {
    constructor() { this.pos = new Vec(0, 0, 0); this.scale = new Vec(1, 1, 1); }
    makeTranslation(x, y, z) { this.pos.set(x, y, z); this.scale.set(1, 1, 1); return this; }
    compose(pos, quat, scale) {
      this.pos.set(pos.x, pos.y, pos.z);
      this.scale.set(scale.x, scale.y, scale.z);
      return this;
    }
  }

  class Grp {
    constructor() {
      this.children = [];
      this.rotation = new Vec(0, 0, 0);
      this.position = new Vec(0, 0, 0);
      this.scale = new Vec(1, 1, 1);
      this.visible = true;
      this.name = '';
    }
    add(child) { this.children.push(child); }
    remove(child) { this.children = this.children.filter((c) => c !== child); }
  }
  const THREE = {
    Vector3: Vec,
    Vector4: Vec,
    Euler: Vec,
    Quaternion: class {
      constructor() { this.x = 0; this.y = 0; this.z = 0; this.w = 1; }
      setFromEuler(e) { this.x = e.x; this.y = e.y; this.z = e.z; return this; }
      identity() { this.x = 0; this.y = 0; this.z = 0; this.w = 1; return this; }
    },
    Matrix4: Mat4,
    Color: Col,
    Group: Grp,
    BoxGeometry: class {
      constructor(w, h, d) { this.params = [w, h, d]; }
      dispose() { disposed.geometries += 1; }
    },
    ShaderMaterial: class {
      constructor(opts) {
        Object.assign(this, opts);
        this.uniforms = opts.uniforms;
      }
      dispose() { disposed.materials += 1; }
    },
    MeshBasicMaterial: class {
      constructor(opts) {
        Object.assign(this, opts);
        this.color = new Col(opts.color);
      }
      dispose() { disposed.materials += 1; }
    },
    InstancedMesh: class {
      constructor(geometry, material, count) {
        this.geometry = geometry;
        this.material = material;
        this.count = count;
        this.frustumCulled = true;
        this.instanceMatrix = { needsUpdate: false, uploads: 0 };
        this.matrices = [];
        meshes.push(this);
      }
      setMatrixAt(i, m) { this.matrices[i] = { pos: m.pos.clone(), scale: m.scale.clone() }; }
    },
  };
  return { THREE, disposed, meshes };
}
/**
 * 用真实源码加载地形层模块。random 可注入, 因为涟漪 / 流星的落点和触发概率
 * 全靠 Math.random, 固定它才能断言具体行为。
 * @returns {object}
 */
function loadTopography(options) {
  options = options || {};
  const stub = createThreeStub();
  const mathStub = Object.create(Math);
  if (options.random) mathStub.random = options.random;
  const context = {
    THREE: stub.THREE,
    Math: mathStub,
    Number,
    String,
    Object,
    Array,
    console,
  };
  if (options.stageLyrics) context.stageLyrics = options.stageLyrics;
  vm.runInNewContext(presetSource, context);
  const mod = context.MineradioSonicTopography;
  assert.ok(mod, '模块必须把自己挂到全局 MineradioSonicTopography');
  const scene = {
    children: [],
    add(o) { this.children.push(o); },
    remove(o) { this.children = this.children.filter((c) => c !== o); },
  };
  return { mod, stub, context, scene };
}

/** 走一帧, 默认 60fps。 */
function frame(h, fx, audio, dt) {
  h.mod.update(dt == null ? 1 / 60 : dt, {
    scene: h.scene,
    fx: fx,
    time: 0,
    visualRotation: null,
    visualRotationActive: false,
    audio: audio || {},
  });
}

/** 最近一次构建出来的四层: 地形 / 悬浮块 / 流星 / 尾迹。 */
function layers(h) {
  const m = h.stub.meshes.slice(-4);
  return { terrain: m[0], floating: m[1], meteors: m[2], trails: m[3] };
}

/** 着色器里真正生效的涟漪 (w 为 0 表示这一槽空着)。 */
function activeRipples(terrain) {
  return terrain.material.uniforms.uRipples.value.filter((r) => Math.abs(r.w) > 1e-4);
}
test('音域回响登记为第 8 个视觉预设，并在预设面板里排到前面', () => {
  const meta = readSourceBlock(app, 'var presetMeta = [', 'var lyricColorPresets');
  const names = meta.match(/name: '([^']+)'/g).map((s) => s.slice(7, -1));
  assert.deepEqual(names, ['emily专辑封面', '滚筒', '星球', '虚空', '唱片', '星河', '安魂', '音域回响']);
  const icons = readSourceBlock(meta, 'var presetIcons = [', 'var presetDisplayOrder');
  assert.equal((icons.match(/<svg /g) || []).length, names.length, '每个预设都要有自己的图标');
  assert.match(meta, /\{ name: '音域回响', desc: '音域地形 · 移植 CmzYa' \}/);
  assert.match(meta, /var presetDisplayOrder = \[0, 7, 6, 5, 4, 2, 1, 3\]/);
  assert.match(app, /var SONIC_TOPOGRAPHY_PRESET_INDEX = 7;/);
});

test('地形层是独立脚本，必须先于 app.js 求值，且 app.js 只通过全局访问它', () => {
  const scripts = indexHtml.match(/<script src="[^"]+"><\/script>/g) || [];
  const terrainAt = scripts.indexOf('<script src="sonic-topography-preset.js"></script>');
  const appAt = scripts.indexOf('<script src="app.js"></script>');
  assert.ok(terrainAt >= 0, 'index.html 必须加载 sonic-topography-preset.js');
  assert.ok(terrainAt < appAt, '地形层要先注册全局，否则 app.js 启动那一帧拿不到模块');
  // 缺脚本 (例如插件裁剪过 public) 时只能安静跳过, 不能让主循环炸掉。
  assert.match(app, /function sonicTopographyModule\(\) \{\s*\n\s*return \(typeof MineradioSonicTopography !== 'undefined' && MineradioSonicTopography\) \? MineradioSonicTopography : null;/);
  // v1.8.7 那版自研的频谱回响已经整体让位给移植实现, 别留半截。
  assert.doesNotMatch(app, /spectrumEcho|SPECTRUM_ECHO|uSpectrumTex/i);
  const packageJson = JSON.parse(readProjectFile('package.json'));
  assert.ok(packageJson.build.files.includes('public/**/*'), '地形层脚本靠这条通配进安装包');
});
test('网格密度换算成实例数，并被画质档位的上限压住', () => {
  const eco = loadTopography();
  frame(eco, { preset: 7, performanceQuality: 'eco' }, {});
  const ecoLayers = layers(eco);
  // 密度默认 46 → 156×156, 但 eco 档只给 112×112。
  assert.equal(ecoLayers.terrain.count, 112 * 112);
  assert.equal(ecoLayers.terrain.geometry.params[1], 1, '柱子高度固定 1, 靠顶点着色器拉伸');
  assert.ok(Math.abs(ecoLayers.terrain.geometry.params[0] - (168 / 112) * (0.9 / 1.05)) < 1e-9);
  assert.equal(ecoLayers.floating.count, 80, '悬浮块默认 80 个');
  assert.equal(ecoLayers.meteors.count, 20);
  assert.equal(ecoLayers.trails.count, 200);
  for (const key of ['terrain', 'floating', 'meteors', 'trails']) {
    assert.equal(ecoLayers[key].frustumCulled, false, `${key} 的包围盒在着色器里被改过, 不能交给视锥裁剪`);
  }

  const ultra = loadTopography();
  frame(ultra, { preset: 7, performanceQuality: 'ultra' }, {});
  assert.equal(layers(ultra).terrain.count, 156 * 156);

  // 同一档位再走一帧不该重建, 否则每帧都在丢 24336 个实例。
  const before = ultra.stub.meshes.length;
  frame(ultra, { preset: 7, performanceQuality: 'ultra' }, {});
  assert.equal(ultra.stub.meshes.length, before);
  // 换档位才重建。
  frame(ultra, { preset: 7, performanceQuality: 'eco' }, {});
  assert.equal(ultra.stub.meshes.length, before + 4);
  assert.equal(layers(ultra).terrain.count, 112 * 112);
});
test('底鼓打出蓝涟漪，并靠迟滞避免同一拍连抖', () => {
  const h = loadTopography({ random: () => 0.5 });
  const fx = { preset: 7, performanceQuality: 'eco' };
  const hit = { bass: 0.8, mid: 0.2, treble: 0, beat: 0.9, energy: 0.3 };
  const rest = { bass: 0.1, mid: 0.1, treble: 0, beat: 0.05, energy: 0.1 };
  frame(h, fx, hit);
  const terrain = layers(h).terrain;
  frame(h, fx, hit); // 上一帧加的涟漪这一帧才写进 uniform
  assert.equal(activeRipples(terrain).length, 1);
  const first = activeRipples(terrain)[0];
  assert.ok(Math.abs(first.x - Math.cos(Math.PI) * 10) < 1e-9, '落点由 random 决定的角度/半径算出');
  assert.ok(first.w > 0, 'w 为正 = 蓝色底鼓涟漪');
  assert.ok(Math.abs(first.w - 1.8) < 1e-6, '强度 = min(kick × 2, 3)');

  for (let i = 0; i < 5; i++) frame(h, fx, hit);
  assert.equal(activeRipples(terrain).length, 1, '底鼓一直压着不放, 只算一次');

  frame(h, fx, rest); // 掉回 0.32 以下重新上膛
  frame(h, fx, hit);
  frame(h, fx, hit);
  assert.equal(activeRipples(terrain).length, 2, '下一拍要能再打一道');
});

test('画布上单击在指针落点打一道涟漪，强度封顶 3', () => {
  const h = loadTopography({ random: () => 0.5 });
  const fx = { preset: 7, performanceQuality: 'eco' };
  const silent = { bass: 0, mid: 0, treble: 0, beat: 0, energy: 0 };
  frame(h, fx, silent);
  const terrain = layers(h).terrain;
  h.mod.pointerRipple(6, -3, 1.2);
  frame(h, fx, silent);
  const one = activeRipples(terrain);
  assert.equal(one.length, 1);
  assert.equal(one[0].x, 6);
  assert.equal(one[0].y, -3, 'vec4 的 y 分量存的是世界 z');
  assert.ok(Math.abs(one[0].w - 1.2) < 1e-6);

  h.mod.pointerRipple(0, 0, 99);
  frame(h, fx, silent);
  const strongest = activeRipples(terrain).reduce((a, r) => Math.max(a, r.w), 0);
  assert.equal(strongest, 3, '再怎么按也不许超过 3, 否则地形会被打穿');
});
test('流星坠落到地面炸出白涟漪并撒十粒尾迹，落地后自己藏起来', () => {
  const h = loadTopography({ random: () => 0.01 });
  const fx = { preset: 7, performanceQuality: 'eco' };
  const silent = { bass: 0, mid: 0, treble: 0, beat: 0, energy: 0 };
  frame(h, fx, { bass: 0.8, mid: 0, treble: 0, beat: 0.9, energy: 0.4 });
  const l = layers(h);
  frame(h, fx, silent);
  assert.equal(l.meteors.matrices[0].scale.x, 1.5, '流星在半空时是可见的');
  assert.ok(l.meteors.matrices[0].pos.y > 20, '从 30 上方开始掉');
  assert.equal(l.trails.matrices.filter((m) => m.scale.x > 0).length, 0, 'random=0.01 不满足 >0.3, 下落途中不撒尾迹');

  // speed ≈ 2.355 单位/帧, 30.1 的高度大约 13 帧落地。
  let landed = false;
  for (let i = 0; i < 40 && !landed; i++) {
    frame(h, fx, silent);
    landed = l.meteors.matrices[0].scale.x === 0;
  }
  assert.ok(landed, '流星必须真的落地');
  assert.equal(l.meteors.matrices[0].pos.y, -1000, '落地后收回 y=-1000');
  assert.equal(l.trails.matrices.filter((m) => m.scale.x > 0).length, 10, '落地炸出十粒尾迹');
  frame(h, fx, silent);
  const white = activeRipples(l.terrain).filter((r) => r.w < 0);
  assert.equal(white.length, 1, 'w 为负 = 落点白涟漪');
  assert.ok(Math.abs(white[0].w + 0.9) < 1e-6);

  // 尾迹寿命 0.5~1.0 秒, 一秒后必须全部退场。
  for (let i = 0; i < 70; i++) frame(h, fx, silent);
  assert.equal(l.trails.matrices.filter((m) => m.scale.x > 0).length, 0);
});
test('切走时地形层软收敛再隐藏，切换预设会释放整层显存', () => {
  const h = loadTopography({ random: () => 0.5 });
  const on = { preset: 7, performanceQuality: 'eco' };
  const off = { preset: 0, performanceQuality: 'eco' };
  const silent = { bass: 0, mid: 0, treble: 0, beat: 0, energy: 0 };
  for (let i = 0; i < 90; i++) frame(h, on, silent);
  const root = h.scene.children[0];
  assert.equal(root.name, 'sonic-topography-root');
  assert.equal(root.visible, true);

  frame(h, off, silent);
  assert.equal(root.visible, true, '刚切走的那一帧不能硬切成黑, 要顺着透明度收');
  for (let i = 0; i < 300; i++) frame(h, off, silent);
  assert.equal(root.visible, false, '收敛完必须自己隐藏, 别继续画 12544 个柱子');

  h.mod.onPresetChange(7, 0, { scene: h.scene, fx: off });
  assert.equal(h.scene.children.length, 0, '离开预设要把整层摘出场景');
  assert.equal(h.stub.disposed.geometries, 4);
  assert.equal(h.stub.disposed.materials, 4);
  const meshCount = h.stub.meshes.length;
  frame(h, off, silent);
  assert.equal(h.stub.meshes.length, meshCount, '不在这个预设就一分钱不花');

  h.mod.onPresetChange(0, 7, { scene: h.scene, fx: on });
  assert.equal(h.scene.children.length, 1, '再进来要重建');
  assert.equal(h.stub.meshes.length, meshCount + 4);
  assert.equal(h.scene.children[0].visible, false, '重建出来先藏着, 等第一帧算完再亮');
});
test('配色默认跟着封面调色板走，也认自定义色', () => {
  const h = loadTopography({
    random: () => 0.5,
    stageLyrics: { coverPalette: { primary: '#ff2200', secondary: 'rgb(34, 255, 0)', highlight: '#0022ff' } },
  });
  const fx = { preset: 7, performanceQuality: 'eco' };
  const silent = { bass: 0, mid: 0, treble: 0, beat: 0, energy: 0 };
  for (let i = 0; i < 240; i++) frame(h, fx, silent);
  const u = layers(h).terrain.material.uniforms;
  assert.ok(u.uCoolCore.value.r > 0.8 && u.uCoolCore.value.b < 0.2, '冷色取封面主色 (红)');
  assert.ok(u.uWarmCore.value.g > 0.8 && u.uWarmCore.value.g > u.uWarmCore.value.r, '暖色取副色 (绿) 再掺一点橙');
  assert.ok(u.uRippleColor.value.b > 0.8 && u.uRippleColor.value.r < 0.2, '涟漪取高光色 (蓝)');
  assert.ok(u.uBaseColor1.value.r < 0.25 && u.uBaseColor1.value.g < 0.25, '底色永远压得很暗, 地形才有夜景感');
  assert.equal(layers(h).trails.material.color.b > 0.8, true, '尾迹跟涟漪同色');

  const custom = loadTopography({ random: () => 0.5 });
  const customFx = {
    preset: 7,
    performanceQuality: 'eco',
    sonicGroundColorMode: 'custom',
    sonicGroundAccentColor: '#112233',
    sonicGroundBaseColor: 'not-a-color',
  };
  for (let i = 0; i < 240; i++) frame(custom, customFx, silent);
  const cu = layers(custom).terrain.material.uniforms;
  assert.ok(Math.abs(cu.uRippleColor.value.r - 0x11 / 255) < 0.02);
  assert.ok(Math.abs(cu.uRippleColor.value.g - 0x22 / 255) < 0.02);
  assert.ok(Math.abs(cu.uRippleColor.value.b - 0x33 / 255) < 0.02);
  // 非法色值退回原作的 #05070c, 不该把地形整片刷白。
  assert.ok(cu.uBaseColor1.value.r < 0.05 && cu.uBaseColor1.value.b < 0.06);
});
test('低频跟着底鼓走但有硬上限，八段均衡能把某一段压下去', () => {
  const loud = { bass: 0.8, mid: 0.6, treble: 0.5, beat: 1, energy: 0.9 };
  const h = loadTopography({ random: () => 0.5 });
  for (let i = 0; i < 200; i++) frame(h, { preset: 7, performanceQuality: 'eco' }, loud);
  const u = layers(h).terrain.material.uniforms;
  // 默认 EQ 把低频推到饱和, 上限就是移植过来的 MAX_SHADER_SUB_BASS / MAX_SHADER_BASS。
  assert.ok(u.uSubBass.value > 1.199 && u.uSubBass.value <= 1.2);
  assert.ok(u.uBass.value > 1.149 && u.uBass.value <= 1.15);
  assert.ok(u.uEnergy.value > 0 && u.uEnergy.value <= 1);
  assert.equal(u.uAmplitude.value, 1, '振幅 50 = 原样, 不放大');

  const dulled = loadTopography({ random: () => 0.5 });
  for (let i = 0; i < 200; i++) {
    frame(dulled, { preset: 7, performanceQuality: 'eco', sonicGroundSubBass: 0 }, loud);
  }
  const du = layers(dulled).terrain.material.uniforms;
  assert.ok(du.uSubBass.value < 0.8, 'EQ 拉到 0 要明显压暗这一段');
  assert.ok(du.uBass.value > 1.149, '只压第一段, 别连坐');

  // 振幅 >50 是平方放大, 100 时 15 倍。
  const amped = loadTopography({ random: () => 0.5 });
  frame(amped, { preset: 7, performanceQuality: 'eco', sonicGroundAmplitude: 100 }, loud);
  assert.equal(layers(amped).terrain.material.uniforms.uAmplitude.value, 15);
});

test('粗粒度音频帧被摊成八段，静音时地形彻底躺平', () => {
  const h = loadTopography({ random: () => 0.5 });
  const fx = { preset: 7, performanceQuality: 'eco' };
  for (let i = 0; i < 200; i++) frame(h, fx, { bass: 0.2, mid: 0.9, treble: 0.8, beat: 0.1, energy: 0.6 });
  const u = layers(h).terrain.material.uniforms;
  assert.ok(u.uMid.value > 0.6, '中频喂进来就要抬起中段');
  assert.ok(u.uBrilliance.value > 0.5, '高频喂进来就要抬起高段');
  assert.ok(u.uSubBass.value < u.uMid.value, '几乎没有底鼓时低段不该反过来最高');

  for (let i = 0; i < 400; i++) frame(h, fx, { bass: 0, mid: 0, treble: 0, beat: 0, energy: 0 });
  for (const key of ['uSubBass', 'uBass', 'uLowMid', 'uMid', 'uHighMid', 'uPresence', 'uBrilliance', 'uAir']) {
    assert.ok(u[key].value < 0.02, `${key} 静音后应收回 0 附近, 实际 ${u[key].value}`);
  }
  assert.equal(activeRipples(layers(h).terrain).length, 0, '静音久了涟漪全部过期');
});
test('旋转跟 particles.rotation 共用一套手势，拖动时自转减速', () => {
  const h = loadTopography({ random: () => 0.5 });
  const fx = { preset: 7, performanceQuality: 'eco', speed: 1 };
  const silent = { bass: 0, mid: 0, treble: 0, beat: 0, energy: 0 };
  h.mod.update(1 / 60, {
    scene: h.scene, fx: fx, time: 0,
    visualRotation: { x: 0.21, y: -0.4 }, visualRotationActive: false, audio: silent,
  });
  const root = h.scene.children[0];
  assert.ok(Math.abs(root.rotation.x - 0.21) < 1e-9, 'X 直接跟手势');
  const yawStep = root.rotation.y - -0.4;
  assert.ok(yawStep > 0, 'Y = 手势 + 自转累积');

  // 正在拖的时候自转降到 35%, 免得跟手势打架。
  h.mod.update(1 / 60, {
    scene: h.scene, fx: fx, time: 0,
    visualRotation: { x: 0.21, y: -0.4 }, visualRotationActive: true, audio: silent,
  });
  const draggingStep = root.rotation.y - -0.4 - yawStep;
  assert.ok(Math.abs(draggingStep - yawStep * 0.35) < 1e-9);

  // 没传旋转 (例如粒子层还没建好) 就退回 0, 不能变成 NaN。
  h.mod.update(1 / 60, { scene: h.scene, fx: fx, time: 0, visualRotation: null, audio: silent });
  assert.equal(root.rotation.x, 0);
  assert.ok(Number.isFinite(root.rotation.y));
  // 布局: 地形整体压在视线下方偏后, 缩放跟着 range 走。
  assert.ok(Math.abs(root.position.y - (-4.05 - 68 * 0.034)) < 1e-9);
  assert.ok(Math.abs(root.position.z - (-4.2 - 62 * 0.055)) < 1e-9);
  assert.ok(Math.abs(root.scale.x - (0.096 + 82 * 0.00072)) < 1e-9);
});

test('没有场景 / 不在这个预设时 update 不建任何东西', () => {
  const noScene = loadTopography({ random: () => 0.5 });
  noScene.mod.update(1 / 60, { fx: { preset: 7 }, audio: {} });
  assert.equal(noScene.stub.meshes.length, 0, '没场景就别建');

  // 冷启动落在别的预设上: 一个实例都不该分配 (fade-out 那条路才需要地形还在)。
  const other = loadTopography({ random: () => 0.5 });
  for (let i = 0; i < 30; i++) frame(other, { preset: 5, performanceQuality: 'eco' }, { beat: 1 });
  assert.equal(other.stub.meshes.length, 0);
  assert.equal(other.scene.children.length, 0);

  assert.equal(other.mod.isActive({ preset: 7 }), true);
  assert.equal(other.mod.isActive({ preset: 5 }), false);
  assert.equal(other.mod.isActive(null), false);
  assert.equal(other.mod.INDEX, 7);
});
test('主循环把地形层挂在粒子旋转之后，音频帧按本项目的量纲折算', () => {
  const animate = readSourceBlock(app, 'function animate() {', "resumeMainRenderLoop('startup');");
  // 必须排在 particles.rotation 同步之后, 否则地形要慢一帧才跟上手势。
  assert.ok(animate.indexOf('particles.rotation.x +=') < animate.indexOf('sonicMod.update(dt, sonicTopographyCtx)'));
  assert.match(animate, /sonicTopographyCtx\.visualRotation = particles \? particles\.rotation : null;/);
  assert.match(animate, /sonicTopographyCtx\.visualRotationActive = !!\(orbit && orbit\.rotating\);/);
  assert.match(animate, /sonicTopographyCtx\.audio\.beat = Math\.min\(1, beatPulse \* 1\.35\);/);
  assert.match(animate, /sonicTopographyCtx\.time = uniforms\.uTime\.value;/);
  // 上下文预分配, 60fps 下不能每帧新建对象。
  assert.doesNotMatch(animate, /sonicMod\.update\(dt, \{/);
  assert.match(app, /var sonicTopographyCtx = \{/);
  // 地形自己够亮, 背景星河压到 0.82 (跟上游一致)。
  assert.match(animate, /var skullBackdropDim = fx && fx\.preset === SKULL_PRESET_INDEX \? 0\.58 : \(fx && fx\.preset === SONIC_TOPOGRAPHY_PRESET_INDEX \? 0\.82 : 1\);/);
});

test('单击画布转成地形涟漪，进出预设都重建地形层', () => {
  const mouseup = readSourceBlock(app, "window.addEventListener('mouseup', function(e){", "renderer.domElement.addEventListener('mouseleave'");
  assert.match(mouseup, /sonicMod\.isActive\(fx\) && e && !mouseDownAt\.hadDrag && !isPointerOverUi\(e\)/, '拖动和点 UI 都不该打涟漪');
  assert.match(mouseup, /var strength = Math\.min\(0\.25 \+ \(pressMs \/ 1000\) \* 2\.6, 3\.0\);/);
  assert.match(mouseup, /var nx = \(e\.clientX \/ Math\.max\(1, innerWidth\) - 0\.5\) \* 34;/);
  assert.match(mouseup, /var nz = \(0\.5 - e\.clientY \/ Math\.max\(1, innerHeight\)\) \* 34;/);
  assert.match(mouseup, /sonicMod\.pointerRipple\(nx, nz, strength\);/);

  const setPreset = readSourceBlock(app, 'function setPreset(p, opts) {', 'function syncFxUniforms()');
  assert.match(setPreset, /if \(changed && \(p === SONIC_TOPOGRAPHY_PRESET_INDEX \|\| prev === SONIC_TOPOGRAPHY_PRESET_INDEX\)\)/);
  assert.match(setPreset, /sonicMod\.onPresetChange\(prev, p, \{ scene: scene, fx: fx \}\);/);
  assert.match(setPreset, /else if \(p === 7\) \{ orbit\.userRadius = 8\.4; orbit\.userPhi = 0\.18;/);

  const trigger = readSourceBlock(app, 'function isSoftFlowPreset(', 'function tickPresetTransition()');
  assert.match(trigger, /return preset === 5 \|\| preset === SONIC_TOPOGRAPHY_PRESET_INDEX;/);
  assert.doesNotMatch(app, /wallpaperFlow/);
});

test('粒子着色器不再为预设 7 单独开分支，星河那一支直接收下它', () => {
  const vs = readSourceBlock(app, 'var vs = `', '// ----- 片元 Shader -----');
  assert.match(vs, /uniform sampler2D uCoverTex, uPrevCoverTex, uEdgeTex, uRippleTex;/);
  assert.match(vs, /Preset 5 \/ 6 \/ 7: WALLPAPER PULSE/);
  assert.doesNotMatch(vs, /uPreset < 6\.5/);
  assert.doesNotMatch(vs, /uPreset > 6\.5/);
  // 唱片专属的高分辨率抑制照旧只管预设 4。
  assert.match(vs, /float vinylHiResGuard = smoothstep\(1\.08, 1\.55, uCoverRes\) \* step\(3\.5, uPreset\) \* \(1\.0 - step\(4\.5, uPreset\)\);/);
});
test('移植出处必须写清楚：上游仓库、原始项目、Wallpaper Engine 作者', () => {
  const header = presetSource.slice(0, presetSource.indexOf('(function (global)'));
  assert.match(header, /XxHuberrr\/Mineradio/, '视觉算法是从这个上游仓库移植的');
  assert.match(header, /GPL-3\.0/);
  assert.match(header, /yin-yizhen\/sonic-topography/);
  assert.match(header, /CmzYa/);
  assert.match(header, /3747222633/, '留下 Workshop 物品号, 别让出处只剩一个昵称');
  // 这一层是移植, 不是原创致敬 —— v1.8.7 曾经写反过。
  assert.doesNotMatch(header, /原创|不是移植/);

  const notice = readProjectFile('NOTICE.md');
  assert.match(notice, /XxHuberrr\/Mineradio/);
  assert.match(notice, /yin-yizhen\/sonic-topography/);
  assert.match(notice, /CmzYa/);
  assert.match(notice, /GPL-3\.0/);
});
