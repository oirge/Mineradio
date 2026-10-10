import { afterEach, describe, expect, it } from 'vitest';
import {
    blockLatticeNavigationInFm,
    isStartupLatticeDeferred,
    resolveStartupView,
    resolvePlayerCapsuleNavigationTarget,
    shouldNavigatePlayerBackThroughHistory,
    shouldReplacePlayerNavigation,
    type NavigationHistoryState,
} from '@/hooks/useAppNavigation';
import i18n from '@/i18n/config';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useStatusMessageStore } from '@/stores/useStatusMessageStore';

// test/unit/navigation/appNavigationHistory.test.ts
// Guards player-back behavior so collection pages are popped instead of duplicated.

const state = (
    view: NavigationHistoryState['view'],
    appHistoryIndex: number,
): NavigationHistoryState => ({
    view,
    appHistoryIndex,
    search: null,
    collection: null,
});

afterEach(() => {
    usePlaybackStore.setState({ isFmMode: false });
    useStatusMessageStore.setState({ message: null });
});

describe('player navigation history', () => {
    it('returns through browser history when the player was opened from an app page', () => {
        expect(shouldNavigatePlayerBackThroughHistory(state('player', 2))).toBe(true);
    });

    it('uses the direct-home fallback for a player startup entry', () => {
        expect(shouldNavigatePlayerBackThroughHistory(state('player', 0))).toBe(false);
    });

    it('does not treat a home entry as player back navigation', () => {
        expect(shouldNavigatePlayerBackThroughHistory(state('home', 2))).toBe(false);
    });

    it('replaces the current entry when navigating to an already active player', () => {
        expect(shouldReplacePlayerNavigation(state('player', 2))).toBe(true);
    });

    it('pushes a new entry when opening the player from home', () => {
        expect(shouldReplacePlayerNavigation(state('home', 2))).toBe(false);
    });
});

describe('Lattice navigation availability', () => {
    it('allows normal queues without emitting a toast', () => {
        usePlaybackStore.setState({ isFmMode: false });
        useStatusMessageStore.setState({ message: null });

        expect(blockLatticeNavigationInFm()).toBe(false);
        expect(useStatusMessageStore.getState().message).toBeNull();
    });

    it('blocks Personal FM and explains why in the status toast', () => {
        usePlaybackStore.setState({ isFmMode: true });
        useStatusMessageStore.setState({ message: null });

        expect(blockLatticeNavigationInFm()).toBe(true);
        expect(useStatusMessageStore.getState().message).toEqual({
            type: 'info',
            text: i18n.t('status.latticeUnavailableInFm'),
        });
    });
});

describe('player capsule navigation', () => {
    it('opens Lattice from any non-Lattice page when it is the configured entry view', () => {
        expect(resolvePlayerCapsuleNavigationTarget('home', 'lattice', false)).toBe('lattice');
        expect(resolvePlayerCapsuleNavigationTarget('player', 'lattice', false)).toBe('lattice');
    });

    it('opens the standard player for Personal FM even when Lattice is configured', () => {
        expect(resolvePlayerCapsuleNavigationTarget('home', 'lattice', true)).toBe('player');
    });

    it('does not navigate away when the progress bar already belongs to Lattice', () => {
        expect(resolvePlayerCapsuleNavigationTarget('lattice', 'lattice', false)).toBeNull();
    });
});

describe('startup view resolution', () => {
    const base = { openPlayerOnLaunch: true, playbackEntryView: 'player' as const, isFmMode: false, queueLength: 3 };

    it('opens home when the setting is off, whatever the entry preference is', () => {
        expect(resolveStartupView({ ...base, openPlayerOnLaunch: false, playbackEntryView: 'lattice' })).toBe('home');
    });

    it('opens the player when the preference is player', () => {
        expect(resolveStartupView(base)).toBe('player');
    });

    it('opens Lattice when the preference is Lattice and the queue has songs', () => {
        expect(resolveStartupView({ ...base, playbackEntryView: 'lattice' })).toBe('lattice');
    });

    it('falls back to the player in FM mode', () => {
        expect(resolveStartupView({ ...base, playbackEntryView: 'lattice', isFmMode: true })).toBe('player');
    });

    it('falls back to the player on an empty queue', () => {
        expect(resolveStartupView({ ...base, playbackEntryView: 'lattice', queueLength: 0 })).toBe('player');
    });

    it('marks only a Lattice launch outside FM as deferrable', () => {
        expect(isStartupLatticeDeferred({ openPlayerOnLaunch: true, playbackEntryView: 'lattice', isFmMode: false })).toBe(true);
        expect(isStartupLatticeDeferred({ openPlayerOnLaunch: true, playbackEntryView: 'player', isFmMode: false })).toBe(false);
        expect(isStartupLatticeDeferred({ openPlayerOnLaunch: false, playbackEntryView: 'lattice', isFmMode: false })).toBe(false);
        expect(isStartupLatticeDeferred({ openPlayerOnLaunch: true, playbackEntryView: 'lattice', isFmMode: true })).toBe(false);
    });
});
