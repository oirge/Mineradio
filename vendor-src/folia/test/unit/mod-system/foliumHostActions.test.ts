// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stores read localStorage at import time; see foliumUiRegistries.test.ts.
vi.hoisted(() => {
    const items = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => items.get(key) ?? null,
            setItem: (key: string, value: string) => { items.set(key, String(value)); },
            removeItem: (key: string) => { items.delete(key); },
            clear: () => items.clear(),
        },
    });
});
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SongResult } from '@/types';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { addFoliumEventHandler, removeFoliumEventHandlers } from '@/mods/folium/events';
import { useFoliumHostActions, type FoliumAppActions } from '@/mods/folium/hostActions';
import { createFoliumPlaybackService } from '@/mods/folium/services';
import type { ModRuntimeInfo } from '@/mods/types';

// test/unit/mod-system/foliumHostActions.test.ts
// The App side of folium.playback's Folium 1.3 additions: shuffle and like
// follow the same availability rules as the player bar's slots, and
// playback.likeChanged follows the liked value getState() reports.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mod: ModRuntimeInfo = {
    id: 'mod-a', name: 'A', version: '1.0.0', author: null, description: null, permissions: ['playback.control'],
    status: 'loaded', error: null, enabled: true, trustStale: false,
    signature: { status: 'unsigned', reason: null, keyId: null, keyLabel: null, signedAt: null },
    devSource: false, experimental: [], embedOrigins: [], folia: null, hasMain: false, clientUrl: null,
};

const song = (id: number) => ({ id, name: `song ${id}` }) as unknown as SongResult;

const appActions = (overrides: Partial<FoliumAppActions> = {}): FoliumAppActions => ({
    play: vi.fn(), pause: vi.fn(), toggle: vi.fn(), seek: vi.fn(), seekToLyricTime: vi.fn(),
    next: vi.fn(), previous: vi.fn(), playSong: vi.fn(), enqueue: vi.fn(),
    navigateToPlayer: vi.fn(), navigateToHome: vi.fn(),
    shuffleQueue: vi.fn(), toggleLike: vi.fn(), openVolume: vi.fn(),
    isLiked: false, controlsDisabled: false,
    ...overrides,
});

const Harness: React.FC<{ actions: FoliumAppActions }> = ({ actions }) => {
    useFoliumHostActions(actions);
    return null;
};

let root: Root | null = null;
const render = (actions: FoliumAppActions) => {
    if (!root) {
        const host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
    }
    act(() => root!.render(React.createElement(Harness, { actions })));
};

const initialPlayback = usePlaybackStore.getState();
beforeEach(() => {
    usePlaybackStore.setState(initialPlayback, true);
});
afterEach(() => {
    act(() => root?.unmount());
    root = null;
    removeFoliumEventHandlers('mod-a');
    document.body.replaceChildren();
});

describe('folium host actions', () => {
    it('shuffles only a queue the player bar could shuffle', () => {
        const actions = appActions();
        render(actions);
        const playback = createFoliumPlaybackService(mod, 'main');

        usePlaybackStore.setState({ playQueue: [song(1)], isFmMode: false });
        expect(playback.shuffleQueue()).toBe(false);

        usePlaybackStore.setState({ playQueue: [song(1), song(2)], isFmMode: true });
        expect(playback.shuffleQueue()).toBe(false);

        usePlaybackStore.setState({ playQueue: [song(1), song(2)], isFmMode: false, activePlaybackContext: 'stage' });
        expect(playback.shuffleQueue()).toBe(false);
        expect(actions.shuffleQueue).not.toHaveBeenCalled();

        usePlaybackStore.setState({ activePlaybackContext: 'main' });
        expect(playback.shuffleQueue()).toBe(true);
        expect(actions.shuffleQueue).toHaveBeenCalledTimes(1);
    });

    it('does not like when there is no song', () => {
        const actions = appActions({ isLiked: true });
        render(actions);
        const playback = createFoliumPlaybackService(mod, 'main');
        expect(playback.getState()).toMatchObject({ song: null, liked: false, canLike: false });
        expect(playback.toggleLike()).toBe(false);
        expect(actions.toggleLike).not.toHaveBeenCalled();
    });

    it('emits playback.likeChanged when the liked value changes, not on first render', () => {
        const handler = vi.fn();
        addFoliumEventHandler('mod-a', 'playback.likeChanged', handler);
        render(appActions({ isLiked: false }));
        expect(handler).not.toHaveBeenCalled();
        render(appActions({ isLiked: true }));
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0]).toEqual({ liked: true });
        render(appActions({ isLiked: true }));
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
