// Keeps Electron's display sleep blocker lifecycle idempotent across playback updates.
function createDisplaySleepBlocker(powerSaveBlocker) {
  let blockerId = null;

  const stop = () => {
    if (blockerId === null) return false;
    if (powerSaveBlocker.isStarted(blockerId)) {
      powerSaveBlocker.stop(blockerId);
    }
    blockerId = null;
    return true;
  };

  const setActive = (active) => {
    if (!active) return stop();
    if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) return true;
    blockerId = powerSaveBlocker.start('prevent-display-sleep');
    return powerSaveBlocker.isStarted(blockerId);
  };

  return { setActive, stop };
}

module.exports = { createDisplaySleepBlocker };
