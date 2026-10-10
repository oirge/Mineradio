// src/stores/useSleepTimerStore.ts
// The sleep timer: the configured duration plus the armed deadline.
//
// Split out of useSettingsUiStore. The deadline and activation id are runtime state rather than
// settings, which is precisely why they no longer sit in the settings snapshot.

import { create } from 'zustand';
import i18n from '../i18n/config';
import { setStatusMessage } from './useStatusMessageStore';

export const SLEEP_TIMER_HOURS_STORAGE_KEY = 'sleep_timer_hours';

export const SLEEP_TIMER_MINUTES_STORAGE_KEY = 'sleep_timer_minutes';

const readStoredSleepTimerPart = (key: string, max: number): number => {
    if (typeof window === 'undefined') {
        return 0;
    }

    const saved = Number(localStorage.getItem(key));
    return Number.isInteger(saved) && saved >= 0 && saved <= max ? saved : 0;
};

const readStoredSleepTimerHours = () => readStoredSleepTimerPart(SLEEP_TIMER_HOURS_STORAGE_KEY, 999);

const readStoredSleepTimerMinutes = () => readStoredSleepTimerPart(SLEEP_TIMER_MINUTES_STORAGE_KEY, 59);

export type SleepTimerState = {
    sleepTimerEnabled: boolean;
    sleepTimerHours: number;
    sleepTimerMinutes: number;
    sleepTimerDeadlineMs: number | null;
    sleepTimerActivationId: number;
    handleToggleSleepTimer: (enable: boolean) => void;
    handleSetSleepTimerHours: (hours: number) => void;
    handleSetSleepTimerMinutes: (minutes: number) => void;
};

export const useSleepTimerStore = create<SleepTimerState>((set, get) => ({
    // A sleep timer is a one-shot action. Persist its preferred duration, never an armed state.
    sleepTimerEnabled: false,
    sleepTimerHours: readStoredSleepTimerHours(),
    sleepTimerMinutes: readStoredSleepTimerMinutes(),
    sleepTimerDeadlineMs: null,
    sleepTimerActivationId: 0,
    handleToggleSleepTimer: (enable) => {
        if (enable && get().sleepTimerHours === 0 && get().sleepTimerMinutes === 0) {
            setStatusMessage({
                type: 'error',
                text: i18n.t('commandPalette.sleepTimerDurationRequired'),
            });
            return;
        }
        set(state => ({
            sleepTimerEnabled: enable,
            // Every explicit activation starts a fresh countdown, even when its duration is unchanged.
            sleepTimerActivationId: enable
                ? state.sleepTimerActivationId + 1
                : state.sleepTimerActivationId,
        }));
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (enable ? 'sleepTimerOn' : 'sleepTimerOff')),
        });
    },
    handleSetSleepTimerHours: (hours) => {
        const clamped = Math.min(999, Math.max(0, Math.floor(hours) || 0));
        if (typeof window !== 'undefined') {
            localStorage.setItem(SLEEP_TIMER_HOURS_STORAGE_KEY, String(clamped));
        }
        set(state => ({
            sleepTimerHours: clamped,
            sleepTimerEnabled: clamped === 0 && state.sleepTimerMinutes === 0
                ? false
                : state.sleepTimerEnabled,
        }));
    },
    handleSetSleepTimerMinutes: (minutes) => {
        const clamped = Math.min(59, Math.max(0, Math.floor(minutes) || 0));
        if (typeof window !== 'undefined') {
            localStorage.setItem(SLEEP_TIMER_MINUTES_STORAGE_KEY, String(clamped));
        }
        set(state => ({
            sleepTimerMinutes: clamped,
            sleepTimerEnabled: state.sleepTimerHours === 0 && clamped === 0
                ? false
                : state.sleepTimerEnabled,
        }));
    },
}));

/**
 * The SleepTimer half of the former settings snapshot, for the surfaces that
 * legitimately edit this whole domain at once. Ordinary consumers select one field instead.
 */
export const selectSleepTimerSnapshot = (state: SleepTimerState) => ({
    sleepTimerEnabled: state.sleepTimerEnabled,
    sleepTimerHours: state.sleepTimerHours,
    sleepTimerMinutes: state.sleepTimerMinutes,
    sleepTimerDeadlineMs: state.sleepTimerDeadlineMs,
    sleepTimerActivationId: state.sleepTimerActivationId,
    handleToggleSleepTimer: state.handleToggleSleepTimer,
    handleSetSleepTimerHours: state.handleSetSleepTimerHours,
    handleSetSleepTimerMinutes: state.handleSetSleepTimerMinutes,
});
