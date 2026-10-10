import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpDown, Check, Moon, RefreshCw, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Theme, ThemeMode, VisualizerMode } from '../../types';
import type { ThemeSourceModel } from '../../hooks/themeControllerState';
import { useThemeQuickEditorStore } from '../../stores/useThemeQuickEditorStore';
import { useThemeSyncAction } from '../../hooks/useThemeSyncAction';
import AudioEqualizerDialog from './AudioEqualizerDialog';
import AppearanceSection from './controls/AppearanceSection';
import SongActionRow from './controls/SongActionRow';
import VolumeRow from './controls/VolumeRow';

// src/components/panelTab/ControlsTab.tsx
// 控制标签页只负责装配：歌曲动作、音量、外观区，以及底部的当前主题行。

interface ControlsTabProps {
    loopMode: 'off' | 'all' | 'one';
    onToggleLoop: () => void;
    onLike: () => void;
    isLiked: boolean;
    likeDisabled?: boolean;
    likeDisabledReason?: string;
    onGenerateAITheme: () => void;
    isGeneratingTheme: boolean;
    canGenerateAITheme: boolean;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    bgMode: ThemeMode;
    onBgModeChange: (mode: ThemeMode) => void;
    hasCustomTheme: boolean;
    themeSourceModel: ThemeSourceModel;
    defaultTheme: Theme;
    daylightTheme: Theme;
    visualizerMode: VisualizerMode;
    onVisualizerModeChange: (mode: VisualizerMode) => void;
    useCoverColorBg: boolean;
    onToggleCoverColorBg: (enable: boolean) => void;
    isDaylight: boolean;
    onToggleDaylight: () => void;
    volume: number;
    isMuted: boolean;
    onVolumePreview: (val: number) => void;
    onVolumeChange: (val: number) => void;
    onToggleMute: () => void;
    loopToggleDisabled?: boolean;
    onClosePanel?: () => void;
}

const ControlsTab: React.FC<ControlsTabProps> = ({
    loopMode,
    onToggleLoop,
    onLike,
    isLiked,
    likeDisabled = false,
    likeDisabledReason,
    onGenerateAITheme,
    isGeneratingTheme,
    canGenerateAITheme,
    theme,
    onThemeChange,
    onBgModeChange,
    hasCustomTheme,
    themeSourceModel,
    defaultTheme,
    daylightTheme,
    visualizerMode,
    onVisualizerModeChange,
    useCoverColorBg,
    onToggleCoverColorBg,
    isDaylight,
    onToggleDaylight,
    volume,
    isMuted,
    onVolumePreview,
    onVolumeChange,
    onToggleMute,
    loopToggleDisabled = false,
    onClosePanel,
}) => {
    const { t } = useTranslation();
    const openThemeQuickEditor = useThemeQuickEditorStore(state => state.openEditor);
    const { themeSyncState, runThemeSync } = useThemeSyncAction();

    const formatThemeDisplayName = (name: string) => {
        if (themeSourceModel.activeSource !== 'default') {
            return name;
        }

        return name === defaultTheme.name
            ? t('theme.midnightDefault')
            : (name === daylightTheme.name ? t('theme.daylightDefault') : name);
    };

    const activeThemeSource = themeSourceModel.current;
    const currentEditableSource = themeSourceModel.editableSource;
    const themeDisplayName = formatThemeDisplayName(activeThemeSource.label || theme.name);

    const openCurrentThemeQuickEditor = () => {
        if (currentEditableSource) {
            openThemeQuickEditor(currentEditableSource);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative"
        >
            <div className="space-y-4">
                <SongActionRow
                    loopMode={loopMode}
                    onToggleLoop={onToggleLoop}
                    loopToggleDisabled={loopToggleDisabled}
                    onLike={onLike}
                    isLiked={isLiked}
                    likeDisabled={likeDisabled}
                    likeDisabledReason={likeDisabledReason}
                    onGenerateAITheme={onGenerateAITheme}
                    isGeneratingTheme={isGeneratingTheme}
                    canGenerateAITheme={canGenerateAITheme}
                    themeSourceModel={themeSourceModel}
                    isDaylight={isDaylight}
                />

                <div className="pt-2 border-t border-white/5 space-y-3">
                    <VolumeRow
                        volume={volume}
                        isMuted={isMuted}
                        onVolumePreview={onVolumePreview}
                        onVolumeChange={onVolumeChange}
                        onToggleMute={onToggleMute}
                        theme={theme}
                        isDaylight={isDaylight}
                    />

                    <AppearanceSection
                        theme={theme}
                        onThemeChange={onThemeChange}
                        isDaylight={isDaylight}
                        visualizerMode={visualizerMode}
                        onVisualizerModeChange={onVisualizerModeChange}
                        useCoverColorBg={useCoverColorBg}
                        onToggleCoverColorBg={onToggleCoverColorBg}
                        themeSourceModel={themeSourceModel}
                        onBgModeChange={onBgModeChange}
                        hasCustomTheme={hasCustomTheme}
                        defaultTheme={defaultTheme}
                        daylightTheme={daylightTheme}
                        onClosePanel={onClosePanel}
                    />
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onToggleDaylight}
                            className={`rounded-md p-1 transition-all ${isDaylight ? 'text-amber-500' : 'text-blue-300'}`}
                            title={isDaylight ? t('theme.switchToDark') : t('theme.switchToLight')}
                            aria-label={isDaylight ? t('theme.switchToDark') : t('theme.switchToLight')}
                        >
                            {isDaylight ? <Sun size={14} /> : <Moon size={14} />}
                        </button>
                        {currentEditableSource ? (
                            <button
                                type="button"
                                onClick={openCurrentThemeQuickEditor}
                                className={`max-w-[120px] truncate rounded-md px-1.5 py-1 text-left text-xs font-bold transition-colors ${isDaylight ? 'hover:bg-black/10' : 'hover:bg-white/10'}`}
                                title={currentEditableSource === 'custom'
                                    ? (t('options.customThemeQuickEditTitle') || 'Edit Custom Theme')
                                    : (t('options.aiThemeQuickEditTitle') || 'Edit AI Theme')}
                            >
                                {themeDisplayName}
                            </button>
                        ) : (
                            <span className="text-xs font-bold truncate max-w-[120px]">
                                {themeDisplayName}
                            </span>
                        )}
                        {themeSourceModel.activeSource !== 'default' && (
                            <button
                                onClick={() => void runThemeSync()}
                                disabled={themeSyncState === 'syncing'}
                                className={`p-1 rounded-full ${isDaylight ? 'hover:bg-black/10' : 'hover:bg-white/10'} transition-colors disabled:cursor-wait`}
                                title={themeSyncState === 'syncing'
                                    ? t('options.syncing')
                                    : themeSyncState === 'complete'
                                        ? t('ui.synced')
                                        : t('commandPalette.commands.sync-now.title')}
                            >
                                <AnimatePresence mode="wait" initial={false}>
                                    <motion.span
                                        key={themeSyncState}
                                        initial={{ opacity: 0, scale: 0.55, rotate: -35 }}
                                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                        exit={{ opacity: 0, scale: 0.55, rotate: 35 }}
                                        transition={{ duration: 0.16, ease: 'easeOut' }}
                                        className="block"
                                    >
                                        {themeSyncState === 'syncing' ? (
                                            <RefreshCw size={12} className="animate-spin" />
                                        ) : themeSyncState === 'complete' ? (
                                            <Check size={12} className="text-green-500" strokeWidth={3} />
                                        ) : (
                                            <ArrowUpDown size={12} />
                                        )}
                                    </motion.span>
                                </AnimatePresence>
                            </button>
                        )}
                    </div>
                </div>

            </div>

            <AudioEqualizerDialog isDaylight={isDaylight} theme={theme} />

        </motion.div>
    );
};

export default ControlsTab;
