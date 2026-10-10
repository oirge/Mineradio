import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

// test/unit/electron/windowPlaybackHandoff.test.ts
// Locks down the short-lived main-process playback handoff store.

const require = createRequire(import.meta.url);
const { createWindowPlaybackHandoffStore } = require('../../../electron/windowPlaybackHandoff.cjs') as {
    createWindowPlaybackHandoffStore: (options?: {
        ttlMs?: number;
        now?: () => number;
        storage?: {
            get: (key: string) => unknown;
            set: (key: string, value: unknown) => void;
            delete: (key: string) => void;
        };
        storageKey?: string;
    }) => {
        clear: () => void;
        consume: () => unknown | null;
        peek: () => unknown | null;
        save: (handoff: unknown) => boolean;
    };
};

// Minimal electron-store-like backing so the disk-backed path can be exercised in-process.
const createMemoryStorage = (): {
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => void;
    delete: (key: string) => void;
} => {
    const data = new Map<string, unknown>();
    return {
        get: (key) => data.get(key),
        set: (key, value) => { data.set(key, value); },
        delete: (key) => { data.delete(key); },
    };
};

describe('windowPlaybackHandoffStore', () => {
    it('consumes a saved handoff only once', () => {
        let now = 1000;
        const store = createWindowPlaybackHandoffStore({ ttlMs: 5000, now: () => now });
        const handoff = { version: 1, capturedAt: now };

        expect(store.save(handoff)).toBe(true);
        expect(store.peek()).toBe(handoff);
        expect(store.consume()).toBe(handoff);
        expect(store.consume()).toBeNull();
    });

    it('drops expired handoffs', () => {
        let now = 1000;
        const store = createWindowPlaybackHandoffStore({ ttlMs: 100, now: () => now });

        store.save({ version: 1, capturedAt: now });
        now = 1101;

        expect(store.peek()).toBeNull();
        expect(store.consume()).toBeNull();
    });

    it('clears the current handoff when saving invalid payloads', () => {
        const store = createWindowPlaybackHandoffStore();

        store.save({ version: 1, capturedAt: 1 });
        expect(store.save(null)).toBe(false);

        expect(store.consume()).toBeNull();
    });

    it('persists a handoff to storage so a fresh store instance can restore it', () => {
        let now = 1000;
        const storage = createMemoryStorage();

        const first = createWindowPlaybackHandoffStore({ ttlMs: 5000, now: () => now, storage });
        expect(first.save({ version: 1, capturedAt: now })).toBe(true);

        // Simulate a process relaunch: a brand-new store over the same backing restores it,
        // and the restore consumes (clears) the persisted entry exactly once.
        const relaunched = createWindowPlaybackHandoffStore({ ttlMs: 5000, now: () => now, storage });
        expect(relaunched.peek()).toEqual({ version: 1, capturedAt: now });
        expect(relaunched.consume()).toEqual({ version: 1, capturedAt: now });
        expect(relaunched.consume()).toBeNull();
    });

    it('drops a persisted handoff that expired while the process was away', () => {
        let now = 1000;
        const storage = createMemoryStorage();

        createWindowPlaybackHandoffStore({ ttlMs: 100, now: () => now, storage })
            .save({ version: 1, capturedAt: now });
        now = 5000;

        const relaunched = createWindowPlaybackHandoffStore({ ttlMs: 100, now: () => now, storage });
        expect(relaunched.consume()).toBeNull();
        expect(relaunched.peek()).toBeNull();
    });

    it('persists an in-memory-only store only when a backing storage is provided', () => {
        const store = createWindowPlaybackHandoffStore();

        expect(store.save({ version: 1, capturedAt: 1 })).toBe(true);
        expect(store.consume()).toEqual({ version: 1, capturedAt: 1 });
    });
});
