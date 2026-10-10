import { describe, expect, it, vi } from 'vitest';

// test/unit/electron/qqAuthSessionRepository.test.ts

const {
    SESSION_KEY,
    createQqAuthSessionRepository,
} = require('../../../electron/qqAuthSessionRepository.cjs') as {
    SESSION_KEY: string;
    createQqAuthSessionRepository: (options: Record<string, unknown>) => {
        kind: string;
        load: () => unknown;
        save: (sessions: unknown[]) => void;
    };
};

function createStore() {
    const values = new Map<string, unknown>();
    return {
        values,
        get: vi.fn((key: string) => values.get(key)),
        set: vi.fn((key: string, value: unknown) => values.set(key, value)),
        delete: vi.fn((key: string) => values.delete(key)),
    };
}

// Reversible byte transformation: deterministic enough for the unit test while ensuring the fake
// disk value is not merely the plaintext JSON wrapped in base64.
function createSafeStorage(backend = 'dpapi') {
    return {
        isEncryptionAvailable: vi.fn(() => true),
        getSelectedStorageBackend: vi.fn(() => backend),
        encryptString: vi.fn((plaintext: string): Buffer =>
            Buffer.from(Buffer.from(plaintext, 'utf8').map((byte) => byte ^ 0xa5))),
        decryptString: vi.fn((ciphertext: Buffer) =>
            Buffer.from(Buffer.from(ciphertext).map((byte) => byte ^ 0xa5)).toString('utf8')),
    };
}

describe('QQ auth session repository', () => {
    it('round-trips sessions while electron-store sees ciphertext only', () => {
        const store = createStore();
        const safeStorage = createSafeStorage();
        const repository = createQqAuthSessionRepository({ store, safeStorage });
        const sessions = [{
            token: 'opaque-token',
            credential: { musicid: 123, musickey: 'qq-secret-musickey', loginType: 6 },
            device: { androidId: 'device-id' },
            expiresAt: 1_000_000,
        }];

        repository.save(sessions);

        const persisted = store.values.get(SESSION_KEY);
        expect(persisted).toEqual(expect.any(String));
        expect(persisted).not.toContain('opaque-token');
        expect(persisted).not.toContain('qq-secret-musickey');
        expect(repository.load()).toEqual(sessions);
        expect(repository.kind).toBe('electron-safe-storage');
        if (process.platform !== 'linux') {
            expect(safeStorage.getSelectedStorageBackend).not.toHaveBeenCalled();
        }
    });

    it('refuses Linux basic_text instead of persisting credentials without encryption', () => {
        const store = createStore();
        const repository = createQqAuthSessionRepository({
            store,
            safeStorage: createSafeStorage('basic_text'),
            platform: 'linux',
        });

        expect(() => repository.save([{ token: 'opaque-token' }]))
            .toThrow(/unencrypted basic_text/);
        expect(store.set).not.toHaveBeenCalled();
    });

    it('can clear stale ciphertext even if encryption becomes unavailable', () => {
        const store = createStore();
        store.values.set(SESSION_KEY, 'stale-ciphertext');
        const safeStorage = {
            isEncryptionAvailable: vi.fn(() => false),
        };
        const repository = createQqAuthSessionRepository({ store, safeStorage });

        repository.save([]);

        expect(store.delete).toHaveBeenCalledWith(SESSION_KEY);
        expect(store.values.has(SESSION_KEY)).toBe(false);
    });
});
