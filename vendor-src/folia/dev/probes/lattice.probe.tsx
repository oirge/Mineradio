import { useMemo, useState } from 'react';
import { useMotionValue } from 'framer-motion';
import Lattice from '../../src/components/app/lattice/Lattice';
import { PlayerState, type Line, type SongResult } from '../../src/types';
import type { ProbeDefinition } from './definition';
import { DEFAULT_THEME } from '../../src/services/baseThemes';
import { useLatticeControlsStore } from '../../src/stores/useLatticeControlsStore';
import AppOverlays from '../../src/components/app/overlays/AppOverlays';

// dev/probes/lattice.probe.tsx
// Real wall and playback controls with local, deterministic queue data.
/**
 * Two cover shapes on one stub host, which a spec or the memory harness routes for itself.
 *
 * `stepped` is Navidrome-shaped, so the sizing ladder can rewrite it and each card asks for its own
 * step. `original` is a plain path no provider rule matches, so `getSizedCoverUrl` hands it back
 * untouched and every card paints the full-size asset - which is exactly what the wall did before
 * it sized anything, and is how the memory harness gets a baseline without a production switch.
 */
type CoverMode = 'off' | 'stepped' | 'original';

const coverUrlFor = (mode: CoverMode, index: number): string | undefined => {
    if (mode === 'off') return undefined;
    return mode === 'original'
        ? `https://navidrome.test/original/${index}.png`
        : `https://navidrome.test/rest/getCoverArt.view?id=${index}`;
};

const buildQueue = (count: number, covers: CoverMode): SongResult[] => Array.from({ length: count }, (_, index) => ({
    id: String(index), name: `Poster ${index}`, artists: [{ id: 1, name: 'Artist' }],
    album: { id: 1, name: 'Album', coverUrl: coverUrlFor(covers, index) }, durationMs: 180000,
    sourceRef: { kind: 'online', providerId: 'netease', mediaId: String(index) },
}));

const queue: SongResult[] = buildQueue(12, 'off');
const lyricLines: Line[] = [
    { startTime: 0, endTime: 8, fullText: '壤土下的安居 Cozy Home Underground', words: [
        { text: '壤土下的安居', startTime: 0, endTime: 4 },
        { text: ' Cozy Home Underground', startTime: 4, endTime: 8 },
    ] },
    { startTime: 8, endTime: 16, fullText: '锤砧间的音符 Notes From Striking the Anvil', words: [
        { text: '锤砧间的音符', startTime: 8, endTime: 12 },
        { text: ' Notes From Striking the Anvil', startTime: 12, endTime: 16 },
    ] },
];

// Covers are off and the queue is 12 by default, so the gesture cases keep their fixture and run
// without a single image request.
function LatticeProbe({ covers = 'off', queueLength = 12, withLyrics = false }:
    { covers?: CoverMode; queueLength?: number; withLyrics?: boolean }) {
    const source = useMemo(
        () => (covers === 'off' && queueLength === 12 ? queue : buildQueue(queueLength, covers)),
        [covers, queueLength],
    );
    const time = useMotionValue(42);
    const [songs, setSongs] = useState(source);
    const [currentSong, setCurrentSong] = useState<SongResult | null>(source[0]);
    const [loopMode, setLoopMode] = useState<'off' | 'all' | 'one'>('all');
    const [command, setCommand] = useState('');
    const [toggles, setToggles] = useState(0);
    const [backs, setBacks] = useState(0);
    const [seek, setSeek] = useState(42);
    const [playerState, setPlayerState] = useState(PlayerState.PLAYING);
    const [playbackDuration, setPlaybackDuration] = useState(180);
    const isCurrentSongPosterVisible = useLatticeControlsStore(state => state.isCurrentSongPosterVisible);
    return <div style={{ height: '100vh' }} data-loop={loopMode} data-command={command} data-toggles={toggles} data-backs={backs} data-seek={seek}
        data-current-song-poster-visible={isCurrentSongPosterVisible}>
        <Lattice lyrics={withLyrics ? { lines: lyricLines } : null} controls={{ loopMode,
            playback: { prev: () => setCurrentSong(source[Math.max(0, source.indexOf(currentSong!) - 1)]),
                next: () => setCurrentSong(source[(source.indexOf(currentSong!) + 1) % source.length]),
                toggleLoop: () => setLoopMode(value => value === 'off' ? 'all' : value === 'all' ? 'one' : 'off'),
                shuffleQueue: () => setSongs(value => [...value].reverse()), toggleSongLike: () => {}, isSongLiked: false, isFmMode: false },
            invokeCommandById: setCommand, canInvokeCommandById: () => true,
        }} queue={songs} currentSong={currentSong} playerState={playerState}
            lyricSource={{ currentTime: time, currentLineIndex: withLyrics ? 0 : -1,
                lines: withLyrics ? lyricLines : [], theme: DEFAULT_THEME }} lyricKeywordColoringEnabled
            currentTime={time} playbackDuration={playbackDuration} canTogglePlayback isDaylight={false}
            onBack={() => setBacks(value => value + 1)} onOpenPlayer={() => {}} onPlaySong={song => setCurrentSong(song)}
            onTogglePlayback={() => setToggles(value => value + 1)} onSeek={setSeek} />
        <AppOverlays model={{
            floatingControls: currentSong ? {
                currentSong,
                playerState: PlayerState.PLAYING,
                currentTime: time,
                duration: 180,
                loopMode,
                currentView: 'lattice',
                audioSrc: 'probe://audio',
                canTogglePlay: true,
                lyrics: null,
                onSeek: setSeek,
                onTogglePlay: () => setToggles(value => value + 1),
                onToggleLoop: () => setLoopMode(value => value === 'off' ? 'all' : value === 'all' ? 'one' : 'off'),
                onNavigateToPlayer: () => {},
                isDaylight: false,
                slotPrimary: 'loop',
                slotSecondary: 'lyrics-timeline',
                slotContext: {
                    onShuffle: () => {}, canShuffle: true,
                    onLike: () => {}, isLiked: false, likeDisabled: false,
                    invokeCommandById: setCommand, canInvokeCommandById: () => true,
                },
                onCommitBottomBarOffset: () => {},
            } : null,
        }} />
        <div style={{ position: 'fixed', right: 0, top: 0, zIndex: 100 }}>
            <button onClick={() => setCurrentSong(source[(source.indexOf(currentSong!) + 1) % source.length])}>Next track</button>
            <button onClick={() => setSongs(value => [...value].reverse())}>Reverse queue</button>
            <button onClick={() => setSongs(value => value.filter(song => song.id !== '3'))}>Remove poster 3</button>
            <button onClick={() => { setSongs([]); setCurrentSong(null); }}>Clear queue</button>
            <button onClick={() => setSongs(source)}>Restore queue</button>
            <button onClick={() => setPlayerState(value => value === PlayerState.PLAYING ? PlayerState.PAUSED : PlayerState.PLAYING)}>Toggle player state</button>
            <button onClick={() => setPlaybackDuration(value => value + 1)}>Bump duration</button>
        </div>
    </div>;
}

export default {
    id: 'lattice', title: 'Lattice gestures',
    description: 'Pointer, wheel and keyboard interactions with expanded playback controls.',
    Component: LatticeProbe,
} satisfies ProbeDefinition;
