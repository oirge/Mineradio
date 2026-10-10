const crypto = require('node:crypto');

// electron/bodian/session.cjs

const SESSION_KEY = 'BODIAN_SESSION_V2';
const DEVICE_KEY = 'BODIAN_DEVICE_ID';

// Credentials are loaded lazily, after Electron's OS encryption service becomes available.
function createSessionRepository({ store, safeStorage, warn = console.warn }) {
  let loaded = false;
  let current = null;
  let revision = 0;
  const canEncrypt = () => safeStorage?.isEncryptionAvailable()
    && safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
  let deviceId = store.get(DEVICE_KEY);
  if (typeof deviceId !== 'string' || !/^[a-f0-9]{32}$/.test(deviceId)) {
    deviceId = crypto.randomBytes(16).toString('hex');
    store.set(DEVICE_KEY, deviceId);
  }
  return {
    deviceId,
    get revision() { return revision; },
    get() {
      if (loaded) return current;
      loaded = true;
      try {
        const sealed = store.get(SESSION_KEY);
        if (typeof sealed !== 'string' || !canEncrypt()) return null;
        const value = JSON.parse(safeStorage.decryptString(Buffer.from(sealed, 'base64')));
        if (value.version === 2 && /^[1-9]\d{0,19}$/.test(value.uid) && value.user?.id === value.uid
          && typeof value.token === 'string' && value.token) current = value;
      } catch { warn('[BodianSession] Encrypted session could not be restored'); }
      return current;
    },
    set(value) {
      loaded = true;
      current = { version: 2, uid: String(value.uid), token: value.token, user: value.user };
      revision++;
      try {
        if (!canEncrypt()) throw new Error('Encryption unavailable');
        store.set(SESSION_KEY, safeStorage.encryptString(JSON.stringify(current)).toString('base64'));
      } catch {
        store.delete(SESSION_KEY);
        warn('[BodianSession] Login is available for this run only; OS encryption is unavailable');
      }
    },
    clear() {
      loaded = true;
      current = null;
      revision++;
      store.delete(SESSION_KEY);
    },
  };
}

module.exports = { createSessionRepository, SESSION_KEY, DEVICE_KEY };
