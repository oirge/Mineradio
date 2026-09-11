// Mineradio 3D 歌单架「原版」实现（上游 XxHuberrr/Mineradio 移植，GPL-3.0）。
// 本文件由拼装脚本从本地上游源码树生成，与现有歌单架并存，可来回切换。
// 上游几何/管理器逐字节移植；宿主依赖（THREE / scene / 数据 / 工具）经 createEngine 注入。
// 该 IIFE 不污染任何全局，只暴露 window.MineradioShelfClassic。
window.MineradioShelfClassic = (function () {
  'use strict';

  // ---- 宿主绑定（由 createEngine 注入） ----
  var D = null;
  var THREE, scene, camera, renderer, uniforms, particles, pointerParallax, fx,
    playQueue, currentIdx, playlistCoverCache, bass, beatPulse, playing,
    songCoverSrc, queueItemKey, compactCount, requestPlaylistCover, readableInkForHex,
    shelfAccentHex, shelfAccentRgba, shelfSettings, shelfAlwaysVisible,
    shouldUseWallpaperSafeShelfCamera, shouldUseSkullSafeShelfCamera, shouldUseShelfDynamicCamera,
    hasAnyPlatformLogin, userPlaylists, myPodcastCollections, playlistCatalogRevision,
    pulseObjectValue, showToast, playShelfSelectTick, setFocusZone, setPeek,
    updateEmptyHomeVisibility, loadPlaylistIntoQueueById, playQueueAt, setShelfMode,
    togglePlaylistPanel, suppressBottomControlsForShelf, restoreBottomControlsAfterShelfExit,
    scheduleLyricLayoutSave, saveLyricLayout, setShelfHoverTabVisible,
    isFullscreenPlaylistQueueFocusLockedAtEdge, isPointerOverUi, clampRange,
    visualGuideActive, emptyHomeActive, homeForcedOpen, safeShelfCloseContent,
    makeContentListManager;

  // ---- 原版参数默认值（照上游 00-state/04-fx-defaults.js） ----
  var CLASSIC_FX_DEFAULTS = {
    shelfSize: 0.92, shelfOffsetX: -0.34, shelfOffsetY: -0.2, shelfOffsetZ: 0.12,
    shelfAngleY: -11, shelfOpacity: 1, shelfBgOpacity: 0.79, shelfAccentColor: '#ffffff',
    shelfDetailOffsetX: 0, shelfDetailOffsetY: 0, shelfDetailOffsetZ: 0,
    shelfDetailScale: 1.35, shelfDetailAngleX: 0, shelfDetailAngleY: -13, shelfDetailRowGap: 1,
    shelfDetailOpenDuration: 0.6, shelfDetailCloseDuration: 0.18, shelfDetailRowDuration: 0.72,
    shelfDetailIntroStrength: 1, shelfDetailParallax: 1,
    shelfSummonOpenDuration: 0.91, shelfSummonCloseDuration: 0.46, shelfSummonSlide: 1.9,
    shelfSummonStagger: 1, shelfSummonScale: 1, shelfSummonParallax: 1,
    shelfCameraEnterSpeed: 0.24, shelfCameraExitSpeed: 0.24
  };
  function classicNorm(key, fallback, min, max) {
    var value = (fx && fx[key] != null) ? Number(fx[key]) : fallback;
    if (!isFinite(value)) value = fallback;
    return clampRange(value, min, max);
  }
  // 详情页位置/动画参数（上游 02-visual/04-visual-settings-persistence.js）。
  function shelfDetailSettings() {
    return {
      x: classicNorm('shelfDetailOffsetX', CLASSIC_FX_DEFAULTS.shelfDetailOffsetX, -4.8, 4.8),
      y: classicNorm('shelfDetailOffsetY', CLASSIC_FX_DEFAULTS.shelfDetailOffsetY, -3.6, 3.6),
      z: classicNorm('shelfDetailOffsetZ', CLASSIC_FX_DEFAULTS.shelfDetailOffsetZ, -3.6, 3.6),
      scale: classicNorm('shelfDetailScale', CLASSIC_FX_DEFAULTS.shelfDetailScale, 0.72, 1.35),
      rx: classicNorm('shelfDetailAngleX', CLASSIC_FX_DEFAULTS.shelfDetailAngleX, -24, 24) * Math.PI / 180,
      ry: classicNorm('shelfDetailAngleY', CLASSIC_FX_DEFAULTS.shelfDetailAngleY, -28, 28) * Math.PI / 180,
      rowGap: classicNorm('shelfDetailRowGap', CLASSIC_FX_DEFAULTS.shelfDetailRowGap, 0.72, 1.32),
      openDuration: classicNorm('shelfDetailOpenDuration', CLASSIC_FX_DEFAULTS.shelfDetailOpenDuration, 0.12, 1.2),
      closeDuration: classicNorm('shelfDetailCloseDuration', CLASSIC_FX_DEFAULTS.shelfDetailCloseDuration, 0.08, 0.8),
      rowDuration: classicNorm('shelfDetailRowDuration', CLASSIC_FX_DEFAULTS.shelfDetailRowDuration, 0.16, 1.6),
      intro: classicNorm('shelfDetailIntroStrength', CLASSIC_FX_DEFAULTS.shelfDetailIntroStrength, 0, 1.8),
      parallax: classicNorm('shelfDetailParallax', CLASSIC_FX_DEFAULTS.shelfDetailParallax, 0, 1.8)
    };
  }
  // 唤出/收起节奏参数（上游）。
  function shelfSummonSettings() {
    return {
      openDuration: classicNorm('shelfSummonOpenDuration', CLASSIC_FX_DEFAULTS.shelfSummonOpenDuration, 0.08, 2),
      closeDuration: classicNorm('shelfSummonCloseDuration', CLASSIC_FX_DEFAULTS.shelfSummonCloseDuration, 0.08, 1.6),
      slide: classicNorm('shelfSummonSlide', CLASSIC_FX_DEFAULTS.shelfSummonSlide, 0, 4),
      stagger: classicNorm('shelfSummonStagger', CLASSIC_FX_DEFAULTS.shelfSummonStagger, 0, 3),
      scale: classicNorm('shelfSummonScale', CLASSIC_FX_DEFAULTS.shelfSummonScale, 0, 3),
      parallax: classicNorm('shelfSummonParallax', CLASSIC_FX_DEFAULTS.shelfSummonParallax, 0, 2.5),
      cameraEnterSpeed: classicNorm('shelfCameraEnterSpeed', CLASSIC_FX_DEFAULTS.shelfCameraEnterSpeed, 0.2, 1.5),
      cameraExitSpeed: classicNorm('shelfCameraExitSpeed', CLASSIC_FX_DEFAULTS.shelfCameraExitSpeed, 0.2, 1.5)
    };
  }
  // 帧率无关的指数缓动因子（上游）。
  function durationEaseFactor(seconds, dt) {
    seconds = Math.max(0.016, Number(seconds) || 0.016);
    dt = Math.max(1 / 240, Number(dt) || 1 / 60);
    return clampRange(1 - Math.exp(-dt / seconds), 0.001, 1);
  }

  // 边界同步采用一个可复用载荷；pushShared 必须同步复制标量，不得保存该对象。
  var sharedScratch = { pinnedOpen: false, visibility: 0, openAnimAt: -10 };
  var liveBoundaryDepth = 0;
  var engineGeneration = 0;
  function syncLive() {
    if (liveBoundaryDepth || !D || typeof D.snapshotLive !== 'function') return;
    var s = D.snapshotLive();
    if (!s) return;
    if ('playQueue' in s) playQueue = s.playQueue;
    if ('currentIdx' in s) currentIdx = s.currentIdx;
    if ('bass' in s) bass = s.bass;
    if ('beatPulse' in s) beatPulse = s.beatPulse;
    if ('playing' in s) playing = s.playing;
    if ('particles' in s) particles = s.particles;
    if ('camera' in s) camera = s.camera;
    if ('scene' in s) scene = s.scene;
    if ('uniforms' in s) uniforms = s.uniforms;
    if ('pointerParallax' in s) pointerParallax = s.pointerParallax;
    if ('playlistCoverCache' in s) playlistCoverCache = s.playlistCoverCache;
    if ('fx' in s) fx = s.fx;
    if ('userPlaylists' in s) userPlaylists = s.userPlaylists;
    if ('myPodcastCollections' in s) myPodcastCollections = s.myPodcastCollections;
    if ('playlistCatalogRevision' in s) playlistCatalogRevision = s.playlistCatalogRevision;
    if ('visualGuideActive' in s) visualGuideActive = s.visualGuideActive;
    if ('emptyHomeActive' in s) emptyHomeActive = s.emptyHomeActive;
    if ('homeForcedOpen' in s) homeForcedOpen = s.homeForcedOpen;
    if ('pinnedOpen' in s) shelfPinnedOpen = !!s.pinnedOpen;
    else if ('shelfPinnedOpen' in s) shelfPinnedOpen = !!s.shelfPinnedOpen;
    if ('visibility' in s) shelfVisibility = s.visibility;
    else if ('shelfVisibility' in s) shelfVisibility = s.shelfVisibility;
    if ('openAnimAt' in s) shelfOpenAnimAt = s.openAnimAt;
    else if ('shelfOpenAnimAt' in s) shelfOpenAnimAt = s.shelfOpenAnimAt;
  }
  function pushShared() {
    if (D && typeof D.pushShared === 'function') {
      sharedScratch.pinnedOpen = shelfPinnedOpen;
      sharedScratch.visibility = shelfVisibility;
      sharedScratch.openAnimAt = shelfOpenAnimAt;
      D.pushShared(sharedScratch);
    }
  }
  function liveEntry(fn, generation) {
    return function () {
      if (generation != null && generation !== engineGeneration) return;
      var outer = liveBoundaryDepth === 0;
      if (outer) syncLive();
      liveBoundaryDepth++;
      try { return fn.apply(this, arguments); }
      finally {
        liveBoundaryDepth--;
        if (outer) pushShared();
      }
    };
  }
  function resetShared() {
    shelfPinnedOpen = false;
    shelfVisibility = 0;
    shelfOpenAnimAt = -10;
    shelfPlaybackSwitchGuardUntil = 0;
    shelfHoverCue.target = shelfHoverCue.value = 0;
    shelfHoverCue.x = shelfHoverCue.y = shelfHoverCue.lastAt = shelfHoverCue.enteredAt = 0;
    shelfHoverCue.zoneActive = shelfHoverCue.guide = false;
    if (fx) fx.shelfPinnedOpen = false;
    pushShared();
  }

// ============================================================
var shelfPinnedOpen = false;
var shelfManager = null;
var shelfOpenAnimAt = -10;
var shelfHoverCue = { target: 0, value: 0, x: 0, y: 0, lastAt: 0, enteredAt: 0, zoneActive: false, guide: false };
var shelfVisibility = 0;  // 0..1, 侧栏自动隐藏的整体透明度系数
var shelfPlaybackSwitchGuardUntil = 0;
function shelfPlaybackSwitchGuardActive(now) {
  return (now || performance.now()) < shelfPlaybackSwitchGuardUntil;
}
function markShelfPlaybackSwitchGuard(ms) {
  shelfPlaybackSwitchGuardUntil = Math.max(shelfPlaybackSwitchGuardUntil, performance.now() + Math.max(220, ms || 980));
  shelfHoverCue.target = 0;
  shelfHoverCue.value = 0;
  shelfHoverCue.zoneActive = false;
  shelfHoverCue.enteredAt = 0;
  shelfHoverCue.guide = false;
  shelfVisibility = 0;
  if (typeof setShelfHoverTabVisible === 'function') setShelfHoverTabVisible(false);
  if (shelfManager && shelfManager.clearSelected) shelfManager.clearSelected();
  if (typeof setFocusZone === 'function') setFocusZone(null, true);
}
function isPortraitShelfViewport() {
  return innerHeight > innerWidth * 1.08;
}
function shelfLayoutProfile(shelfCtl) {
  var portrait = isPortraitShelfViewport();
  var narrow = !portrait && innerWidth < 980;
  var skullShelf = shouldUseSkullSafeShelfCamera();
  var detailScale = portrait ? clampRange(innerWidth / 820, 0.70, 0.86) : (narrow ? 0.92 : 1.04);
  shelfCtl = shelfCtl || shelfSettings();
  var detailCtl = shelfDetailSettings();
  return {
    portrait: portrait,
    narrow: narrow,
    sideX: (skullShelf ? (portrait ? 0.22 : (narrow ? 0.46 : 0.76)) : (portrait ? 1.56 : (narrow ? 2.48 : 3.18))) + shelfCtl.x,
    sideY: (skullShelf ? (portrait ? -0.22 : (narrow ? -0.30 : -0.34)) : 0) + shelfCtl.y,
    sideXStep: skullShelf ? (portrait ? 0.018 : 0.034) : (portrait ? 0.018 : 0.040),
    sideYStep: skullShelf ? (portrait ? 0.46 : 0.62) : (portrait ? 0.52 : 0.68),
    sideZ: (skullShelf ? (portrait ? 0.86 : 0.92) : (portrait ? 0.78 : 0.86)) + shelfCtl.z,
    sideZStep: skullShelf ? (portrait ? 0.108 : 0.158) : (portrait ? 0.118 : 0.170),
    sideEntryX: skullShelf ? (portrait ? 0.30 : 0.50) : (portrait ? 0.38 : 0.82),
    sideDetailShift: skullShelf ? (portrait ? 0.00 : 0.00) : (portrait ? 0.38 : 0.82),
    sideScale: (skullShelf ? (portrait ? 0.84 : (narrow ? 1.04 : 1.22)) : (portrait ? 0.70 : (narrow ? 0.86 : 1))) * shelfCtl.size,
    sideRotY: (skullShelf ? (portrait ? -0.085 : -0.190) : (portrait ? 0.12 : 0.28)) + shelfCtl.angle,
    sideRotX: skullShelf ? (portrait ? 0.018 : 0.030) : (portrait ? 0.022 : 0.042),
    stageX: shelfCtl.x,
    stageXStep: portrait ? 0.92 : (narrow ? 1.22 : 1.55),
    stageY: (portrait ? -2.46 : -2.20) + shelfCtl.y,
    stageZ: (portrait ? 0.84 : 1.0) + shelfCtl.z,
    stageScale: (portrait ? 0.72 : (narrow ? 0.86 : 1)) * shelfCtl.size,
    detail: {
      x: (skullShelf ? (portrait ? 0.16 : (narrow ? 0.40 : 0.64)) : (portrait ? 0.38 : (narrow ? 0.96 : 1.28))) + shelfCtl.x * 0.62 + detailCtl.x,
      y: (skullShelf ? (portrait ? -0.40 : -0.68) : (portrait ? 0.10 : 0.18)) + shelfCtl.y * 0.55 + detailCtl.y,
      z: (skullShelf ? (portrait ? 1.10 : 1.22) : (portrait ? 1.28 : 1.36)) + shelfCtl.z * 0.45 + detailCtl.z,
      rx: (skullShelf ? (portrait ? 0.006 : 0.014) : (portrait ? -0.004 : -0.008)) + detailCtl.rx,
      ry: (skullShelf ? (portrait ? -0.070 : -0.165) : (portrait ? 0.00 : 0.020)) + shelfCtl.angle * 0.55 + detailCtl.ry,
      scale: (skullShelf ? detailScale * (portrait ? 0.88 : 1.02) : detailScale) * shelfCtl.size * detailCtl.scale,
      rowStep: (skullShelf ? (portrait ? 0.37 : 0.43) : (portrait ? 0.36 : 0.42)) * detailCtl.rowGap,
      openDuration: detailCtl.openDuration,
      closeDuration: detailCtl.closeDuration,
      rowDuration: detailCtl.rowDuration,
      intro: detailCtl.intro,
      parallax: detailCtl.parallax,
      rowScale: skullShelf ? (portrait ? 0.90 : 1.02) : (portrait ? 0.88 : (narrow ? 0.96 : 1.00))
    }
  };
}
function shelfHotZoneWidth() {
  var ratio = isPortraitShelfViewport() ? 0.26 : 0.18;
  return Math.min(isPortraitShelfViewport() ? 280 : 360, Math.max(148, innerWidth * ratio));
}
function shelfPreviewUseZoneWidth() {
  return Math.min(820, Math.max(shelfHotZoneWidth(), innerWidth * 0.56));
}
function shelfWheelZoneWidth() {
  var portrait = isPortraitShelfViewport();
  var ratioWidth = innerWidth * (portrait ? 0.24 : 0.18);
  return Math.min(portrait ? 280 : 360, Math.max(shelfHotZoneWidth(), ratioWidth));
}
function isShelfClickZone(e) {
  var edge = shelfPinnedOpen ? Math.min(390, Math.max(210, innerWidth * 0.22)) : shelfHotZoneWidth();
  return e.clientX > innerWidth - edge && e.clientY > 130 && e.clientY < innerHeight - 150;
}
function isShelfPreviewUseZone(e) {
  var edge = shelfPreviewUseZoneWidth();
  return e.clientX > innerWidth - edge && e.clientY > 96 && e.clientY < innerHeight - 96;
}
function isShelfWheelZone(e) {
  var edge = shelfWheelZoneWidth();
  return e.clientX > innerWidth - edge && e.clientY > 116 && e.clientY < innerHeight - 116;
}
function canUseSideShelfWithoutPinnedOpen() {
  return !!shelfAlwaysVisible();
}
function shelfPreviewIsVisible() {
  if (shelfPlaybackSwitchGuardActive()) return false;
  return shelfHoverCue.guide || shelfHoverCue.zoneActive || shelfHoverCue.target > 0 || shelfHoverCue.value > 0.10 || shelfVisibility > 0.12;
}
function shelfAutoHiddenInputReady() {
  if (shelfPlaybackSwitchGuardActive()) return false;
  if (shelfPinnedOpen || shelfAlwaysVisible()) return true;
  if (shelfManager && shelfManager.hasOpenContent && shelfManager.hasOpenContent()) return true;
  return !!(shelfHoverCue.guide || shelfHoverCue.zoneActive || shelfHoverCue.value > 0.18 || shelfVisibility > 0.16);
}
function canShowShelfHoverCueAt(e) {
  if (!e) return false;
  if (shelfPlaybackSwitchGuardActive()) return false;
  if (!shelfHoverCue.guide) return false;
  if (document.body.classList.contains('splash-active')) return false;
  if (visualGuideActive || emptyHomeActive || homeForcedOpen) return false;
  if (!shelfManager || !shelfManager.getMode || shelfManager.getMode() !== 'side') return false;
  if (shelfPinnedOpen) return false;
  if (shelfManager.hasOpenContent && shelfManager.hasOpenContent()) return false;
  if (isPointerOverUi(e)) return false;
  if (isShelfClickZone(e)) return true;
  return shelfPreviewIsVisible() && isShelfPreviewUseZone(e);
}
function shelfCueRect() {
  var w = shelfHotZoneWidth();
  var top = Math.max(136, innerHeight * 0.22);
  var h = Math.min(390, innerHeight - top - 142);
  return { left: innerWidth - w, top: top, width: w, height: h, right: innerWidth, bottom: top + h };
}
function shelfCueCenter() {
  var r = shelfCueRect();
  return { x: r.left + r.width * 0.58, y: r.top + r.height * 0.50 };
}
function setShelfGuideCueActive(on) {
  shelfHoverCue.guide = !!on;
  if (on) {
    var c = shelfCueCenter();
    shelfHoverCue.target = 1;
    shelfHoverCue.value = Math.max(shelfHoverCue.value, 0.72);
    shelfHoverCue.x = c.x;
    shelfHoverCue.y = c.y;
    shelfHoverCue.lastAt = performance.now();
  } else {
    shelfHoverCue.target = 0;
  }
}
function updateShelfHoverCueFromPointer(e) {
  if (shelfPlaybackSwitchGuardActive()) {
    shelfHoverCue.target = 0;
    shelfHoverCue.value = 0;
    shelfHoverCue.zoneActive = false;
    shelfHoverCue.enteredAt = 0;
    shelfHoverCue.guide = false;
    return;
  }
  if (!e) {
    if (!shelfHoverCue.guide) shelfHoverCue.target = 0;
    shelfHoverCue.zoneActive = false;
    shelfHoverCue.enteredAt = 0;
    return;
  }
  var active = false;
  var inZone = canShowShelfHoverCueAt(e);
  if (inZone && !shelfHoverCue.zoneActive) {
    shelfHoverCue.zoneActive = true;
    shelfHoverCue.enteredAt = performance.now();
  } else if (!inZone) {
    shelfHoverCue.zoneActive = false;
    shelfHoverCue.enteredAt = 0;
  }
  active = inZone;
  if (!shelfHoverCue.guide) shelfHoverCue.target = active ? 1 : 0;
  shelfHoverCue.x = e.clientX;
  shelfHoverCue.y = e.clientY;
  shelfHoverCue.lastAt = performance.now();
}
function tickShelfHoverCue(dt) {
  if (shelfPlaybackSwitchGuardActive()) {
    shelfHoverCue.target = 0;
    shelfHoverCue.value = 0;
    shelfHoverCue.zoneActive = false;
    shelfHoverCue.enteredAt = 0;
    shelfHoverCue.guide = false;
    return 0;
  }
  if (!shelfHoverCue.guide && shelfHoverCue.zoneActive) {
    var heldPointer = { clientX: shelfHoverCue.x, clientY: shelfHoverCue.y };
    if (canShowShelfHoverCueAt(heldPointer)) {
      if (performance.now() - shelfHoverCue.enteredAt > 260) shelfHoverCue.target = 1;
    } else {
      shelfHoverCue.zoneActive = false;
      shelfHoverCue.enteredAt = 0;
      shelfHoverCue.target = 0;
    }
  }
  if (!shelfHoverCue.guide && !shelfHoverCue.zoneActive && performance.now() - shelfHoverCue.lastAt > 650) shelfHoverCue.target = 0;
  var target = shelfHoverCue.guide ? 1 : shelfHoverCue.target;
  var summon = shelfSummonSettings();
  var duration = target > shelfHoverCue.value
    ? Math.max(0.05, summon.openDuration * 0.50)
    : Math.max(0.05, summon.closeDuration * 0.50);
  shelfHoverCue.value += (target - shelfHoverCue.value) * durationEaseFactor(duration, dt);
  if (shelfHoverCue.value < 0.006 && !target) shelfHoverCue.value = 0;
  return shelfHoverCue.value;
}
function setShelfPinnedOpen(open, immediate, persist) {
  var nextOpen = !!open;
  if (nextOpen && typeof suppressBottomControlsForShelf === 'function') suppressBottomControlsForShelf(980);
  if (nextOpen && !shelfPinnedOpen) {
    var nowT = uniforms && uniforms.uTime ? uniforms.uTime.value : performance.now() / 1000;
    var previewVisible = shelfHoverCue.guide || shelfHoverCue.value > 0.28 || shelfVisibility > 0.20;
    var summon = shelfSummonSettings();
    shelfOpenAnimAt = previewVisible ? nowT - summon.openDuration : nowT;
    shelfHoverCue.target = 0;
    shelfHoverCue.zoneActive = false;
    shelfHoverCue.enteredAt = 0;
  }
  shelfPinnedOpen = nextOpen;
  if (fx) fx.shelfPinnedOpen = nextOpen;
  if (!nextOpen) {
    updateShelfHoverCueFromPointer(null);
    shelfHoverCue.target = 0;
    shelfHoverCue.value = 0;
    shelfHoverCue.zoneActive = false;
    shelfHoverCue.enteredAt = 0;
    shelfHoverCue.guide = false;
    shelfVisibility = 0;
    if (typeof setShelfHoverTabVisible === 'function') setShelfHoverTabVisible(false);
    if (shelfManager && shelfManager.clearSelected) shelfManager.clearSelected();
  }
  pushShared();
  var hint = document.getElementById('hint');
  if (hint) hint.classList.toggle('shelf-hidden', shelfPinnedOpen || !!(shelfManager && shelfManager.hasOpenContent && shelfManager.hasOpenContent()));
  if (nextOpen && typeof setPeek === 'function') setPeek(document.getElementById('search-area'), false, 'search');
  if (typeof updateEmptyHomeVisibility === 'function') updateEmptyHomeVisibility({ forceLoad: false });
  if (shelfManager && shelfManager.hasOpenContent && shelfManager.hasOpenContent()) return;
  if (typeof setFocusZone === 'function') setFocusZone(shelfPinnedOpen ? 'shelf-side' : null, immediate);
  if (!nextOpen && typeof restoreBottomControlsAfterShelfExit === 'function') {
    requestAnimationFrame((function (generation, manager) {
      return function () {
        if (generation === engineGeneration && manager === shelfManager && !shelfPinnedOpen && manager.getMode() !== 'off') {
          restoreBottomControlsAfterShelfExit('shelf-pin-close');
        }
      };
    })(engineGeneration, shelfManager));
  }
  if (persist !== false) {
    if (typeof scheduleLyricLayoutSave === 'function') scheduleLyricLayoutSave(220, { user: true, reason: 'shelfPinnedOpen' });
    else saveLyricLayout({ user: true, reason: 'shelfPinnedOpen' });
  }
}
function clearShelfPreviewOnPointerExit(e) {
  if (!shelfManager || !shelfManager.getMode || shelfManager.getMode() !== 'side') return;
  var keepQueueFocus = typeof isFullscreenPlaylistQueueFocusLockedAtEdge === 'function' && isFullscreenPlaylistQueueFocusLockedAtEdge(e);
  var hasContent = shelfManager.hasOpenContent && shelfManager.hasOpenContent();
  updateShelfHoverCueFromPointer(null);
  shelfHoverCue.target = 0;
  shelfHoverCue.value = 0;
  shelfHoverCue.zoneActive = false;
  shelfHoverCue.enteredAt = 0;
  if (typeof setShelfHoverTabVisible === 'function') setShelfHoverTabVisible(false);
  if (shelfManager && shelfManager.clearSelected) shelfManager.clearSelected();
  if (hasContent && shelfManager.closeContent) safeShelfCloseContent('shelf-mode-reset');
  if (shelfPinnedOpen) setShelfPinnedOpen(false, true);
  shelfVisibility = 0;
  if (typeof setFocusZone === 'function') setFocusZone(keepQueueFocus ? 'queue' : null, keepQueueFocus);
}
function suppressShelfPreviewForPlaybackSwitch() {
  if (!shelfManager || !shelfManager.getMode || shelfManager.getMode() !== 'side') return;
  if (shelfPinnedOpen || (shelfManager.hasOpenContent && shelfManager.hasOpenContent())) return;
  markShelfPlaybackSwitchGuard(1120);
  updateShelfHoverCueFromPointer(null);
  shelfHoverCue.target = 0;
  shelfHoverCue.value = 0;
  shelfHoverCue.zoneActive = false;
  shelfHoverCue.enteredAt = 0;
  shelfHoverCue.guide = false;
  shelfVisibility = 0;
  if (typeof setShelfHoverTabVisible === 'function') setShelfHoverTabVisible(false);
  if (shelfManager && shelfManager.clearSelected) shelfManager.clearSelected();
  if (typeof setFocusZone === 'function') setFocusZone(null, true);
}

function makeShelfManager() {
  var group = null;
  var cards = [];          // [{canvas, ctx, texture, mesh, item, index, slot}]
  var allItems = [];
  var renderedStart = -1;
  var SHELF_VISIBLE_RADIUS = 5;
  var SHELF_MAX_RENDER = SHELF_VISIBLE_RADIUS * 2 + 1;
  var shelfPane = 'mine';       // mine | fav
  var collectionReveal = 0;     // 滚轮阻尼累积，用于打开/返回收藏歌单
  var paneMemory = { mine: 0, fav: 0 };
  var paneSwitchAt = -10;
  var paneSwitchDir = 1;
  var mode = 'side';
  var lastSig = '';
  var lastUpdate = 0;
  var lastCardRedrawAt = -10;
  var lastCardPulseBucket = -1;
  var cardBuildQueue = null;
  var selectedIdx = -1;
  var coverBindResumeUntil = -10;

  function shelfPointerSelectionForegroundActive() {
    return selectedIdx >= 0 && !document.body.classList.contains('cursor-hidden');
  }

  // v7.2 PSP 风格状态
  var centerIdx = 0;          // 当前居中卡片 index (在 items 数组中的位置)
  var centerTarget = 0;       // 目标 centerIdx (插值)
  var centerSmooth = 0;       // 当前实际 centerIdx 平滑值
  var openCardIdx = -1;       // 已打开内容框的卡片 (-1 表示无)
  var contentList = null;     // 二级 PSP 滚动列表 manager
  var connectorParticles = null;
  var playlistPaneCache = { revision: -1, source: null, mine: [], fav: [] };

  // 一次性返回完整 items 数组 (不只 5 张, 全部参与 PSP 滚动)
  function splitPlaylists() {
    if (playlistPaneCache.revision === playlistCatalogRevision && playlistPaneCache.source === userPlaylists) {
      return { mine: playlistPaneCache.mine, fav: playlistPaneCache.fav };
    }
    var mine = [], fav = [];
    userPlaylists.forEach(function (pl) {
      var pane = pl && (pl.shelfPane || pl.shelf_pane);
      if (pane === 'mine' || pane === 'fav') (pane === 'fav' ? fav : mine).push(pl);
      else (pl.subscribed ? fav : mine).push(pl);
    });
    playlistPaneCache = { revision: playlistCatalogRevision, source: userPlaylists, mine: mine, fav: fav };
    return { mine: mine, fav: fav };
  }

  function shelfShowsPodcasts() {
    return !fx || fx.shelfShowPodcasts !== false;
  }

  function shelfMergesCollections() {
    return !!(fx && fx.shelfMergeCollections === true);
  }

  function activePlaylists() {
    var panes = splitPlaylists();
    if (shelfMergesCollections()) return panes.mine.concat(panes.fav);
    var source = (shelfPane === 'fav') ? panes.fav : panes.mine;
    if (!source.length && shelfPane === 'mine' && panes.fav.length) source = panes.fav;
    if (!source.length && shelfPane === 'fav' && panes.mine.length) source = panes.mine;
    return source;
  }

  function currentItems() {
    if (D && typeof D.getShelfItems === 'function') return D.getShelfItems() || [];
    // 队列只保存长度与来源；封面和卡片项在可见窗口中按需构造。
    return { length: playQueue.length, queue: playQueue };
  }
  function shelfItemAt(items, index) {
    if (items.queue) {
      var song = items.queue[index];
      return {
        type: 'queue', key: queueItemKey(song), title: song.name, sub: song.artist || '未知歌手',
        cover: songCoverSrc(song, 360), tag: index === currentIdx ? '正在播放' : ('#' + (index + 1)), queueIndex: index
      };
    }
    return D && typeof D.shelfItemAt === 'function' ? D.shelfItemAt(items, index) : items[index];
  }
  function makeRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var chars = String(text || '').split('');
    var line = '', lines = [];
    for (var i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line); line = chars[i];
        if (lines.length >= maxLines - 1) break;
      } else line = test;
    }
    if (line && lines.length < maxLines) lines.push(line);
    for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], x, y + j * lineHeight);
  }
  function cardDrawSignature(card, item) {
    item = item || {};
    var rec = item.cover ? playlistCoverCache[item.cover] : null;
    var coverState = item.cover ? (rec && rec.loaded ? 'ready' : (rec && rec.failed ? 'fail' : 'wait')) : 'none';
    var pulseBucket = card && card.isCenter ? Math.round((bass + beatPulse * 0.85) * 6) : 0;
    return [
      item.type || '', item.title || '', item.sub || '', item.tag || '',
      item.playlistId || '', item.podcastKey || '', item.queueIndex == null ? '' : item.queueIndex,
      item.cover || '', coverState, card && card.isCenter ? 1 : 0, card && card.selected ? 1 : 0,
      card && card.dofBucket == null ? -1 : card.dofBucket, pulseBucket, shelfAccentHex(), shelfSettings().bgOpacity
    ].join('|');
  }

  function drawCard(card, item) {
    if (card.disposed || !group || mode === 'off') return;
    item = item || card.item || {};
    var nextDrawKey = cardDrawSignature(card, item);
    if (card.drawKey === nextDrawKey) return;
    card.drawKey = nextDrawKey;
    var cv = card.canvas, ctx = card.ctx;
    var W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    var pad = 18;
    var isNow = item.type === 'queue' && item.tag === '正在播放';
    var shelfLook = shelfSettings();

    // 卡片底
    makeRoundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 32);
    ctx.fillStyle = 'rgba(0,0,0,' + shelfLook.bgOpacity.toFixed(3) + ')'; ctx.fill();
    var grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)');
    grad.addColorStop(1, 'rgba(255,255,255,0.018)');
    ctx.fillStyle = grad; ctx.fill();

    if (isNow) {
      ctx.strokeStyle = shelfAccentRgba(0.72);
      ctx.lineWidth = 1.8 + Math.sin(uniforms.uTime.value * 3) * 0.28 + bass * 1.2;
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1.1;
    }
    ctx.stroke();

    if (card.selected) {
      ctx.save();
      makeRoundRect(ctx, pad + 2, pad + 2, W - pad * 2 - 4, H - pad * 2 - 4, 30);
      ctx.shadowColor = shelfAccentRgba(0.58);
      ctx.shadowBlur = 18;
      ctx.strokeStyle = shelfAccentRgba(0.72);
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }

    // 大封面方块
    var coverSize = H - pad * 2 - 8;
    var cx = pad + 6, cy = pad + 4;
    makeRoundRect(ctx, cx, cy, coverSize, coverSize, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
    if (item.cover) {
      var rec = playlistCoverCache[item.cover];
      if (rec && rec.loaded && rec.img) {
        ctx.save(); makeRoundRect(ctx, cx, cy, coverSize, coverSize, 26); ctx.clip();
        ctx.drawImage(rec.img, cx, cy, coverSize, coverSize); ctx.restore();
      } else if (!rec || (!rec.loading && !rec.failed)) {
        var binding = card.binding || 0;
        var generation = engineGeneration;
        requestPlaylistCover(item.cover, function () {
          if (generation !== engineGeneration || card.disposed || card.item !== item || card.binding !== binding || !group || mode === 'off') return;
          drawCard(card, item);
        });
      }
    }

    // 文本区
    var tx = pad + coverSize + 32;
    ctx.font = '700 17px Inter, Arial';
    ctx.fillStyle = isNow ? shelfAccentRgba(0.92) : 'rgba(255,255,255,0.92)';
    ctx.fillText(item.tag || '', tx, pad + 36);

    ctx.font = '700 30px Inter, Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    wrapText(ctx, item.title || '', tx, pad + 78, W - tx - pad - 14, 36, 2);

    ctx.font = '400 17px Inter, Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.52)';
    wrapText(ctx, item.sub || '', tx, pad + 156, W - tx - pad - 14, 24, 2);

    // 律动进度条
    ctx.strokeStyle = isNow ? shelfAccentRgba(0.90) : 'rgba(255,255,255,0.30)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(tx, H - pad - 22);
    ctx.lineTo(tx + Math.min(260, 80 + bass * 320), H - pad - 22);
    ctx.stroke();

    if (card.isCenter) {
      var actionY = H - pad - 78;
      if (item.type === 'playlist') {
        makeRoundRect(ctx, tx, actionY, 138, 38, 18);
        var playGrad = ctx.createLinearGradient(tx, actionY, tx + 138, actionY + 38);
        playGrad.addColorStop(0, 'rgba(255,255,255,0.88)');
        playGrad.addColorStop(0.55, shelfAccentRgba(0.94));
        playGrad.addColorStop(1, shelfAccentRgba(0.58));
        ctx.fillStyle = playGrad; ctx.fill();
        ctx.strokeStyle = shelfAccentRgba(0.44);
        ctx.lineWidth = 1.1; ctx.stroke();
        ctx.font = '800 14px Inter, "Microsoft YaHei", Arial';
        ctx.fillStyle = readableInkForHex(shelfAccentHex());
        ctx.fillText('▶ 播放歌单', tx + 25, actionY + 24);

        makeRoundRect(ctx, tx + 150, actionY, 104, 38, 18);
        ctx.fillStyle = 'rgba(255,255,255,0.055)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1.1; ctx.stroke();
        ctx.font = '700 14px Inter, "Microsoft YaHei", Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.fillText('详情', tx + 184, actionY + 24);
      } else if (item.type === 'queue') {
        ctx.font = '600 14px Inter, "Microsoft YaHei", Arial';
        ctx.fillStyle = shelfAccentRgba(0.84);
        ctx.fillText('点击播放', tx, actionY + 25);
      }
    }

    var dof = card.dofBlur || 0;
    if (dof > 0.12) {
      makeRoundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 32);
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.28, dof * 0.18).toFixed(3) + ')';
      ctx.fill();
    }

    card.texture.needsUpdate = true;
  }

  function buildOneCard(item, i) {
    var cv = document.createElement('canvas');
    cv.width = 720; cv.height = 360;
    var ctx = cv.getContext('2d');
    var tx = new THREE.CanvasTexture(cv);
    tx.minFilter = THREE.LinearFilter; tx.magFilter = THREE.LinearFilter;
    tx.generateMipmaps = false;
    var mat = new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0.96, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
    var geo = new THREE.PlaneGeometry(2.05, 1.025, 1, 1);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 50 + i;
    mesh.userData.action = item.type === 'playlist'
      ? { kind: 'loadPlaylist', playlistId: item.playlistId, title: item.title }
      : (item.type === 'podcastCollection'
        ? { kind: 'loadPlaylist', playlistId: 'podcast:' + item.podcastKey, title: item.title }
        : (item.type === 'queue' ? { kind: 'playQueue', index: item.queueIndex } : { kind: 'empty' }));
    group.add(mesh);
    var card = { binding: 0, disposed: false, canvas: cv, ctx: ctx, texture: tx, mesh: mesh, item: item, index: i, isCenter: false, selected: i === selectedIdx, floatMix: 0, fxPulse: 0, dofBlur: 0, dofBucket: -1, drawKey: '' };
    return card;
  }

  function shelfCardAction(item) {
    return item.type === 'playlist'
      ? { kind: 'loadPlaylist', playlistId: item.playlistId, title: item.title }
      : (item.type === 'podcastCollection'
        ? { kind: 'loadPlaylist', playlistId: 'podcast:' + item.podcastKey, title: item.title }
        : (item.type === 'queue' ? { kind: 'playQueue', index: item.queueIndex } : { kind: 'empty' }));
  }

  function rebindShelfCard(card, item, index) {
    card.binding++;
    card.item = item;
    card.index = index;
    card.selected = index === selectedIdx;
    card.isCenter = Math.abs(index - centerSmooth) < 0.5;
    card.drawKey = '';
    card.mesh.userData.action = shelfCardAction(item);
    card.mesh.renderOrder = 50 + index;
    drawCard(card, item);
    return card;
  }

  function disposeShelfCard(card) {
    if (!card || card.disposed) return;
    card.disposed = true;
    if (card.mesh && card.mesh.parent) card.mesh.parent.remove(card.mesh);
    if (card.mesh && card.mesh.material) {
      if (card.mesh.material.map) card.mesh.material.map.dispose();
      card.mesh.material.dispose();
    }
    if (card.mesh && card.mesh.geometry) card.mesh.geometry.dispose();
  }

  function warmTextureUpload(tex) {
    if (!tex || !renderer || typeof renderer.initTexture !== 'function') return;
    try { renderer.initTexture(tex); } catch (e) { }
  }

  function cancelCardBuildQueue() {
    if (!cardBuildQueue) return;
    cardBuildQueue.cancelled = true;
    if (cardBuildQueue.raf) cancelAnimationFrame(cardBuildQueue.raf);
    cardBuildQueue = null;
  }

  function disposeRenderedCards() {
    cancelCardBuildQueue();
    cards.forEach(disposeShelfCard);
    cards = [];
    renderedStart = -1;
  }

  function scheduleQueuedCardBuild(job) {
    function step(deadline) {
      if (!job || job.cancelled || cardBuildQueue !== job || !group) return;
      var started = performance.now();
      var built = 0;
      while (job.next <= job.end && built < 2 && performance.now() - started < 7) {
        var card = buildOneCard(shelfItemAt(allItems, job.next), job.next);
        cards.push(card);
        drawCard(card, card.item);
        warmTextureUpload(card.texture);
        job.next += 1;
        built += 1;
      }
      if (job.next <= job.end) {
        if (window.requestIdleCallback) {
          requestIdleCallback(step, { timeout: 180 });
        } else {
          job.raf = requestAnimationFrame(step);
        }
      } else {
        cardBuildQueue = null;
      }
    }
    if (window.requestIdleCallback) requestIdleCallback(step, { timeout: 180 });
    else job.raf = requestAnimationFrame(step);
  }

  function syncRenderedWindow(force, asyncBuild) {
    if (!group) return;
    var total = allItems.length;
    if (!total) { disposeRenderedCards(); return; }
    var center = Math.round(centerTarget);
    var start = Math.max(0, center - SHELF_VISIBLE_RADIUS);
    var end = Math.min(total - 1, start + SHELF_MAX_RENDER - 1);
    start = Math.max(0, end - SHELF_MAX_RENDER + 1);
    if (!force && start === renderedStart && cards.length === (end - start + 1)) {
      cards.forEach(function (c) {
        var nextItem = shelfItemAt(allItems, c.index) || c.item;
        if (c.item !== nextItem) {
          c.item = nextItem;
          c.drawKey = '';
          drawCard(c, c.item);
        }
      });
      return;
    }
    cancelCardBuildQueue();
    renderedStart = start;
    if (asyncBuild && !cards.length) {
      cardBuildQueue = { start: start, end: end, next: start, cancelled: false, raf: 0 };
      scheduleQueuedCardBuild(cardBuildQueue);
      return;
    }
    var existingByIndex = Object.create(null);
    cards.forEach(function (card) { existingByIndex[card.index] = card; });
    var reusable = cards.filter(function (card) { return card.index < start || card.index > end; });
    var nextCards = [];
    for (var itemIdx = start; itemIdx <= end; itemIdx++) {
      var card = existingByIndex[itemIdx] || reusable.shift();
      if (!card) card = buildOneCard(shelfItemAt(allItems, itemIdx), itemIdx);
      else rebindShelfCard(card, shelfItemAt(allItems, itemIdx), itemIdx);
      if (!card.drawKey) drawCard(card, card.item);
      nextCards.push(card);
    }
    reusable.forEach(disposeShelfCard);
    cards = nextCards;
  }

  function rebuild(asyncCards, nextItems, nextSig) {
    if (!group) return;
    cancelCardBuildQueue();
    if (connectorParticles) {
      if (connectorParticles.parent) connectorParticles.parent.remove(connectorParticles);
      if (connectorParticles.geometry) connectorParticles.geometry.dispose();
      if (connectorParticles.material) connectorParticles.material.dispose();
      connectorParticles = null;
    }
    allItems = nextItems || currentItems();
    lastSig = nextSig == null ? sig(allItems) : nextSig;
    lastCardRedrawAt = -10;
    lastCardPulseBucket = -1;
    // center 起始 = currentIdx (如果是 queue), 否则 0
    if (allItems.length && shelfItemAt(allItems, 0).type === 'queue' && currentIdx >= 0) {
      centerTarget = Math.min(allItems.length - 1, currentIdx);
      centerSmooth = centerTarget;
      centerIdx = centerTarget;
    } else if (centerTarget >= allItems.length) {
      centerTarget = Math.max(0, allItems.length - 1);
      centerSmooth = centerTarget;
    }
    if (selectedIdx >= allItems.length) selectedIdx = -1;
    syncRenderedWindow(true, !!asyncCards);
    if (mode === 'stage') {
      createStageExtras();
    }
  }

  // ====================================================
  //  PSP 弧形布局: 以 centerSmooth 为基准, 卡片绕弧排列
  //  i 距离 center 越远 → 越靠后, 越小, 越淡
  // ====================================================
  function placeCard(card, i, totalCards, modeIs, frameLayout, frameLook, frameSummon) {
    var delta = card.index - centerSmooth;     // 正=下方, 负=上方
    var absD = Math.abs(delta);
    // 隐藏太远的卡 (>4 全隐藏)
    if (absD > SHELF_VISIBLE_RADIUS + 0.5) { card.mesh.visible = false; return; }
    card.mesh.visible = true;
    card.mesh.renderOrder = 60 + Math.round((SHELF_VISIBLE_RADIUS + 1 - Math.min(absD, SHELF_VISIBLE_RADIUS + 1)) * 10);
    var parX = pointerParallax.x || 0;
    var parY = pointerParallax.y || 0;
    var parWeight = Math.max(0, 1 - absD * 0.16);
    var pulse = card.fxPulse || 0;
    var layout = frameLayout;
    var shelfLook = frameLook;
    var summon = frameSummon;
    var nextDof = Math.max(0, Math.min(1, (absD - 0.45) / 3.2));
    var nextDofBucket = Math.round(nextDof * 5);
    if (card.dofBucket !== nextDofBucket) {
      card.dofBucket = nextDofBucket;
      card.dofBlur = nextDof;
      drawCard(card, card.item);
    }

    if (modeIs === 'side') {
      // 右侧 3D 架: 恢复更靠近、更斜切的打开姿态，让卡片有真正的前后层次。
      var detailOpenSide = contentList && contentList.isOpen();
      var nowT = uniforms.uTime.value;
      var hoverBreath = (!shelfPinnedOpen && !detailOpenSide) ? shelfVisibility : 0;
      var passiveAlways = shelfAlwaysVisible() && !shelfPinnedOpen && !detailOpenSide;
      var liftTarget = card.selected && shelfPointerSelectionForegroundActive() && !detailOpenSide ? 1 : 0;
      var liftRate = liftTarget > (card.floatMix || 0) ? 0.20 : 0.13;
      card.floatMix = (card.floatMix || 0) + (liftTarget - (card.floatMix || 0)) * liftRate;
      if (!liftTarget && card.floatMix < 0.004) card.floatMix = 0;
      var lift = card.floatMix || 0;
      var sideLayer = Math.max(0, SHELF_VISIBLE_RADIUS + 1 - Math.min(absD, SHELF_VISIBLE_RADIUS + 1));
      card.mesh.renderOrder = passiveAlways
        ? (30 + Math.round(sideLayer * 1.1) + Math.round(lift * 96))
        : (60 + Math.round(sideLayer * 10) + Math.round(lift * 70));
      var breathPulse = hoverBreath * (0.5 + 0.5 * Math.sin(nowT * 1.22 + card.index * 0.74));
      var revealRaw = Math.max(0, Math.min(1, (nowT - shelfOpenAnimAt - absD * 0.035 * summon.stagger) / summon.openDuration));
      var reveal = revealRaw * revealRaw * (3 - 2 * revealRaw);
      var entry = (1 - reveal) * (0.82 + absD * 0.075 * summon.stagger) * summon.slide;
      var paneRaw = Math.max(0, Math.min(1, (nowT - paneSwitchAt - absD * 0.030 * summon.stagger) / Math.max(0.12, summon.openDuration * 1.16)));
      var paneEase = 1 - paneRaw * paneRaw * (3 - 2 * paneRaw);
      var wallpaperShelfPose = shouldUseWallpaperSafeShelfCamera();
      var skullShelfPose = shouldUseSkullSafeShelfCamera();
      var safeShelfPose = wallpaperShelfPose || skullShelfPose;
      var px = layout.sideX + absD * layout.sideXStep - (detailOpenSide ? layout.sideDetailShift : 0) + entry * layout.sideEntryX;
      var py = (layout.sideY || 0) - delta * layout.sideYStep + (1 - reveal) * (delta < 0 ? -0.18 : 0.18) * summon.slide;
      var pz = layout.sideZ - absD * layout.sideZStep - (1 - reveal) * 0.20 * summon.slide;
      px += paneEase * paneSwitchDir * 0.60;
      py += paneEase * (delta < 0 ? -0.16 : 0.16);
      pz -= paneEase * 0.22;
      px += parX * 0.060 * parWeight * summon.parallax;
      py += parY * 0.046 * parWeight * summon.parallax;
      pz += (parY * 0.026 - parX * 0.028) * parWeight * summon.parallax;
      py += Math.sin(nowT * 0.92 + card.index * 0.64) * 0.052 * hoverBreath * Math.max(0.20, parWeight);
      pz += Math.cos(nowT * 0.78 + card.index * 0.52) * 0.030 * hoverBreath * parWeight;
      if (lift > 0.001) {
        px -= lift * (skullShelfPose ? 0.035 : (layout.portrait ? 0.065 : 0.145));
        py += lift * (skullShelfPose ? 0.045 : (layout.portrait ? 0.075 : 0.105));
        pz += lift * (skullShelfPose ? 0.080 : 0.220);
      }
      var revealScale = 1 - (1 - reveal) * 0.12 * summon.scale;
      var scale = (absD < 0.5 ? 1.12 : Math.max(0.55, 1.04 - absD * 0.14)) * revealScale * (1 + pulse * 0.056 + breathPulse * 0.026 + lift * (skullShelfPose ? 0.045 : 0.075)) * layout.sideScale;
      if (wallpaperShelfPose) scale *= 1.22;
      else if (skullShelfPose) scale *= 1.04;
      card.mesh.position.set(px, py, pz);
      if (skullShelfPose && camera) {
        card.mesh.quaternion.copy(camera.quaternion);
        card.mesh.rotateX(layout.sideRotX - delta * 0.008 - parY * 0.004 * parWeight * summon.parallax);
        card.mesh.rotateY(layout.sideRotY + (1 - reveal) * 0.012 * summon.slide + parX * 0.006 * parWeight * summon.parallax);
      } else {
        var safeRotY = wallpaperShelfPose ? 0.12 : layout.sideRotY;
        var safeEntryRotY = wallpaperShelfPose ? 0.05 : 0.16;
        card.mesh.rotation.y = (safeShelfPose ? safeRotY : layout.sideRotY) + (1 - reveal) * safeEntryRotY * summon.slide + parX * (safeShelfPose ? 0.014 : 0.038) * parWeight * summon.parallax;
        var safeRotX = wallpaperShelfPose ? 0.020 : layout.sideRotX;
        card.mesh.rotation.x = -delta * (safeShelfPose ? safeRotX : layout.sideRotX) - parY * (safeShelfPose ? 0.010 : 0.024) * parWeight * summon.parallax;
      }
      card.mesh.scale.setScalar(scale);
      var disabledByDetail = detailOpenSide;
      var opacity = absD < 0.5 ? 1.0 : Math.max(0.22, 1.0 - absD * 0.30);
      if (disabledByDetail) {
        opacity *= card.index === openCardIdx ? 0.16 : 0.08;
        card.mesh.material.color.setScalar(card.index === openCardIdx ? 0.42 : 0.25);
      } else {
        if (passiveAlways) opacity *= 0.92 + lift * 0.08;
        card.mesh.material.color.setScalar(passiveAlways ? (0.96 + lift * 0.04) : 1);
      }
      // v8: 自动隐藏 — shelf 不在 focus 区时整体淡化
      card.mesh.material.opacity = Math.min(1, opacity * (shelfVisibility != null ? shelfVisibility : 1) * reveal * (1 - paneEase * 0.24) + pulse * 0.10 * reveal + breathPulse * 0.035) * shelfLook.opacity;
      setCardCenter(card, absD < 0.5);
    } else {
      // 舞台 PSP: 水平展开 + center 突出, dock 在底部
      var pxStage = (layout.stageX || 0) + delta * layout.stageXStep;
      var pyStage = layout.stageY;
      var pzStage = absD < 0.5 ? layout.stageZ : (layout.stageZ - Math.min(2.0, absD) * 0.55);
      var paneRawS = Math.max(0, Math.min(1, (uniforms.uTime.value - paneSwitchAt - absD * 0.030) / 0.72));
      var paneEaseS = 1 - paneRawS * paneRawS * (3 - 2 * paneRawS);
      pxStage += paneEaseS * paneSwitchDir * 0.80;
      pzStage -= paneEaseS * 0.28;
      pxStage += parX * 0.110 * parWeight;
      pyStage += parY * 0.060 * parWeight;
      pzStage += (parY * 0.040 - parX * 0.035) * parWeight;
      var scaleS = (absD < 0.5 ? 1.20 : Math.max(0.45, 1.0 - absD * 0.22)) * (1 + pulse * 0.060) * layout.stageScale;
      card.mesh.position.set(pxStage, pyStage, pzStage);
      card.mesh.rotation.y = -delta * 0.22 + parX * 0.050 * parWeight;
      card.mesh.rotation.x = 0.10 - absD * 0.04 - parY * 0.028 * parWeight;
      card.mesh.scale.setScalar(scaleS);
      var disabledStage = contentList && contentList.isOpen();
      var opS = absD < 0.5 ? 1.0 : Math.max(0.18, 1.0 - absD * 0.32);
      if (disabledStage) {
        opS *= card.index === openCardIdx ? 0.16 : 0.08;
        card.mesh.material.color.setScalar(card.index === openCardIdx ? 0.42 : 0.25);
      } else {
        card.mesh.material.color.setScalar(1);
      }
      card.mesh.material.opacity = Math.min(1, opS * (shelfVisibility != null ? shelfVisibility : 1) * (1 - paneEaseS * 0.24) + pulse * 0.10) * shelfLook.opacity;
      setCardCenter(card, absD < 0.5);
    }
  }

  function setCardCenter(card, isCenter) {
    if (card.isCenter !== isCenter) {
      card.isCenter = isCenter;
      drawCard(card, card.item);
    } else {
      card.isCenter = isCenter;
    }
  }

  function playPlaylistCard(card) {
    if (!card || !card.mesh || !card.mesh.userData) return false;
    var action = card.mesh.userData.action;
    if (!action || action.kind !== 'loadPlaylist' || !action.playlistId) return false;
    if (String(action.playlistId).indexOf('podcast:') === 0) return false;
    pulseCard(card, 1.05);
    if (contentList && contentList.isOpen && contentList.isOpen()) contentList.close();
    openCardIdx = -1;
    setShelfPinnedOpen(false, true);
    if (typeof setFocusZone === 'function') setFocusZone(null, true);
    loadPlaylistIntoQueueById(action.playlistId, true, action.title || (card.item && card.item.title) || '');
    return true;
  }

  function pulseCard(card, amount) {
    if (!card) return;
    pulseObjectValue(card, 'fxPulse', amount || 1, 0.46);
  }

  function createStageExtras() {
    if (!group) return;
    var pcount = 80;
    var pgeo = new THREE.BufferGeometry();
    var ppos = new Float32Array(pcount * 3);
    var pcol = new Float32Array(pcount * 3);
    var prnd = new Float32Array(pcount);
    for (var i = 0; i < pcount; i++) {
      ppos[i * 3] = (Math.random() - 0.5) * 6;
      ppos[i * 3 + 1] = (Math.random() - 0.5) * 1.2 + 0.3;
      ppos[i * 3 + 2] = 1.0 + Math.random() * 1.5;
      pcol[i * 3] = 0.56; pcol[i * 3 + 1] = 0.91; pcol[i * 3 + 2] = 1.0;
      prnd[i] = Math.random();
    }
    pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
    pgeo.setAttribute('aColor', new THREE.BufferAttribute(pcol, 3));
    pgeo.setAttribute('aRand', new THREE.BufferAttribute(prnd, 1));
    var pmat = new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime, uPixel: uniforms.uPixel, uDotTex: uniforms.uDotTex },
      vertexShader: `precision highp float; uniform float uTime, uPixel; attribute vec3 aColor; attribute float aRand;
varying vec3 vC; varying float vA;
void main(){
  vec3 p = position;
  p.x += sin(uTime * 0.4 + aRand * 6.0) * 1.5;
  p.y += sin(uTime * 0.6 + aRand * 4.0) * 0.2;
  p.z += cos(uTime * 0.5 + aRand * 5.0) * 0.4;
  vC = aColor; vA = 0.4 + 0.4 * sin(uTime * 1.5 + aRand * 7.0);
  vec4 m = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = 4.0 * uPixel;
  gl_Position = projectionMatrix * m;
}`,
      fragmentShader: `precision highp float; uniform sampler2D uDotTex;
varying vec3 vC; varying float vA;
void main(){ vec4 t = texture2D(uDotTex, gl_PointCoord); if (t.a < 0.02) discard; gl_FragColor = vec4(vC, t.a * vA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    connectorParticles = new THREE.Points(pgeo, pmat);
    connectorParticles.frustumCulled = false;
    connectorParticles.renderOrder = 49;
    connectorParticles.position.set(0, -2.2, 0);
    if (group.parent) group.parent.add(connectorParticles); else scene.add(connectorParticles);
  }

  function sig(items) {
    if (D && typeof D.getShelfSignature === 'function') return String(D.getShelfSignature(items));
    var result = 'local:' + items.length + ':' + currentIdx;
    for (var i = 0; i < items.length; i++) {
      // 无宿主签名时仍完整检查成员；队列签名不生成不可见封面。
      if (items.queue) {
        var song = items.queue[i];
        result += signatureField(queueItemKey(song)) + signatureField(song.name) + signatureField(song.artist);
      } else {
        var item = shelfItemAt(items, i);
        result += signatureField(item.key) + signatureField(item.contentSignature) + signatureField(item.type)
          + signatureField(item.playlistId) + signatureField(item.queueIndex) + signatureField(item.title)
          + signatureField(item.sub) + signatureField(item.cover) + signatureField(item.tag);
      }
    }
    return result;
  }
  function signatureField(value) {
    var text = value == null ? '' : String(value);
    return ':' + text.length + ':' + text;
  }

  function switchPane(nextPane) {
    if (shelfMergesCollections()) return false;
    if (nextPane === shelfPane) return false;
    paneMemory[shelfPane] = Math.max(0, Math.round(centerTarget));
    shelfPane = nextPane;
    collectionReveal = 0;
    var targetList = activePlaylists();
    var remembered = paneMemory[nextPane] || 0;
    centerTarget = Math.max(0, Math.min(Math.max(0, targetList.length - 1), remembered));
    centerSmooth = centerTarget + (nextPane === 'fav' ? 1.85 : -1.85);
    centerIdx = centerTarget;
    paneSwitchAt = uniforms.uTime.value;
    paneSwitchDir = nextPane === 'fav' ? 1 : -1;
    shelfOpenAnimAt = uniforms.uTime.value;
    if (contentList) contentList.close();
    selectedIdx = Math.round(centerTarget);
    playShelfSelectTick(paneSwitchDir, 'card');
    rebuild();
    showToast(nextPane === 'fav' ? '收藏歌单' : '我的歌单');
    return true;
  }

  function applySelectedIndex(idx) {
    idx = idx == null || idx < 0 ? -1 : Math.round(idx);
    selectedIdx = idx;
    cards.forEach(function (c) {
      var next = c.index === selectedIdx;
      if (c.selected !== next) {
        c.selected = next;
        drawCard(c, c.item);
      }
    });
  }
  function step(direction) {
    if (!allItems.length) return;
    var panes = splitPlaylists();
    var atEnd = centerTarget >= allItems.length - 1 && direction > 0;
    var atStart = centerTarget <= 0 && direction < 0;
    if (!shelfMergesCollections()) {
      if (hasAnyPlatformLogin() && userPlaylists.length && shelfPane === 'mine' && atEnd && panes.fav.length) {
        collectionReveal += Math.min(1.5, Math.abs(direction));
        if (collectionReveal >= 3) switchPane('fav');
        return;
      }
      if (hasAnyPlatformLogin() && userPlaylists.length && shelfPane === 'fav' && atStart && panes.mine.length) {
        collectionReveal += Math.min(1.5, Math.abs(direction));
        if (collectionReveal >= 3) switchPane('mine');
        return;
      }
    }
    collectionReveal = 0;
    var prevTarget = Math.round(centerTarget);
    centerTarget = Math.max(0, Math.min(allItems.length - 1, centerTarget + direction));
    var nextTarget = Math.round(centerTarget);
    paneMemory[shelfPane] = Math.max(0, Math.round(centerTarget));
    syncRenderedWindow(false);
    applySelectedIndex(nextTarget);
    if (nextTarget !== prevTarget) playShelfSelectTick(direction, 'card');
    pulseCard(cards.find(function (c) { return c.index === nextTarget; }), 0.55);
  }

  function screenHitCard(card, sx, sy, pad) {
    if (!card || !card.mesh || !card.mesh.visible || !group || !group.visible) return null;
    var params = card.mesh.geometry && card.mesh.geometry.parameters || {};
    var hw = (params.width || 1.7) / 2;
    var hh = (params.height || 0.85) / 2;
    var pts = [
      new THREE.Vector3(-hw, -hh, 0),
      new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0),
      new THREE.Vector3(-hw, hh, 0),
    ];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    card.mesh.updateMatrixWorld(true);
    for (var i = 0; i < pts.length; i++) {
      pts[i].applyMatrix4(card.mesh.matrixWorld).project(camera);
      var x = (pts[i].x + 1) * innerWidth / 2;
      var y = (1 - pts[i].y) * innerHeight / 2;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    pad = pad == null ? 28 : pad;
    if (sx < minX - pad || sx > maxX + pad || sy < minY - pad || sy > maxY + pad) return null;
    var u = clampRange((sx - minX) / Math.max(1, maxX - minX), 0, 1);
    var v = 1 - clampRange((sy - minY) / Math.max(1, maxY - minY), 0, 1);
    return { x: u, y: v };
  }

  function pickCardAtScreen(sx, sy, pad) {
    if (!cards.length || !group || !group.visible) return null;
    var ordered = cards.slice().sort(function (a, b) { return (b.mesh.renderOrder || 0) - (a.mesh.renderOrder || 0); });
    for (var i = 0; i < ordered.length; i++) {
      var uv = screenHitCard(ordered[i], sx, sy, pad == null ? 72 : pad);
      if (uv) return { card: ordered[i], uv: uv, screenPick: true };
    }
    return null;
  }

  return {
    setMode: function (m) {
      if (m === mode && group) return;
      mode = m;
      if (m === 'off') {
        disposeRenderedCards();
        if (group && group.parent) group.parent.remove(group);
        if (connectorParticles) {
          if (connectorParticles.parent) connectorParticles.parent.remove(connectorParticles);
          connectorParticles.geometry.dispose(); connectorParticles.material.dispose(); connectorParticles = null;
        }
        group = null;
        allItems = [];
        lastSig = '';
        lastUpdate = 0;
        centerIdx = centerTarget = centerSmooth = 0;
        selectedIdx = openCardIdx = -1;
        shelfPane = 'mine'; collectionReveal = 0;
        paneMemory.mine = paneMemory.fav = 0;
        paneSwitchAt = coverBindResumeUntil = -10;
        paneSwitchDir = 1;
        resetShared();
        // 宿主 dispose 必须同步释放详情资源并作废所有异步加载令牌；close 只是淡出。
        if (contentList) {
          var previousContent = contentList;
          contentList = null;
          previousContent.dispose();
        }
        return;
      }
      if (!group) {
        group = new THREE.Group();
        group.renderOrder = 50;
        scene.add(group);
      }
      var asyncCards = mode === 'side' && document.body.classList.contains('splash-active');
      rebuild(asyncCards);
    },
    getMode: function () { return mode; },
    update: function (dt) {
      if (!group) return;
      // PSP 滚动平滑
      centerSmooth += (centerTarget - centerSmooth) * 0.16;
      if (Math.abs(centerSmooth - centerTarget) < 0.001) centerSmooth = centerTarget;
      var px = pointerParallax.x, py = pointerParallax.y;
      var appRevealed = !document.body.classList.contains('splash-active');
      var cueVis = tickShelfHoverCue(dt);
      // v8: shelf 自动可见度 — 启动页期间不显示；侧栏只在右侧停留时淡入。
      var targetVis;
      if (!appRevealed) {
        targetVis = 0;
      } else if (mode === 'side') {
        var contentOpen = contentList && contentList.isOpen();
        var switchGuard = typeof shelfPlaybackSwitchGuardActive === 'function' && shelfPlaybackSwitchGuardActive();
        if (!allItems.length && !contentOpen) targetVis = 0;
        else if (switchGuard && !contentOpen && !shelfPinnedOpen) targetVis = 0;
        else targetVis = (contentOpen || shelfPinnedOpen || shelfAlwaysVisible()) ? 1.0 : (cueVis > 0.01 ? Math.max(0.16, cueVis * 0.88) : 0);
      } else {
        targetVis = allItems.length ? 1.0 : 0;
      }
      var summonVis = shelfSummonSettings();
      var visDuration = targetVis > shelfVisibility
        ? Math.max(0.05, summonVis.openDuration * 0.45)
        : Math.max(0.05, summonVis.closeDuration * 0.65);
      shelfVisibility += (targetVis - shelfVisibility) * durationEaseFactor(visDuration, dt);
      if (shelfVisibility < 0.01 && targetVis === 0) shelfVisibility = 0;
      group.visible = appRevealed && (mode !== 'side' || shelfVisibility > 0) && (allItems.length > 0 || (contentList && contentList.isOpen()));
      if (connectorParticles) connectorParticles.visible = group.visible && mode === 'stage';
      if (mode === 'side') {
        var contentOpenForLayer = !!(contentList && contentList.isOpen());
        var passiveAlwaysGroup = shelfAlwaysVisible() && !shelfPinnedOpen && !contentOpenForLayer;
        var pointerSelectionForeground = shelfPointerSelectionForegroundActive();
        var liftedCardActive = passiveAlwaysGroup && cards.some(function (c) {
          return (pointerSelectionForeground && c.selected) || (c.floatMix || 0) > 0.025;
        });
        group.renderOrder = (contentOpenForLayer || shelfPinnedOpen || liftedCardActive) ? 300 : 30;
        group.position.set(0, 0, 0);
        var bindToCover = (shelfAlwaysVisible() || shelfPinnedOpen || shelfVisibility > 0.06) && particles && particles.rotation && !(contentList && contentList.isOpen());
        if (bindToCover) {
          var bindEase = uniforms.uTime.value < coverBindResumeUntil ? 0.18 : 0.075;
          group.rotation.x += ((particles.rotation.x - py * 0.010) - group.rotation.x) * bindEase;
          group.rotation.y += ((particles.rotation.y + px * 0.018) - group.rotation.y) * bindEase;
          group.rotation.z += (particles.rotation.z - group.rotation.z) * bindEase;
        } else {
          group.rotation.y += ((px * 0.018) - group.rotation.y) * 0.045;
          group.rotation.x += ((-py * 0.010) - group.rotation.x) * 0.045;
          group.rotation.z += (0 - group.rotation.z) * 0.045;
        }
      } else {
        group.renderOrder = ((contentList && contentList.isOpen()) || selectedIdx >= 0) ? 300 : 30;
        var t = uniforms.uTime.value;
        group.position.y = Math.sin(t * 0.3) * 0.04;
        group.position.x = px * 0.10;
        group.rotation.y = px * 0.025;
        group.rotation.x = -py * 0.012;
      }
      var frameLook = shelfSettings();
      var frameLayout = shelfLayoutProfile(frameLook);
      for (var i = 0; i < cards.length; i++) {
        placeCard(cards[i], i, cards.length, mode, frameLayout, frameLook, summonVis);
      }
      // 内容更新 (节流)
      if (uniforms.uTime.value - lastUpdate > 0.8) {
        lastUpdate = uniforms.uTime.value;
        var nextItems = currentItems();
        var nextSig = sig(nextItems);
        if (nextSig !== lastSig) rebuild(false, nextItems, nextSig);
        else {
          var pulseBucket = Math.round((bass + beatPulse * 0.85) * 10);
          var redrawInterval = playing ? 1.35 : 4.0;
          if (pulseBucket !== lastCardPulseBucket || uniforms.uTime.value - lastCardRedrawAt > redrawInterval) {
            lastCardPulseBucket = pulseBucket;
            lastCardRedrawAt = uniforms.uTime.value;
            cards.forEach(function (c) {
              c.item = shelfItemAt(allItems, c.index) || c.item;
              c.isCenter = Math.abs(c.index - centerSmooth) < 0.5;
              if (c.isCenter || c.dofBucket <= 1 || c.index === currentIdx) drawCard(c, c.item);
            });
          }
        }
      }
      // 二级内容框 update
      if (contentList) contentList.update(dt, frameLayout.detail, frameLook);
    },
    onCoverChange: function () {
      coverBindResumeUntil = uniforms && uniforms.uTime ? uniforms.uTime.value + 1.2 : coverBindResumeUntil;
      if (group && mode === 'side' && (shelfAlwaysVisible() || shelfPinnedOpen || shelfVisibility > 0.06) && particles && particles.rotation && !(contentList && contentList.isOpen())) {
        group.rotation.x += (particles.rotation.x - group.rotation.x) * 0.28;
        group.rotation.y += (particles.rotation.y - group.rotation.y) * 0.28;
        group.rotation.z += (particles.rotation.z - group.rotation.z) * 0.28;
      }
      if (group && mode !== 'off' && uniforms.uTime.value - lastUpdate > 0.2) {
        lastUpdate = uniforms.uTime.value;
        rebuild();
      }
    },
    rebuild: rebuild,
    refreshTheme: function () {
      cards.forEach(function (c) {
        c.drawKey = '';
        drawCard(c, c.item);
      });
      if (contentList && contentList.refreshTheme) contentList.refreshTheme();
    },
    raycastCards: function (raycaster) {
      if (!group || !group.visible || !cards.length) return null;
      var visibleMeshes = cards.filter(function (c) { return c.mesh.visible; }).map(function (c) { return c.mesh; });
      var hits = raycaster.intersectObjects(visibleMeshes, false);
      if (!hits.length) return null;
      var card = cards.find(function (c) { return c.mesh === hits[0].object; });
      return { card: card, point: hits[0].point, uv: hits[0].uv };
    },
    pickCardAtScreen: pickCardAtScreen,
    // PSP 步进
    next: function () { step(1); },
    prev: function () { step(-1); },
    scrollBy: function (d) { step(d); },
    getCenterIdx: function () { return Math.round(centerSmooth); },
    getCardAt: function (idx) { return cards.find(function (c) { return c.index === idx; }); },
    getCards: function () { return cards; },
    playPlaylistAt: function (idx) {
      return playPlaylistCard(cards.find(function (c) { return c.index === idx; }));
    },
    clearSelected: function () {
      applySelectedIndex(-1);
    },
    setSelected: function (idx) {
      applySelectedIndex(idx);
    },
    triggerAction: function (action) {
      if (mode === 'off' || !group || !action) return;
      var card = cards.find(function (c) { return c.mesh.userData.action === action; });
      pulseCard(card, action.kind === 'loadPlaylist' ? 1.0 : 0.70);
      if (action.kind === 'playQueue') {
        playQueueAt(action.index);
      } else if (action.kind === 'loadPlaylist') {
        if (!contentList) contentList = makeContentListManager();
        openCardIdx = card ? card.index : -1;
        contentList.open(action.playlistId, action.title || (card && card.item.title), card);
        setShelfPinnedOpen(true, true);
        if (typeof updateEmptyHomeVisibility === 'function') updateEmptyHomeVisibility({ forceLoad: false });
        if (typeof setFocusZone === 'function') setFocusZone('shelf-detail', true);
      } else if (action.kind === 'empty') {
        togglePlaylistPanel(true);
      }
    },
    // 二级内容框 open/close
    openContent: function (cardIdx) {
      var card = cards.find(function (c) { return c.index === cardIdx; });
      if (!card) return;
      var action = card.mesh.userData.action;
      if (!action) return;
      pulseCard(card, 1.0);
      // queue 类型 → 直接播放, 不需要内容框
      if (action.kind === 'playQueue') {
        playQueueAt(action.index);
        return;
      }
      if (action.kind === 'loadPlaylist') {
        if (!contentList) contentList = makeContentListManager();
        openCardIdx = card.index;
        contentList.open(action.playlistId, action.title || card.item.title, card);
        setShelfPinnedOpen(true, true);
        if (typeof updateEmptyHomeVisibility === 'function') updateEmptyHomeVisibility({ forceLoad: false });
        if (typeof setFocusZone === 'function') setFocusZone('shelf-detail', true);
      }
      if (action.kind === 'empty') togglePlaylistPanel(true);
    },
    closeContent: function () {
      openCardIdx = -1;
      if (contentList) contentList.close();
      var hint = document.getElementById('hint');
      if (hint) hint.classList.toggle('shelf-hidden', shelfPinnedOpen);
      if (typeof setFocusZone === 'function') setFocusZone(shelfPinnedOpen ? 'shelf-side' : null, true);
      if (typeof updateEmptyHomeVisibility === 'function') updateEmptyHomeVisibility({ forceLoad: false });
    },
    hasOpenContent: function () { return contentList && contentList.isOpen(); },
    getContentList: function () { return contentList; },
    getOpenContentIndex: function () { return openCardIdx; },
    canInteract: function () { return mode !== 'off' && allItems.length > 0; }
  };
}


  // ============================================================
  //  导出：原版几何/手感函数 + 引擎工厂
  // ============================================================
  function createClassicShelfEngine(deps) {
    if (shelfManager) shelfManager.setMode('off');
    engineGeneration++;
    D = deps || {};
    THREE = D.THREE; scene = D.scene; camera = D.camera; renderer = D.renderer;
    uniforms = D.uniforms; particles = D.particles; pointerParallax = D.pointerParallax; fx = D.fx;
    playQueue = D.playQueue; currentIdx = D.currentIdx; playlistCoverCache = D.playlistCoverCache;
    bass = D.bass; beatPulse = D.beatPulse; playing = D.playing;
    songCoverSrc = D.songCoverSrc; queueItemKey = D.queueItemKey; compactCount = D.compactCount;
    requestPlaylistCover = D.requestPlaylistCover; readableInkForHex = D.readableInkForHex;
    shelfAccentHex = D.shelfAccentHex; shelfAccentRgba = D.shelfAccentRgba;
    shelfSettings = D.shelfSettings; shelfAlwaysVisible = D.shelfAlwaysVisible;
    shouldUseWallpaperSafeShelfCamera = D.shouldUseWallpaperSafeShelfCamera;
    shouldUseSkullSafeShelfCamera = D.shouldUseSkullSafeShelfCamera;
    shouldUseShelfDynamicCamera = D.shouldUseShelfDynamicCamera;
    hasAnyPlatformLogin = D.hasAnyPlatformLogin; userPlaylists = D.userPlaylists || [];
    myPodcastCollections = D.myPodcastCollections || []; playlistCatalogRevision = D.playlistCatalogRevision;
    pulseObjectValue = D.pulseObjectValue; showToast = D.showToast;
    playShelfSelectTick = D.playShelfSelectTick; setFocusZone = D.setFocusZone; setPeek = D.setPeek;
    updateEmptyHomeVisibility = D.updateEmptyHomeVisibility;
    loadPlaylistIntoQueueById = D.loadPlaylistIntoQueueById; playQueueAt = D.playQueueAt;
    setShelfMode = D.setShelfMode; togglePlaylistPanel = D.togglePlaylistPanel;
    suppressBottomControlsForShelf = D.suppressBottomControlsForShelf;
    restoreBottomControlsAfterShelfExit = D.restoreBottomControlsAfterShelfExit;
    scheduleLyricLayoutSave = D.scheduleLyricLayoutSave; saveLyricLayout = D.saveLyricLayout;
    setShelfHoverTabVisible = D.setShelfHoverTabVisible;
    isFullscreenPlaylistQueueFocusLockedAtEdge = D.isFullscreenPlaylistQueueFocusLockedAtEdge;
    isPointerOverUi = D.isPointerOverUi; clampRange = D.clampRange;
    visualGuideActive = D.visualGuideActive; emptyHomeActive = D.emptyHomeActive;
    homeForcedOpen = D.homeForcedOpen;
    safeShelfCloseContent = D.safeShelfCloseContent;
    makeContentListManager = D.makeContentListManager;

    syncLive();
    shelfManager = makeShelfManager();
    var engine = shelfManager;
    // 生命周期只允许一个活动实例。旧 manager 的延迟入口不能操纵后来注入的宿主。
    // 所有入口统一同步；嵌套 clearSelected 等方法不得重新读入动作前的 pin 状态。
    Object.keys(engine).forEach(function (key) {
      if (typeof engine[key] === 'function') engine[key] = liveEntry(engine[key], engineGeneration);
    });
    return engine;
  }

  return {
    createClassicShelfEngine: createClassicShelfEngine,
    settings: liveEntry(function () { return shelfSettings(); }),
    detailSettings: liveEntry(shelfDetailSettings),
    summonSettings: liveEntry(shelfSummonSettings),
    // 原版几何/热区/悬停手感；所有公开入口读取实时宿主输入。
    isPortraitShelfViewport: liveEntry(isPortraitShelfViewport),
    shelfLayoutProfile: liveEntry(shelfLayoutProfile),
    shelfHotZoneWidth: liveEntry(shelfHotZoneWidth),
    shelfPreviewUseZoneWidth: liveEntry(shelfPreviewUseZoneWidth),
    shelfWheelZoneWidth: liveEntry(shelfWheelZoneWidth),
    isShelfClickZone: liveEntry(isShelfClickZone),
    isShelfPreviewUseZone: liveEntry(isShelfPreviewUseZone),
    isShelfWheelZone: liveEntry(isShelfWheelZone),
    canUseSideShelfWithoutPinnedOpen: liveEntry(canUseSideShelfWithoutPinnedOpen),
    shelfPreviewIsVisible: liveEntry(shelfPreviewIsVisible),
    shelfAutoHiddenInputReady: liveEntry(shelfAutoHiddenInputReady),
    canShowShelfHoverCueAt: liveEntry(canShowShelfHoverCueAt),
    shelfCueRect: liveEntry(shelfCueRect),
    shelfCueCenter: liveEntry(shelfCueCenter),
    setShelfGuideCueActive: liveEntry(setShelfGuideCueActive),
    updateShelfHoverCueFromPointer: liveEntry(updateShelfHoverCueFromPointer),
    tickShelfHoverCue: liveEntry(tickShelfHoverCue),
    setShelfPinnedOpen: liveEntry(setShelfPinnedOpen),
    clearShelfPreviewOnPointerExit: liveEntry(clearShelfPreviewOnPointerExit),
    suppressShelfPreviewForPlaybackSwitch: liveEntry(suppressShelfPreviewForPlaybackSwitch),
    shelfPlaybackSwitchGuardActive: liveEntry(shelfPlaybackSwitchGuardActive),
    markShelfPlaybackSwitchGuard: liveEntry(markShelfPlaybackSwitchGuard),
    syncLive: syncLive,
    CLASSIC_FX_DEFAULTS: CLASSIC_FX_DEFAULTS
  };
})();
