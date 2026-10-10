import React, { useCallback, useState } from 'react';
import { ArrowDownUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlaybackStore } from '../../stores/usePlaybackStore';
import { useLyricSettingsStore } from '../../stores/useLyricSettingsStore';
import { setStatusMessage } from '../../stores/useStatusMessageStore';
import { openCommandPaletteCommand, setIsPanelOpen } from '../../stores/useAppViewStore';
import { exportCurrentSongLyrics } from '../../services/lyricExport/currentSongExport';
import type { LyricExportFormat } from '../../services/lyricExport/types';
import { hasExportableLyrics } from '../../utils/lyrics/exportableLyrics';
import { LYRIC_EXPORT_COMMAND_ID } from '../command-palette/commands/lyricExportCommands';
import LyricFileDialog from './LyricFileDialog';

// src/components/panelTab/LyricFileButton.tsx
// The one lyric-file button in the lyrics row of the player panel's source tab (local, Navidrome
// and online share it). Import and export used to be two icons next to online matching, which
// crowded the row; both now open one dialog (LyricFileDialog). This component owns the dialog's
// state and runs its actions.

type LyricFileButtonProps = {
    /** Each tab styles its row icons differently; the trigger matches its neighbours. */
    buttonClassName: string;
    isDaylight: boolean;
    /** The tab's existing file-input handler. Left out where the source cannot take an imported file. */
    onImportChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

const LyricFileButton: React.FC<LyricFileButtonProps> = ({ buttonClassName, isDaylight, onImportChange }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const currentSong = usePlaybackStore(state => state.currentSong);
    const lyrics = usePlaybackStore(state => state.lyrics);
    const canExportCurrent = Boolean(currentSong) && hasExportableLyrics(lyrics);

    const close = useCallback(() => setIsOpen(false), []);

    const handleImportChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onImportChange?.(event);
        close();
    };

    const exportCurrent = async (format: LyricExportFormat) => {
        if (!currentSong || isExporting) return;
        setIsExporting(true);
        try {
            // Read the stores at click time: the export re-reads the song's raw lyric source, and
            // the source choice may have changed since this row last rendered.
            const exported = await exportCurrentSongLyrics({
                song: currentSong,
                onScreenLyrics: usePlaybackStore.getState().lyrics,
                activeLocalLyricsSource: usePlaybackStore.getState().activeLocalLyricsSource,
                localLyricsPriority: useLyricSettingsStore.getState().localLyricsPriority,
            }, format);
            setStatusMessage({
                type: exported ? 'success' : 'info',
                text: exported ? t('lyricExport.exported') : t('lyricExport.noLyrics'),
            });
            if (exported) close();
        } catch (error) {
            console.error('[LyricFileButton] Export failed', error);
            setStatusMessage({ type: 'error', text: t('lyricExport.failed') });
        } finally {
            setIsExporting(false);
        }
    };

    const openBatchExport = () => {
        close();
        openCommandPaletteCommand(LYRIC_EXPORT_COMMAND_ID);
        // Same hand-off as the segmentation toggle in AppearanceSection: the palette takes over,
        // so the panel underneath gets out of the way.
        setIsPanelOpen(false);
    };

    return (
        <>
            <button
                type="button"
                data-ponder-panel-source-lyrics-file
                onClick={() => setIsOpen(true)}
                className={buttonClassName}
                title={t('lyricFile.button')}
                aria-label={t('lyricFile.button')}
                aria-haspopup="dialog"
            >
                <ArrowDownUp size={14} />
            </button>
            <LyricFileDialog
                isOpen={isOpen}
                onClose={close}
                isDaylight={isDaylight}
                onImportChange={onImportChange ? handleImportChange : undefined}
                canExportCurrent={canExportCurrent}
                isExporting={isExporting}
                onExportCurrent={format => void exportCurrent(format)}
                onOpenBatchExport={openBatchExport}
            />
        </>
    );
};

export default LyricFileButton;
