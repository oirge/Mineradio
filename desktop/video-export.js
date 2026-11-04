'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const FRAME_RATE = 30;
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_PENDING_BYTES = 32 * 1024 * 1024;
const MAX_PENDING_CHUNKS = 8;
const READY_TIMEOUT_MS = 50_000;
const FRAME_ACK_TIMEOUT_MS = 15_000;
const MAX_INITIAL_BYTES = 32 * 1024 * 1024;

/** The hidden renderer paints only; the main renderer retains the sole audio owner. */
function createVideoExportManager({
  BrowserWindow, ipcMain, dialog, getMainWindow, getMainServerPort,
  trustedMainFrameHandler, translate = value => value,
  preloadPath = path.join(__dirname, 'video-export-preload.js'),
  readyTimeoutMs = READY_TIMEOUT_MS,
  fileSystem = fs,
}) {
  let active = null;
  let disposed = false;
  const cleanups = new Set();

  function send(record, channel, payload) {
    if (!record.owner.isDestroyed()) record.owner.send(channel, payload);
  }

  function requireCurrent(id) {
    if (!active || active.id !== id || active.discarded) throw new Error('VIDEO_EXPORT_SESSION_INVALID');
    return active;
  }

  function ownsHiddenFrame(event, record = active) {
    try {
      return !!record && !record.discarded && record.window && !record.window.isDestroyed()
        && event.sender === record.window.webContents
        && !!event.senderFrame && !event.senderFrame.parent
        && event.senderFrame === record.window.webContents.mainFrame
        && event.senderFrame.url === record.url;
    } catch { return false; }
  }

  function stopSurface(record) {
    clearTimeout(record.readyTimer);
    clearTimeout(record.ackTimer);
    clearTimeout(record.nextFrameTimer);
    record.readyTimer = null;
    record.ackTimer = null;
    record.nextFrameTimer = null;
    if (record.ownerListener) {
      record.owner.removeListener('destroyed', record.ownerListener);
      record.owner.removeListener('render-process-gone', record.ownerListener);
      record.ownerListener = null;
    }
    const win = record.window;
    record.window = null;
    if (win && !win.isDestroyed()) {
      try { win.webContents.stopPainting(); } catch {}
      win.destroy();
    }
  }

  /** Only this job's random sibling temporary file is removed on cancellation. */
  function discard(record) {
    if (record.cleanup) return record.cleanup;
    record.discarded = true;
    if (active === record) active = null;
    if (record.rejectReady) record.rejectReady(new Error('VIDEO_EXPORT_CANCELLED'));
    record.rejectReady = null;
    stopSurface(record);
    record.cleanup = (async () => {
      if (record.opening) await record.opening.catch(() => {});
      await record.writes.catch(() => {});
      if (record.handle) {
        const handle = record.handle;
        record.handle = null;
        await handle.close().catch(() => {});
      }
      if (record.tempPath) await fileSystem.promises.unlink(record.tempPath).catch(() => {});
    })();
    cleanups.add(record.cleanup);
    void record.cleanup.finally(() => cleanups.delete(record.cleanup));
    return record.cleanup;
  }

  function fail(record, error) {
    if (record.discarded || record.committed) return;
    const message = error && error.message ? error.message : String(error || 'VIDEO_EXPORT_FAILED');
    if (record.rejectReady) record.rejectReady(new Error(message));
    record.rejectReady = null;
    try { send(record, 'mineradio-video-export-failure', { id: record.id, error: message }); } catch {}
    void discard(record);
  }

  function readOptions(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('VIDEO_EXPORT_OPTIONS_INVALID');
    const { width, height, extension } = payload;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 240 || height < 240
      || width > 3840 || height > 3840 || width % 2 || height % 2
      || width * height > 8_294_400 || !['mp4', 'webm'].includes(extension)) {
      throw new Error('VIDEO_EXPORT_OPTIONS_INVALID');
    }
    const text = JSON.stringify(payload);
    if (Buffer.byteLength(text) > MAX_INITIAL_BYTES) throw new Error('VIDEO_EXPORT_OPTIONS_TOO_LARGE');
    // Preserve the bridge's typed frequency/waveform arrays.
    const initial = structuredClone(payload);
    const rawName = String(payload.fileName || 'Mineradio').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').slice(0, 180);
    const defaultName = rawName.replace(/\.(?:mp4|webm)$/i, '') + '.' + extension;
    return { width, height, extension, defaultName, initial };
  }

  async function begin(event, payload) {
    if (disposed) throw new Error('VIDEO_EXPORT_CLOSED');
    if (active) throw new Error('VIDEO_EXPORT_BUSY');
    const options = readOptions(payload);
    const record = {
      id: crypto.randomUUID(), owner: event.sender, window: null, discarded: false,
      writes: Promise.resolve(), nextSequence: 0, pendingBytes: 0, pendingChunks: 0,
      bytes: 0, stage: 'choosing', waitingAck: false,
      width: options.width, height: options.height, initial: options.initial,
    };
    active = record;
    record.ownerListener = () => { void discard(record); };
    record.owner.once('destroyed', record.ownerListener);
    record.owner.once('render-process-gone', record.ownerListener);
    try {
      const choice = await dialog.showSaveDialog(getMainWindow(), {
        title: translate('导出歌词／可视化视频'),
        defaultPath: options.defaultName,
        filters: [{ name: options.extension === 'mp4' ? 'MP4' : 'WebM', extensions: [options.extension] }],
      });
      if (record.discarded || disposed) throw new Error('VIDEO_EXPORT_CANCELLED');
      if (choice.canceled || !choice.filePath) {
        await discard(record);
        return { cancelled: true };
      }
      const chosen = path.resolve(choice.filePath);
      record.fileName = chosen.toLowerCase().endsWith('.' + options.extension)
        ? chosen : chosen + '.' + options.extension;
      record.tempPath = path.join(path.dirname(record.fileName), `.mineradio-video-${record.id}.part`);
      record.opening = fileSystem.promises.open(record.tempPath, 'wx').then(handle => {
        record.handle = handle;
        return handle;
      });
      await record.opening;
      if (record.discarded) {
        await discard(record);
        throw new Error('VIDEO_EXPORT_CANCELLED');
      }
      record.stage = 'preparing';
      record.url = `http://127.0.0.1:${getMainServerPort()}/vendor/folia/index.html?videoExport=${record.id}`;
      record.initial = { ...record.initial, id: record.id };
      // A separate surface avoids resizing, hiding, focusing or capturing the user's desktop.
      const win = new BrowserWindow({
        width: record.width, height: record.height, useContentSize: true,
        enableLargerThanScreen: true,
        show: false, frame: false, focusable: false, skipTaskbar: true, type: 'toolbar',
        backgroundColor: '#09090b', autoHideMenuBar: true, title: 'Mineradio Video Export',
        webPreferences: {
          preload: preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true,
          backgroundThrottling: false, offscreen: true,
        },
      });
      record.window = win;
      // Electron's constructor centers through the display work area and can shrink even an
      // offscreen window. Lift the native size limit above, then restore the real render size
      // after construction. No zoom or low-resolution bitmap upscaling is involved.
      win.setContentSize(record.width, record.height, false);
      win.webContents.setFrameRate(FRAME_RATE);
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      const preventNavigation = navigation => navigation.preventDefault();
      win.webContents.on('will-navigate', preventNavigation);
      win.webContents.on('will-frame-navigate', preventNavigation);
      win.webContents.on('will-redirect', preventNavigation);
      win.webContents.on('render-process-gone', () => {
        if (record.window === win) fail(record, new Error('VIDEO_EXPORT_RENDERER_GONE'));
      });
      win.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
        if (record.window === win && isMainFrame !== false && code !== -3) fail(record, new Error('VIDEO_EXPORT_LOAD_FAILED'));
      });
      win.on('closed', () => {
        if (record.window === win) fail(record, new Error('VIDEO_EXPORT_WINDOW_CLOSED'));
      });
      win.webContents.on('paint', async () => {
        if (active !== record || record.discarded || record.stage !== 'recording' || record.waitingAck) return;
        clearTimeout(record.nextFrameTimer);
        record.nextFrameTimer = null;
        record.waitingAck = true;
        record.ackTimer = setTimeout(() => fail(record, new Error('VIDEO_EXPORT_FRAME_TIMEOUT')), FRAME_ACK_TIMEOUT_MS);
        record.ackTimer.unref?.();
        try {
          // The paint event can carry a stale bitmap for compositor-only opacity and
          // transforms. Copy the complete current page surface, including those layers.
          const image = await win.webContents.capturePage();
          if (active !== record || record.discarded || record.stage !== 'recording' || record.window !== win) return;
          const size = image.getSize();
          if (!size.width || !size.height || image.isEmpty()) throw new Error('VIDEO_EXPORT_FRAME_EMPTY');
          const bytes = image.toJPEG(92);
          send(record, 'mineradio-video-export-frame', { id: record.id, bytes, width: size.width, height: size.height });
        } catch (error) {
          if (active === record && record.stage === 'recording') fail(record, error);
        }
      });
      const ready = new Promise((resolve, reject) => {
        record.resolveReady = resolve;
        record.rejectReady = reject;
        record.readyTimer = setTimeout(() => {
          fail(record, new Error('VIDEO_EXPORT_READY_TIMEOUT'));
        }, readyTimeoutMs);
        record.readyTimer.unref?.();
      });
      // Attach rejection handling before loadURL: an early load failure must not be unhandled.
      const loaded = Promise.resolve().then(() => win.loadURL(record.url));
      await Promise.all([loaded, ready]);
      requireCurrent(record.id);
      record.stage = 'recording';
      win.webContents.invalidate();
      return { id: record.id, fileName: record.fileName, width: record.width, height: record.height };
    } catch (error) {
      fail(record, error);
      await discard(record);
      throw error;
    }
  }

  function acknowledge(_event, id) {
    const record = requireCurrent(id);
    record.waitingAck = false;
    clearTimeout(record.ackTimer);
    record.ackTimer = null;
    clearTimeout(record.nextFrameTimer);
    // invalidate() re-emits Electron's cached backing bitmap immediately; it does not
    // obey setFrameRate(). Give the compositor time to deliver a fresh paint first,
    // and request a paced repeat only when an otherwise static scene stays unchanged.
    record.nextFrameTimer = setTimeout(() => {
      record.nextFrameTimer = null;
      if (active === record && !record.discarded && record.stage === 'recording'
        && !record.waitingAck && record.window && !record.window.isDestroyed()) {
        record.window.webContents.invalidate();
      }
    }, Math.ceil(1000 / FRAME_RATE));
    record.nextFrameTimer.unref?.();
  }

  function update(_event, payload) {
    const record = requireCurrent(payload && payload.id);
    if (record.stage !== 'recording') return;
    const budget = payload.lyrics !== undefined || payload.analysis !== undefined ? MAX_INITIAL_BYTES : 2 * 1024 * 1024;
    if (Buffer.byteLength(JSON.stringify(payload)) > budget) throw new Error('VIDEO_EXPORT_UPDATE_TOO_LARGE');
    record.window.webContents.send('mineradio-video-export-update', payload);
  }

  async function append(_event, payload) {
    const record = requireCurrent(payload && payload.id);
    if (record.stage !== 'recording') throw new Error('VIDEO_EXPORT_NOT_RECORDING');
    const bytes = payload.bytes;
    if (!(bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(bytes)) throw new Error('VIDEO_EXPORT_CHUNK_INVALID');
    const length = bytes.byteLength;
    if (!length || length > MAX_CHUNK_BYTES || payload.sequence !== record.nextSequence) {
      throw new Error('VIDEO_EXPORT_CHUNK_INVALID');
    }
    if (record.pendingChunks >= MAX_PENDING_CHUNKS || record.pendingBytes + length > MAX_PENDING_BYTES) {
      fail(record, new Error('VIDEO_EXPORT_WRITE_BACKPRESSURE'));
      throw new Error('VIDEO_EXPORT_WRITE_BACKPRESSURE');
    }
    const buffer = bytes instanceof ArrayBuffer ? Buffer.from(bytes) : Buffer.from(bytes.buffer, bytes.byteOffset, length);
    record.nextSequence++;
    record.pendingChunks++;
    record.pendingBytes += length;
    const write = record.writes.then(async () => {
      if (record.discarded) throw new Error('VIDEO_EXPORT_CANCELLED');
      await record.handle.writeFile(buffer);
      record.bytes += length;
    });
    record.writes = write;
    try {
      await write;
      return { ok: true };
    } catch (error) {
      fail(record, error);
      throw error;
    } finally {
      record.pendingChunks--;
      record.pendingBytes -= length;
    }
  }

  async function finish(_event, payload) {
    const record = requireCurrent(payload && payload.id);
    if (record.stage !== 'recording') throw new Error('VIDEO_EXPORT_NOT_RECORDING');
    record.stage = 'finalizing';
    stopSurface(record);
    try {
      await record.writes;
      requireCurrent(record.id);
      if (!record.bytes) throw new Error('VIDEO_EXPORT_EMPTY');
      await record.handle.sync();
      await record.handle.close();
      record.handle = null;
      requireCurrent(record.id);
      await fileSystem.promises.rename(record.tempPath, record.fileName);
      record.tempPath = null;
      record.committed = true;
      if (active === record) active = null;
      return { fileName: record.fileName };
    } catch (error) {
      fail(record, error);
      await discard(record);
      throw error;
    }
  }

  async function cancel(_event, payload) {
    if (!active || active.id !== (payload && payload.id)) return { cancelled: true };
    await discard(active);
    return { cancelled: true };
  }

  function registerIpc() {
    for (const [channel, handler] of [
      ['begin', begin], ['append', append], ['finish', finish], ['cancel', cancel],
    ]) ipcMain.handle('mineradio-video-export-' + channel, trustedMainFrameHandler(handler));
    for (const [channel, handler] of [['ack', acknowledge], ['update', update]]) {
      const guarded = trustedMainFrameHandler(handler);
      ipcMain.on('mineradio-video-export-' + channel, (event, payload) => {
        try { guarded(event, payload); } catch (error) {
          const id = channel === 'ack' ? payload : payload && payload.id;
          if (active && active.id === id) fail(active, error);
        }
      });
    }
    ipcMain.handle('mineradio-video-export-initial', event => {
      if (!ownsHiddenFrame(event)) throw new Error('IPC_FORBIDDEN');
      return active.initial;
    });
    ipcMain.handle('mineradio-video-export-ready', event => {
      if (!ownsHiddenFrame(event)) throw new Error('IPC_FORBIDDEN');
      const record = active;
      clearTimeout(record.readyTimer);
      record.readyTimer = null;
      record.rejectReady = null;
      record.resolveReady?.();
      record.resolveReady = null;
      return { ok: true };
    });
    ipcMain.on('mineradio-video-export-renderer-failed', (event, message) => {
      if (ownsHiddenFrame(event)) fail(active, new Error(String(message || 'VIDEO_EXPORT_RENDER_FAILED').slice(0, 1000)));
    });
  }

  async function dispose() {
    disposed = true;
    if (active) await discard(active);
    await Promise.all([...cleanups]);
  }

  return { registerIpc, dispose, hasPendingWork: () => !!active || cleanups.size > 0 };
}

module.exports = { createVideoExportManager, FRAME_RATE, MAX_CHUNK_BYTES, MAX_PENDING_BYTES, MAX_PENDING_CHUNKS };
