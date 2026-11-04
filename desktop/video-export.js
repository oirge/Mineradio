'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { reserveWebmDuration } = require('./video-export-webm');

const MAX_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_PENDING_BYTES = 32 * 1024 * 1024;
const MAX_PENDING_CHUNKS = 8;
const READY_TIMEOUT_MS = 50_000;
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
  let lastCommitted = null;
  let disposed = false;
  const cleanups = new Set();

  function send(record, channel, payload) {
    if (!record.owner.isDestroyed()) record.owner.send(channel, payload);
  }

  function requireCurrent(id) {
    if (!active || active.id !== id || active.discarded) throw new Error('VIDEO_EXPORT_SESSION_INVALID');
    return active;
  }

  function allowsCapturePermission(webContents, permission, origin, details = {}) {
    const record = active;
    try {
      if (!record || record.discarded || record.stage !== 'recording'
        || !(record.capturePermissionUntil > Date.now()) || !record.window || record.window.isDestroyed()
        || !webContents || webContents.isDestroyed() || details.isMainFrame !== true
        || record.owner.isDestroyed() || getMainWindow()?.webContents !== record.owner
        || record.owner.mainFrame !== record.ownerFrame || record.ownerFrame.parent
        || record.ownerFrame.url !== record.ownerUrl) return false;
      // Chromium may attribute tab-capture permission to the captured surface
      // rather than the consuming owner. Both identities must match this job.
      const isOwner = webContents === record.owner;
      if (!isOwner && webContents !== record.window.webContents) return false;
      const frame = isOwner ? record.ownerFrame : record.captureFrame;
      const requestingUrl = isOwner ? record.ownerUrl : record.url;
      if (!frame || webContents.mainFrame !== frame || frame.parent || frame.url !== requestingUrl) return false;
      // Electron 43 reports tab capture as media with an empty mediaTypes list.
      // Camera and microphone requests carry video/audio and must stay denied.
      if (permission === 'media') {
        if (!Array.isArray(details.mediaTypes) || details.mediaTypes.length !== 0) return false;
      } else if (permission === 'display-capture') {
        if (details.mediaTypes !== undefined && (!Array.isArray(details.mediaTypes)
          || details.mediaTypes.some(type => type !== 'video'))) return false;
      } else return false;
      const ownerUrl = new URL(record.ownerUrl);
      if (ownerUrl.protocol !== 'http:' || ownerUrl.hostname !== '127.0.0.1'
        || Number(ownerUrl.port) !== Number(getMainServerPort())
        || !['/', '/index.html'].includes(ownerUrl.pathname)
        || new URL(origin).origin !== ownerUrl.origin
        || (details.requestingUrl && details.requestingUrl !== requestingUrl)) return false;
      return true;
    } catch { return false; }
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
    record.readyTimer = null;
    if (record.ownerListener) {
      record.owner.removeListener('destroyed', record.ownerListener);
      record.owner.removeListener('render-process-gone', record.ownerListener);
      record.ownerListener = null;
    }
    const win = record.window;
    record.window = null;
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
  }

  /** Only this job's random sibling temporary file is removed on cancellation. */
  function discard(record) {
    if (record.stage === 'committing') return record.commit.then(() => {}, () => discard(record));
    if (record.cleanup) return record.cleanup;
    record.discarded = true;
    if (active === record) active = null;
    if (record.rejectReady) record.rejectReady(new Error('VIDEO_EXPORT_CANCELLED'));
    record.rejectReady = null;
    record.rejectFinalized?.(new Error('VIDEO_EXPORT_CANCELLED'));
    record.rejectFinalized = null;
    stopSurface(record);
    record.cleanup = (async () => {
      if (record.opening) await record.opening.catch(() => {});
      await record.writes.catch(() => {});
      if (record.handle) {
        const handle = record.handle;
        record.handle = null;
        await handle.close().catch(() => {});
      }
      if (record.inputHandle) {
        await record.inputHandle.close().catch(() => {});
        record.inputHandle = null;
      }
      if (record.tempPath && record.tempOwned) await fileSystem.promises.unlink(record.tempPath).catch(() => {});
      if (record.sourcePath && record.sourceOwned) await fileSystem.promises.unlink(record.sourcePath).catch(() => {});
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
    const frameRate = payload.frameRate === undefined ? 30 : payload.frameRate;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 240 || height < 240
      || width > 3840 || height > 3840 || width % 2 || height % 2
      || width * height > 8_294_400 || !['mp4', 'webm'].includes(extension) || ![30, 60, 90, 120].includes(frameRate)) {
      throw new Error('VIDEO_EXPORT_OPTIONS_INVALID');
    }
    const text = JSON.stringify(payload);
    if (Buffer.byteLength(text) > MAX_INITIAL_BYTES) throw new Error('VIDEO_EXPORT_OPTIONS_TOO_LARGE');
    // Preserve the bridge's typed frequency/waveform arrays.
    const initial = structuredClone(payload);
    initial.frameRate = frameRate;
    const rawName = String(payload.fileName || 'Mineradio').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').slice(0, 180);
    const defaultName = rawName.replace(/\.(?:mp4|webm)$/i, '') + '.' + extension;
    return { width, height, extension, defaultName, initial };
  }

  async function begin(event, payload) {
    if (disposed) throw new Error('VIDEO_EXPORT_CLOSED');
    if (active) throw new Error('VIDEO_EXPORT_BUSY');
    const options = readOptions(payload);
    const record = {
      id: crypto.randomUUID(), owner: event.sender, ownerFrame: event.senderFrame,
      ownerUrl: event.senderFrame.url, window: null, discarded: false,
      writes: Promise.resolve(), nextSequence: 0, pendingBytes: 0, pendingChunks: 0,
      bytes: 0, stage: 'choosing',
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
        record.tempOwned = true;
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
          backgroundThrottling: false,
        },
      });
      record.window = win;
      // Electron's constructor centers through the display work area and can shrink even an
      // hidden window. Lift the native size limit above, then restore the real render size
      // after construction. No zoom or low-resolution bitmap upscaling is involved.
      win.setContentSize(record.width, record.height, false);
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
      // Chromium captures this display-only WebContents directly. The opaque token
      // is bound to the trusted owner frame and expires after ten seconds.
      const sourceId = win.webContents.getMediaSourceId(record.owner);
      if (!sourceId) throw new Error('VIDEO_EXPORT_SOURCE_UNAVAILABLE');
      record.captureFrame = win.webContents.mainFrame;
      record.capturePermissionUntil = Date.now() + 10_000;
      return { id: record.id, fileName: record.fileName, width: record.width, height: record.height, sourceId };
    } catch (error) {
      fail(record, error);
      await discard(record);
      throw error;
    }
  }

  function update(_event, payload) {
    const record = requireCurrent(payload && payload.id);
    if (record.stage !== 'recording') return;
    const budget = payload.lyrics !== undefined || payload.analysis !== undefined ? MAX_INITIAL_BYTES : 2 * 1024 * 1024;
    if (Buffer.byteLength(JSON.stringify(payload)) > budget) throw new Error('VIDEO_EXPORT_UPDATE_TOO_LARGE');
    record.window.webContents.send('mineradio-video-export-update', payload);
  }

  async function writeEncodedChunk(record, buffer, final = false) {
    if (!record.bytes && record.headerPrefix) buffer = Buffer.concat([record.headerPrefix, buffer]);
    const chunk = record.bytes ? { bytes: buffer } : reserveWebmDuration(buffer);
    if (chunk.needsMore) {
      if (final) throw new Error('VIDEO_EXPORT_HEADER_INCOMPLETE');
      record.headerPrefix = buffer;
      return;
    }
    record.headerPrefix = null;
    if (chunk.durationOffset !== undefined) record.webmDuration = { durationOffset: chunk.durationOffset, scale: chunk.scale };
    await record.handle.writeFile(chunk.bytes);
    record.bytes += chunk.bytes.length;
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
    // Encoded output proves the stream is established; no more permission grant is needed.
    record.capturePermissionUntil = 0;
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
      await writeEncodedChunk(record, buffer);
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
    try {
      await record.writes;
      requireCurrent(record.id);
      if (record.headerPrefix) await writeEncodedChunk(record, Buffer.alloc(0), true);
      if (!record.bytes) throw new Error('VIDEO_EXPORT_EMPTY');
      if (record.webmDuration) {
        const ticks = payload.duration * 1e9 / record.webmDuration.scale;
        if (!Number.isFinite(payload.duration) || payload.duration <= 0 || !Number.isFinite(ticks)) throw new Error('VIDEO_EXPORT_DURATION_INVALID');
        const duration = Buffer.alloc(8);
        duration.writeDoubleBE(ticks);
        await record.handle.write(duration, 0, duration.length, record.webmDuration.durationOffset);
      }
      await record.handle.sync();
      await record.handle.close();
      record.handle = null;
      requireCurrent(record.id);
      if (record.initial.extension === 'webm') await finalizeFrameRate(record);
      requireCurrent(record.id);
      stopSurface(record);
      // rename is the atomic commit boundary: cancellation cannot roll it back.
      record.stage = 'committing';
      record.commit = (async () => {
        try { await fileSystem.promises.rename(record.tempPath, record.fileName); }
        catch (error) { record.stage = 'commit-failed'; throw error; }
        record.tempPath = null;
        record.tempOwned = false;
        record.committed = true;
        lastCommitted = { id: record.id, fileName: record.fileName };
        if (active === record) active = null;
        if (record.sourcePath) {
          record.cleanup = fileSystem.promises.unlink(record.sourcePath).catch(() => {}).then(() => {
            record.sourcePath = null; record.sourceOwned = false;
          });
          cleanups.add(record.cleanup);
          void record.cleanup.finally(() => cleanups.delete(record.cleanup));
          await record.cleanup;
        }
        return { fileName: record.fileName };
      })();
      return await record.commit;
    } catch (error) {
      fail(record, error);
      await discard(record);
      throw error;
    }
  }

  async function finalizeFrameRate(record) {
    record.sourcePath = record.tempPath;
    record.sourceOwned = record.tempOwned;
    record.sourceBytes = record.bytes;
    record.tempPath = path.join(path.dirname(record.fileName), `.mineradio-video-${record.id}.cfr.part`);
    record.tempOwned = false;
    record.finalizedBytes = 0;
    record.finalizedSequence = 0;
    record.opening = (async () => {
      record.inputHandle = await fileSystem.promises.open(record.sourcePath, 'r');
      record.handle = await fileSystem.promises.open(record.tempPath, 'wx');
      record.tempOwned = true;
    })();
    await record.opening;
    requireCurrent(record.id);
    record.stage = 'encoding';
    const finalized = new Promise((resolve, reject) => {
      record.resolveFinalized = resolve; record.rejectFinalized = reject;
    });
    finalized.catch(() => {});
    record.window.webContents.send('mineradio-video-export-finalize', {
      id: record.id, size: record.sourceBytes, frameRate: record.initial.frameRate,
      width: record.width, height: record.height,
    });
    await finalized;
    await record.writes;
    requireCurrent(record.id);
    if (!record.finalizedBytes) throw new Error('VIDEO_EXPORT_EMPTY');
    await record.handle.sync();
    await record.handle.close(); record.handle = null;
    await record.inputHandle.close(); record.inputHandle = null;
  }

  function requireEncoding(event, payload) {
    if (!ownsHiddenFrame(event)) throw new Error('IPC_FORBIDDEN');
    const record = requireCurrent(payload?.id);
    if (record.stage !== 'encoding') throw new Error('VIDEO_EXPORT_NOT_ENCODING');
    return record;
  }

  async function readRecording(event, payload) {
    const record = requireEncoding(event, payload);
    const { position, length } = payload;
    if (!Number.isSafeInteger(position) || position < 0 || !Number.isSafeInteger(length)
      || length < 1 || length > MAX_CHUNK_BYTES || position + length > record.sourceBytes) throw new Error('VIDEO_EXPORT_READ_INVALID');
    const bytes = Buffer.alloc(length);
    const result = await record.inputHandle.read(bytes, 0, length, position);
    if (result.bytesRead !== length) throw new Error('VIDEO_EXPORT_READ_INCOMPLETE');
    return bytes;
  }

  async function writeFinalized(event, payload) {
    const record = requireEncoding(event, payload);
    const { bytes, position, sequence } = payload;
    if (!(bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(bytes)) throw new Error('VIDEO_EXPORT_CHUNK_INVALID');
    const length = bytes.byteLength;
    if (!length || length > MAX_CHUNK_BYTES || sequence !== record.finalizedSequence
      || !Number.isSafeInteger(position) || position < 0 || position > record.finalizedBytes) throw new Error('VIDEO_EXPORT_CHUNK_INVALID');
    if (record.pendingChunks >= MAX_PENDING_CHUNKS || record.pendingBytes + length > MAX_PENDING_BYTES) throw new Error('VIDEO_EXPORT_WRITE_BACKPRESSURE');
    record.finalizedSequence++; record.pendingChunks++; record.pendingBytes += length;
    const buffer = bytes instanceof ArrayBuffer ? Buffer.from(bytes) : Buffer.from(bytes.buffer, bytes.byteOffset, length);
    const write = record.writes.then(async () => {
      requireCurrent(record.id);
      for (let offset = 0; offset < length;) {
        const { bytesWritten } = await record.handle.write(buffer, offset, length - offset, position + offset);
        if (!bytesWritten) throw new Error('VIDEO_EXPORT_WRITE_INCOMPLETE');
        offset += bytesWritten;
      }
      record.finalizedBytes = Math.max(record.finalizedBytes, position + length);
    });
    record.writes = write;
    try { await write; } finally { record.pendingChunks--; record.pendingBytes -= length; }
  }

  async function cancel(_event, payload) {
    if (lastCommitted?.id === payload?.id) return { cancelled: false, fileName: lastCommitted.fileName };
    if (!active || active.id !== (payload && payload.id)) return { cancelled: true };
    if (active.stage === 'committing') return { cancelled: false, committing: true };
    await discard(active);
    return { cancelled: true };
  }

  function registerIpc() {
    for (const [channel, handler] of [
      ['begin', begin], ['append', append], ['finish', finish], ['cancel', cancel],
    ]) ipcMain.handle('mineradio-video-export-' + channel, trustedMainFrameHandler(handler));
    for (const [channel, handler] of [['update', update]]) {
      const guarded = trustedMainFrameHandler(handler);
      ipcMain.on('mineradio-video-export-' + channel, (event, payload) => {
        try { guarded(event, payload); } catch (error) {
          const id = payload && payload.id;
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
    ipcMain.handle('mineradio-video-export-read-recording', readRecording);
    ipcMain.handle('mineradio-video-export-write-finalized', writeFinalized);
    ipcMain.handle('mineradio-video-export-finalized', (event, payload) => {
      const record = requireEncoding(event, payload);
      // All accepted writes drain below; no new read or write may race handle closure.
      record.stage = 'sealing';
      record.resolveFinalized?.(); record.resolveFinalized = null; record.rejectFinalized = null;
      return { ok: true };
    });
    ipcMain.on('mineradio-video-export-encoding-progress', (event, payload) => {
      if (!ownsHiddenFrame(event) || active.stage !== 'encoding' || payload?.id !== active.id
        || !Number.isFinite(payload.progress) || payload.progress < 0 || payload.progress > 1) return;
      send(active, 'mineradio-video-export-encoding-progress', payload);
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

  return { registerIpc, dispose, allowsCapturePermission, hasPendingWork: () => !!active || cleanups.size > 0 };
}

module.exports = { createVideoExportManager, MAX_CHUNK_BYTES, MAX_PENDING_BYTES, MAX_PENDING_CHUNKS };
