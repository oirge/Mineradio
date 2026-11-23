import type { HostState } from '../client';
import type { LocalCommand } from './useLibraryPage';
import type { LocalTool } from './localCommandCatalog';
import LocalCommandPalette from './LocalCommandPalette';
import LocalAudioSettings from './LocalAudioSettings';
import LocalSubtitleSettings from './LocalSubtitleSettings';
import LocalAddToPlaylist from './LocalAddToPlaylist';
import LocalVideoExport from './LocalVideoExport';
import LocalFrameRateCheck from './LocalFrameRateCheck';
import type { LyricRenderQuality } from '../../types';

// src/mineradio/local/LocalToolDialogs.tsx
// Keep the local player's assembly independent of the individual tool implementations.
export default function LocalToolDialogs({ tool, state, command, onClose, onLibrary, activeLyrics, setProbeQuality }: {
    tool: LocalTool | null; state: HostState | null; command: LocalCommand; onClose: () => void; onLibrary: () => void;
    activeLyrics: boolean; setProbeQuality: (value: LyricRenderQuality | null) => void;
}) {
    if (tool === 'commands') return <LocalCommandPalette state={state} command={command} onClose={onClose} />;
    if (tool === 'audio') return <LocalAudioSettings state={state} command={command} onClose={onClose} />;
    if (tool === 'subtitles') return <LocalSubtitleSettings onClose={onClose} />;
    if (tool === 'videoExport') return <LocalVideoExport state={state} command={command} onClose={onClose} />;
    if (tool === 'frameRate') return <LocalFrameRateCheck canMeasure={activeLyrics && state?.playing === true}
        trackId={state?.currentTrack?.id} setQuality={setProbeQuality} onClose={onClose} />;
    if (tool === 'addPlaylist') return <LocalAddToPlaylist state={state} command={command} onClose={onClose} onLibrary={onLibrary} />;
    return null;
}
