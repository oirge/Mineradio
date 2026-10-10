// mods/visualizer52hz/ponder.mjs
// The 52Hz entry in Ponder (the in-app tutorial), through the experimental
// `ponder.targets` surface. A mod cannot draw its own UI into Ponder's stage —
// the detailed skeletons are the host's own pages — so this sticks to generic
// boxes (a surface, controls, rails) and lets the captions carry the meaning.
// Every text is a { 'zh-CN', en } label, so it follows the UI language.

const stage = {
  kind: 'synthetic',
  rect: { left: 0.5, top: 0.12, width: 0.6, height: 0.56, anchorX: 'center' },
  role: 'surface',
  labelKey: { 'zh-CN': '播放页', en: 'Player' },
};

// Concentric capsules around `from`, hidden until a reveal step grows them.
const ringsAround = (from, radius, steps) => Object.fromEntries(steps.map(([x, y], index) => [
  `ring${index + 1}`,
  {
    kind: 'derived',
    from,
    expand: { left: x, right: x, top: y, bottom: y },
    role: 'rail',
    radius,
    startsHidden: true,
    ...(index === steps.length - 1
      ? { labelKey: { 'zh-CN': '年轮', en: 'Rings' }, labelPlacement: 'below' }
      : {}),
  },
]));

const lyricRings = {
  id: 'rings',
  titleKey: { 'zh-CN': '年轮从哪里来', en: 'Where the rings come from' },
  anchors: {
    stage,
    lyric: {
      kind: 'relative',
      from: 'stage',
      rect: { left: 0.3, width: 0.4, top: 0.44, height: 0.12 },
      role: 'control',
      labelKey: { 'zh-CN': '当前歌词', en: 'Current line' },
    },
    ...ringsAround('lyric', '999px', [[22, 16], [48, 34], [76, 54]]),
  },
  steps: [
    { kind: 'highlight', id: 'line', anchor: 'lyric', intensity: [0, 0.4], durationMs: 520, keyframe: true },
    {
      kind: 'caption', id: 'lineText', at: 'bottom', withPrevious: true, durationMs: 5200,
      pointTo: { anchor: 'lyric', y: 0.5 },
      textKey: {
        'zh-CN': '当前这句歌词整句出现，每个字到了自己的时间点就被点亮。',
        en: 'The current line appears whole, and each character lights up when its moment comes.',
      },
    },
    { kind: 'pause', id: 'readLine' },
    { kind: 'reveal', id: 'firstRing', anchor: 'ring1', transition: 'zoom', durationMs: 600, keyframe: true },
    {
      kind: 'caption', id: 'beatText', at: 'bottom', withPrevious: true, durationMs: 5600,
      pointTo: { anchor: 'ring1', x: 1, y: 0.5 },
      textKey: {
        'zh-CN': '每个节拍，都会从字形外发出一圈年轮，沿着文字的轮廓向外扩散。',
        en: 'On every beat a ring leaves the outline of the text and spreads outward along its shape.',
      },
    },
    { kind: 'reveal', id: 'secondRing', anchor: 'ring2', transition: 'zoom', durationMs: 600 },
    { kind: 'reveal', id: 'thirdRing', anchor: 'ring3', transition: 'zoom', durationMs: 600 },
    {
      kind: 'caption', id: 'loudText', at: 'bottom', durationMs: 5600, keyframe: true,
      pointTo: { anchor: 'ring3', y: 1 },
      textKey: {
        'zh-CN': '节拍越响，年轮越粗越亮；传到屏幕边缘时正好淡出。',
        en: 'Louder beats make thicker, brighter rings; each fades out as it reaches the screen edge.',
      },
    },
    { kind: 'pause', id: 'readLoud' },
  ],
};

const settingRow = (top, zh, en) => ({
  kind: 'relative',
  from: 'panel',
  rect: { left: 0.08, width: 0.84, top, height: 0.08 },
  role: 'rail',
  labelKey: { 'zh-CN': zh, en },
  labelPlacement: 'above',
});

const settings = {
  id: 'settings',
  titleKey: { 'zh-CN': '调整年轮', en: 'Tuning the rings' },
  action: {
    kind: 'openVisualizerSettings',
    section: 'visualizer',
    labelKey: { 'zh-CN': '打开歌词动画设置', en: 'Open lyric animation settings' },
  },
  anchors: {
    panel: {
      kind: 'synthetic',
      rect: { left: 0.5, top: 0.12, width: 0.42, height: 0.58, anchorX: 'center' },
      role: 'surface',
      labelKey: { 'zh-CN': '52Hz 设置', en: '52Hz settings' },
    },
    speed: settingRow(0.22, '扩散速度', 'Spread speed'),
    beats: settingRow(0.42, '节拍灵敏度', 'Beat sensitivity'),
    loudness: settingRow(0.62, '响度灵敏度', 'Loudness sensitivity'),
  },
  steps: [
    { kind: 'highlight', id: 'speedRow', anchor: 'speed', intensity: [0, 0.4], durationMs: 480, keyframe: true },
    {
      kind: 'caption', id: 'speedText', at: 'bottom', withPrevious: true, durationMs: 5000,
      pointTo: { anchor: 'speed', x: 1, y: 0.5 },
      textKey: {
        'zh-CN': '扩散速度决定年轮向外走得多快。无论快慢，到屏幕边缘都会淡出。',
        en: 'Spread speed sets how fast rings travel. Fast or slow, they fade out by the screen edge.',
      },
    },
    { kind: 'highlight', id: 'beatRow', anchor: 'beats', intensity: [0, 0.4], durationMs: 480, keyframe: true },
    {
      kind: 'caption', id: 'beatRowText', at: 'bottom', withPrevious: true, durationMs: 5000,
      pointTo: { anchor: 'beats', x: 1, y: 0.5 },
      textKey: {
        'zh-CN': '节拍灵敏度越高，越容易判定为节拍，年轮越密。',
        en: 'Higher beat sensitivity detects more beats, so rings come closer together.',
      },
    },
    { kind: 'highlight', id: 'loudRow', anchor: 'loudness', intensity: [0, 0.4], durationMs: 480, keyframe: true },
    {
      kind: 'caption', id: 'loudRowText', at: 'bottom', withPrevious: true, durationMs: 5000,
      pointTo: { anchor: 'loudness', x: 1, y: 0.5 },
      textKey: {
        'zh-CN': '响度灵敏度决定年轮的粗细和亮度。字号和不透明度也在这里调。',
        en: 'Loudness sensitivity sets how thick and bright rings are. Text size and opacity live here too.',
      },
    },
    { kind: 'pause', id: 'readSettings' },
  ],
};

const pithRadius = '46% 54% 40% 60% / 55% 45% 58% 42%';

const instrumental = {
  id: 'instrumental',
  titleKey: { 'zh-CN': '纯音乐', en: 'Instrumentals' },
  anchors: {
    stage,
    pith: {
      kind: 'relative',
      from: 'stage',
      rect: { left: 0.45, width: 0.08, top: 0.43, height: 0.13 },
      role: 'control',
      radius: pithRadius,
      labelKey: { 'zh-CN': '髓心', en: 'Pith' },
    },
    ...ringsAround('pith', pithRadius, [[18, 16], [40, 36], [66, 58]]),
  },
  steps: [
    { kind: 'highlight', id: 'pithShow', anchor: 'pith', intensity: [0, 0.4], durationMs: 520, keyframe: true },
    {
      kind: 'caption', id: 'pithText', at: 'bottom', withPrevious: true, durationMs: 5200,
      pointTo: { anchor: 'pith', x: 1, y: 0.5 },
      textKey: {
        'zh-CN': '没有歌词的歌，会从一个随机变形的髓心开始长出年轮。',
        en: 'A song without lyrics grows its rings from a randomly shaped pith.',
      },
    },
    { kind: 'reveal', id: 'pithRing1', anchor: 'ring1', transition: 'zoom', durationMs: 600, keyframe: true },
    { kind: 'reveal', id: 'pithRing2', anchor: 'ring2', transition: 'zoom', durationMs: 600 },
    { kind: 'reveal', id: 'pithRing3', anchor: 'ring3', transition: 'zoom', durationMs: 600 },
    {
      kind: 'caption', id: 'pithMoveText', at: 'bottom', durationMs: 5600,
      pointTo: { anchor: 'ring3', y: 1 },
      textKey: {
        'zh-CN': '每隔十来秒换一个新的髓心，旧的年轮继续向外走，叠成木纹一样的截面。',
        en: 'Every ten seconds or so a new pith takes over while the old rings keep spreading, like the grain of a cut trunk.',
      },
    },
    { kind: 'pause', id: 'readPith' },
  ],
};

export const ponderTarget = {
  id: 'guide',
  titleKey: { 'zh-CN': '52Hz 歌词动画', en: '52Hz lyric animation' },
  summaryKey: {
    'zh-CN': '歌词逐字点亮，每个节拍从字形外发出一圈年轮。',
    en: 'Lyrics light up character by character, and every beat sends a ring out from the text.',
  },
  category: 'appearance',
  // The visualizer's host container; the mod's markup inside it is its own.
  hoverSelector: '[data-folium-entry="visualizer52hz:rings"]',
  scenes: [lyricRings, settings, instrumental],
};
