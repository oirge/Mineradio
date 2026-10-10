import { describe, expect, it, vi } from 'vitest';
import { buildAppOverlaysModel } from '../../../src/components/app/overlays/buildAppOverlaysModel';
import { shouldShowNowPlayingToast } from '../../../src/components/app/overlays/now-playing-toast/nowPlayingToastVisibility';
import { useLatticeControlsStore } from '../../../src/stores/useLatticeControlsStore';
import { PlayerState, type SongResult } from '../../../src/types';

// test/unit/stage/nowPlayingToastVisibility.test.ts

describe('now playing toast visibility', () => {
    it.each(['player', 'lattice'] as const)('shows on %s without the home opt-in', view => {
        expect(shouldShowNowPlayingToast({ mode: 'auto', view, showOnHome: false })).toBe(true);
    });

    it('keeps home opt-in and never mode semantics', () => {
        expect(shouldShowNowPlayingToast({ mode: 'auto', view: 'home', showOnHome: false })).toBe(false);
        expect(shouldShowNowPlayingToast({ mode: 'always', view: 'home', showOnHome: true })).toBe(true);
        expect(shouldShowNowPlayingToast({ mode: 'never', view: 'lattice', showOnHome: true })).toBe(false);
    });

    it('routes a Lattice card click to the registered current-song focus action', () => {
        const song: SongResult = {
            id: 'now',
            name: 'Now',
            artists: [{ id: 1, name: 'Artist' }],
            album: { id: 1, name: 'Album' },
            durationMs: 180000,
            sourceRef: { kind: 'online', providerId: 'netease', mediaId: 'now' },
        };
        const focus = vi.fn();
        const unregister = useLatticeControlsStore.getState().registerFocus(focus);
        const navigateToPlayer = vi.fn();
        const openSongCardPanel = vi.fn();
        const model = buildAppOverlaysModel({
            currentView: 'lattice',
            stageTrackPillOnScreen: true,
            currentSong: song,
            playerState: PlayerState.PLAYING,
            playQueue: [song],
            effectiveLoopMode: 'off',
            isFmMode: false,
            isNowPlayingStageActive: false,
            isNowPlayingControlDisabled: false,
            stageTrackPillMode: 'always',
            stageTrackPillTimeoutSec: 10,
            stageNextUp: null,
            stageIsNextUp: false,
            coverUrl: null,
            isDaylight: false,
            navigateToPlayer,
            openSongCardPanel,
            stageTrackPillOpenPlayerLabel: 'Open player',
            stageTrackPillOpenSongCardLabel: 'Open song card',
            stageTrackPillFocusLatticeLabel: 'Focus current song',
        } as unknown as Parameters<typeof buildAppOverlaysModel>[0]);

        expect(model.nowPlayingToast?.activateLabel).toBe('Focus current song');
        model.nowPlayingToast?.onActivate?.();
        expect(focus).toHaveBeenCalledOnce();
        expect(navigateToPlayer).not.toHaveBeenCalled();
        expect(openSongCardPanel).not.toHaveBeenCalled();
        unregister();
    });
});
