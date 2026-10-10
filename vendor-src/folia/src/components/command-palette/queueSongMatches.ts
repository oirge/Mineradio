import type { SongResult } from '../../types';
import { getProviderSongMetadata } from '../../services/onlineMusic/songMetadata';
import { evaluateQueueSearch, buildQueueSearchIndex, type QueueSearchEvaluation } from './queueSearch';
import type { CommandPaletteCommand, CommandPaletteContext, CommandPaletteMatch } from './types';

// src/components/command-palette/queueSongMatches.ts
// Synthesizes one throwaway command per matching queue song. Kept out of the registry so the
// queue surface can import it without pulling the whole command list back in.

const getSongArtistLabel = (song: SongResult) => (
    getProviderSongMetadata(song).artists.map(artist => artist.name).filter(Boolean).join(', ')
);

const getSongAlbumLabel = (song: SongResult) => getProviderSongMetadata(song).album?.name || '';

const buildQueueSongDescription = (song: SongResult, index: number, context: CommandPaletteContext) => {
    const metadata = [getSongArtistLabel(song), getSongAlbumLabel(song)].filter(Boolean).join(' · ');
    return metadata || context.shared.t('commandPalette.queueIndex', 'Queue #{{index}}').replace('{{index}}', String(index + 1));
};

const createQueueSongCommand = (
    song: SongResult,
    index: number,
    context: CommandPaletteContext,
): CommandPaletteCommand => ({
    id: `queue-song-${index}-${song.id}`,
    group: 'playback',
    title: song.name,
    description: buildQueueSongDescription(song, index, context),
    textSource: 'runtime',
    keywords: [`#${index + 1}`],
    queueIndex: index,
    queueSong: song,
    closeAfterExecute: !context.playback.queuePaletteKeepOpen,
    execute: async (_input, commandContext) => {
        await commandContext.playback.playSong(song, commandContext.playback.queue);
        return true;
    },
});

export const getQueueSongMatchesFromEvaluation = (
    evaluation: QueueSearchEvaluation,
    query: string,
    context: CommandPaletteContext,
): CommandPaletteMatch[] => evaluation.matches.map(match => ({
    command: createQueueSongCommand(match.entry.song, match.entry.queueIndex, context),
    score: match.score,
    input: query,
    queueReasons: match.reasons,
}));

export const getQueueSongMatches = (query: string, context: CommandPaletteContext): CommandPaletteMatch[] => (
    getQueueSongMatchesFromEvaluation(
        evaluateQueueSearch(buildQueueSearchIndex(context.playback.queue), context.shared.currentSong, query),
        query,
        context,
    )
);
