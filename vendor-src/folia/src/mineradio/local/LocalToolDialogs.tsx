import type { HostState } from '../client';
import type { LocalCommand } from './useLibraryPage';
import type { LocalTool } from './localCommandCatalog';
import LocalCommandPalette from './LocalCommandPalette';
import LocalAudioSettings from './LocalAudioSettings';
import LocalSubtitleSettings from './LocalSubtitleSettings';
import LocalAddToPlaylist from './LocalAddToPlaylist';
import LocalVideoExport from './LocalVideoExport';
import { AnimatePresence } from 'framer-motion';

// src/mineradio/local/LocalToolDialogs.tsx
// Keep the local player's assembly independent of the individual tool implementations.
export default function LocalToolDialogs({ tool, state, command, onClose, onLibrary }: {
    tool: LocalTool | null; state: HostState | null; command: LocalCommand; onClose: () => void; onLibrary: () => void;
}) {
    return <AnimatePresence initial={false} mode="sync">
        {tool === 'commands' && <LocalCommandPalette key="commands" state={state} command={command} onClose={onClose} />}
        {tool === 'audio' && <LocalAudioSettings key="audio" state={state} command={command} onClose={onClose} />}
        {tool === 'subtitles' && <LocalSubtitleSettings key="subtitles" onClose={onClose} />}
        {tool === 'videoExport' && <LocalVideoExport key="videoExport" state={state} command={command} onClose={onClose} />}
        {tool === 'addPlaylist' && <LocalAddToPlaylist key="addPlaylist" state={state} command={command} onClose={onClose} onLibrary={onLibrary} />}
    </AnimatePresence>;
}
