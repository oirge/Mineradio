import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, FileJson, FileText, PackageOpen, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ThemedDialog from '../shared/ThemedDialog';
import type { LyricExportFormat } from '../../services/lyricExport/types';

// src/components/panelTab/LyricFileDialog.tsx
// The lyric file dialog behind the panel's import / export button: import a file, export this song
// as .fia or .lrc, or hand off to the batch export page. Presentational: the button owns the state
// and the actions.
//
// Portalled to <body>: the panel root has a backdrop filter, which would otherwise turn the
// dialog's fixed overlay into one sized and clipped to the panel. React events still bubble to the
// panel root through the portal, where they are stopped, so clicking in here never closes the panel.

/** Every format the local-file adapter reads, `.fia` included. */
const LYRIC_IMPORT_ACCEPT = '.lrc,.vtt,.ttml,.qrc,.yrc,.krc,.txt,.fia,.json';

type LyricFileDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    isDaylight: boolean;
    /** Left out where the source cannot take an imported file; the import section is then hidden. */
    onImportChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    canExportCurrent: boolean;
    isExporting: boolean;
    onExportCurrent: (format: LyricExportFormat) => void;
    onOpenBatchExport: () => void;
};

const LyricFileDialog: React.FC<LyricFileDialogProps> = ({
    isOpen,
    onClose,
    isDaylight,
    onImportChange,
    canExportCurrent,
    isExporting,
    onExportCurrent,
    onOpenBatchExport,
}) => {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);

    // The overlay is marked as a keyboard window, which makes the global shortcut bridge ignore
    // Escape; ThemedDialog has no key handling of its own. Same arrangement as AudioEqualizerDialog.
    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (typeof document === 'undefined') return null;

    const idleBorder = isDaylight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)';
    const hoverClass = isDaylight ? 'hover:bg-black/[0.04]' : 'hover:bg-white/[0.06]';
    const textPrimary = isDaylight ? 'text-zinc-900' : 'text-white';
    const textSecondary = isDaylight ? 'text-zinc-500' : 'text-zinc-400';
    const exportDisabled = !canExportCurrent || isExporting;

    const renderSectionHeading = (label: string) => (
        <h3 className={`mb-2.5 text-xs font-bold uppercase tracking-wider opacity-70 ${textSecondary}`}>{label}</h3>
    );

    /** A full-width row: icon, title and one line of explanation, optionally a trailing chevron. */
    const renderRow = (icon: LucideIcon, title: string, description: string, onClick: () => void, trailing = false) => {
        const Icon = icon;
        return (
            <button
                type="button"
                onClick={onClick}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${hoverClass}`}
                style={{ borderColor: idleBorder }}
            >
                <Icon size={16} className={`shrink-0 opacity-70 ${textPrimary}`} />
                <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${textPrimary}`}>{title}</span>
                    <span className={`block text-[11px] ${textSecondary}`}>{description}</span>
                </span>
                {trailing && <ChevronRight size={15} className={`shrink-0 opacity-50 ${textPrimary}`} />}
            </button>
        );
    };

    /** A half-width tile for one export format. */
    const renderFormatTile = (icon: LucideIcon, format: LyricExportFormat, title: string, description: string) => {
        const Icon = icon;
        return (
            <button
                type="button"
                disabled={exportDisabled}
                onClick={() => onExportCurrent(format)}
                className={`flex flex-col gap-1.5 rounded-xl border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${exportDisabled ? '' : hoverClass}`}
                style={{ borderColor: idleBorder }}
            >
                <span className={`flex items-center gap-2 text-sm font-medium ${textPrimary}`}>
                    <Icon size={15} className="shrink-0 opacity-70" />
                    {title}
                </span>
                <span className={`text-[11px] leading-snug ${textSecondary}`}>{description}</span>
            </button>
        );
    };

    return createPortal((
        <ThemedDialog
            isOpen={isOpen}
            onClose={onClose}
            isDaylight={isDaylight}
            title={t('lyricFile.title')}
            description={t(onImportChange ? 'lyricFile.description' : 'lyricFile.descriptionExportOnly')}
        >
            <div data-ponder="lyric-file-dialog" className="space-y-5">
                {onImportChange && (
                    <section>
                        {renderSectionHeading(t('lyricFile.importHeading'))}
                        {renderRow(Upload, t('lyricFile.importChoose'), t('lyricFile.importFormats'), () => inputRef.current?.click())}
                        <input
                            type="file"
                            accept={LYRIC_IMPORT_ACCEPT}
                            ref={inputRef}
                            className="hidden"
                            onChange={onImportChange}
                        />
                    </section>
                )}

                <section>
                    {renderSectionHeading(t('lyricFile.exportHeading'))}
                    <div className="grid grid-cols-2 gap-2">
                        {renderFormatTile(FileJson, 'fia', t('lyricExport.formatFia'), t('lyricExport.formatFiaDesc'))}
                        {renderFormatTile(FileText, 'lrc', t('lyricExport.formatLrc'), t('lyricExport.formatLrcDesc'))}
                    </div>
                    {!canExportCurrent && (
                        <p className={`mt-2 text-[11px] ${textSecondary}`}>{t('lyricExport.noLyrics')}</p>
                    )}
                </section>

                {renderRow(PackageOpen, t('lyricFile.batchTitle'), t('lyricFile.batchDesc'), onOpenBatchExport, true)}
            </div>
        </ThemedDialog>
    ), document.body);
};

export default LyricFileDialog;
