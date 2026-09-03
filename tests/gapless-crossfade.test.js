'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ENGINE_START = 'var GAPLESS_CROSSFADE_MIN_SECONDS';
const ENGINE_END = 'var REPLAY_GAIN_PREAMP_MIN';
const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

/**
 * 从 renderer 源码截取无缝播放 / 交叉淡入淡出引擎实现。
 * @returns {string} 可在隔离上下文执行的真实源码。
 */
function readGaplessEngineSource() {
  const start = appSource.indexOf(ENGINE_START);
  const end = appSource.indexOf(ENGINE_END, start);
  assert.ok(start >= 0 && end > start, '未找到无缝播放引擎实现');
  return appSource.slice(start, end);
}

// 测试句柄 → 引擎内真实函数名。用一份映射同时生成 vm 导出语句和外部句柄，避免两处改名走散。
const ENGINE_HANDLES = {
  ensurePool: 'ensureAudioDeckPool',
  normalize: 'normalizeGaplessSettings',
  readSaved: 'readSavedGaplessSettings',
  enabledForHandoff: 'gaplessEnabledForHandoff',
  activeDeck: 'activeAudioDeck',
  idleIndex: 'idleAudioDeckIndex',
  deckGain: 'currentAudioDeckGain',
  setDeckGain: 'setAudioDeckGainImmediate',
  rampDeck: 'rampAudioDeckGain',
  duckRetire: 'duckAndRetireAudioDeck',
  release: 'releaseGaplessPrefetch',
  settleStart: 'settleGaplessDeckStart',
  prefetch: 'maybeStartGaplessPrefetch',
  adopt: 'adoptGaplessDeckForSong',
  watch: 'runGaplessPlaybackWatch',
  resolveSeconds: 'resolveCrossfadeSeconds',
  finishNow: 'finishCrossfadeImmediately',
  resetForSwitch: 'resetGaplessForTrackSwitch',
  formatSeconds: 'formatGaplessSeconds',
  hintText: 'gaplessHintText',
  updateControls: 'updateGaplessControls',
  toggle: 'toggleGaplessSetting',
  setSeconds: 'setGaplessCrossfadeSeconds',
  initControls: 'initGaplessControls',
};

/**
 * 造一个记录全部自动化事件的 GainNode 桩。
 * 增益值按真实 WebAudio 的语义在 now 时刻取值：曲线取首点，线性斜坡不立即跳到终值。
 * @param {object} harness 测试台。
 * @returns {object} GainNode 桩。
 */
function createGainNodeStub(harness) {
  const events = [];
  const param = {
    value: 1,
    cancelScheduledValues(when) { events.push({ type: 'cancel', when }); },
    setValueAtTime(value, when) { events.push({ type: 'set', value, when }); param.value = value; },
    linearRampToValueAtTime(value, when) { events.push({ type: 'linear', value, when }); },
    setValueCurveAtTime(curve, when, span) {
      if (harness.curveUnsupported) throw new Error('NotSupportedError');
      events.push({ type: 'curve', from: curve[0], to: curve[curve.length - 1], span, points: curve.length });
      param.value = curve[0];
    },
  };
  return { gain: param, events, connect() {} };
}

/**
 * 造一个可编排的音频元素桩，覆盖 play() 成功 / 拒绝 / 抛错 / 不返回 Promise 四种真实行为。
 * @param {object} harness 测试台。
 * @returns {object} 音频元素桩。
 */
function createFakeAudioElement(harness) {
  const el = {
    id: 'deck-' + harness.elements.length,
    src: '', currentSrc: '', readyState: 4, duration: NaN, currentTime: 0,
    paused: true, ended: false, volume: 1, muted: false, onended: null,
    crossOrigin: '', preload: '', playBehavior: '',
    playCalls: 0, pauseCalls: 0, loadCalls: 0,
    play() {
      el.playCalls += 1;
      const behavior = el.playBehavior || harness.playBehavior;
      if (behavior === 'throw') throw new Error('play threw');
      if (behavior === 'reject') return Promise.reject(new Error('NotAllowedError'));
      el.paused = false;
      if (behavior === 'sync') return undefined;
      return Promise.resolve();
    },
    pause() { el.pauseCalls += 1; el.paused = true; },
    load() { el.loadCalls += 1; },
    removeAttribute(name) { if (name === 'src') { el.src = ''; el.currentSrc = ''; } },
    addEventListener() {},
    removeEventListener() {},
  };
  harness.elements.push(el);
  return el;
}

/**
 * 造一个只够无缝播放面板用的 DOM 桩。
 * @returns {object} 节点表与 document 桩。
 */
function createDomStub() {
  const byId = Object.create(null);
  /**
   * 造一个节点桩。
   * @param {string} id 节点 id。
   * @returns {object} 节点桩。
   */
  function createNode(id) {
    const node = {
      id, value: '', textContent: '', classes: Object.create(null),
      listeners: Object.create(null), parentNode: null, children: [],
      classList: {
        toggle(name, on) { node.classes[name] = on === undefined ? !node.classes[name] : !!on; return !!node.classes[name]; },
        add(name) { node.classes[name] = true; },
        remove(name) { delete node.classes[name]; },
        contains(name) { return !!node.classes[name]; },
      },
      querySelector(selector) { return node.children.filter((child) => child.id === selector)[0] || null; },
      addEventListener(type, fn) { (node.listeners[type] = node.listeners[type] || []).push(fn); },
      dispatch(type, target) { (node.listeners[type] || []).forEach((fn) => fn({ type, target })); },
    };
    byId[id] = node;
    return node;
  }
  const fold = createNode('fx-gapless-fold');
  const toggle = createNode('t-gapless');
  const slider = createNode('gapless-crossfade');
  const output = createNode('output');
  const hint = createNode('gapless-hint');
  const wrap = createNode('fx-slider');
  wrap.children = [slider, output];
  slider.parentNode = wrap;
  return {
    byId, fold, toggle, slider, output, hint,
    document: { getElementById(id) { return byId[id] || null; } },
  };
}

/**
 * 创建无缝播放引擎的隔离执行环境。真实源码在 vm 里跑，外部依赖全部换成可观测的桩。
 * @param {{noWebAudio?: boolean, curveUnsupported?: boolean}=} options 环境选项。
 * @returns {object} 引擎句柄。
 */
function createGaplessEngine(options) {
  const opts = options || {};
  const store = Object.create(null);
  const dom = createDomStub();
  const harness = {
    playBehavior: 'resolve', curveUnsupported: !!opts.curveUnsupported,
    nextIndex: -1, startSeconds: 0, playQueueAtImpl: null,
    elements: [], gainNodes: [], connections: [], timers: [], timerId: 0,
    toasts: [], warnings: [], bound: [], volumeSyncs: 0, listenFinalized: [], queueCalls: [], stored: {},
  };
  const analyser = { label: 'analyser' };
  const beatAnalyser = { label: 'beatAnalyser' };
  const audioCtx = {
    currentTime: 0,
    createGain() { const node = createGainNodeStub(harness); harness.gainNodes.push(node); return node; },
    createMediaElementSource(el) { return { label: 'source-' + el.id, connect(target) { harness.connections.push({ from: 'source-' + el.id, to: target && target.label || 'deck-gain' }); } }; },
  };
  const context = {
    Array, Object, Math, Number, String, JSON, Promise, Float32Array, Error, isFinite,
    console: { warn(message, detail) { harness.warnings.push(String(message) + ' ' + String(detail)); } },
    setTimeout(fn, ms) { harness.timerId += 1; harness.timers.push({ id: harness.timerId, fn, ms }); return harness.timerId; },
    clearTimeout(id) { harness.timers = harness.timers.filter((timer) => timer.id !== id); },
    // 引擎里是 new Audio()，简写方法不可 new，这里必须用函数表达式
    Audio: function () { return createFakeAudioElement(harness); },
    audio: null, audioDeckList: [], audioDeckActive: 0,
    audioCtx: opts.noWebAudio ? null : audioCtx,
    analyser: opts.noWebAudio ? null : analyser,
    beatAnalyser: opts.noWebAudio ? null : beatAnalyser,
    gainNode: { label: 'master' },
    playQueue: [], playMode: 'order', currentIdx: 0,
    GAPLESS_STORE_KEY: 'mineradio-gapless-v1',
    localStorage: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
      setItem(key, value) { store[key] = String(value); },
    },
    clampRange(value, min, max) { return Math.min(max, Math.max(min, value)); },
    bindPlaybackProgressEvents(el) { harness.bound.push(el); },
    applyVolumeToAudio() { harness.volumeSyncs += 1; },
    setPersistentLocalStorageItem(key, value) { harness.stored[key] = String(value); store[key] = String(value); },
    showToast(text) { harness.toasts.push(text); },
    finalizeListenSession(completed) { harness.listenFinalized.push(completed); },
    nextQueueIndexPreview() { return harness.nextIndex; },
    ensureLocalSongUrl(song) { return song && song.url || ''; },
    queueItemKey(song) { return song && song.name || ''; },
    resolveTrackStartSeconds() { return harness.startSeconds; },
    playQueueAt(idx, playOpts) {
      harness.queueCalls.push({ idx, opts: playOpts, handoffPending: context.crossfadeState.handoffPending });
      return harness.playQueueAtImpl ? harness.playQueueAtImpl(idx, playOpts) : Promise.resolve(true);
    },
    document: dom.document,
  };
  context.window = context;
  vm.runInNewContext(
    readGaplessEngineSource()
      + Object.keys(ENGINE_HANDLES).map((key) => '\nthis.' + key + ' = ' + ENGINE_HANDLES[key] + ';').join('')
      + '\nthis.settings = function(){ return gaplessSettings; };'
      + '\nthis.setSettings = function(next){ gaplessSettings = normalizeGaplessSettings(next); };'
      + '\nthis.prefetchState = function(){ return gaplessPrefetch; };'
      + '\nthis.crossfade = function(){ return crossfadeState; };',
    context,
  );
  const engine = { context, harness, dom, store, audioCtx };
  Object.keys(ENGINE_HANDLES).concat(['settings', 'setSettings', 'prefetchState', 'crossfade']).forEach((key) => {
    assert.equal(typeof context[key], 'function', '引擎句柄缺失：' + key);
    engine[key] = context[key];
  });
  return engine;
}

/**
 * 把队列、下标与正在播放的 deck 一次性摆好，避免每个用例重复十行铺垫。
 * @param {object} engine 引擎句柄。
 * @param {{remaining?: number, duration?: number, queue?: Array<object>, nextIndex?: number}=} setup 场景参数。
 * @returns {Array<object>} deck 列表。
 */
function bootPlayback(engine, setup) {
  const conf = setup || {};
  const decks = engine.ensurePool();
  const queue = conf.queue || [
    { type: 'local', name: 'a.flac', url: 'file:///a.flac' },
    { type: 'local', name: 'b.flac', url: 'file:///b.flac' },
  ];
  engine.context.playQueue = queue;
  engine.context.currentIdx = 0;
  engine.harness.nextIndex = conf.nextIndex === undefined ? 1 : conf.nextIndex;
  const duration = conf.duration === undefined ? 200 : conf.duration;
  const remaining = conf.remaining === undefined ? 3 : conf.remaining;
  const el = decks[0].el;
  el.src = queue[0].url;
  el.currentSrc = queue[0].url;
  el.duration = duration;
  el.currentTime = duration - remaining;
  el.paused = false;
  return decks;
}

/**
 * 让引擎里排出的定时器按时间顺序跑完，包含定时器里再排出的定时器。
 * @param {object} harness 测试台。
 * @returns {void}
 */
function runTimers(harness) {
  for (let round = 0; round < 8; round += 1) {
    if (!harness.timers.length) return;
    const due = harness.timers.slice().sort((a, b) => a.ms - b.ms);
    harness.timers = [];
    due.forEach((timer) => timer.fn());
  }
}

/**
 * 让微任务队列跑空，等待 play() 的 Promise 结算。
 * @returns {Promise<void>} 队列跑空的 Promise。
 */
async function flushMicrotasks() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

/**
 * 验证设置归一化：秒数夹在 0~10、按 0.5 档取整，脏数据一律回落，开关只认显式的 false。
 * @returns {void}
 */
function testSettingsNormalization() {
  const engine = createGaplessEngine();
  assert.deepEqual(Object.assign({}, engine.normalize(null)), { enabled: true, crossfadeSeconds: 0 }, '默认开无缝、不交叉');
  assert.equal(engine.normalize({ crossfadeSeconds: 40 }).crossfadeSeconds, 10, '上限 10 秒');
  assert.equal(engine.normalize({ crossfadeSeconds: -5 }).crossfadeSeconds, 0, '下限 0 秒');
  assert.equal(engine.normalize({ crossfadeSeconds: 3.3 }).crossfadeSeconds, 3.5);
  assert.equal(engine.normalize({ crossfadeSeconds: 3.2 }).crossfadeSeconds, 3);
  assert.equal(engine.normalize({ crossfadeSeconds: 'x' }).crossfadeSeconds, 0);
  assert.equal(engine.normalize({ crossfadeSeconds: Infinity }).crossfadeSeconds, 0);
  assert.equal(engine.normalize({ enabled: false }).enabled, false);
  assert.equal(engine.normalize({ enabled: 0 }).enabled, true, '只有显式的 false 才关，脏数据默认开');
}

/**
 * 验证设置存档缺失或损坏时回落默认值，并按范围归一化。
 * @returns {void}
 */
function testSavedSettingsFallBackToDefaults() {
  const engine = createGaplessEngine();
  assert.deepEqual(Object.assign({}, engine.readSaved()), { enabled: true, crossfadeSeconds: 0 });
  engine.store['mineradio-gapless-v1'] = '{坏了';
  assert.deepEqual(Object.assign({}, engine.readSaved()), { enabled: true, crossfadeSeconds: 0 }, '存档损坏时回落默认值而不是抛错');
  engine.store['mineradio-gapless-v1'] = JSON.stringify({ enabled: false, crossfadeSeconds: 99 });
  assert.deepEqual(Object.assign({}, engine.readSaved()), { enabled: false, crossfadeSeconds: 10 });
}

/**
 * 验证只开交叉也会启用双 deck，两个都关才彻底回到单元素旧流程。
 * @returns {void}
 */
function testHandoffGate() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: false, crossfadeSeconds: 0 });
  assert.equal(engine.enabledForHandoff(), false, '两个都关时不预取');
  engine.setSettings({ enabled: false, crossfadeSeconds: 3 });
  assert.equal(engine.enabledForHandoff(), true, '交叉本身就是一种接续，只开它也要预取');
}

/**
 * 验证 deck 池只建一次、复用已有的 audio 元素，且每个 deck 的增益中性值都是 1。
 * @returns {void}
 */
function testDeckPoolWiring() {
  const engine = createGaplessEngine();
  const decks = engine.ensurePool();
  assert.equal(decks.length, 2, '双 deck 常驻');
  assert.equal(engine.context.audioDeckActive, 0);
  assert.equal(engine.context.audio, decks[0].el, '全局 audio 指向出声的 deck');
  decks.forEach((deck, index) => {
    assert.ok(deck.source, 'deck ' + index + ' 要有 MediaElementSource');
    assert.ok(deck.gain, 'deck ' + index + ' 要有独立 deckGain');
    assert.equal(deck.gain.gain.value, 1, 'deckGain 中性值必须是 1，乘 1 逐位透明');
  });
  assert.equal(engine.harness.connections.length, 2, '每个 deck 的 source 都接进自己的 deckGain');
  assert.equal(new Set(engine.harness.bound).size, 2, '两个 deck 都要绑进度事件');
  engine.ensurePool();
  assert.equal(engine.harness.gainNodes.length, 2, '重复调用不能重复建节点，接线一次成型');
  assert.equal(engine.idleIndex(), 1);
  assert.equal(engine.activeDeck(), decks[0]);
}

/**
 * 验证已经接过 MediaElementSource 的旧元素会被复用成 0 号 deck，而不是被丢掉。
 * @returns {void}
 */
function testDeckPoolReusesExistingElement() {
  const engine = createGaplessEngine();
  const existing = engine.context.Audio();
  engine.context.audio = existing;
  const decks = engine.ensurePool();
  assert.equal(decks[0].el, existing, '已有的 audio 必须复用，重新 new 会把整条音频链丢掉');
  assert.equal(engine.context.audio, existing);
}

/**
 * 验证两个开关都关时完全不预取、不碰闲置 deck，播放链路和单元素时代一致。
 * @returns {void}
 */
function testDisabledKeepsLegacyFlow() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: false, crossfadeSeconds: 0 });
  const decks = bootPlayback(engine, { remaining: 4 });
  engine.watch(decks[0].el);
  assert.equal(engine.prefetchState().deckIndex, -1, '关闭时不预取');
  assert.equal(decks[1].el.src, '', '闲置 deck 不该被塞入媒体源');
  assert.equal(decks[1].el.playCalls, 0, '闲置 deck 绝不出声');
  assert.equal(decks[0].el.pauseCalls, 0, '正在播的 deck 一个字不动');
  assert.equal(engine.harness.queueCalls.length, 0, '推进队列仍然只由 onended 负责');
}

/**
 * 验证无缝播放的预取只解码不出声，也不碰正在播的 deck。
 * @returns {void}
 */
function testPrefetchDecodesWithoutSound() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: true, crossfadeSeconds: 0 });
  const decks = bootPlayback(engine, { remaining: 5 });
  engine.watch(decks[0].el);
  const prefetch = engine.prefetchState();
  assert.equal(prefetch.deckIndex, 1);
  assert.equal(prefetch.url, 'file:///b.flac');
  assert.equal(prefetch.queueIndex, 1);
  assert.equal(decks[1].el.src, 'file:///b.flac');
  assert.equal(decks[1].el.loadCalls, 1, '预取要真的 load 出解码缓冲');
  assert.equal(decks[1].el.playCalls, 0, '预取只解码不出声');
  assert.equal(decks[0].el.pauseCalls, 0, '预取不能碰正在播的 deck');
  assert.ok(engine.harness.volumeSyncs >= 1, '预取后要把闲置 deck 的元素音量对齐当前策略');
  assert.equal(decks[1].gain.gain.value, 1, '预取 deck 拿到的必须是干净的中性增益');
  // 距结尾还远时不该提前占用解码资源
  const later = createGaplessEngine();
  later.setSettings({ enabled: true, crossfadeSeconds: 0 });
  const far = bootPlayback(later, { remaining: 120 });
  later.watch(far[0].el);
  assert.equal(later.prefetchState().deckIndex, -1, '离结尾还远时不预取');
}

/**
 * 验证手动切歌、缓冲不足与地址不匹配都不接管预取 deck：要求 5 靠这一层挡住。
 * @returns {void}
 */
function testAdoptRefusesManualSwitch() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: true, crossfadeSeconds: 0 });
  const decks = bootPlayback(engine, { remaining: 5 });
  engine.watch(decks[0].el);
  const song = engine.context.playQueue[1];
  assert.equal(engine.adopt(song, undefined, 'file:///b.flac'), false, '手动切歌不接管');
  assert.equal(engine.adopt(song, { manual: true }, 'file:///b.flac'), false, '点下一首不接管');
  assert.equal(engine.adopt(song, { autoAdvance: true }, 'file:///c.flac'), false, '地址不匹配不接管');
  decks[1].el.readyState = 2;
  assert.equal(engine.adopt(song, { autoAdvance: true }, 'file:///b.flac'), false, '缓冲不足时宁可走旧的 load 流程');
  decks[1].el.readyState = 4;
  engine.setSettings({ enabled: false, crossfadeSeconds: 0 });
  assert.equal(engine.adopt(song, { autoAdvance: true }, 'file:///b.flac'), false, '开关关掉后连自动续播也不接管');
  assert.equal(engine.context.audioDeckActive, 0, '被拒的接管一次也不能挪动全局指针');
  assert.equal(engine.context.audio, decks[0].el);
  assert.equal(engine.prefetchState().deckIndex, 1, '被拒的接管不能消费掉预取记录');
}

/**
 * 验证自动续播接管：全局指针跟着换 deck，旧 deck 被收干净，接管 deck 用极短斜坡起播。
 * @returns {void}
 */
function testAdoptOnAutoAdvance() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: true, crossfadeSeconds: 0 });
  const decks = bootPlayback(engine, { remaining: 5 });
  engine.watch(decks[0].el);
  const song = engine.context.playQueue[1];
  decks[0].el.onended = function () {};
  assert.equal(engine.adopt(song, { autoAdvance: true }, 'file:///b.flac'), true);
  assert.equal(engine.context.audioDeckActive, 1);
  assert.equal(engine.context.audio, decks[1].el, '全局 audio 换 deck，进度条与统计跟着走');
  assert.equal(decks[0].el.pauseCalls, 1, '旧 deck 自然播完后直接收掉');
  assert.equal(decks[0].el.onended, null, '收掉旧 deck 时要解掉自然结束回调');
  assert.equal(decks[0].gain.gain.value, 1, '旧 deck 增益复位成中性 1');
  assert.equal(decks[1].gain.gain.value, 0, '接管 deck 先压到 0，等 play() 确认再补斜坡');
  assert.ok(decks[1].pendingStartRamp > 0, '起播斜坡待执行');
  assert.equal(engine.prefetchState().deckIndex, -1, '预取记录被接管消费掉');
  engine.settleStart();
  const events = decks[1].gain.events;
  const last = events[events.length - 1];
  assert.equal(last.type, 'linear', '起播用斜坡而不是阶跃');
  assert.equal(last.value, 1);
  assert.ok(last.when > 0 && last.when < 0.05, '接续斜坡是十几毫秒级，听不出延迟');
  assert.equal(decks[1].pendingStartRamp, 0, '斜坡只补一次');
}

/**
 * 验证单曲重播也能无缝接管，同时起播失败路径不会把 deck 永久留在 0 增益上。
 * @returns {void}
 */
function testAdoptOnRepeatAndFailedStart() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: true, crossfadeSeconds: 0 });
  const song = { type: 'local', name: 'a.flac', url: 'file:///a.flac' };
  const decks = bootPlayback(engine, { remaining: 5, queue: [song], nextIndex: 0 });
  engine.watch(decks[0].el);
  assert.equal(engine.prefetchState().url, 'file:///a.flac', '单曲循环预取的就是自己');
  assert.equal(engine.adopt(song, { autoRepeat: true }, 'file:///a.flac'), true, '单曲重播也走无缝接管');
  assert.equal(engine.context.audioDeckActive, 1);
  // 起播失败时 attemptAudioPlay 同样会调 settleGaplessDeckStart：无论这个 deck 还是不是活跃 deck，
  // 增益都要补回中性 1，否则它会被 0 一直压着，下次播它就是静音。
  assert.equal(decks[1].gain.gain.value, 0);
  engine.context.audioDeckActive = 0;
  engine.settleStart();
  assert.equal(decks[1].gain.gain.value, 1, '待执行斜坡在非活跃 deck 上直接补成中性 1');
}

/**
 * 让测试里的 playQueueAt 桩按真实链路接管 deck（playQueueAt → playLocalQueueItem → adoptGaplessDeckForSong）。
 * @param {object} engine 引擎句柄。
 * @returns {void}
 */
function wireAdoptingQueue(engine) {
  engine.harness.playQueueAtImpl = function (idx, opts) {
    const song = engine.context.playQueue[idx];
    engine.context.currentIdx = idx;
    engine.adopt(song, opts, song && song.url);
    return Promise.resolve(true);
  };
}

/**
 * 验证交叉秒数的边界：短歌按 (时长 - 最小尾巴) / 2 封顶，脏时长一律不交叉。
 * @returns {void}
 */
function testCrossfadeSecondsBoundaries() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: true, crossfadeSeconds: 10 });
  assert.equal(engine.resolveSeconds(240), 10);
  assert.equal(engine.resolveSeconds(8), (8 - 0.35) / 2, '8 秒的歌配 10 秒交叉会从头叠到尾，必须按短歌封顶');
  assert.equal(engine.resolveSeconds(0.2), 0, '比最小尾巴还短的歌一律不交叉');
  assert.equal(engine.resolveSeconds(0), 0);
  assert.equal(engine.resolveSeconds(NaN), 0, '时长还没解析出来时不交叉');
  engine.setSettings({ enabled: true, crossfadeSeconds: 0 });
  assert.equal(engine.resolveSeconds(240), 0, 'Crossfade = 0 永不交叉');
}

/**
 * 验证 Crossfade = 0 时闲置 deck 绝不出声，播放逻辑与原来完全一致。
 * @returns {void}
 */
function testZeroCrossfadeKeepsSingleVoice() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: true, crossfadeSeconds: 0 });
  const decks = bootPlayback(engine, { remaining: 1.5 });
  wireAdoptingQueue(engine);
  engine.watch(decks[0].el);
  assert.equal(engine.crossfade().active, false);
  assert.equal(engine.crossfade().starting, false);
  assert.equal(decks[1].el.playCalls, 0, 'Crossfade = 0 时任何时刻只有一路声音');
  assert.equal(engine.harness.queueCalls.length, 0, '队列推进仍然只由 onended 负责');
  assert.deepEqual(engine.harness.listenFinalized, [], '不提前结算播放统计');
}

/**
 * 把场景直接推进到「交叉已经提交、两条斜坡正在跑」的状态。
 * @param {object} engine 引擎句柄。
 * @param {number=} seconds 交叉秒数，默认 3。
 * @returns {Promise<Array<object>>} deck 列表。
 */
async function bootActiveCrossfade(engine, seconds) {
  const span = seconds === undefined ? 3 : seconds;
  engine.setSettings({ enabled: true, crossfadeSeconds: span });
  const decks = bootPlayback(engine, { remaining: span });
  wireAdoptingQueue(engine);
  engine.watch(decks[0].el);
  await flushMicrotasks();
  assert.equal(engine.crossfade().active, true, '交叉应已提交');
  return decks;
}

/**
 * 验证交叉主路径：先确认下一首真的出声，再排等功率对交叉、结算旧歌、推进队列，最后收掉旧 deck。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testCrossfadeHappyPath() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: true, crossfadeSeconds: 3 });
  const decks = bootPlayback(engine, { remaining: 3 });
  wireAdoptingQueue(engine);
  engine.watch(decks[0].el);
  // 起播确认之前只是 starting：队列一个字没动，旧歌也还没被结算。
  assert.equal(engine.crossfade().starting, true);
  assert.equal(engine.crossfade().active, false);
  assert.equal(decks[1].el.playCalls, 1, '交叉先让下一首在闲置 deck 上真的播起来');
  assert.equal(engine.harness.queueCalls.length, 0, 'play() 还没确认成功就推进队列会导致突然静音');

  await flushMicrotasks();
  assert.equal(engine.crossfade().active, true);
  assert.equal(engine.crossfade().seconds, 3);
  const fadeOut = decks[0].gain.events.filter((e) => e.type === 'curve').pop();
  const fadeIn = decks[1].gain.events.filter((e) => e.type === 'curve').pop();
  assert.deepEqual(Object.assign({}, fadeOut), { type: 'curve', from: 1, to: 0, span: 3, points: 33 }, '旧歌走等功率降');
  assert.deepEqual(Object.assign({}, fadeIn), { type: 'curve', from: 0, to: 1, span: 3, points: 33 }, '新歌走等功率升，总能量恒定不塌陷');
  assert.deepEqual(Array.from(engine.harness.listenFinalized), [true], '交叉等于把旧歌听完，按完整播放结算一次');
  assert.equal(engine.harness.queueCalls.length, 1);
  assert.equal(engine.harness.queueCalls[0].idx, 1);
  assert.equal(engine.harness.queueCalls[0].opts.autoAdvance, true);
  assert.equal(engine.harness.queueCalls[0].opts.crossfade, true);
  assert.equal(engine.harness.queueCalls[0].handoffPending, true, '一次性令牌必须在这次切歌里生效，否则淡出的旧 deck 会被直接停掉');
  assert.equal(engine.crossfade().handoffPending, false, '令牌用完立刻收回，任何别的切歌都吃不到');
  assert.equal(decks[0].el.pauseCalls, 0, '交叉期间旧 deck 必须继续出声');
  assert.equal(engine.context.audioDeckActive, 1);
  assert.equal(engine.context.audio, decks[1].el, '全局 audio 换到新 deck，进度条与统计跟着走');
  // 预取时 pause() 过一次（换 src 前先停稳），之后这个 deck 已经在出声，一次都不能再被停
  const pausesAfterCommit = decks[1].el.pauseCalls;

  runTimers(engine.harness);
  assert.equal(engine.crossfade().active, false);
  assert.equal(decks[0].el.pauseCalls, 1, '斜坡走完才收掉旧 deck');
  assert.equal(decks[0].el.src, '', '收掉时清空媒体源，释放解码缓冲');
  assert.equal(decks[0].gain.gain.value, 1, '旧 deck 增益复位成中性 1');
  assert.equal(decks[1].el.pauseCalls, pausesAfterCommit, '出声之后的新 deck 一次也不能被停');
  const topUp = decks[1].gain.events.pop();
  assert.equal(topUp.type, 'linear', '交叉结束时新 deck 还没到满增益就补一条极短斜坡，不留半程电平');
  assert.equal(topUp.value, 1);
}

/**
 * 验证预起播被拒时原样退回：旧歌完好无损地继续播，队列一个字不动，失败地址进黑名单不再重试。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testCrossfadeAbortsWhenStartRejected() {
  const engine = createGaplessEngine();
  engine.harness.playBehavior = 'reject';
  engine.setSettings({ enabled: true, crossfadeSeconds: 3 });
  const decks = bootPlayback(engine, { remaining: 3 });
  wireAdoptingQueue(engine);
  const keepAlive = function () {};
  decks[0].el.onended = keepAlive;
  engine.watch(decks[0].el);
  await flushMicrotasks();

  assert.equal(engine.crossfade().active, false);
  assert.equal(engine.crossfade().starting, false);
  assert.equal(engine.crossfade().blockedUrl, 'file:///b.flac', '失败地址进黑名单');
  assert.equal(engine.harness.queueCalls.length, 0, '起播失败不能推进队列');
  assert.deepEqual(Array.from(engine.harness.listenFinalized), [], '起播失败不能提前结算旧歌');
  assert.equal(decks[0].el.pauseCalls, 0, '旧歌一个字没动');
  assert.equal(decks[0].el.onended, keepAlive, 'onended 还有效，会照原来的路径续播');
  assert.equal(decks[0].gain.events.filter((e) => e.type === 'curve').length, 0, '旧歌没被排上任何淡出');
  assert.equal(decks[1].el.src, '', '失败的 deck 要清干净');
  assert.equal(decks[1].gain.gain.value, 1, '失败的 deck 增益复位成中性 1');
  assert.equal(engine.prefetchState().deckIndex, -1);

  // 同一首歌里不再重试，避免每次 timeupdate 都撞一次失败的起播
  engine.watch(decks[0].el);
  await flushMicrotasks();
  assert.equal(decks[1].el.playCalls, 1, '黑名单期内不重试');
  assert.equal(engine.prefetchState().deckIndex, -1, '黑名单地址连预取都不做');

  // 下一次切歌复位黑名单，预取恢复
  engine.resetForSwitch('track-switch');
  assert.equal(engine.crossfade().blockedUrl, '');
  decks[0].el.currentTime = decks[0].el.duration - 15;
  engine.watch(decks[0].el);
  assert.equal(engine.prefetchState().url, 'file:///b.flac', '复位后预取恢复');
  assert.equal(decks[1].el.playCalls, 1, '还没进交叉窗口时不该起播');
}

/**
 * 验证 play() 同步抛错与不返回 Promise 两种实现都走对分支。
 * @returns {void}
 */
function testCrossfadeStartEdgeReturns() {
  const thrower = createGaplessEngine();
  thrower.harness.playBehavior = 'throw';
  thrower.setSettings({ enabled: true, crossfadeSeconds: 3 });
  const throwDecks = bootPlayback(thrower, { remaining: 3 });
  wireAdoptingQueue(thrower);
  thrower.watch(throwDecks[0].el);
  assert.equal(thrower.crossfade().starting, false, 'play() 同步抛错要立刻回落');
  assert.equal(thrower.crossfade().active, false);
  assert.equal(thrower.crossfade().blockedUrl, 'file:///b.flac');
  assert.equal(thrower.harness.queueCalls.length, 0);
  assert.equal(throwDecks[0].el.pauseCalls, 0, '旧歌不受影响');

  const sync = createGaplessEngine();
  sync.harness.playBehavior = 'sync';
  sync.setSettings({ enabled: true, crossfadeSeconds: 3 });
  const syncDecks = bootPlayback(sync, { remaining: 3 });
  wireAdoptingQueue(sync);
  sync.watch(syncDecks[0].el);
  assert.equal(sync.crossfade().active, true, '老实现的 play() 不返回 Promise，要同步提交');
  assert.equal(sync.harness.queueCalls.length, 1);
  assert.equal(sync.context.audio, syncDecks[1].el);
}

/**
 * 验证交叉进行中手动切歌：还在出声的 deck 先压到 0 再停，绝不在非零电平上硬切；重复复位是空操作。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testManualSwitchDuringCrossfadeDucks() {
  const engine = createGaplessEngine();
  const decks = await bootActiveCrossfade(engine, 3);
  const serialBefore = engine.crossfade().settleSerial;

  engine.resetForSwitch('track-switch');
  assert.equal(engine.crossfade().active, false);
  assert.ok(engine.crossfade().settleSerial > serialBefore, '收尾序号要递增，作废还没到点的交叉收尾');
  const ducking = decks[0].gain.events[decks[0].gain.events.length - 1];
  assert.equal(ducking.type, 'linear');
  assert.equal(ducking.value, 0, '正在出声的旧 deck 必须先压到 0');
  assert.equal(decks[0].el.pauseCalls, 0, '压低还没走完就 pause 会爆音');

  // 重复复位不能再收一次：pauseCurrentAudioForTrackSwitch 与 fadeOutAndPauseAudio 可能接连触发
  const pausesBefore = decks[0].el.pauseCalls;
  const activePauses = decks[1].el.pauseCalls;
  const eventsBefore = decks[1].gain.events.length;
  engine.resetForSwitch('track-switch');
  engine.finishNow('fade-out-pause');
  assert.equal(decks[0].el.pauseCalls, pausesBefore, '重复复位是空操作');
  assert.equal(decks[1].gain.events.length, eventsBefore, '重复复位不能给活跃 deck 再排一条斜坡');

  runTimers(engine.harness);
  assert.equal(decks[0].el.pauseCalls, 1, '压到 0 之后才停');
  assert.equal(decks[0].gain.gain.value, 1, '停稳后增益复位成中性 1');
  assert.equal(decks[1].el.pauseCalls, activePauses, '正在出声的接管 deck 一次也不能被停');
  assert.equal(engine.context.audio, decks[1].el);
}

/**
 * 验证被作废的收尾定时器不会把刚接管的新 deck 停掉——这一条挡的就是「突然静音」。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testStaleTimersCannotStopNewDeck() {
  const engine = createGaplessEngine();
  const decks = await bootActiveCrossfade(engine, 3);
  engine.resetForSwitch('track-switch');

  // 交叉被打断后立刻换下一首：预取重新拿走刚被压低的 0 号 deck
  engine.context.playQueue.push({ type: 'local', name: 'c.flac', url: 'file:///c.flac' });
  engine.harness.nextIndex = 2;
  decks[1].el.duration = 200;
  decks[1].el.currentTime = 190;
  decks[1].el.paused = false;
  engine.watch(decks[1].el);
  assert.equal(engine.prefetchState().deckIndex, 0, '被压低的 deck 收干净后可以立刻复用');
  assert.equal(engine.adopt(engine.context.playQueue[2], { autoAdvance: true }, 'file:///c.flac'), true);
  engine.settleStart();
  assert.equal(engine.context.audioDeckActive, 0);
  const pausesBefore = decks[0].el.pauseCalls;

  runTimers(engine.harness);
  assert.equal(decks[0].el.pauseCalls, pausesBefore, '上一轮的压低收尾必须已经作废，不能停掉刚接管的 deck');
  assert.equal(engine.context.audio, decks[0].el);
  assert.equal(decks[0].el.src, 'file:///c.flac', '新接管的媒体源不能被旧收尾清掉');
}

/**
 * 验证单曲循环下一首就是自己时预取照做、交叉不做：同一个文件叠播会听成回声。
 * @returns {void}
 */
function testSameTrackNeverCrossfades() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: true, crossfadeSeconds: 4 });
  const song = { type: 'local', name: 'a.flac', url: 'file:///a.flac' };
  const decks = bootPlayback(engine, { remaining: 3, queue: [song], nextIndex: 0 });
  wireAdoptingQueue(engine);
  engine.watch(decks[0].el);
  assert.equal(engine.prefetchState().url, 'file:///a.flac', '单曲循环照样预取，接续仍然无缝');
  assert.equal(engine.crossfade().active, false);
  assert.equal(engine.crossfade().starting, false);
  assert.equal(decks[1].el.playCalls, 0, '同一首歌绝不叠播，避免回声');
  assert.equal(engine.harness.queueCalls.length, 0);
}

/**
 * 验证随机播放的待洗牌状态既不预取也不交叉，洗过牌之后再恢复：要求 6 靠这一层守住。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testShufflePendingSkipsEverything() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: true, crossfadeSeconds: 3 });
  engine.context.playMode = 'shuffle';
  const decks = bootPlayback(engine, { remaining: 3 });
  wireAdoptingQueue(engine);
  engine.watch(decks[0].el);
  assert.equal(engine.prefetchState().deckIndex, -1, '还没洗牌时预取的那一首不一定还是下一首，一律不预取');
  assert.equal(decks[1].el.src, '');
  assert.equal(decks[1].el.playCalls, 0, '随机播放行为必须零变化');
  assert.equal(engine.harness.queueCalls.length, 0);

  // 队列已经洗过牌，下标就稳定了，预取与交叉恢复
  engine.context.shuffledPlayQueueArrays = new Set([engine.context.playQueue]);
  engine.watch(decks[0].el);
  assert.equal(engine.prefetchState().url, 'file:///b.flac');
  assert.equal(engine.crossfade().starting, true, '洗过牌之后随机播放也能交叉');
  await flushMicrotasks();
  assert.equal(engine.crossfade().active, true);
}

/**
 * 验证「播完即停」时释放预取：nextQueueIndexPreview 返回 -1，不该再占着解码缓冲。
 * @returns {void}
 */
function testStopAfterCurrentReleasesPrefetch() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: true, crossfadeSeconds: 3 });
  const decks = bootPlayback(engine, { remaining: 8 });
  engine.watch(decks[0].el);
  assert.equal(engine.prefetchState().deckIndex, 1);

  engine.harness.nextIndex = -1;
  decks[0].el.currentTime = decks[0].el.duration - 3;
  engine.watch(decks[0].el);
  assert.equal(engine.prefetchState().deckIndex, -1, '没有下一首就释放预取');
  assert.equal(decks[1].el.src, '', '释放时清空媒体源，交还解码缓冲');
  assert.equal(decks[1].gain.gain.value, 1);
  assert.equal(decks[1].el.playCalls, 0, '没有下一首自然也不交叉');
  assert.equal(engine.crossfade().active, false);
}

/**
 * 验证交叉进行中改秒数不截断正在跑的斜坡，新值落盘留给下一首。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testSettingsChangeDoesNotCutRunningFade() {
  const engine = createGaplessEngine();
  const decks = await bootActiveCrossfade(engine, 3);
  const fromEvents = decks[0].gain.events.length;
  const toEvents = decks[1].gain.events.length;

  engine.setSeconds(6);
  assert.equal(decks[0].gain.events.length, fromEvents, '中途截断斜坡反而会听到一次电平跳变');
  assert.equal(decks[1].gain.events.length, toEvents);
  assert.equal(engine.crossfade().seconds, 3, '正在跑的这次交叉仍然按原时长走完');
  assert.equal(engine.settings().crossfadeSeconds, 6);
  assert.deepEqual(
    Object.assign({}, JSON.parse(engine.harness.stored['mineradio-gapless-v1'])),
    { enabled: true, crossfadeSeconds: 6 },
    '新值走独立存档键落盘，下一首生效',
  );
  assert.equal(engine.harness.toasts.length, 1);
  assert.match(engine.harness.toasts[0], /交叉淡入淡出 6 秒/);

  engine.setSeconds(6);
  assert.equal(engine.harness.toasts.length, 1, '值没变时不重复提示');
}

/**
 * 验证关掉无缝开关会立刻释放预取，开关状态落盘。
 * @returns {void}
 */
function testToggleReleasesPrefetch() {
  const engine = createGaplessEngine();
  engine.setSettings({ enabled: true, crossfadeSeconds: 0 });
  const decks = bootPlayback(engine, { remaining: 5 });
  engine.watch(decks[0].el);
  assert.equal(engine.prefetchState().deckIndex, 1);

  engine.toggle();
  assert.equal(engine.settings().enabled, false);
  assert.equal(engine.prefetchState().deckIndex, -1, '关掉之后不该继续占着解码缓冲');
  assert.equal(decks[1].el.src, '');
  assert.equal(JSON.parse(engine.harness.stored['mineradio-gapless-v1']).enabled, false);
  assert.match(engine.harness.toasts[0], /无缝播放已关闭/);

  engine.toggle();
  assert.equal(engine.settings().enabled, true);
  assert.match(engine.harness.toasts[1], /无缝播放已开启/);
  assert.equal(engine.prefetchState().deckIndex, -1, '重新打开不立刻预取，等下一次 timeupdate');
}

/**
 * 验证秒数展示与三档说明文案。
 * @returns {void}
 */
function testSecondsFormatAndHintTiers() {
  const engine = createGaplessEngine();
  assert.equal(engine.formatSeconds(0), '0');
  assert.equal(engine.formatSeconds(3), '3');
  assert.equal(engine.formatSeconds(2.5), '2.5');
  assert.equal(engine.formatSeconds(10), '10');
  assert.equal(engine.formatSeconds('x'), '0');
  engine.setSettings({ enabled: false, crossfadeSeconds: 0 });
  assert.match(engine.hintText(), /已关闭/);
  engine.setSettings({ enabled: true, crossfadeSeconds: 0 });
  assert.match(engine.hintText(), /只有一路声音/);
  engine.setSettings({ enabled: false, crossfadeSeconds: 4 });
  assert.match(engine.hintText(), /交叉淡入淡出 4 秒/, '开了交叉就是接续，文案不能还说已关闭');
}

/**
 * 验证面板：读存档渲染开关与滑杆，事件只绑一次，拖动不刷屏、松手才提示。
 * @returns {void}
 */
function testControlsBindAndRender() {
  const engine = createGaplessEngine();
  engine.store['mineradio-gapless-v1'] = JSON.stringify({ enabled: true, crossfadeSeconds: 2.5 });
  engine.initControls();
  assert.equal(engine.settings().crossfadeSeconds, 2.5, '面板初始化时读回存档');
  assert.equal(engine.dom.toggle.classes.on, true);
  assert.equal(engine.dom.slider.value, '2.5');
  assert.equal(engine.dom.output.textContent, '2.5 s');
  assert.match(engine.dom.hint.textContent, /交叉淡入淡出 2\.5 秒/);

  engine.initControls();
  assert.equal((engine.dom.fold.listeners.input || []).length, 1, '重复初始化不能重复绑事件');
  assert.equal((engine.dom.fold.listeners.change || []).length, 1);

  engine.dom.slider.value = '4';
  engine.dom.fold.dispatch('input', engine.dom.slider);
  assert.equal(engine.settings().crossfadeSeconds, 4);
  assert.equal(engine.dom.output.textContent, '4 s');
  assert.deepEqual(Array.from(engine.harness.toasts), [], '拖动过程中不弹提示，避免刷屏');

  engine.dom.slider.value = '0';
  engine.dom.fold.dispatch('change', engine.dom.slider);
  assert.equal(engine.settings().crossfadeSeconds, 0);
  assert.equal(engine.dom.output.textContent, '关');
  assert.equal(engine.harness.toasts.length, 1, '松手落定才提示一次');
  assert.match(engine.harness.toasts[0], /交叉淡入淡出已关闭/);
  assert.match(engine.dom.hint.textContent, /只有一路声音/);

  // 面板里别的滑杆不该被这两个监听吃掉
  const other = { id: 'fx-intensity', value: '9' };
  engine.dom.fold.dispatch('change', other);
  assert.equal(engine.settings().crossfadeSeconds, 0);
  assert.equal(engine.harness.toasts.length, 1);

  engine.setSettings({ enabled: false, crossfadeSeconds: 0 });
  engine.updateControls();
  assert.equal(engine.dom.toggle.classes.on, false);
  assert.match(engine.dom.hint.textContent, /已关闭/);
}

/**
 * 验证没有 WebAudio 的环境退回元素音量，且主增益在场时绝不去动元素音量。
 * @returns {void}
 */
function testNoWebAudioFallback() {
  const engine = createGaplessEngine({ noWebAudio: true });
  engine.setSettings({ enabled: true, crossfadeSeconds: 0 });
  const decks = bootPlayback(engine, { remaining: 5 });
  decks.forEach((deck) => assert.equal(deck.gain, null, '没有 WebAudio 时不建增益节点'));
  engine.watch(decks[0].el);
  assert.equal(engine.prefetchState().deckIndex, 1, '没有 WebAudio 也照样预取接续');
  assert.equal(engine.adopt(engine.context.playQueue[1], { autoAdvance: true }, 'file:///b.flac'), true);
  assert.equal(decks[1].el.volume, 1, '主增益在场时元素音量归它管，deck 逻辑一个字不动');
  engine.settleStart();
  assert.equal(decks[1].el.volume, 1);

  engine.context.gainNode = null;
  engine.setDeckGain(decks[1], 0.5);
  assert.equal(decks[1].el.volume, 0.5, '没有主增益节点时才退回元素音量');
  engine.rampDeck(decks[1], 1, 0, 0.02, true);
  assert.equal(decks[1].el.volume, 0, '退化路径直接落到终值，不留半程音量');
}

/**
 * 验证 setValueCurveAtTime 不可用时退回线性斜坡，而不是变成一次阶跃。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testCurveFallbackStaysSmooth() {
  const engine = createGaplessEngine({ curveUnsupported: true });
  const decks = await bootActiveCrossfade(engine, 3);
  assert.equal(decks[0].gain.events.filter((e) => e.type === 'curve').length, 0);
  const fadeOut = decks[0].gain.events.filter((e) => e.type === 'linear').pop();
  const fadeIn = decks[1].gain.events.filter((e) => e.type === 'linear').pop();
  assert.equal(fadeOut.value, 0);
  assert.equal(fadeOut.when, 3, '退化路径的斜坡仍然占满整段交叉，不能压成阶跃');
  assert.equal(fadeIn.value, 1);
  assert.equal(fadeIn.when, 3);
}

/**
 * 验证双 deck、接管闸门与各条切歌路径的接线按设计接好，避免后续改动悄悄绕开无缝逻辑。
 * @returns {void}
 */
function testSourceWiring() {
  // 双 deck 常驻，每个 deck 走 source → deckGain → analyser / beatAnalyser，中性增益恒为 1，汇入点之后的链路一个字没改。
  assert.match(appSource, /var audioDeckList = \[\], audioDeckActive = 0;/);
  assert.match(appSource, /deck\.gain\.gain\.value = 1;/);
  assert.match(appSource, /deck\.source\.connect\(deck\.gain\);/);
  assert.match(appSource, /deck\.gain\.connect\(analyser\);/);
  assert.match(appSource, /deck\.gain\.connect\(beatAnalyser\);/);

  // 接管闸门：只有自动续播 / 单曲重播 / 交叉三条路进得来，手动切歌与上下首照旧走 audio.src = url。
  assert.match(appSource, /if \(opts\.autoAdvance !== true && opts\.autoRepeat !== true\) return false;/);
  assert.match(appSource, /var adoptedDeck = adoptGaplessDeckForSong\(song, opts, localUrl\);/);
  assert.match(appSource, /if \(!adoptedDeck\) audio\.src = localUrl;/);
  // 接管来的 deck 不能再 seek、更不能 load：load() 会把预解码缓冲整个丢掉。
  assert.match(appSource, /if \(!adoptedDeck\) \{\s*scheduleAudioResumePosition/);
  // 接管路径必须跳过主增益淡入，否则共享的 gainNode 会被拉到 0，接上的那一下反而是静音。
  assert.match(appSource, /fade: adoptedDeck \? false : undefined/);

  // 一次性令牌：只有交叉自己提交的那次切歌能放过正在淡出的旧 deck，其余切歌照旧先停旧 deck 再复位。
  assert.match(appSource, /if \(crossfadeState\.handoffPending\) \{ crossfadeState\.handoffPending = false; return; \}\s*resetGaplessForTrackSwitch\('track-switch'\);/);
  assert.match(appSource, /finishCrossfadeImmediately\('fade-out-pause'\)/);
  // 交叉与预取由媒体时钟驱动，后台标签页被节流也不会漏掉交叉点。
  assert.match(appSource, /event\.type === 'timeupdate' && typeof runGaplessPlaybackWatch === 'function'\) runGaplessPlaybackWatch\(event\.target\);/);
  // 自然播完与自动续播都带上 autoAdvance，预取读的就是续播用的同一个下标函数。
  assert.match(appSource, /nextTrack\(\{ autoAdvance: true \}\);/);
  assert.match(appSource, /var advanceOpts = opts && opts\.autoAdvance === true \? \{ autoAdvance: true \} : undefined;/);

  // 设置走独立存档键，不混进视觉预设 fx，也不被 fx 面板当成视觉参数劫持。
  assert.match(appSource, /var GAPLESS_STORE_KEY = 'mineradio-gapless-v1';/);
  assert.match(appSource, /PERSISTENT_UI_STATE_KEYS[\s\S]*?GAPLESS_STORE_KEY,/);
  assert.ok(!/fx\.gapless/.test(appSource), '无缝播放设置不能写进视觉预设 fx');
  assert.ok(!/\['gapless-crossfade'/.test(appSource), '交叉滑杆不能被 bindFxPanel 当成视觉参数');

  // 启动顺序：接在音效链之后初始化，且不能插进音量均衡那两行之间。
  assert.match(appSource, /initAudioChainControls\(\);\s*initGaplessControls\(\);/);
  assert.match(appSource, /'fx-gapless-fold'[\s\S]{0,140}return 'advanced';/);
  assert.match(appSource, /\['fx-lyric-fold','fx-overlay-fold','fx-stage-fold','fx-playback-fold','fx-gapless-fold','fx-volume-fold','fx-advanced'\]/);

  // 面板入口：折叠块夹在音量与 EQ 之间，只加一个开关和一根滑杆。
  assert.match(indexSource, /id="fx-volume-fold"[\s\S]*?id="fx-gapless-fold"[\s\S]*?id="fx-eq-fold"/);
  assert.match(indexSource, /id="fx-gapless-fold"[\s\S]*?id="t-gapless"[\s\S]*?id="gapless-crossfade" type="range" min="0" max="10" step="0\.5"/);
  assert.match(indexSource, /onclick="toggleGaplessSetting\(\)"/);
  assert.match(indexSource, /id="gapless-hint"/);
}

test('无缝播放设置归一化并容错脏数据', testSettingsNormalization);
test('设置存档损坏时回落默认值', testSavedSettingsFallBackToDefaults);
test('只开交叉也要双 deck 支撑', testHandoffGate);
test('双 deck 池接线一次成型且中性增益为 1', testDeckPoolWiring);
test('已接过音频链的元素被复用成 0 号 deck', testDeckPoolReusesExistingElement);
test('两个开关都关时完全走旧流程', testDisabledKeepsLegacyFlow);
test('预取只解码不出声也不碰在播 deck', testPrefetchDecodesWithoutSound);
test('手动切歌与缓冲不足都不接管预取 deck', testAdoptRefusesManualSwitch);
test('自动续播接管并用极短斜坡起播', testAdoptOnAutoAdvance);
test('单曲重播接管且起播失败不留静音 deck', testAdoptOnRepeatAndFailedStart);
test('交叉秒数按短歌与脏时长封顶', testCrossfadeSecondsBoundaries);
test('Crossfade = 0 时任何时刻只有一路声音', testZeroCrossfadeKeepsSingleVoice);
test('交叉主路径：确认出声后再对交叉并推进队列', testCrossfadeHappyPath);
test('预起播被拒时原样退回并进黑名单', testCrossfadeAbortsWhenStartRejected);
test('play() 抛错与不返回 Promise 都走对分支', testCrossfadeStartEdgeReturns);
test('交叉中手动切歌先压到 0 再停', testManualSwitchDuringCrossfadeDucks);
test('作废的收尾定时器不会停掉新接管的 deck', testStaleTimersCannotStopNewDeck);
test('下一首是自己时预取照做但不交叉', testSameTrackNeverCrossfades);
test('随机播放待洗牌时既不预取也不交叉', testShufflePendingSkipsEverything);
test('播完即停时释放预取', testStopAfterCurrentReleasesPrefetch);
test('交叉中改秒数不截断正在跑的斜坡', testSettingsChangeDoesNotCutRunningFade);
test('关掉无缝开关立刻释放预取', testToggleReleasesPrefetch);
test('秒数展示与三档说明文案', testSecondsFormatAndHintTiers);
test('面板事件只绑一次且拖动不刷屏', testControlsBindAndRender);
test('没有 WebAudio 时退回元素音量', testNoWebAudioFallback);
test('等功率曲线不可用时退回线性斜坡', testCurveFallbackStaysSmooth);
test('双 deck 接线与各条切歌路径按设计接好', testSourceWiring);
