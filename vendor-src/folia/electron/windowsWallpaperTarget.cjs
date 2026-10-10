// electron/windowsWallpaperTarget.cjs
// Target-display resolution for Windows wallpaper mode: which monitor the wallpaper window fills.
// The wallpaper follows the main window — the display the app window was on when wallpaper mode
// was entered — instead of always going to the primary display.
//
// Resolution order (see docs/wallpaper-mode.md):
//   1. the live ordinary main window ("the app window is right there"); outranks the session
//      target because wallpaper mode off + window moved must re-target on the next entry, and a
//      maximized window never updates WINDOW_BOUNDS
//   2. the session's target, remembered once resolved (window rebuilds and display changes inside
//      one wallpaper session all keep the same monitor)
//   3. WINDOW_BOUNDS — the last ordinary-window geometry, which wallpaper geometry never
//      overwrites (see saveWindowState), i.e. "where the app window was last time" for the
//      startup-with-wallpaper-mode and destroyed-window recovery paths
//   4. the primary display (no stored origin, or the remembered display is unplugged)
//
// The helper is deliberately not told about the monitor: it fills whichever display the window
// sits on (MonitorFromWindow), so placing the window correctly is the whole contract here.
//
// All side effects are injected so the decision table is unit-testable headless.

// Electron reports -1 for a display whose id is not known yet and -10 for a virtual display on a
// unified desktop; neither can be matched against a later display list, so those fall back to
// matching by geometry.
function isUsableDisplayId(id) {
  return Number.isInteger(id) && id > 0;
}

function hasOrigin(bounds) {
  return Boolean(bounds)
    && typeof bounds.x === 'number'
    && typeof bounds.y === 'number'
    && typeof bounds.width === 'number'
    && typeof bounds.height === 'number';
}

function sameBounds(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function boundsIntersect(a, b) {
  const horizontalOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const verticalOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

  return horizontalOverlap > 0 && verticalOverlap > 0;
}

function createWindowsWallpaperTargetResolver(options = {}) {
  const { screen, getStoredBounds, getMainWindow } = options;

  // { id, bounds } of the display this session's wallpaper belongs to; null until resolved.
  let sessionTarget = null;

  function snapshot(display) {
    if (!display || !hasOrigin(display.bounds)) {
      sessionTarget = null;
      return null;
    }
    sessionTarget = {
      id: display.id,
      bounds: {
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
      },
    };
    return display;
  }

  // Screen lookups can throw (or report nothing) while the display topology is changing. The
  // resolution feeds window creation, so it degrades to "no display" instead of throwing.
  function safeDisplay(lookup) {
    try {
      return lookup() ?? null;
    } catch (error) {
      return null;
    }
  }

  // Matches the remembered display against the live list: by id when the platform reported a
  // usable one, by exact geometry otherwise (also covers an id that changed across the session).
  function matchSessionTarget(displays) {
    if (!sessionTarget) {
      return null;
    }
    if (isUsableDisplayId(sessionTarget.id)) {
      const byId = displays.find((display) => display.id === sessionTarget.id);
      if (byId) {
        return byId;
      }
    }
    return displays.find((display) => hasOrigin(display.bounds) && sameBounds(display.bounds, sessionTarget.bounds)) || null;
  }

  // The main window while it is still an ordinary window: a wallpaper window's geometry is the
  // display itself, so it is not a usable source of "where the user put the window".
  function getOrdinaryMainWindow() {
    const win = getMainWindow?.();
    if (!win || win.isDestroyed() || win.__wallpaperGeometry === true) {
      return null;
    }
    return win;
  }

  function displayForBounds(bounds) {
    if (!hasOrigin(bounds)) {
      return safeDisplay(() => screen.getPrimaryDisplay());
    }
    const matched = safeDisplay(() => screen.getDisplayMatching(bounds));
    // getDisplayMatching answers "nearest" for a rect that intersects nothing (a monitor the user
    // unplugged, a stale WINDOW_BOUNDS); the wallpaper goes to the primary display instead of
    // following that guess.
    if (matched && hasOrigin(matched.bounds) && boundsIntersect(bounds, matched.bounds)) {
      return matched;
    }
    return safeDisplay(() => screen.getPrimaryDisplay());
  }

  function resolve() {
    const displays = safeDisplay(() => screen.getAllDisplays()) ?? [];
    if (!displays.length) {
      return snapshot(safeDisplay(() => screen.getPrimaryDisplay()));
    }

    const liveWindow = getOrdinaryMainWindow();
    if (liveWindow) {
      return snapshot(displayForBounds(liveWindow.getBounds()));
    }

    const remembered = matchSessionTarget(displays);
    if (remembered) {
      return snapshot(remembered);
    }
    sessionTarget = null; // the remembered display is gone (unplugged)

    return snapshot(displayForBounds(getStoredBounds?.()));
  }

  // Captures the display of the window that is about to be replaced by the wallpaper window. Must
  // be called while that window is still alive: a maximized window's WINDOW_BOUNDS is stale (see
  // persistWindowStateSnapshot), so the stored-geometry path alone would pick the wrong monitor.
  function rememberFromWindow(win) {
    if (!win || win.isDestroyed() || win.__wallpaperGeometry === true) {
      return null;
    }
    return snapshot(displayForBounds(win.getBounds()));
  }

  function clear() {
    sessionTarget = null;
  }

  return {
    resolve,
    rememberFromWindow,
    clear,
  };
}

module.exports = {
  createWindowsWallpaperTargetResolver,
  isUsableDisplayId,
};
