import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStatusMessageStore } from '@/stores/useStatusMessageStore';
import { useSleepTimerStore } from '@/stores/useSleepTimerStore';

// test/unit/stores/sleepTimerState.test.ts

describe('sleep timer settings state', () => {
    let values: Map<string, string>;

    beforeEach(() => {
        values = new Map();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        };
        vi.stubGlobal('localStorage', storage);
        vi.stubGlobal('window', { localStorage: storage });
        useSleepTimerStore.setState({ sleepTimerEnabled: false, sleepTimerHours: 0, sleepTimerMinutes: 0, sleepTimerDeadlineMs: null, sleepTimerActivationId: 0 });
        useStatusMessageStore.setState({ message: null });
    });

    afterEach(() => {
        useSleepTimerStore.setState({ sleepTimerEnabled: false, sleepTimerHours: 0, sleepTimerMinutes: 0, sleepTimerDeadlineMs: null, sleepTimerActivationId: 0 });
        useStatusMessageStore.setState({ message: null });
        vi.unstubAllGlobals();
    });

    it('does not arm a zero-duration timer or persist the armed state', () => {
        useSleepTimerStore.getState().handleToggleSleepTimer(true);

        expect(useSleepTimerStore.getState().sleepTimerEnabled).toBe(false);
        expect(useStatusMessageStore.getState().message).toMatchObject({ type: 'error' });
        expect(values.has('sleep_timer_enabled')).toBe(false);
    });

    it('keeps the preferred duration but disarms when it becomes zero', () => {
        useSleepTimerStore.getState().handleSetSleepTimerMinutes(30);
        useSleepTimerStore.getState().handleToggleSleepTimer(true);
        expect(useSleepTimerStore.getState()).toMatchObject({ sleepTimerEnabled: true, sleepTimerMinutes: 30 });

        useSleepTimerStore.getState().handleSetSleepTimerMinutes(0);

        expect(useSleepTimerStore.getState()).toMatchObject({
            sleepTimerEnabled: false,
            sleepTimerHours: 0,
            sleepTimerMinutes: 0,
        });
        expect(values.get('sleep_timer_minutes')).toBe('0');
        expect(values.has('sleep_timer_enabled')).toBe(false);
    });

    it('creates a new activation when an enabled timer is started with the same duration', () => {
        useSleepTimerStore.getState().handleSetSleepTimerMinutes(30);
        useSleepTimerStore.getState().handleToggleSleepTimer(true);
        const firstActivationId = useSleepTimerStore.getState().sleepTimerActivationId;

        useSleepTimerStore.getState().handleToggleSleepTimer(true);

        expect(useSleepTimerStore.getState()).toMatchObject({
            sleepTimerEnabled: true,
            sleepTimerMinutes: 30,
            sleepTimerActivationId: firstActivationId + 1,
        });
    });
});
