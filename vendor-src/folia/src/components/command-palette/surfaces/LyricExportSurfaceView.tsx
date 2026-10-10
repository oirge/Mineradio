import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, FileJson, FileText, HardDrive, Layers, Tag } from 'lucide-react';
import type { Theme } from '../../../types';
import { useLyricSettingsStore } from '../../../stores/useLyricSettingsStore';
import { setStatusMessage } from '../../../stores/useStatusMessageStore';
import { runLyricExport } from '../../../services/lyricExport/runLyricExport';
import { triggerBlobDownload } from '../../../services/lyricExport/lyricExportFiles';
import type {
    LyricExportFormat,
    LyricExportOptions,
    LyricExportProgress,
    LyricExportScope,
} from '../../../services/lyricExport/types';
import { createLyricExportTone, ExtraChip, OptionCard, RunBar, SectionHeading, ToggleCard } from './LyricExportSurfaceParts';

// src/components/command-palette/surfaces/LyricExportSurfaceView.tsx
// Batch lyric export: pick what to include, run, and download one zip. The run lives in this
// component, so unmounting (closing the palette) aborts it rather than leaving it orphaned.
//
// Layout follows the questions in order — which songs, which formats, how files are named — each
// under its own heading. Scope and format are multi-select cards rather than a column of identical
// toggles, and the LRC-only extras sit inside the format section so they read as belonging to LRC.
// The action bar is pinned below the scroll area so Export never scrolls out of reach.

type LyricExportSurfaceViewProps = {
    isDaylight: boolean;
    settingsCardClass: string;
    toggleOffBackgroundClass: string;
    theme: Theme;
};

type RunState =
    | { kind: 'idle' }
    | { kind: 'running'; progress: LyricExportProgress }
    | { kind: 'done'; exported: number; skipped: number };

const DEFAULT_OPTIONS: LyricExportOptions = {
    scopes: ['online', 'local'],
    formats: ['fia', 'lrc'],
    includeTranslation: true,
    includeRomanization: true,
    resolveOnlineMetadata: true,
};

const toggleIn = <T,>(items: T[], item: T): T[] => (
    items.includes(item) ? items.filter(entry => entry !== item) : [...items, item]
);

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

export default function LyricExportSurfaceView({
    isDaylight,
    settingsCardClass,
    toggleOffBackgroundClass,
    theme,
}: LyricExportSurfaceViewProps) {
    const { t } = useTranslation();
    const [options, setOptions] = useState<LyricExportOptions>(DEFAULT_OPTIONS);
    const [runState, setRunState] = useState<RunState>({ kind: 'idle' });
    const controllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => controllerRef.current?.abort(), []);

    const tone = createLyricExportTone(theme.secondaryColor, isDaylight);
    const isRunning = runState.kind === 'running';
    const canStart = !isRunning && options.scopes.length > 0 && options.formats.length > 0;

    const start = async () => {
        if (!canStart) return;
        const controller = new AbortController();
        controllerRef.current = controller;
        setRunState({ kind: 'running', progress: { phase: 'collect', done: 0, total: 0 } });

        try {
            const result = await runLyricExport(options, useLyricSettingsStore.getState().localLyricsPriority, {
                signal: controller.signal,
                onProgress: progress => {
                    if (!controller.signal.aborted) setRunState({ kind: 'running', progress });
                },
            });
            if (controller.signal.aborted) return;
            if (result.archive) {
                triggerBlobDownload(result.archive.blob, result.archive.fileName);
            }
            setRunState({ kind: 'done', exported: result.exportedCount, skipped: result.skippedCount });
            setStatusMessage({
                type: result.archive ? 'success' : 'info',
                text: result.archive
                    ? t('lyricExport.done', { exported: result.exportedCount, skipped: result.skippedCount })
                    : t('lyricExport.empty'),
            });
        } catch (error) {
            if (isAbortError(error) || controller.signal.aborted) {
                setRunState({ kind: 'idle' });
                setStatusMessage({ type: 'info', text: t('lyricExport.cancelled') });
                return;
            }
            console.error('[LyricExport] Batch export failed', error);
            setRunState({ kind: 'idle' });
            setStatusMessage({ type: 'error', text: t('lyricExport.failed') });
        } finally {
            if (controllerRef.current === controller) controllerRef.current = null;
        }
    };

    const toggleScope = (scope: LyricExportScope) => () => (
        setOptions(current => ({ ...current, scopes: toggleIn(current.scopes, scope) }))
    );
    const toggleFormat = (format: LyricExportFormat) => () => (
        setOptions(current => ({ ...current, formats: toggleIn(current.formats, format) }))
    );

    const statusText = (() => {
        if (runState.kind === 'done') {
            return runState.exported > 0
                ? t('lyricExport.done', { exported: runState.exported, skipped: runState.skipped })
                : t('lyricExport.empty');
        }
        if (runState.kind !== 'running') {
            return canStart ? t('lyricExport.closeCancels') : t('lyricExport.nothingSelected');
        }
        const { phase, done, total } = runState.progress;
        if (phase === 'package') return t('lyricExport.phasePackage');
        if (phase === 'metadata') return t('lyricExport.phaseMetadata', { done, total });
        return total > 0 ? t('lyricExport.phaseCollect', { done, total }) : t('lyricExport.phaseCollectStart');
    })();

    const lrcSelected = options.formats.includes('lrc');

    return (
        <div data-ponder="lyric-export-surface" className="flex h-full flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-6">
                <div className="mx-auto w-full max-w-lg space-y-6">
                    <p className="text-xs leading-relaxed opacity-55" style={{ color: 'var(--text-secondary)' }}>
                        {t('lyricExport.surfaceDesc')}
                    </p>

                    <section data-ponder-lyric-export-scope>
                        <SectionHeading icon={Layers} label={t('lyricExport.sectionScope')} />
                        <div className="grid grid-cols-2 gap-2">
                            <OptionCard tone={tone} icon={Cloud} label={t('lyricExport.scopeOnline')} description={t('lyricExport.scopeOnlineDesc')}
                                selected={options.scopes.includes('online')} disabled={isRunning} onClick={toggleScope('online')} />
                            <OptionCard tone={tone} icon={HardDrive} label={t('lyricExport.scopeLocal')} description={t('lyricExport.scopeLocalDesc')}
                                selected={options.scopes.includes('local')} disabled={isRunning} onClick={toggleScope('local')} />
                        </div>
                    </section>

                    <section data-ponder-lyric-export-formats>
                        <SectionHeading icon={FileText} label={t('lyricExport.sectionFormats')} />
                        <div className="grid grid-cols-2 gap-2">
                            <OptionCard tone={tone} icon={FileJson} label={t('lyricExport.formatFia')} description={t('lyricExport.formatFiaDesc')}
                                selected={options.formats.includes('fia')} disabled={isRunning} onClick={toggleFormat('fia')} />
                            <OptionCard tone={tone} icon={FileText} label={t('lyricExport.formatLrc')} description={t('lyricExport.formatLrcDesc')}
                                selected={lrcSelected} disabled={isRunning} onClick={toggleFormat('lrc')} />
                        </div>
                        {lrcSelected && (
                            <div
                                className="ml-auto mt-2 flex w-[calc(50%-0.25rem)] flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5"
                                style={{ borderColor: tone.idleBorder }}
                            >
                                <span className="w-full text-[11px] opacity-50" style={{ color: 'var(--text-secondary)' }}>
                                    {t('lyricExport.lrcExtras')}
                                </span>
                                <ExtraChip tone={tone} label={t('lyricExport.extraTranslation')} hint={t('lyricExport.includeTranslationDesc')}
                                    checked={options.includeTranslation} disabled={isRunning}
                                    onClick={() => setOptions(current => ({ ...current, includeTranslation: !current.includeTranslation }))} />
                                <ExtraChip tone={tone} label={t('lyricExport.extraRomanization')} hint={t('lyricExport.includeRomanizationDesc')}
                                    checked={options.includeRomanization} disabled={isRunning}
                                    onClick={() => setOptions(current => ({ ...current, includeRomanization: !current.includeRomanization }))} />
                            </div>
                        )}
                    </section>

                    <section data-ponder-lyric-export-names>
                        <SectionHeading icon={Tag} label={t('lyricExport.sectionNames')} />
                        <ToggleCard tone={tone} cardClass={settingsCardClass} toggleOffBackgroundClass={toggleOffBackgroundClass}
                            label={t('lyricExport.resolveOnline')} description={t('lyricExport.resolveOnlineDesc')}
                            active={options.resolveOnlineMetadata} disabled={isRunning}
                            onToggle={() => setOptions(current => ({ ...current, resolveOnlineMetadata: !current.resolveOnlineMetadata }))} />
                    </section>
                </div>
            </div>

            <RunBar
                tone={tone}
                statusText={statusText}
                isRunning={isRunning}
                canStart={canStart}
                startLabel={t('lyricExport.start')}
                cancelLabel={t('lyricExport.cancel')}
                onStart={() => void start()}
                onCancel={() => controllerRef.current?.abort()}
            />
        </div>
    );
}
