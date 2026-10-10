import { FileJson, FileText, PackageOpen } from 'lucide-react';
import { defineCommand } from '../commandFactories';
import { lyricExportSurface } from '../surfaces/lyricExportSurface';
import type { CommandPaletteCommand, CommandPaletteContext } from '../types';
import type { LyricExportFormat } from '../../../services/lyricExport/types';
import { hasExportableLyrics } from '../../../utils/lyrics/exportableLyrics';

// src/components/command-palette/commands/lyricExportCommands.ts
// Lyric export from the palette: the batch export surface, and the song on screen in either format.
//
// The export services are imported on demand: they reach the cache database and the provider
// registry, which the node-environment registry tests must not have to load.

/** Shared with the player panel's lyric file dialog and the storage settings button, which open this surface directly. */
export const LYRIC_EXPORT_COMMAND_ID = 'export-lyric-cache';

const hasLyricsOnScreen = (context?: CommandPaletteContext) => (
    context ? Boolean(context.shared.currentSong) && hasExportableLyrics(context.shared.lyrics) : true
);

const exportCurrent = async (format: LyricExportFormat, context: CommandPaletteContext): Promise<boolean> => {
    const { currentSong, lyrics, t, setStatusMsg } = context.shared;
    if (!currentSong) return false;
    const [{ exportCurrentSongLyrics }, { usePlaybackStore }, { useLyricSettingsStore }] = await Promise.all([
        import('../../../services/lyricExport/currentSongExport'),
        import('../../../stores/usePlaybackStore'),
        import('../../../stores/useLyricSettingsStore'),
    ]);
    try {
        const exported = await exportCurrentSongLyrics({
            song: currentSong,
            onScreenLyrics: lyrics,
            activeLocalLyricsSource: usePlaybackStore.getState().activeLocalLyricsSource,
            localLyricsPriority: useLyricSettingsStore.getState().localLyricsPriority,
        }, format);
        setStatusMsg({
            type: exported ? 'success' : 'info',
            text: exported ? t('lyricExport.exported', 'Lyrics exported') : t('lyricExport.noLyrics', 'No lyrics to export'),
        });
        return exported;
    } catch (error) {
        console.error('[CommandPalette] Lyric export failed', error);
        setStatusMsg({ type: 'error', text: t('lyricExport.failed', 'Lyric export failed') });
        return false;
    }
};

export const lyricExportCommands: CommandPaletteCommand[] = [
    defineCommand({
        id: LYRIC_EXPORT_COMMAND_ID,
        group: 'settings',
        title: 'Export cached lyrics',
        description: 'Save every lyric on this device as .fia and enhanced LRC in one zip',
        // No bare `fia`: this command takes input, and `fia` would be a space-separated prefix of the
        // `fia file` keyword below, so typing that would land here instead.
        keywords: ['lyric export', 'export lyrics', 'batch export', 'lyrics backup', 'fia zip', '导出歌词', '批量导出歌词', '歌词备份'],
        icon: PackageOpen,
        requiresInput: true,
        surface: lyricExportSurface,
        placeholder: context => context.shared.t('commandPalette.lyricExportPlaceholder', 'Choose what to export below'),
        execute: () => false,
    }),
    defineCommand({
        id: 'export-current-lyrics-fia',
        group: 'settings',
        title: 'Export current lyrics as .fia',
        description: 'Save this song’s lyrics in Folia’s lossless format, saved word segmentation included',
        keywords: ['save lyrics', 'folia lyrics file', 'fia file', '导出当前歌词', '保存歌词'],
        icon: FileJson,
        isAvailable: hasLyricsOnScreen,
        execute: (_input, context) => exportCurrent('fia', context),
    }),
    defineCommand({
        id: 'export-current-lyrics-lrc',
        group: 'settings',
        title: 'Export current lyrics as LRC',
        description: 'Save this song’s lyrics as an enhanced LRC other players can read',
        keywords: ['save lrc', 'lrc file', 'enhanced lrc', '导出 lrc', '保存 lrc'],
        icon: FileText,
        isAvailable: hasLyricsOnScreen,
        execute: (_input, context) => exportCurrent('lrc', context),
    }),
];
