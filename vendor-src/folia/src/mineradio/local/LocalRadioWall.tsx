import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RadioWall from '../../components/app/lattice/radio/RadioWall';
import type { LatticeTile } from '../../components/app/lattice/latticeModel';
import { useStableCallbacks } from '../../hooks/useStableCallbacks';
import type { HostTrack } from '../client';
import { hostTrackToWallSong } from './wallCatalogData';
import type { LocalPlayer } from './playerTypes';

// Render the host's bounded queue window and play the exact queue slot selected on the wall.
interface QueueWindow {
    items: { index: number; track: HostTrack }[];
    revision: string | number;
    wrapsAround: boolean;
}

interface Props {
    player: LocalPlayer;
    hidesUpcoming: boolean;
    onBack: () => void;
    onOpenPlayer: () => void;
}

export default function LocalRadioWall({ player, hidesUpcoming, onBack, onOpenPlayer }: Props) {
    const { t } = useTranslation('localPlayer');
    const [snapshot, setSnapshot] = useState<QueueWindow | null>(null);
    const [retry, setRetry] = useState(0);
    const [failed, setFailed] = useState(false);
    const { command } = player;
    const revision = player.state?.queueRevision;
    const currentIndex = player.state?.currentIndex ?? -1;
    const playMode = player.state?.playMode;

    useEffect(() => {
        if (revision === undefined) return;
        let canceled = false;
        setFailed(false);
        void command<QueueWindow>('getQueue', { aroundCurrent: true }).then(result => {
            if (!canceled) setSnapshot(result);
        }).catch(() => {
            if (!canceled) setFailed(true);
        });
        return () => { canceled = true; };
    }, [command, currentIndex, playMode, revision, retry]);

    const currentWindow = snapshot?.revision === revision ? snapshot : null;
    const tiles = useMemo<LatticeTile[]>(() => {
        if (!currentWindow) return [];
        const items = currentWindow.items;
        const current = items.findIndex(item => item.index === currentIndex);
        if (currentIndex >= 0 && current < 0) return [];
        return items.map(({ index, track }, position) => ({
            id: JSON.stringify([index, track.id]), queueIndex: index, song: hostTrackToWallSong(track),
            title: track.title, artist: track.artist || track.album, coverUrl: track.cover,
            section: position === current ? 'now' : current >= 0 && position < current ? 'played' : 'upcoming',
        }));
    }, [currentIndex, currentWindow]);

    const actions = useStableCallbacks({
        play: (tile: LatticeTile) => {
            if (!currentWindow) return;
            if (tile.queueIndex === currentIndex && player.state?.playing) return;
            void command('playQueue', {
                index: tile.queueIndex, expectedRevision: currentWindow.revision, expectedTrackId: String(tile.song.id),
            }).catch(() => {});
        },
        toggle: () => { void command('togglePlay').catch(() => {}); },
        seek: (seconds: number) => { void command('seek', { seconds }).catch(() => {}); },
    });

    return <>
        <RadioWall tiles={tiles} audioBands={player.audioBands} isFm={false} hidesUpcoming={hidesUpcoming}
            wrapsAround={playMode === 'loop' && currentWindow?.wrapsAround === true}
            onPlay={actions.play} onPlayFromWall={actions.play} onTogglePlayback={actions.toggle} onSeek={actions.seek}
            onOpenPlayer={onOpenPlayer} onBack={onBack} />
        {!tiles.length && <div className="lattice-empty" data-testid="local-radio-queue-status">
            <strong>{t(failed ? 'commandFailed' : currentWindow ? 'queueEmpty' : 'loading')}</strong>
            {failed && <button type="button" onClick={() => setRetry(value => value + 1)}>{t('retry')}</button>}
        </div>}
    </>;
}
