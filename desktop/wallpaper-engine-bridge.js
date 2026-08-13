'use strict';

const path = require('path');
const { ipcMain, dialog, shell, screen, session } = require('electron');
const { WallpaperEngineLibrary, registerWallpaperEngineScheme } = require('./wallpaper-engine-library');
const { WallpaperEngineRuntime } = require('./wallpaper-engine-runtime');

const GRANT_MS = 12000;
const PREPARE_TIMEOUT_MS = 9000;
const MAX_FPS = 240;
const RESUME_TIMEOUT_MS = 30000;
const ALLOWED_PERMS = new Set(['speaker-selection', 'pointerLock', 'pointer-lock']);

function createWallpaperEngineBridge(options = {}) {
  const getMainWindow = typeof options.getMainWindow === 'function' ? options.getMainWindow : () => null;
  const getMainServerPort = typeof options.getMainServerPort === 'function' ? options.getMainServerPort : () => 0;
  const isAppQuitting = typeof options.isAppQuitting === 'function' ? options.isAppQuitting : () => false;
  const isWindowFullscreen = typeof options.isWindowFullscreen === 'function' ? options.isWindowFullscreen : () => false;
  const isHtmlFullscreen = typeof options.isHtmlFullscreen === 'function' ? options.isHtmlFullscreen : () => false;
  const userDataPath = String(options.userDataPath || '');
  const nativeTempPath = String(options.nativeTempPath || path.join(userDataPath || process.cwd(), 'native'));
  const desktopCapturer = options.desktopCapturer || null;

  const library = new WallpaperEngineLibrary({ userDataPath });
  const runtime = new WallpaperEngineRuntime({ library, desktopCapturer, nativeTempPath });

  let captureSourceId = '';
  let captureGrant = null;
  let captureOperation = 0;
  let capturePreparationOperation = 0;
  let glassCaptureOperation = 0;
  let hostBoundsRestartTimer = null;
  let hostBoundsRestartPending = false;
  let hostBoundsStopPromise = null;
  let hostBoundsOperation = 0;
  let hostBoundsFollowupReason = '';
  let hostVisibilitySuspended = false;
  let hostVisibilityResumePending = false;
  let hostVisibilityResumeTimer = null;
  let hostVisibilityOperation = 0;
  let hostVisibilityStopPromise = null;
  let windowHooksInstalled = false;
  let ipcInstalled = false;

  function mainWindow() {
    const win = getMainWindow();
    return win && !win.isDestroyed() ? win : null;
  }

  function isLocalAppUrl(value) {
    try {
      const u = new URL(String(value || ''));
      return u.protocol === 'http:' && u.hostname === '127.0.0.1' && Number(u.port || 0) === Number(getMainServerPort() || 0);
    } catch (_) {
      return false;
    }
  }

  function isTrustedMainDocumentUrl(value) {
    try {
      const u = new URL(String(value || ''));
      if (!isLocalAppUrl(u.href)) return false;
      const pathname = path.posix.normalize(u.pathname || '/');
      return pathname === '/' || pathname === '/index.html';
    } catch (_) {
      return false;
    }
  }

  function isTrustedIpc(event) {
    try {
      const win = mainWindow();
      if (!event || !event.sender || !win) return false;
      if (event.sender !== win.webContents || event.sender.isDestroyed()) return false;
      if (event.senderFrame && event.senderFrame.parent) return false;
      const sourceUrl = (event.senderFrame && event.senderFrame.url) || event.sender.getURL();
      return isTrustedMainDocumentUrl(sourceUrl);
    } catch (_) {
      return false;
    }
  }

  function targetFps(display, requestedFps) {
    const displayFrequency = Math.max(24, Math.min(MAX_FPS, Math.round(Number(display && display.displayFrequency) || 60)));
    const requested = Number(requestedFps);
    if (!Number.isFinite(requested) || requested <= 0) return displayFrequency;
    return Math.max(24, Math.min(displayFrequency, MAX_FPS, Math.round(requested)));
  }

  function hostCornerRadius(win) {
    if (!win || win.isDestroyed() || win.isMaximized() || win.isFullScreen() || isWindowFullscreen() || isHtmlFullscreen()) return 0;
    const bounds = win.getContentBounds();
    const display = screen.getDisplayMatching(bounds);
    const scaleFactor = Math.max(1, Number(display && display.scaleFactor) || 1);
    return Math.max(0, Math.round(34 * scaleFactor));
  }

  function physicalContentBounds(win, fallback = {}) {
    const bounds = win && !win.isDestroyed() ? win.getContentBounds() : {
      x: Number(fallback.x) || 0,
      y: Number(fallback.y) || 0,
      width: Number(fallback.width) || 1280,
      height: Number(fallback.height) || 720,
    };
    const display = screen.getDisplayMatching(bounds);
    const scaleFactor = Math.max(1, Number(display && display.scaleFactor) || 1);
    if (win && !win.isDestroyed() && typeof screen.dipToScreenRect === 'function') {
      try {
        const physicalRect = screen.dipToScreenRect(win, bounds);
        if (physicalRect && Number(physicalRect.width) > 0 && Number(physicalRect.height) > 0) {
          return {
            bounds, display, scaleFactor,
            x: Math.round(Number(physicalRect.x) || 0),
            y: Math.round(Number(physicalRect.y) || 0),
            width: Math.max(1, Math.round(Number(physicalRect.width) || 1)),
            height: Math.max(1, Math.round(Number(physicalRect.height) || 1)),
          };
        }
      } catch (_) {}
    }
    const dipOrigin = { x: Number(bounds.x) || 0, y: Number(bounds.y) || 0 };
    const dipEnd = {
      x: dipOrigin.x + Math.max(1, Number(bounds.width) || Number(fallback.width) || 1280),
      y: dipOrigin.y + Math.max(1, Number(bounds.height) || Number(fallback.height) || 720),
    };
    const physicalOrigin = typeof screen.dipToScreenPoint === 'function' ? screen.dipToScreenPoint(dipOrigin) : { x: Math.round(dipOrigin.x * scaleFactor), y: Math.round(dipOrigin.y * scaleFactor) };
    const physicalEnd = typeof screen.dipToScreenPoint === 'function' ? screen.dipToScreenPoint(dipEnd) : { x: Math.round(dipEnd.x * scaleFactor), y: Math.round(dipEnd.y * scaleFactor) };
    return {
      bounds, display, scaleFactor,
      x: Number.isFinite(Number(physicalOrigin.x)) ? Number(physicalOrigin.x) : 0,
      y: Number.isFinite(Number(physicalOrigin.y)) ? Number(physicalOrigin.y) : 0,
      width: Math.max(1, Math.abs(Math.round(Number(physicalEnd.x) - Number(physicalOrigin.x))) || Math.round((Number(bounds.width) || 1280) * scaleFactor)),
      height: Math.max(1, Math.abs(Math.round(Number(physicalEnd.y) - Number(physicalOrigin.y))) || Math.round((Number(bounds.height) || 720) * scaleFactor)),
    };
  }

  function nativeWindowHandleDecimal(win) {
    const handle = win.getNativeWindowHandle();
    if (process.arch === 'x64') return handle.readBigUInt64LE(0).toString();
    return String(handle.readUInt32LE(0));
  }

  function clearCaptureGrant(sessionId = '') {
    const expectedSessionId = String(sessionId || '');
    if (expectedSessionId && !captureGrant) return false;
    if (expectedSessionId && captureGrant.sessionId !== expectedSessionId) return false;
    if (!captureGrant) return false;
    if (captureGrant && capturePreparationOperation === captureGrant.operation) capturePreparationOperation = 0;
    captureGrant = null;
    captureSourceId = '';
    return true;
  }

  function createCaptureGrant(result, operation, extra = {}) {
    const sessionId = String((result && result.sessionId) || extra.sessionId || '');
    const sourceId = String((result && result.sourceId) || extra.sourceId || '');
    if (!/^[a-f0-9]{24}$/i.test(sessionId)) {
      clearCaptureGrant();
      return null;
    }
    captureSourceId = sourceId;
    captureGrant = {
      sessionId, sourceId, operation,
      kind: extra.kind || 'scene',
      captureSource: extra.captureSource || null,
      createdAt: Date.now(),
      requestStarted: false,
    };
    return captureGrant;
  }

  function getCaptureGrant() {
    const grant = captureGrant;
    if (!grant) return null;
    if (Date.now() - grant.createdAt > GRANT_MS) {
      clearCaptureGrant(grant.sessionId);
      return null;
    }
    const active = runtime.getStatus();
    if (!active || active.active !== true || active.sessionId !== grant.sessionId) {
      clearCaptureGrant(grant.sessionId);
      return null;
    }
    return grant;
  }

  function isTrustedDisplayCapturePermission(webContents, origin) {
    const win = mainWindow();
    if (!win || !webContents || webContents !== win.webContents) return false;
    if (!isTrustedMainDocumentUrl(origin || webContents.getURL())) return false;
    const grant = getCaptureGrant();
    return !!grant && (!!captureSourceId || grant.kind === 'dwm-glass' || grant.kind === 'scene');
  }

  function isTrustedPreparationMediaPermission(webContents, origin) {
    const grant = getCaptureGrant();
    if (!grant || capturePreparationOperation !== grant.operation) return false;
    return isTrustedDisplayCapturePermission(webContents, origin);
  }

  async function prepareRendererGlassCapture(sessionId, fps, sourceId) {
    const win = mainWindow();
    if (!win || !/^[a-f0-9]{24}$/i.test(String(sessionId || ''))) {
      return { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_RENDERER_UNAVAILABLE' };
    }
    const safeSessionId = String(sessionId);
    const safeFps = Math.max(24, Math.min(60, Number(fps) || 60));
    const safeSourceId = /^window:\d+:\d+$/.test(String(sourceId || '')) ? String(sourceId) : '';
    const grant = getCaptureGrant();
    if (!grant || grant.kind !== 'dwm-glass' || grant.sessionId !== safeSessionId
      || grant.sourceId !== safeSourceId) {
      return { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_GRANT_MISSING' };
    }
    const script = `(() => {
      const prepare = window.__mineradioPrepareWallpaperEngineGlassCapture;
      if (typeof prepare !== 'function') return { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_PREPARE_HANDLER_MISSING' };
      return Promise.resolve(prepare(${JSON.stringify(safeSessionId)}, ${safeFps}, ${JSON.stringify(safeSourceId)}))
        .then((value) => value && typeof value === 'object' ? value : { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_PREPARE_RESULT_INVALID' })
        .catch((error) => ({ ok: false, error: String(error && (error.message || error.name) || error || 'WALLPAPER_GLASS_CAPTURE_PREPARE_FAILED').slice(0, 500) }));
    })()`;
    let timeout;
    try {
      capturePreparationOperation = grant.operation;
      const result = await Promise.race([
        win.webContents.executeJavaScript(script, true),
        new Promise((resolve) => {
          timeout = setTimeout(() => resolve({ ok: false, error: 'WALLPAPER_GLASS_CAPTURE_PREPARE_TIMEOUT' }), PREPARE_TIMEOUT_MS);
        }),
      ]);
      return result && typeof result === 'object'
        ? { ok: result.ok === true, error: String(result.error || '').slice(0, 500) }
        : { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_PREPARE_RESULT_INVALID' };
    } catch (error) {
      return { ok: false, error: String(error && (error.message || error.name) || error || 'WALLPAPER_GLASS_CAPTURE_PREPARE_FAILED').slice(0, 500) };
    } finally {
      if (capturePreparationOperation === grant.operation) capturePreparationOperation = 0;
      if (timeout) clearTimeout(timeout);
    }
  }

  function cancelHostBoundsRestart() {
    if (hostBoundsRestartTimer) {
      clearTimeout(hostBoundsRestartTimer);
      hostBoundsRestartTimer = null;
    }
    hostBoundsRestartPending = false;
    hostBoundsStopPromise = null;
    hostBoundsFollowupReason = '';
    hostBoundsOperation += 1;
  }

  function stopRuntimeForRenderer(reason = '') {
    captureOperation += 1;
    cancelHostBoundsRestart();
    clearCaptureGrant();
    return runtime.stop().catch((error) => {
      console.warn('[Wallpaper Engine] renderer cleanup failed:', reason || 'renderer-reset', error && error.message || error);
      return { ok: false, stopped: false, error: String(error && (error.message || error.name) || error || 'WALLPAPER_ENGINE_STOP_FAILED') };
    });
  }

  function finishVisibleHostResume(win) {
    hostVisibilityResumePending = false;
    if (hostVisibilityResumeTimer) {
      clearTimeout(hostVisibilityResumeTimer);
      hostVisibilityResumeTimer = null;
    }
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      try { win.webContents.setBackgroundThrottling(false); } catch (_) {}
    }
  }

  function suspendForHiddenHost(win, reason = 'hidden') {
    if (!win || win.isDestroyed()) return Promise.resolve({ ok: true, stopped: false });
    if (hostVisibilitySuspended) {
      return hostVisibilityStopPromise || Promise.resolve({ ok: true, stopped: true });
    }
    hostVisibilitySuspended = true;
    hostVisibilityOperation += 1;
    finishVisibleHostResume(win);
    cancelHostBoundsRestart();
    try {
      win.webContents.send('mineradio-wallpaper-engine-host-bounds-changed', {
        phase: 'prepare',
        reason: String(reason || 'hidden'),
      });
    } catch (_) {}
    hostVisibilityStopPromise = stopRuntimeForRenderer(`host-${reason || 'hidden'}`);
    return hostVisibilityStopPromise;
  }

  function resumeForVisibleHost(win, reason = 'visible') {
    if (isAppQuitting()) return;
    if (!hostVisibilitySuspended) return;
    hostVisibilitySuspended = false;
    hostVisibilityResumePending = true;
    const visibilityOperation = ++hostVisibilityOperation;
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      try { win.webContents.setBackgroundThrottling(false); } catch (_) {}
    }
    if (hostVisibilityResumeTimer) clearTimeout(hostVisibilityResumeTimer);
    hostVisibilityResumeTimer = setTimeout(() => {
      finishVisibleHostResume(win);
    }, RESUME_TIMEOUT_MS);
    const notifyRestart = () => {
      if (hostVisibilityOperation !== visibilityOperation || hostVisibilitySuspended || !win || win.isDestroyed() || !win.isVisible() || win.isMinimized()) return;
      try {
        win.webContents.send('mineradio-wallpaper-engine-host-bounds-changed', {
          phase: 'restart',
          reason: String(reason || 'visible'),
        });
      } catch (_) {}
    };
    const stopped = hostVisibilityStopPromise;
    Promise.resolve(stopped).catch(() => null).finally(() => {
      if (hostVisibilityStopPromise === stopped) hostVisibilityStopPromise = null;
      if (hostVisibilityOperation !== visibilityOperation || hostVisibilitySuspended) return;
      setTimeout(notifyRestart, 80);
      setTimeout(notifyRestart, 420);
      setTimeout(notifyRestart, 1100);
    });
  }

  function scheduleHostBoundsRestart(win, reason = 'bounds-changed') {
    if (!win || win.isDestroyed()) return;
    const status = runtime.getStatus();
    if (!hostBoundsRestartPending && (!status || status.active !== true)) return;
    let job = hostBoundsStopPromise;
    if (!job) {
      hostBoundsFollowupReason = String(reason || 'bounds-changed').slice(0, 80);
      hostBoundsRestartPending = true;
      job = {
        started: false,
        sessionId: String(status && status.sessionId || ''),
        reason: hostBoundsFollowupReason,
        boundsOperation: ++hostBoundsOperation,
        promise: null,
      };
      hostBoundsStopPromise = job;
    } else {
      job.reason = String(reason || job.reason || 'bounds-changed').slice(0, 80);
      hostBoundsFollowupReason = job.reason;
    }
    if (hostBoundsRestartTimer) clearTimeout(hostBoundsRestartTimer);
    hostBoundsRestartTimer = setTimeout(() => {
      hostBoundsRestartTimer = null;
      if (hostBoundsStopPromise !== job || job.started === true) return;
      const currentBeforePrepare = runtime.getStatus();
      if (!currentBeforePrepare || currentBeforePrepare.active !== true) {
        hostBoundsStopPromise = null;
        hostBoundsRestartPending = false;
        return;
      }
      job.started = true;
      job.sessionId = String(currentBeforePrepare.sessionId || job.sessionId || '');
      try {
        win.webContents.send('mineradio-wallpaper-engine-host-bounds-changed', {
          phase: 'prepare',
          reason: job.reason,
          sessionId: job.sessionId,
        });
      } catch (_) {}
      job.promise = Promise.resolve()
        .then(() => runtime.stop(job.sessionId))
        .catch(() => ({ ok: false }))
        .finally(() => {
          const ownsCurrentJob = hostBoundsStopPromise === job;
          if (ownsCurrentJob) {
            hostBoundsStopPromise = null;
            hostBoundsRestartPending = false;
          }
          if (!ownsCurrentJob || hostVisibilitySuspended || !win || win.isDestroyed()) return;
          try {
            win.webContents.send('mineradio-wallpaper-engine-host-bounds-changed', {
              phase: 'restart',
              reason: job.reason,
              sessionId: job.sessionId,
            });
          } catch (_) {}
        });
    }, 260);
  }

  function registerIpc() {
    if (ipcInstalled) return;
    ipcInstalled = true;

    ipcMain.handle('mineradio-wallpaper-engine-list', async (event, payload = {}) => {
      try {
        if (!isTrustedIpc(event)) return { ok: false, projects: [], count: 0, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
        const snapshot = await library.list({ force: payload && payload.force === true });
        const runtimeStatus = await runtime.probe(payload && payload.force === true);
        return { ...snapshot, runtime: runtimeStatus };
      } catch (error) {
        return { ok: false, projects: [], count: 0, error: error.message || 'WALLPAPER_ENGINE_SCAN_FAILED' };
      }
    });

    ipcMain.handle('mineradio-wallpaper-engine-project-details', async (event, id) => {
      try {
        if (!isTrustedIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
        return await library.getProjectDetails(String(id || ''));
      } catch (error) {
        return { ok: false, error: error.message || 'WALLPAPER_ENGINE_PROJECT_DETAILS_FAILED' };
      }
    });

    ipcMain.handle('mineradio-wallpaper-engine-open-project-details', async (event, payload = {}) => {
      try {
        if (!isTrustedIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
        const details = await library.getProjectDetails(String(payload && payload.id || ''));
        const workshopId = String(details && details.workshopId || '');
        if (!/^\d{5,32}$/.test(workshopId)) {
          return { ok: false, error: 'WALLPAPER_ENGINE_WORKSHOP_DETAILS_UNAVAILABLE' };
        }
        const target = payload && payload.target === 'workshop' ? 'workshop' : 'we';
        let revealError = '';
        if (target === 'we') {
          try {
            await runtime.revealWorkshop(workshopId);
            return { ok: true, opened: 'wallpaper-engine', workshopId };
          } catch (error) {
            revealError = error && (error.code || error.message) || 'WALLPAPER_ENGINE_REVEAL_FAILED';
          }
        }
        const steamUri = 'steam://url/CommunityFilePage/' + workshopId;
        try {
          await shell.openExternal(steamUri);
          return { ok: true, opened: 'steam-workshop', workshopId, fallback: target === 'we', revealError };
        } catch (_) {
          const webUrl = 'https://steamcommunity.com/sharedfiles/filedetails/?id=' + workshopId;
          await shell.openExternal(webUrl);
          return { ok: true, opened: 'web-workshop', workshopId, fallback: target === 'we', revealError };
        }
      } catch (error) {
        return { ok: false, error: error.message || 'WALLPAPER_ENGINE_OPEN_PROJECT_DETAILS_FAILED' };
      }
    });

    ipcMain.handle('mineradio-wallpaper-engine-choose-directory', async (event) => {
      try {
        if (!isTrustedIpc(event)) return { ok: false, canceled: false, projects: [], count: 0, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
        const win = mainWindow();
        const options = { title: '导入 Wallpaper Engine 项目', buttonLabel: '导入此目录', properties: ['openDirectory'] };
        const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
        if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: true, canceled: true };
        const snapshot = await library.addManualRoot(result.filePaths[0]);
        const runtimeStatus = await runtime.probe(false);
        return { ...snapshot, runtime: runtimeStatus, canceled: false };
      } catch (error) {
        return { ok: false, canceled: false, projects: [], count: 0, error: error.message || 'WALLPAPER_ENGINE_IMPORT_FAILED' };
      }
    });

    ipcMain.handle('mineradio-wallpaper-engine-choose-project-file', async (event) => {
      try {
        if (!isTrustedIpc(event)) return { ok: false, canceled: false, projects: [], count: 0, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
        const win = mainWindow();
        const options = {
          title: '选择 project.json 或场景包 (.pkg/.pak)',
          buttonLabel: '导入此项目',
          properties: ['openFile'],
          filters: [{ name: 'Wallpaper Engine 项目', extensions: ['pkg', 'pak', 'json'] }],
        };
        const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
        if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: true, canceled: true };
        const selected = path.resolve(result.filePaths[0]);
        const snapshot = await library.addManualProjectFile(selected);
        const runtimeStatus = await runtime.probe(false);
        return { ...snapshot, runtime: runtimeStatus, canceled: false };
      } catch (error) {
        return { ok: false, canceled: false, projects: [], count: 0, error: error.message || 'WALLPAPER_ENGINE_IMPORT_PROJECT_FAILED' };
      }
    });

    ipcMain.handle('mineradio-wallpaper-engine-remove-directory', async (event, rootId) => {
      try {
        if (!isTrustedIpc(event)) return { ok: false, projects: [], count: 0, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
        const snapshot = await library.removeManualRoot(rootId);
        const runtimeStatus = await runtime.probe(false);
        return { ...snapshot, runtime: runtimeStatus };
      } catch (error) {
        return { ok: false, projects: [], count: 0, error: error.message || 'WALLPAPER_ENGINE_REMOVE_ROOT_FAILED' };
      }
    });

    ipcMain.handle('mineradio-wallpaper-engine-runtime-status', async (event, payload = {}) => {
      try {
        if (!isTrustedIpc(event)) return { ok: false, available: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
        const probe = await runtime.probe(payload && payload.force === true);
        return { ...probe, ...runtime.getStatus(), pending: runtime.pending != null };
      } catch (error) {
        return { ok: false, available: false, error: error.message || 'WALLPAPER_ENGINE_RUNTIME_PROBE_FAILED' };
      }
    });

    ipcMain.handle('mineradio-wallpaper-engine-start-scene', async (event, payload = {}) => {
      let operation = 0;
      let startedSessionId = '';
      try {
        if (!isTrustedIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
        operation = ++captureOperation;
        if (hostVisibilitySuspended) return { ok: false, error: 'WALLPAPER_ENGINE_HOST_SUSPENDED' };
        const win = mainWindow();
        const physicalBounds = physicalContentBounds(win, payload);
        const display = physicalBounds.display;
        const fps = targetFps(display, payload && payload.fps);
        const cornerRadius = hostCornerRadius(win);
        const result = await runtime.start(String(payload && payload.id || ''), {
          width: Math.max(640, Math.min(7680, physicalBounds.width)),
          height: Math.max(360, Math.min(4320, physicalBounds.height)),
          fps,
          x: physicalBounds.x,
          y: physicalBounds.y,
        });
        startedSessionId = String(result && result.sessionId || '');
        if (operation !== captureOperation) {
          await runtime.stop(startedSessionId).catch(() => {});
          return { ok: false, error: 'WALLPAPER_ENGINE_START_SUPERSEDED', sessionId: startedSessionId };
        }
        let embedded = result;
        if (win && typeof runtime.embedActiveWindow === 'function') {
          try {
            embedded = await runtime.embedActiveWindow(startedSessionId, {
              hostWindowId: nativeWindowHandleDecimal(win),
              hostExecutable: process.execPath,
              cornerRadius,
              desktopIconLayering: false,
            });
          } catch (embeddingError) {
            clearCaptureGrant(startedSessionId);
            await runtime.stop(startedSessionId).catch(() => {});
            return {
              ok: false,
              error: embeddingError && (embeddingError.code || embeddingError.message) || 'WALLPAPER_ENGINE_WINDOW_ISOLATION_FAILED',
              capturePrepared: false,
              sessionId: startedSessionId,
            };
          }
        }
        if (operation !== captureOperation) {
          await runtime.stop(startedSessionId).catch(() => {});
          return { ok: false, error: 'WALLPAPER_ENGINE_START_SUPERSEDED', sessionId: startedSessionId };
        }
        const grant = createCaptureGrant({ ...result, ...embedded }, operation);
        if (!grant) {
          await runtime.stop(startedSessionId).catch(() => {});
          return { ok: false, error: 'WALLPAPER_ENGINE_CAPTURE_UNAVAILABLE', sessionId: startedSessionId };
        }
        if (win) {
          try { win.moveTop(); } catch (_) {}
          try { win.focus(); } catch (_) {}
        }
        if (operation !== captureOperation) {
          clearCaptureGrant(grant.sessionId);
          await runtime.stop(grant.sessionId).catch(() => {});
          return { ok: false, error: 'WALLPAPER_ENGINE_START_SUPERSEDED', sessionId: grant.sessionId };
        }
        return { ...result, ...embedded, capturePrepared: true, captureMode: 'dwm-thumbnail' };
      } catch (error) {
        if (startedSessionId) {
          clearCaptureGrant(startedSessionId);
          await runtime.stop(startedSessionId).catch(() => {});
        } else if (captureGrant && captureGrant.operation === operation) {
          clearCaptureGrant();
        }
        return { ok: false, error: error.code || error.message || 'WALLPAPER_ENGINE_SCENE_START_FAILED', sessionId: startedSessionId };
      }
    });

    ipcMain.handle('mineradio-wallpaper-engine-capture-result', async (event, payload = {}) => {
      if (!isTrustedIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
      const sessionId = String(payload && payload.sessionId || '');
      if (!/^[a-f0-9]{24}$/i.test(sessionId)) return { ok: false, error: 'WALLPAPER_ENGINE_SESSION_INVALID' };
      const matched = clearCaptureGrant(sessionId);
      let confirmed = false;
      if (matched && payload && payload.ok === true && typeof runtime.confirmCaptureReady === 'function') {
        confirmed = await runtime.confirmCaptureReady(sessionId).catch(() => false);
      }
      if (matched && !confirmed) {
        hostBoundsFollowupReason = '';
        await runtime.stop(sessionId).catch(() => {});
      }
      if (matched && confirmed && hostVisibilityResumePending) {
        finishVisibleHostResume(mainWindow());
      }
      if (matched && confirmed && hostBoundsFollowupReason) {
        const followupReason = hostBoundsFollowupReason;
        hostBoundsFollowupReason = '';
        setTimeout(() => {
          const win = mainWindow();
          if (!win || !win.isVisible() || win.isMinimized()) return;
          scheduleHostBoundsRestart(win, followupReason);
        }, 90);
      }
      return {
        ok: matched && confirmed,
        accepted: matched,
        captureReady: confirmed,
        error: matched && !confirmed ? 'WALLPAPER_ENGINE_DWM_SURFACE_FAILED' : '',
      };
    });

    ipcMain.handle('mineradio-wallpaper-engine-prepare-glass-capture', async (event, payload = {}) => {
      if (!isTrustedIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
      const sessionId = String(payload && payload.sessionId || '');
      if (!/^[a-f0-9]{24}$/i.test(sessionId)) return { ok: false, error: 'WALLPAPER_ENGINE_SESSION_INVALID' };
      const win = mainWindow();
      if (!win || !win.isVisible() || win.isMinimized() || hostVisibilitySuspended) {
        return { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_HOST_HIDDEN' };
      }
      const captureOp = captureOperation;
      const glassOperation = ++glassCaptureOperation;
      try {
        const current = runtime.getStatus();
        if (!current || current.active !== true || current.sessionId !== sessionId) {
          return { ok: false, error: 'WALLPAPER_ENGINE_SESSION_INACTIVE' };
        }
        const sourceId = String(current.dwmGlassSurfaceSourceId || current.sourceId || '');
        const source = current.captureSource || (sourceId ? { id: sourceId, name: 'Mineradio WE DWM Surface' } : null);
        if (!source || !source.id) return { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_SOURCE_INVALID' };
        const grant = createCaptureGrant({ sessionId, sourceId: source.id }, glassOperation, {
          kind: 'dwm-glass',
          captureSource: source,
        });
        if (!grant) return { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_SOURCE_INVALID' };
        const prepared = await prepareRendererGlassCapture(sessionId, payload && payload.fps, source.id);
        const after = runtime.getStatus();
        if (captureOp !== captureOperation || glassOperation !== glassCaptureOperation || !after || after.active !== true || after.sessionId !== sessionId) {
          return { ok: false, error: 'WALLPAPER_ENGINE_START_SUPERSEDED' };
        }
        return {
          ok: !!(prepared && prepared.ok === true),
          capturePrepared: !!(prepared && prepared.ok === true),
          captureMode: 'dwm-glass-svg-sampler',
          error: String(prepared && prepared.error || ''),
        };
      } catch (error) {
        return {
          ok: false,
          error: String(error && (error.code || error.message || error.name) || error || 'WALLPAPER_GLASS_CAPTURE_PREPARE_FAILED').slice(0, 500),
        };
      } finally {
        if (captureGrant && captureGrant.kind === 'dwm-glass' && captureGrant.operation === glassOperation) {
          clearCaptureGrant(sessionId);
        }
      }
    });

    ipcMain.handle('mineradio-wallpaper-engine-activate-dwm-surface', async (event, payload = {}) => {
      if (!isTrustedIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
      const sessionId = String(payload && payload.sessionId || '');
      if (!/^[a-f0-9]{24}$/i.test(sessionId)) return { ok: false, error: 'WALLPAPER_ENGINE_SESSION_INVALID' };
      try {
        const result = await runtime.activateDwmSurface(sessionId);
        return {
          ok: !!(result && result.dwmSurfaceActive === true),
          active: !!(result && result.dwmSurfaceActive === true),
          captureMode: 'dwm-thumbnail',
          error: result && result.dwmSurfaceActive === true ? '' : 'WALLPAPER_ENGINE_DWM_SURFACE_FAILED',
        };
      } catch (error) {
        return { ok: false, active: false, error: String(error && (error.code || error.message) || error || 'WALLPAPER_ENGINE_DWM_SURFACE_FAILED') };
      }
    });

    ipcMain.on('mineradio-wallpaper-engine-glass-surface', (event, payload = {}) => {
      if (!isTrustedIpc(event) || typeof runtime.updateGlassSurface !== 'function') return;
      const sessionId = String(payload && payload.sessionId || '');
      if (!/^[a-f0-9]{24}$/i.test(sessionId)) return;
      const win = mainWindow();
      if (payload.active === true && (!win || !win.isVisible() || win.isMinimized() || hostVisibilitySuspended)) return;
      try { runtime.updateGlassSurface(sessionId, payload); } catch (_) {}
    });

    ipcMain.on('mineradio-wallpaper-engine-pointer-activity', (event, payload = {}) => {
      const win = mainWindow();
      if (!isTrustedIpc(event) || !win || !win.isVisible() || win.isMinimized() || hostVisibilitySuspended) return;
      const sessionId = String(payload && payload.sessionId || '');
      if (!/^[a-f0-9]{24}$/i.test(sessionId)) return;
      const rawXUnit = payload && payload.xUnit;
      const rawYUnit = payload && payload.yUnit;
      const xUnit = Math.round(rawXUnit);
      const yUnit = Math.round(rawYUnit);
      if (typeof rawXUnit !== 'number' || typeof rawYUnit !== 'number' || !Number.isFinite(xUnit) || !Number.isFinite(yUnit) || xUnit < 0 || xUnit > 65535 || yUnit < 0 || yUnit > 65535) return;
      const status = runtime.getStatus();
      if (!status || status.active !== true || status.sourceWindowParked !== true || String(status.sessionId || '') !== sessionId || typeof runtime.noteHostPointerActivity !== 'function') return;
      try {
        runtime.noteHostPointerActivity({ sessionId, xUnit, yUnit });
      } catch (_) {}
    });

    ipcMain.handle('mineradio-wallpaper-engine-stop-scene', async (event, payload = {}) => {
      try {
        if (!isTrustedIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
        const sessionId = String(payload && payload.sessionId || '');
        const stopAll = payload && payload.all === true || !sessionId;
        if (stopAll) {
          captureOperation += 1;
          cancelHostBoundsRestart();
          clearCaptureGrant();
        }
        const result = await runtime.stop(stopAll ? '' : sessionId);
        const current = runtime.getStatus();
        if (!stopAll && (!current.active || (captureGrant && captureGrant.sessionId === sessionId))) {
          clearCaptureGrant(sessionId);
        }
        return result;
      } catch (error) {
        return { ok: false, error: error.code || error.message || 'WALLPAPER_ENGINE_SCENE_STOP_FAILED' };
      }
    });
  }

  function attachWindow(win) {
    if (!win || win.isDestroyed() || windowHooksInstalled) return;
    windowHooksInstalled = true;
    win.on('minimize', () => suspendForHiddenHost(win, 'minimize'));
    win.on('restore', () => resumeForVisibleHost(win, 'restore'));
    win.on('show', () => resumeForVisibleHost(win, 'show'));
    win.on('hide', () => suspendForHiddenHost(win, 'hide'));
    win.on('move', () => scheduleHostBoundsRestart(win, 'move'));
    win.on('resize', () => scheduleHostBoundsRestart(win, 'resize'));
    win.on('enter-full-screen', () => setTimeout(() => scheduleHostBoundsRestart(win, 'enter-full-screen'), 40));
    win.on('leave-full-screen', () => scheduleHostBoundsRestart(win, 'leave-full-screen'));
    win.on('enter-html-full-screen', () => setTimeout(() => scheduleHostBoundsRestart(win, 'enter-html-full-screen'), 40));
    win.on('leave-html-full-screen', () => scheduleHostBoundsRestart(win, 'leave-html-full-screen'));
    win.on('closed', () => {
      windowHooksInstalled = false;
      stopRuntimeForRenderer('window-closed');
    });
  }

  async function installProtocol(protocol) {
    await library.installProtocol(protocol);
  }

  async function dispose() {
    cancelHostBoundsRestart();
    clearCaptureGrant();
    if (typeof library.dispose === 'function') library.dispose();
    return runtime.stop().catch(() => ({ ok: false }));
  }

  function configureSessionPermissions() {
    const ses = session.defaultSession;
    if (!ses || ses._mineradioWallpaperEnginePermissionsConfigured) return;
    ses._mineradioWallpaperEnginePermissionsConfigured = true;
    const previousCheck = ses.setPermissionCheckHandler ? null : null;
    ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
      const origin = requestingOrigin || (details && details.requestingUrl) || (webContents && webContents.getURL && webContents.getURL()) || '';
      if (permission === 'display-capture') return isTrustedDisplayCapturePermission(webContents, origin);
      if (permission === 'media') return isTrustedPreparationMediaPermission(webContents, origin);
      return ALLOWED_PERMS.has(permission) && isLocalAppUrl(origin);
    });
    ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const origin = (details && (details.requestingUrl || details.securityOrigin)) || (webContents && webContents.getURL && webContents.getURL()) || '';
      if (permission === 'display-capture') {
        callback(isTrustedDisplayCapturePermission(webContents, origin));
        return;
      }
      if (permission === 'media') {
        callback(isTrustedPreparationMediaPermission(webContents, origin));
        return;
      }
      callback(ALLOWED_PERMS.has(permission) && isLocalAppUrl(origin));
    });
    if (typeof ses.setDisplayMediaRequestHandler === 'function') {
      ses.setDisplayMediaRequestHandler((request, callback) => {
        let replied = false;
        const reply = (value) => {
          if (replied) return;
          replied = true;
          callback(value || {});
        };
        Promise.resolve().then(async () => {
          const win = mainWindow();
          const frame = request && request.frame;
          const trustedFrame = !!(frame && win && frame === win.webContents.mainFrame && !frame.parent && isLocalAppUrl(request.securityOrigin));
          const grant = getCaptureGrant();
          if (!trustedFrame || !request.videoRequested || request.audioRequested || !grant || grant.requestStarted) {
            reply({});
            return;
          }
          grant.requestStarted = true;
          if (grant.kind === 'dwm-glass') {
            const current = runtime.getStatus();
            const source = grant.captureSource;
            const sourceMatch = /^window:(\d+):\d+$/.exec(String(source && source.id || ''));
            if (captureGrant !== grant || !current || current.active !== true || current.sessionId !== grant.sessionId || current.dwmGlassSurfaceReady !== true || current.dwmGlassSurfaceActive !== true || !sourceMatch || Number(sourceMatch[1]) !== Number(current.dwmGlassSurfaceWindowId) || String(source && source.name || '') !== 'Mineradio WE DWM Surface') {
              reply({});
              return;
            }
            reply({ video: source });
            return;
          }
          let refreshed = typeof runtime.refreshActiveSource === 'function' ? await runtime.refreshActiveSource(grant.sessionId, { timeoutMs: 1600, pollIntervalMs: 80, includeSource: true }) : runtime.getStatus();
          let source = refreshed && refreshed.captureSource;
          if (captureGrant !== grant || !refreshed || refreshed.sessionId !== grant.sessionId || !refreshed.sourceId || !source) {
            reply({});
            return;
          }
          reply({ video: source });
        }).catch(() => reply({}));
      });
    }
  }

  return {
    library,
    runtime,
    registerScheme,
    registerIpc,
    configureSessionPermissions,
    attachWindow,
    installProtocol,
    dispose,
    scheduleHostBoundsRestart,
    suspendForHiddenHost,
    resumeForVisibleHost,
  };
}

module.exports = { createWallpaperEngineBridge, registerWallpaperEngineScheme };
