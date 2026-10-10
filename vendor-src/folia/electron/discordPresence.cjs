const DISCORD_PRESENCE_UPDATE_INTERVAL_MS = 15_000;
const DISCORD_ACTIVITY_TYPE_LISTENING = 2;
const DEFAULT_DISCORD_APPLICATION_ID = '1518508445483925645';

// electron/discordPresence.cjs
// Maintains Discord Rich Presence from the main-process playback snapshot.

function normalizeDiscordApplicationId(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return /^\d{16,24}$/.test(trimmed) ? trimmed : '';
}

function normalizeDiscordImageUrl(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost')
    ) {
      return '';
    }
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
    }
    return url.toString();
  } catch {
    return '';
  }
}

function getSnapshotTimestamp(snapshot) {
  const updatedAt = Number(snapshot?.updatedAt);
  return Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now();
}

function buildDiscordActivity(snapshot) {
  if (!snapshot || !snapshot.hasTrack || !snapshot.title) {
    return null;
  }

  const title = String(snapshot.title).slice(0, 128);
  const artist = typeof snapshot.artist === 'string' && snapshot.artist.trim()
    ? snapshot.artist.trim().slice(0, 128)
    : 'Folia';
  const playerState = snapshot.playerState === 'PLAYING' ? 'PLAYING' : 'PAUSED';
  const duration = Number(snapshot.duration);
  const currentTime = Math.max(0, Number(snapshot.currentTime) || 0);
  const hasFiniteDuration = Number.isFinite(duration) && duration > currentTime + 1;
  const coverImageUrl = normalizeDiscordImageUrl(snapshot.coverUrl);

  const activity = {
    name: 'Folia',
    type: DISCORD_ACTIVITY_TYPE_LISTENING,
    details: title,
    state: playerState === 'PLAYING' ? artist : `Paused - ${artist}`,
    largeImageText: coverImageUrl ? title : 'Folia',
    smallImageText: playerState === 'PLAYING' ? 'Playing' : 'Paused',
    instance: false,
  };

  if (coverImageUrl) {
    activity.largeImageKey = coverImageUrl;
  }

  if (playerState === 'PLAYING' && hasFiniteDuration) {
    const sampledAt = getSnapshotTimestamp(snapshot);
    activity.startTimestamp = Math.max(0, sampledAt - currentTime * 1000);
    activity.endTimestamp = sampledAt + (duration - currentTime) * 1000;
  }

  return activity;
}

function getActivityKey(activity) {
  if (!activity) {
    return 'empty';
  }
  return JSON.stringify({
    details: activity.details,
    state: activity.state,
    largeImageKey: activity.largeImageKey,
    startTimestamp: activity.startTimestamp ? Math.round(activity.startTimestamp / 1000) : null,
    endTimestamp: activity.endTimestamp ? Math.round(activity.endTimestamp / 1000) : null,
  });
}

function createDiscordPresenceController({
  getApplicationId,
  isEnabled,
  onStatusChange,
} = {}) {
  let client = null;
  let connectingPromise = null;
  let currentApplicationId = '';
  let lastActivityKey = '';
  let lastUpdateAt = 0;
  let lastSnapshot = null;
  let status = {
    enabled: false,
    configured: false,
    connected: false,
    error: null,
    applicationId: null,
    updatedAt: Date.now(),
  };

  const publishStatus = (patch = {}) => {
    const nextStatus = {
      ...status,
      ...patch,
      updatedAt: Date.now(),
    };
    if (
      nextStatus.enabled === status.enabled &&
      nextStatus.configured === status.configured &&
      nextStatus.connected === status.connected &&
      nextStatus.error === status.error &&
      nextStatus.applicationId === status.applicationId
    ) {
      return status;
    }
    status = nextStatus;
    onStatusChange?.(status);
    return status;
  };

  const getStatus = () => ({ ...status });

  const destroyClient = async () => {
    const activeClient = client;
    client = null;
    connectingPromise = null;
    lastActivityKey = '';
    lastUpdateAt = 0;
    if (!activeClient) {
      return;
    }
    try {
      await activeClient.user?.clearActivity?.(process.pid);
    } catch {
      // Clearing presence is best-effort; Discord may already be closed.
    }
    try {
      await activeClient.destroy();
    } catch {
      // The local Discord IPC can disappear at any time.
    }
  };

  const ensureClient = async () => {
    const applicationId = normalizeDiscordApplicationId(getApplicationId?.());
    const enabled = Boolean(isEnabled?.());
    publishStatus({
      enabled,
      configured: Boolean(applicationId),
      applicationId: applicationId || null,
    });

    if (!enabled || !applicationId) {
      await destroyClient();
      publishStatus({
        connected: false,
        error: enabled ? 'Discord application identity is unavailable.' : null,
      });
      return null;
    }

    if (client && currentApplicationId === applicationId && client.isConnected) {
      return client;
    }

    if (connectingPromise && currentApplicationId === applicationId) {
      return connectingPromise;
    }

    await destroyClient();
    currentApplicationId = applicationId;

    connectingPromise = Promise.resolve()
      .then(() => {
        const { Client } = require('@xhayper/discord-rpc');
        const nextClient = new Client({
          clientId: applicationId,
          transport: { type: 'ipc' },
        });
        nextClient.on('disconnected', () => {
          if (client === nextClient) {
            publishStatus({ connected: false, error: 'Discord disconnected.' });
          }
        });
        return nextClient.login().then(() => {
          client = nextClient;
          publishStatus({ connected: true, error: null });
          return nextClient;
        });
      })
      .catch((error) => {
        client = null;
        publishStatus({
          connected: false,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      })
      .finally(() => {
        connectingPromise = null;
      });

    return connectingPromise;
  };

  const publishSnapshot = async (snapshot) => {
    lastSnapshot = snapshot || null;
    const activity = buildDiscordActivity(lastSnapshot);
    const activeClient = await ensureClient();
    if (!activeClient) {
      return getStatus();
    }

    if (!activity) {
      if (lastActivityKey !== 'empty') {
        try {
          await activeClient.user?.clearActivity?.(process.pid);
          lastActivityKey = 'empty';
          publishStatus({ connected: true, error: null });
        } catch (error) {
          publishStatus({ connected: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return getStatus();
    }

    const activityKey = getActivityKey(activity);
    const now = Date.now();
    if (activityKey === lastActivityKey && now - lastUpdateAt < DISCORD_PRESENCE_UPDATE_INTERVAL_MS) {
      return getStatus();
    }

    try {
      await activeClient.user?.setActivity(activity, process.pid);
      lastActivityKey = activityKey;
      lastUpdateAt = now;
      publishStatus({ connected: true, error: null });
    } catch (error) {
      publishStatus({ connected: false, error: error instanceof Error ? error.message : String(error) });
    }
    return getStatus();
  };

  const refresh = async () => {
    return publishSnapshot(lastSnapshot);
  };

  return {
    getStatus,
    publishSnapshot,
    refresh,
    destroy: destroyClient,
  };
}

module.exports = {
  buildDiscordActivity,
  createDiscordPresenceController,
  DEFAULT_DISCORD_APPLICATION_ID,
  normalizeDiscordApplicationId,
  normalizeDiscordImageUrl,
};
