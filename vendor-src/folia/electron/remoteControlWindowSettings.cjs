// electron/remoteControlWindowSettings.cjs
// Pure helpers for the remote control window's "hide floating bar" and "click-through" switches.

const REMOTE_CONTROL_HIDE_TITLEBAR_SETTING_KEY = 'REMOTE_CONTROL_HIDE_TITLEBAR';
const REMOTE_CONTROL_CLICK_THROUGH_SETTING_KEY = 'REMOTE_CONTROL_CLICK_THROUGH';

/** Reads both switches from a settings reader; both default to off. */
function readRemoteControlWindowSettings(readBoolean) {
  return {
    hideTitlebar: Boolean(readBoolean(REMOTE_CONTROL_HIDE_TITLEBAR_SETTING_KEY, false)),
    clickThrough: Boolean(readBoolean(REMOTE_CONTROL_CLICK_THROUGH_SETTING_KEY, false)),
  };
}

/** The tray "unlock" item only makes sense while the window is open and ignoring the mouse. */
function shouldShowRemoteUnlockTrayItem({ remoteOpen, clickThrough }) {
  return Boolean(remoteOpen) && Boolean(clickThrough);
}

/**
 * Applies click-through to the remote window. Mouse events are deliberately NOT forwarded: the
 * page must never see hover/move events while it is click-through, so no hover state can latch.
 */
function applyRemoteControlMouseIgnore(win, clickThrough) {
  if (!win || (typeof win.isDestroyed === 'function' && win.isDestroyed())) {
    return false;
  }

  win.setIgnoreMouseEvents(Boolean(clickThrough));
  return Boolean(clickThrough);
}

module.exports = {
  REMOTE_CONTROL_HIDE_TITLEBAR_SETTING_KEY,
  REMOTE_CONTROL_CLICK_THROUGH_SETTING_KEY,
  readRemoteControlWindowSettings,
  shouldShowRemoteUnlockTrayItem,
  applyRemoteControlMouseIgnore,
};
