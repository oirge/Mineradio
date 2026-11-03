'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createVideoExportManager, MAX_CHUNK_BYTES, MAX_PENDING_CHUNKS } = require('../desktop/video-export');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function harness(t, options = {}) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mineradio-video-test-'));
  const owner = Object.assign(new EventEmitter(), {
    destroyed: false, sent: [],
    isDestroyed() { return this.destroyed; },
    send(channel, value) { this.sent.push({ channel, value }); },
  });
  const h = {
    directory, owner, windows: [], handlers: new Map(), listeners: new Map(), time: 100,
    output: path.join(directory, '测试视频.webm'), autoReady: options.autoReady !== false,
  };
  h.event = { sender: owner, senderFrame: { url: 'http://127.0.0.1:3210/', parent: null } };
  class Window extends EventEmitter {
    constructor(configuration) {
      super();
      this.configuration = configuration;
      this.destroyed = false;
      // Model the constructor's native Center() work-area clamp on a small Windows display.
      this.contentSize = { width: Math.min(1024, configuration.width), height: Math.min(720, configuration.height) };
      this.webContents = Object.assign(new EventEmitter(), {
        isDestroyed: () => this.destroyed,
        setFrameRate: value => { this.frameRate = value; },
        setWindowOpenHandler: callback => { this.openHandler = callback; },
        invalidate: () => { this.invalidations = (this.invalidations || 0) + 1; },
        stopPainting: () => { this.stopped = true; },
        send: (channel, value) => { this.lastMessage = { channel, value }; },
      });
      h.windows.push(this);
    }
    isDestroyed() { return this.destroyed; }
    setContentSize(width, height) {
      this.contentSize = this.configuration.enableLargerThanScreen
        ? { width, height } : { width: Math.min(1024, width), height: Math.min(720, height) };
    }
    destroy() { this.destroyed = true; this.emit('closed'); }
    async loadURL(url) {
      this.url = url;
      this.webContents.mainFrame = { url, parent: null };
      if (h.autoReady) await h.handlers.get('mineradio-video-export-ready')(h.hiddenEvent(this));
    }
  }
  h.hiddenEvent = (win = h.windows.at(-1)) => ({ sender: win.webContents, senderFrame: win.webContents.mainFrame });
  h.manager = createVideoExportManager({
    BrowserWindow: Window,
    ipcMain: { handle: (key, fn) => h.handlers.set(key, fn), on: (key, fn) => h.listeners.set(key, fn) },
    dialog: { showSaveDialog: async () => options.choice ? options.choice() : { canceled: false, filePath: h.output } },
    getMainWindow: () => ({ webContents: owner }), getMainServerPort: () => 3210,
    trustedMainFrameHandler: handler => (event, ...args) => {
      if (event !== h.event) return { ok: false, error: 'IPC_FORBIDDEN' };
      return handler(event, ...args);
    },
    readyTimeoutMs: options.readyTimeoutMs || 20_000,
    fileSystem: options.fileSystem || fs,
    now: () => h.time,
  });
  h.manager.registerIpc();
  h.invoke = (channel, payload, event = h.event) => h.handlers.get('mineradio-video-export-' + channel)(event, payload);
  h.send = (channel, payload, event = h.event) => h.listeners.get('mineradio-video-export-' + channel)(event, payload);
  h.begin = patch => h.invoke('begin', {
    width: 1280, height: 720, extension: 'webm', fileName: '测试视频.webm',
    visuals: { lyricStyle: 'flow' }, state: { position: 0, duration: 20 },
    lyrics: [{ startTime: 0, words: '歌词' }], analysis: { frequency: new Float32Array([0.2, 0.5]) }, ...patch,
  });
  h.chunk = (id, sequence, value) => h.invoke('append', { id, sequence, bytes: Uint8Array.from(value) });
  h.frames = () => owner.sent.filter(item => item.channel.endsWith('-frame'));
  h.failures = () => owner.sent.filter(item => item.channel.endsWith('-failure'));
  h.paint = () => {
    const image = { getSize: () => ({ width: 1280, height: 720 }), isEmpty: () => false, toJPEG: () => Buffer.from([255, 216, 255]) };
    h.windows.at(-1).webContents.emit('paint', {}, {}, image);
  };
  t.after(async () => {
    await h.manager.dispose();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });
  return h;
}

test('导出分块顺序落盘，提交前保留旧目标，最后块写完才保存', async t => {
  const gate = deferred();
  let block = false;
  const fileSystem = { promises: { ...fs.promises, open: async (...args) => {
    const handle = await fs.promises.open(...args);
    const write = handle.writeFile.bind(handle);
    handle.writeFile = async bytes => { if (block) await gate.promise; return write(bytes); };
    return handle;
  } } };
  const h = await harness(t, { fileSystem });
  await fs.promises.writeFile(h.output, 'previous-video');
  const session = await h.begin();
  await h.chunk(session.id, 0, [1, 2]);
  block = true;
  const last = h.chunk(session.id, 1, [3, 4]);
  const finishing = h.invoke('finish', { id: session.id });
  assert.equal(await fs.promises.readFile(h.output, 'utf8'), 'previous-video');
  gate.resolve();
  await last;
  assert.deepEqual(await finishing, { fileName: h.output });
  assert.deepEqual([...await fs.promises.readFile(h.output)], [1, 2, 3, 4]);
  assert.equal(h.windows[0].destroyed, true);
  assert.equal(h.failures().length, 0);
  assert.deepEqual(await fs.promises.readdir(h.directory), [path.basename(h.output)]);
});

test('取消清理临时内容并保留原文件，可开始下一次导出', async t => {
  const h = await harness(t);
  await fs.promises.writeFile(h.output, 'old');
  const first = await h.begin();
  await h.chunk(first.id, 0, [1, 2, 3]);
  await h.invoke('cancel', { id: first.id });
  assert.equal(await fs.promises.readFile(h.output, 'utf8'), 'old');
  assert.deepEqual(await fs.promises.readdir(h.directory), [path.basename(h.output)]);
  const next = await h.begin();
  assert.notEqual(next.id, first.id);
  h.send('ack', first.id);
  h.send('update', { id: first.id, state: {} });
  await h.chunk(next.id, 0, [9]);
  await h.invoke('finish', { id: next.id });
  assert.deepEqual([...await fs.promises.readFile(h.output)], [9]);
});

test('画面只有一个待确认帧，确认后继续30fps绘制且不会显示窗口', async t => {
  const h = await harness(t);
  const session = await h.begin();
  const win = h.windows[0];
  assert.equal(win.configuration.show, false);
  assert.equal(win.configuration.focusable, false);
  assert.equal(win.configuration.skipTaskbar, true);
  assert.equal(win.configuration.type, 'toolbar');
  assert.equal(win.configuration.webPreferences.offscreen, true);
  assert.equal(win.configuration.webPreferences.sandbox, true);
  assert.equal(win.frameRate, 30);
  h.paint();
  h.time += 100;
  h.paint();
  assert.equal(h.frames().length, 1);
  h.send('ack', session.id);
  h.paint();
  assert.equal(h.frames().length, 2);
  assert.deepEqual([...h.frames()[0].value.bytes], [255, 216, 255]);
});

test('小屏幕不会钳制离屏画面的横向或纵向真实分辨率', async t => {
  const h = await harness(t);
  for (const [width, height] of [[1280, 720], [1920, 1080], [1080, 1920]]) {
    const session = await h.begin({ width, height });
    assert.deepEqual(h.windows.at(-1).contentSize, { width, height });
    await h.invoke('cancel', { id: session.id });
  }
});

test('初始和更新桥保留typed频谱数组，隐藏页不能获得主界面文件权限', async t => {
  const h = await harness(t);
  const session = await h.begin();
  const initial = h.handlers.get('mineradio-video-export-initial')(h.hiddenEvent());
  assert.ok(initial.analysis.frequency instanceof Float32Array);
  assert.equal(initial.id, session.id);
  h.send('update', { id: session.id, analysis: { frequency: new Float64Array([0.1, 0.9]) } });
  assert.ok(h.windows[0].lastMessage.value.analysis.frequency instanceof Float64Array);
  const forbidden = h.invoke('append', { id: session.id, sequence: 0, bytes: new Uint8Array([1]) }, h.hiddenEvent());
  assert.deepEqual(forbidden, { ok: false, error: 'IPC_FORBIDDEN' });
  const otherFrame = { ...h.hiddenEvent(), senderFrame: { url: h.windows[0].url, parent: null } };
  assert.throws(() => h.handlers.get('mineradio-video-export-initial')(otherFrame), /IPC_FORBIDDEN/);
  h.windows[0].webContents.mainFrame.url += '&evil=1';
  assert.throws(() => h.handlers.get('mineradio-video-export-initial')(h.hiddenEvent()), /IPC_FORBIDDEN/);
});

test('拒绝子frame、错误token和外部导航，全部host写操作需可信主frame', async t => {
  const h = await harness(t);
  const session = await h.begin();
  for (const channel of ['append', 'finish', 'cancel', 'begin']) {
    assert.deepEqual(await h.invoke(channel, { id: session.id }, {}), { ok: false, error: 'IPC_FORBIDDEN' });
  }
  const win = h.windows[0];
  const child = { ...h.hiddenEvent(), senderFrame: { url: win.url, parent: win.webContents.mainFrame } };
  assert.throws(() => h.handlers.get('mineradio-video-export-ready')(child), /IPC_FORBIDDEN/);
  for (const name of ['will-navigate', 'will-frame-navigate', 'will-redirect']) {
    let prevented = false;
    win.webContents.emit(name, { preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
  }
  assert.deepEqual(win.openHandler({ url: 'https://example.com' }), { action: 'deny' });
  h.send('ack', session.id, {});
  h.send('update', { id: session.id, state: {} }, {});
  assert.equal(h.failures().length, 0);
});

test('切歌可携带长逐字歌词，频谱更新仍保持较小预算', async t => {
  const h = await harness(t);
  const session = await h.begin();
  const lyrics = { trackId: 'second-track', lines: [{ words: '词'.repeat(800_000) }] };
  h.send('update', { id: session.id, state: { currentTrack: { id: 'second-track' } }, lyrics });
  assert.equal(h.windows[0].lastMessage.value.lyrics.trackId, 'second-track');
  assert.equal(h.failures().length, 0);
  h.send('update', { id: session.id, state: { excessive: 'x'.repeat(2 * 1024 * 1024) } });
  assert.equal(h.failures()[0].value.error, 'VIDEO_EXPORT_UPDATE_TOO_LARGE');
});

test('拒绝错序和超大块，不允许空文件覆盖已存在的目标', async t => {
  const h = await harness(t);
  await fs.promises.writeFile(h.output, 'old');
  const session = await h.begin();
  await assert.rejects(h.chunk(session.id, 1, [1]), /CHUNK_INVALID/);
  await assert.rejects(h.invoke('append', { id: session.id, sequence: 0, bytes: new Uint8Array(MAX_CHUNK_BYTES + 1) }), /CHUNK_INVALID/);
  await assert.rejects(h.invoke('finish', { id: session.id }), /VIDEO_EXPORT_EMPTY/);
  assert.equal(await fs.promises.readFile(h.output, 'utf8'), 'old');
  assert.deepEqual(await fs.promises.readdir(h.directory), [path.basename(h.output)]);
});

test('写入积压达到上限时失败并清理，不让IPC缓存无限增长', async t => {
  const gate = deferred();
  const fileSystem = { promises: { ...fs.promises, open: async (...args) => {
    const handle = await fs.promises.open(...args);
    const write = handle.writeFile.bind(handle);
    handle.writeFile = async bytes => { await gate.promise; return write(bytes); };
    return handle;
  } } };
  const h = await harness(t, { fileSystem });
  const session = await h.begin();
  const pending = Array.from({ length: MAX_PENDING_CHUNKS + 1 }, (_, sequence) => h.chunk(session.id, sequence, [sequence]));
  const settled = Promise.allSettled(pending);
  gate.resolve();
  const results = await settled;
  assert.ok(results.some(result => result.status === 'rejected' && /WRITE_BACKPRESSURE/.test(result.reason.message)));
  await h.manager.dispose();
  assert.equal(h.failures().length, 1);
  assert.deepEqual(await fs.promises.readdir(h.directory), []);
});

test('磁盘写入失败关闭renderer并保留旧目标', async t => {
  const fileSystem = { promises: { ...fs.promises, open: async (...args) => {
    const handle = await fs.promises.open(...args);
    handle.writeFile = async () => { throw new Error('ENOSPC'); };
    return handle;
  } } };
  const h = await harness(t, { fileSystem });
  await fs.promises.writeFile(h.output, 'old');
  const session = await h.begin();
  await assert.rejects(h.chunk(session.id, 0, [1]), /ENOSPC/);
  await h.manager.dispose();
  assert.equal(h.windows[0].destroyed, true);
  assert.equal(await fs.promises.readFile(h.output, 'utf8'), 'old');
  assert.deepEqual(await fs.promises.readdir(h.directory), [path.basename(h.output)]);
});

test('隐藏renderer崩溃和主renderer销毁均清理会话', async t => {
  for (const crashed of ['hidden', 'owner']) {
    await t.test(crashed, async t => {
      const h = await harness(t);
      const session = await h.begin();
      await h.chunk(session.id, 0, [1]);
      if (crashed === 'hidden') h.windows[0].webContents.emit('render-process-gone', {}, { reason: 'crashed' });
      else h.owner.emit('destroyed');
      await h.manager.dispose();
      assert.equal(h.windows[0].destroyed, true);
      assert.deepEqual(await fs.promises.readdir(h.directory), []);
    });
  }
});

test('隐藏renderer未ready时超时清理，不遗留空窗口或文件', async t => {
  const h = await harness(t, { autoReady: false, readyTimeoutMs: 15 });
  // Production timers are unref'ed; keep this bounded test alive until the rejection arrives.
  const keepAlive = setTimeout(() => {}, 1000);
  try { await assert.rejects(h.begin(), /VIDEO_EXPORT_READY_TIMEOUT/); }
  finally { clearTimeout(keepAlive); }
  assert.equal(h.failures()[0].value.error, 'VIDEO_EXPORT_READY_TIMEOUT');
  assert.equal(h.windows[0].destroyed, true);
  assert.deepEqual(await fs.promises.readdir(h.directory), []);
});

test('保存对话框取消不启动renderer，选择期间重复开始也会拒绝', async t => {
  const choice = deferred();
  const h = await harness(t, { choice: () => choice.promise });
  const first = h.begin();
  await assert.rejects(h.begin(), /VIDEO_EXPORT_BUSY/);
  choice.resolve({ canceled: true });
  assert.deepEqual(await first, { cancelled: true });
  assert.equal(h.windows.length, 0);
  assert.deepEqual(await fs.promises.readdir(h.directory), []);
});

test('退出发生在异步打开临时文件期间也等待关闭和清理', async t => {
  const opened = deferred(), gate = deferred();
  const fileSystem = { promises: { ...fs.promises, open: async (...args) => {
    const handle = await fs.promises.open(...args);
    opened.resolve();
    await gate.promise;
    return handle;
  } } };
  const h = await harness(t, { fileSystem });
  const beginning = h.begin();
  const rejected = assert.rejects(beginning, /VIDEO_EXPORT_CANCELLED/);
  await opened.promise;
  const disposing = h.manager.dispose();
  assert.equal(h.manager.hasPendingWork(), true);
  gate.resolve();
  await Promise.all([rejected, disposing]);
  assert.deepEqual(await fs.promises.readdir(h.directory), []);
  assert.equal(h.windows.length, 0);
});

test('尺寸和格式非法时先拒绝，不打开保存对话框', async t => {
  let dialogs = 0;
  const h = await harness(t, { choice: () => { dialogs++; return { canceled: true }; } });
  for (const values of [{ width: 0 }, { width: 1921 }, { height: 4000 }, { extension: 'exe' }]) {
    await assert.rejects(h.begin(values), /VIDEO_EXPORT_OPTIONS_INVALID/);
  }
  assert.equal(dialogs, 0);
});
