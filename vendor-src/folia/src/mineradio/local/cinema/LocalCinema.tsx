import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronLeft, Focus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReducedMotionFor } from '../../../hooks/useReducedMotionFor';
import type { Theme } from '../../../types';
import type { LocalPlayer } from '../playerTypes';
import { bindCinemaLook } from './cinemaLook';
import { createLocalCinema } from './createLocalCinema';
import './localCinema.css';

// Keep the same lyric component mounted while the hall loads or falls back after a graphics failure.
interface Props {
    player: LocalPlayer;
    theme: Theme;
    lightsUp: boolean;
    curtainsOnPause: boolean;
    onClose: () => void;
    children: ReactNode;
}

export default function LocalCinema({ player, theme, lightsUp, curtainsOnPause, onClose, children }: Props) {
    const { t } = useTranslation('localPlayer');
    const reducedMotion = useReducedMotionFor('uiMicroMotion');
    const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
    const box = useRef<HTMLDivElement>(null);
    const screen = useRef<HTMLDivElement>(null);
    const root = useRef<HTMLElement>(null);
    const controls = useRef<ReturnType<typeof createLocalCinema> | null>(null);
    const playing = player.state?.playing === true;
    const cover = player.state?.currentTrack?.cover ?? '';
    const input = useRef({ player, reducedMotion, playing, cover, accent: theme.accentColor, lightsUp, curtainsOnPause });
    input.current = { player, reducedMotion, playing, cover, accent: theme.accentColor, lightsUp, curtainsOnPause };

    useEffect(() => {
        try {
            const runtime = createLocalCinema(box.current!, screen.current!, () => {
                const current = input.current;
                return { ...current, power: Math.min(1, current.player.audioPower.get() / 255),
                    bass: Math.min(1, current.player.audioBands.bass.get() / 255) };
            }, setStatus);
            controls.current = runtime;
            const unbind = bindCinemaLook(root.current!, runtime.turn);
            return () => { controls.current = null; unbind(); runtime.dispose(); };
        } catch {
            setStatus('failed');
            return undefined;
        }
    }, []);
    useEffect(() => { controls.current?.sync(); }, [playing, cover, theme.accentColor, lightsUp, curtainsOnPause, reducedMotion]);

    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget || status !== 'ready') return;
        const turns: Record<string, [number, number]> = { ArrowLeft: [0.13, 0], ArrowRight: [-0.13, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] };
        const turn = turns[event.key];
        if (!turn) return;
        event.preventDefault();
        controls.current?.turn(...turn);
    };

    return <section ref={root} className="local-cinema" data-testid="local-cinema" data-status={status}
        aria-label={t('cinemaBeta')} tabIndex={status === 'ready' ? 0 : -1} onKeyDown={onKeyDown}>
        <div ref={screen} className="local-cinema-screen" data-testid="local-cinema-screen">{children}</div>
        <div ref={box} className="local-cinema-hall" aria-hidden="true" />
        <div className="local-cinema-tools" data-scene-no-look>
            <button type="button" data-testid="local-cinema-exit" className="local-glass" onClick={onClose} title={t('cinemaExit')} aria-label={t('cinemaExit')}><ChevronLeft size={19} /></button>
            {status === 'ready' && <button type="button" data-testid="local-cinema-reset" className="local-glass"
                title={t('cinemaReset')} aria-label={t('cinemaReset')} onClick={() => controls.current?.reset()}><Focus size={17} /></button>}
            {status !== 'ready' && <span className="local-glass" role="status">{t(status === 'failed' ? 'cinemaUnavailable' : 'cinemaLoading')}</span>}
        </div>
    </section>;
}
