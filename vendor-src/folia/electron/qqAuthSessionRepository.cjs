// electron/qqAuthSessionRepository.cjs
//
// Persists the QQ API's server-side credential state in Electron's main process. The renderer keeps
// only the opaque `qqmusic_session` token; musickey, refresh keys and device context are encrypted
// before electron-store writes them to disk and are never sent over IPC.

const SESSION_KEY = 'QQ_API_AUTH_SESSION_V1';
const ENVELOPE_VERSION = 1;

function assertEncryptionAvailable(safeStorage, platform) {
  if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function') {
    throw new Error('Electron safeStorage is unavailable');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Electron safeStorage encryption is unavailable');
  }

  // On Linux Electron may fall back to `basic_text` when no secret store is available. That backend
  // only obfuscates data, so refusing it is safer than silently persisting a QQ musickey in plaintext.
  const backend = platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function'
    ? safeStorage.getSelectedStorageBackend()
    : null;
  if (backend === 'basic_text') {
    throw new Error('Electron safeStorage selected the unencrypted basic_text backend');
  }
}

function createQqAuthSessionRepository({ store, safeStorage, platform = process.platform }) {
  if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') {
    throw new TypeError('A compatible electron-store instance is required');
  }

  return {
    kind: 'electron-safe-storage',
    load() {
      const encoded = store.get(SESSION_KEY);
      if (encoded === undefined || encoded === null) {
        return [];
      }
      if (typeof encoded !== 'string' || encoded.length === 0) {
        throw new Error('Stored QQ auth session payload is invalid');
      }

      assertEncryptionAvailable(safeStorage, platform);
      const plaintext = safeStorage.decryptString(Buffer.from(encoded, 'base64'));
      const envelope = JSON.parse(plaintext);
      if (
        !envelope ||
        typeof envelope !== 'object' ||
        envelope.version !== ENVELOPE_VERSION ||
        !Array.isArray(envelope.sessions)
      ) {
        throw new Error('Stored QQ auth session envelope is invalid');
      }
      return envelope.sessions;
    },
    save(sessions) {
      if (!Array.isArray(sessions)) {
        throw new TypeError('QQ auth sessions must be an array');
      }
      if (sessions.length === 0) {
        // Logout and TTL cleanup must still be able to remove stale ciphertext even when the OS
        // keychain becomes temporarily unavailable after the record was originally created.
        if (typeof store.delete === 'function') {
          store.delete(SESSION_KEY);
        } else {
          store.set(SESSION_KEY, undefined);
        }
        return;
      }

      assertEncryptionAvailable(safeStorage, platform);
      const plaintext = JSON.stringify({ version: ENVELOPE_VERSION, sessions });
      const encrypted = safeStorage.encryptString(plaintext);
      store.set(SESSION_KEY, encrypted.toString('base64'));
    },
  };
}

module.exports = {
  SESSION_KEY,
  createQqAuthSessionRepository,
};
