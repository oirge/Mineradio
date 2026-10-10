import { createRequire } from 'module';
import { describe, expect, it, vi } from 'vitest';

// Verifies the main-process blocker never leaks or starts duplicate blockers.
const require = createRequire(import.meta.url);
const { createDisplaySleepBlocker } = require('../../../electron/displaySleepBlocker.cjs') as {
    createDisplaySleepBlocker: (powerSaveBlocker: {
        start: (type: string) => number;
        stop: (id: number) => void;
        isStarted: (id: number) => boolean;
    }) => { setActive: (active: boolean) => boolean; stop: () => boolean };
};

describe('displaySleepBlocker', () => {
    it('starts prevent-display-sleep once and stops it when playback is inactive', () => {
        let started = false;
        const powerSaveBlocker = {
            start: vi.fn(() => { started = true; return 7; }),
            stop: vi.fn(() => { started = false; }),
            isStarted: vi.fn(() => started),
        };
        const blocker = createDisplaySleepBlocker(powerSaveBlocker);

        expect(blocker.setActive(true)).toBe(true);
        expect(blocker.setActive(true)).toBe(true);
        expect(powerSaveBlocker.start).toHaveBeenCalledOnce();
        expect(powerSaveBlocker.start).toHaveBeenCalledWith('prevent-display-sleep');

        expect(blocker.setActive(false)).toBe(true);
        expect(powerSaveBlocker.stop).toHaveBeenCalledWith(7);
        expect(blocker.setActive(false)).toBe(false);
    });
});
