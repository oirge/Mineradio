import React from 'react';
import { AlertTriangle, Eye, FolderSearch, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../../types';
import type { LocalLibraryAutoScanRootState } from '../../../types/localLibraryWatch';
import { refreshLocalLibraryAutoScanRoots } from '../../../services/localLibraryAutoScan';
import { useLocalLibraryAutoScanState } from '../../../hooks/useLocalLibraryAutoScan';
import { useLocalLibrarySettingsStore } from '../../../stores/useLocalLibrarySettingsStore';
import { SettingsAnchor } from './navigation/SettingsAnchorContext';
import SettingsSectionHeading from './navigation/SettingsSectionHeading';

// src/components/modal/settings/LocalLibraryWatchSection.tsx
// Storage subview section for the local folder watcher: the toggle plus the live per-folder watch
// state, so a folder that is silently not being watched says so instead of just never rescanning.

type LocalLibraryWatchSectionProps = {
    /** Tailwind class set the storage subview already uses for error text. */
    errorTextColor: string;
    settingsCardClass: string;
    theme?: Theme;
    toggleOffBackgroundClass: string;
};

const LocalLibraryWatchSection: React.FC<LocalLibraryWatchSectionProps> = ({
    errorTextColor,
    settingsCardClass,
    theme,
    toggleOffBackgroundClass,
}) => {
    const { t } = useTranslation();
    const autoScanEnabled = useLocalLibrarySettingsStore(state => state.autoScanEnabled);
    const setAutoScanEnabled = useLocalLibrarySettingsStore(state => state.setAutoScanEnabled);
    const autoScan = useLocalLibraryAutoScanState();

    // Hidden wherever FileSystemObserver has not shipped; there is nothing to configure there.
    if (!autoScan.supported) {
        return null;
    }

    const describeRoot = (root: LocalLibraryAutoScanRootState): { text: string; warning: boolean; } => {
        if (root.skipReason === 'permission') {
            return { text: t('options.localLibraryWatchNoPermission') || 'Access expired. Re-import this folder to watch it.', warning: true };
        }
        if (root.error) {
            return { text: `${t('options.localLibraryWatchFailed') || 'Watch failed'}: ${root.error}`, warning: true };
        }
        if (!root.watching) {
            return { text: t('options.localLibraryWatchStarting') || 'Starting the watch...', warning: false };
        }
        if (!root.recursive) {
            return { text: t('options.localLibraryWatchRootOnly') || 'Watching this folder only; subfolders are not covered.', warning: true };
        }
        return { text: t('options.localLibraryWatchActive') || 'Watching this folder and its subfolders.', warning: false };
    };

    const lastScanLabel = autoScan.lastScanAt
        ? `${t('options.localLibraryWatchLastScan') || 'Last auto scan'}: ${new Date(autoScan.lastScanAt).toLocaleString()}`
        : (t('options.localLibraryWatchNeverScanned') || 'No automatic scan has run yet.');

    return (
        <SettingsAnchor anchorId="localLibraryWatch" label={t('options.localLibraryWatch') || 'Local Folder Watch'}>
            <SettingsSectionHeading icon={FolderSearch} label={t('options.localLibraryWatch') || 'Local Folder Watch'} />
            <div className={`p-4 rounded-xl border space-y-4 ${settingsCardClass}`}>
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {t('options.localLibraryAutoScan') || 'Auto scan imported folders'}
                        </div>
                        <div className="text-xs opacity-50 max-w-[280px]" style={{ color: 'var(--text-secondary)' }}>
                            {t('options.localLibraryAutoScanDesc') || 'Watch the folders you imported and run an incremental scan whenever their files change.'}
                        </div>
                    </div>
                    <button
                        onClick={() => setAutoScanEnabled(!autoScanEnabled)}
                        className={`shrink-0 w-12 h-6 rounded-full p-1 transition-colors ${!autoScanEnabled ? toggleOffBackgroundClass : ''}`}
                        style={{ backgroundColor: autoScanEnabled ? theme?.secondaryColor || 'rgba(114, 119, 134, 1)' : undefined }}
                        aria-pressed={autoScanEnabled}
                        aria-label={t('options.localLibraryAutoScan') || 'Auto scan imported folders'}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${autoScanEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>

                {autoScanEnabled && (
                    <div className="pt-3 border-t border-white/10 space-y-3">
                        {autoScan.roots.length === 0 ? (
                            <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                                {autoScan.attaching
                                    ? (t('options.localLibraryWatchAttaching') || 'Attaching to the imported folders...')
                                    : (t('options.localLibraryWatchNoFolders') || 'No imported folders yet. Import one from the local library page.')}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {autoScan.roots.map(root => {
                                    const detail = describeRoot(root);
                                    return (
                                        <div key={root.rootFolderName} className="bg-black/10 rounded-lg border border-white/5 px-3 py-2">
                                            <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                                                {detail.warning
                                                    ? <AlertTriangle size={12} className="shrink-0 opacity-70" />
                                                    : <Eye size={12} className="shrink-0 opacity-50" />}
                                                <span className="truncate">{root.rootFolderName}</span>
                                            </div>
                                            <div className="text-[10px] opacity-45 mt-1 break-all font-mono" style={{ color: 'var(--text-secondary)' }}>
                                                {detail.text}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-3">
                            <div className="text-[11px] opacity-50 min-w-0" style={{ color: 'var(--text-secondary)' }}>
                                {autoScan.scanning
                                    ? (t('options.localLibraryWatchScanning') || 'Scanning changed files...')
                                    : lastScanLabel}
                            </div>
                            <button
                                onClick={() => { void refreshLocalLibraryAutoScanRoots(); }}
                                disabled={autoScan.attaching}
                                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {autoScan.attaching
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : <RefreshCw size={12} />}
                                {t('options.localLibraryWatchRecheck') || 'Re-check folders'}
                            </button>
                        </div>

                        {autoScan.lastError && (
                            <div className={`text-[11px] break-all ${errorTextColor}`}>
                                {autoScan.lastError}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </SettingsAnchor>
    );
};

export default LocalLibraryWatchSection;
