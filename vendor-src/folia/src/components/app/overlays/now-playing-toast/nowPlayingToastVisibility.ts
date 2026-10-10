import type { AppView } from '../../../../stores/useAppViewStore';
import type { StageTrackPillMode } from '../NowPlayingToast';

// src/components/app/overlays/now-playing-toast/nowPlayingToastVisibility.ts
// Keeps the card and its next-track countdown on exactly the same set of app surfaces.

export const shouldShowNowPlayingToast = ({
    mode,
    view,
    showOnHome,
}: {
    mode: StageTrackPillMode;
    view: AppView;
    showOnHome: boolean;
}) => mode !== 'never' && (
    view === 'player'
    || view === 'lattice'
    || (view === 'home' && showOnHome)
);
