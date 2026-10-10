import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SongResult } from '@/types';
import type { OmniPlaybackReport } from '@/types/onlineMusic';

// test/unit/hooks/useNeteaseScrobbleReporter.test.ts
// The wiring layer: it alone decides when a listening session opens and when it settles, so the
// branches that only comments could describe until now - an automix deck handover, loop-one, and
// signing out mid-track - are pinned here. The repo's vitest runs on node with no jsdom and no
// testing-library, so this reuses the minimal React runtime from useOnlineProviderQrLogin.test.ts
// and a hand-rolled audio element rather than pulling in a rendering stack.

const runtime = vi.hoisted(() => ({
    slots: [] as { current: any }[],
    cursor: 0,
    effects: [] as Array<() => void | (() => void)>,
}));

vi.mock('react', () => ({
    useRef: (initial: unknown) => {
        const index = runtime.cursor++;
        runtime.slots[index] ??= { current: initial };
        return runtime.slots[index];
    },
    // The hook's single effect has a dependency array, but every `render` below is a deliberate
    // re-render with changed inputs, so running it each time matches what React would do.
    useEffect: (effect: () => void | (() => void)) => { runtime.effects.push(effect); },
}));

const gate = vi.hoisted(() => ({
    isNeteaseScrobbleReady: vi.fn(() => true),
    // Typed rather than bare, so the assertions below can read the song and report it was handed.
    sendPlaybackReport: vi.fn(async (_song: unknown, _report: unknown) => true),
}));
vi.mock('@/services/onlineMusic/playbackReportGate', () => gate);

vi.mock('@/services/onlineMusic/omni', () => ({
    omni: {
        canReportPlayback: (song: SongResult) => (
            song.sourceRef?.kind === 'online' && song.sourceRef.providerId === 'netease'
        ),
    },
}));

vi.mock('@/services/onlineMusic/songMetadata', () => ({
    getProviderSongMetadata: (song: SongResult) => ({ durationMs: song.durationMs ?? 0, artists: [] }),
}));

const audioSettings = vi.hoisted(() => ({ neteaseScrobbleEnabled: true, audioQuality: 'high' }));
const useAudioSettingsStore = vi.hoisted(() => {
    const hook = (selector: (state: { neteaseScrobbleEnabled: boolean; audioQuality: string }) => unknown) => selector(audioSettings);
    hook.getState = () => audioSettings;
    return hook;
});
vi.mock('@/stores/useAudioSettingsStore', () => ({ useAudioSettingsStore }));

const { useNeteaseScrobbleReporter } = await import('@/hooks/useNeteaseScrobbleReporter');

/**
 * A clock that moves with playback.
 *
 * The tracker cross-checks accumulated media time against the wall clock, so a test that plays 45
 * seconds of audio in zero real time is - correctly - rejected as impossible. Every tick advances
 * this by its own quarter second, which is what real playback would do.
 */
const clock = { now: 1_700_000_000_000 };

/** The parts of an HTMLAudioElement the hook touches, plus a way to drive its listeners. */
const createDeck = () => {
    const listeners = new Map<string, Set<() => void>>();
    return {
        currentTime: 0,
        paused: false,
        ended: false,
        addEventListener: (type: string, listener: () => void) => {
            listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
        },
        removeEventListener: (type: string, listener: () => void) => {
            listeners.get(type)?.delete(listener);
        },
        emit(type: string) {
            listeners.get(type)?.forEach(listener => listener());
        },
        /** Continuous playback in quarter-second ticks, the way a real deck reports it. */
        playFor(seconds: number) {
            for (let step = 0; step <= Math.round(seconds / 0.25); step += 1) {
                if (step > 0) {
                    this.currentTime = Number((this.currentTime + 0.25).toFixed(4));
                    clock.now += 250;
                }
                this.emit('timeupdate');
            }
        },
    };
};

type Deck = ReturnType<typeof createDeck>;

const song = (mediaId: string, overrides: Partial<SongResult> = {}): SongResult => ({
    id: mediaId,
    name: 'song-' + mediaId,
    artists: [],
    album: { id: '', name: '' },
    durationMs: 240_000,
    sourceRef: { kind: 'online', providerId: 'netease', mediaId },
    ...overrides,
} as SongResult);

/** The song and payload of the nth report, named so the assertions read as intent. */
const reportedSong = (call: number) => gate.sendPlaybackReport.mock.calls[call]?.[0] as SongResult;
const reportedPayload = (call: number) => gate.sendPlaybackReport.mock.calls[call]?.[1] as OmniPlaybackReport;

let cleanups: Array<() => void> = [];
const audioRef: { current: Deck | null } = { current: null };

const render = (currentSong: SongResult | null, activeDeck = 'A') => {
    cleanups.forEach(cleanup => cleanup());
    runtime.cursor = 0;
    runtime.effects.length = 0;
    useNeteaseScrobbleReporter({ audioRef: audioRef as never, currentSong, activeDeck });
    cleanups = runtime.effects
        .map(effect => effect())
        .filter((cleanup): cleanup is () => void => typeof cleanup === 'function');
};

describe('useNeteaseScrobbleReporter', () => {
    let deck: Deck;

    beforeEach(() => {
        runtime.slots.length = 0;
        runtime.cursor = 0;
        runtime.effects.length = 0;
        cleanups = [];
        gate.isNeteaseScrobbleReady.mockReset().mockReturnValue(true);
        gate.sendPlaybackReport.mockReset().mockResolvedValue(true);
        audioSettings.neteaseScrobbleEnabled = true;
        clock.now = 1_700_000_000_000;
        vi.spyOn(Date, 'now').mockImplementation(() => clock.now);
        deck = createDeck();
        audioRef.current = deck;
    });

    it('reports the finished track when the queue moves on', () => {
        render(song('1'));
        deck.playFor(45);
        render(song('2'));

        expect(gate.sendPlaybackReport).toHaveBeenCalledTimes(1);
        expect(reportedSong(0)).toMatchObject({ id: '1' });
        expect(reportedPayload(0)).toMatchObject({ playedSeconds: 45, quality: 'high' });
    });

    it('reports the outgoing track on an automix handover, where its `ended` never arrives', () => {
        render(song('1'));
        deck.playFor(50);

        // The blend arms: the queue advances and `audioRef` is repointed at the other deck, whose
        // `ended` for the outgoing track will never reach this hook.
        audioRef.current = createDeck();
        render(song('2'), 'B');

        expect(gate.sendPlaybackReport).toHaveBeenCalledTimes(1);
        expect(reportedSong(0)).toMatchObject({ id: '1' });
    });

    it('reports each pass of a loop-one repeat separately', () => {
        render(song('1'));
        deck.playFor(40);

        deck.currentTime = 0.25;
        deck.emit('timeupdate');
        expect(gate.sendPlaybackReport).toHaveBeenCalledTimes(1);

        deck.playFor(40);
        render(song('2'));
        expect(gate.sendPlaybackReport).toHaveBeenCalledTimes(2);
        expect(reportedSong(1)).toMatchObject({ id: '1' });
    });

    it('reports on `ended` when nothing else advances the queue', () => {
        render(song('1'));
        deck.playFor(45);
        deck.ended = true;
        deck.emit('ended');

        expect(gate.sendPlaybackReport).toHaveBeenCalledTimes(1);
    });

    it('says nothing about a track that was skipped early', () => {
        render(song('1'));
        deck.playFor(10);
        render(song('2'));

        expect(gate.sendPlaybackReport).not.toHaveBeenCalled();
    });

    it('drops the listen in progress when the setting is switched off', () => {
        render(song('1'));
        deck.playFor(45);

        audioSettings.neteaseScrobbleEnabled = false;
        render(song('1'));
        render(song('2'));

        expect(gate.sendPlaybackReport).not.toHaveBeenCalled();
    });

    it('withholds a report from a listener who signed out during the track', () => {
        render(song('1'));
        deck.playFor(45);

        gate.isNeteaseScrobbleReady.mockReturnValue(false);
        render(song('2'));

        expect(gate.sendPlaybackReport).not.toHaveBeenCalled();
    });

    it.each([
        ['a cloud-disk upload', { kind: 'online', providerId: 'netease', mediaId: '1', variant: 'cloud' }],
        ['another provider', { kind: 'online', providerId: 'kugou', mediaId: '1' }],
        ['a local file', { kind: 'local', mediaId: 'local-1' }],
    ])('never opens a session for %s', (_label, sourceRef) => {
        render(song('1', { sourceRef } as Partial<SongResult>));
        deck.playFor(90);
        render(song('2'));

        expect(gate.sendPlaybackReport).not.toHaveBeenCalled();
    });

    it('never opens a session for a non-numeric NetEase id', () => {
        render(song('abc'));
        deck.playFor(90);
        render(song('2'));

        expect(gate.sendPlaybackReport).not.toHaveBeenCalled();
    });

    it('counts nothing while the deck is paused', () => {
        render(song('1'));
        deck.playFor(20);
        deck.paused = true;
        deck.playFor(60);
        deck.paused = false;
        render(song('2'));

        expect(gate.sendPlaybackReport).not.toHaveBeenCalled();
    });
});
