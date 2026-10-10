import React from 'react';
import { useMotionValue } from 'framer-motion';
import { Check, Moon, Pause, Play, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VisualizerRenderer from '../../visualizer/VisualizerRenderer';
import {
    AudioBands,
    CappellaAvatarImage,
    CappellaEmojiImage,
    MonetPortraitImage,
    SubtitleContentMode,
    Theme,
    VisualizerMode,
} from '../../../types';
import {
    VIS_PLAYGROUND_PREVIEW_COVER_URL,
    VIS_PLAYGROUND_PREVIEW_LINES,
} from '../../visualizer/PreviewPlaceholder';
import { getVisualizerScopedSeed } from '../../visualizer/registry';
import type { VisualizerTuningBundle } from '../../visualizer/tuningRegistry';
import type { VisualizerBackgroundConfig } from '../../visualizer/backgrounds/definition';
import type { EditableMode } from './themeParkDraft';

// src/components/modal/theme-park/ThemeParkPreview.tsx
// The live visualizer preview pane of the Theme Park editor: renders the draft theme through the
// same VisualizerRenderer the player uses, with the mode badges and the pause control on top.

const ThemePreviewLayer: React.FC<{
    theme: Theme;
    mode: EditableMode;
    isActive: boolean;
    visualizerMode: VisualizerMode;
    visualizerTunings?: VisualizerTuningBundle;
    visualizerModeLabel: string;
    staticMode: boolean;
    visualizerOpacity: number;
    backgroundConfig?: VisualizerBackgroundConfig;
    cappellaCustomEmojiImages: CappellaEmojiImage[];
    cappellaCustomAvatarImages: CappellaAvatarImage[];
    monetPortraitImage?: MonetPortraitImage | null;
    showSubtitleTranslation: boolean;
    subtitleContentMode?: SubtitleContentMode;
    lyricsFontScale: number;
    currentTime: ReturnType<typeof useMotionValue<number>>;
    currentLineIndex: number;
    audioPower: ReturnType<typeof useMotionValue<number>>;
    audioBands: AudioBands;
    clipPath?: string;
    overlayAlign: 'top-left' | 'bottom-right';
}> = ({
    theme,
    mode,
    isActive,
    visualizerMode,
    visualizerTunings,
    visualizerModeLabel,
    staticMode,
    visualizerOpacity,
    backgroundConfig,
    cappellaCustomEmojiImages,
    cappellaCustomAvatarImages,
    monetPortraitImage,
    showSubtitleTranslation,
    subtitleContentMode,
    lyricsFontScale,
    currentTime,
    currentLineIndex,
    audioPower,
    audioBands,
    clipPath,
    overlayAlign,
}) => {
        const { t } = useTranslation();
        const isLight = mode === 'light';
        const overlayPositionClass = overlayAlign === 'top-left'
            ? 'items-start justify-start'
            : 'items-end justify-end';
        const badgeRowAlignmentClass = overlayAlign === 'top-left'
            ? 'justify-start'
            : 'justify-end';
        const isBottomRight = overlayAlign === 'bottom-right';

        return (
            <div
                className="absolute inset-0 overflow-hidden"
                style={{
                    clipPath,
                }}
            >
                <div className="absolute inset-0">
                    <VisualizerRenderer
                        mode={visualizerMode}
                        visualizerTunings={visualizerTunings}
                        currentTime={currentTime}
                        currentLineIndex={currentLineIndex}
                        lines={VIS_PLAYGROUND_PREVIEW_LINES}
                        theme={theme}
                        isDaylight={isLight}
                        audioPower={audioPower}
                        audioBands={audioBands}
                        songTitle="Cappella Preview"
                        showText
                        staticMode={staticMode}
                        isPreviewMode
                        visualizerOpacity={visualizerOpacity}
                        background={backgroundConfig}
                        coverUrl={VIS_PLAYGROUND_PREVIEW_COVER_URL}
                        lyricsFontScale={lyricsFontScale}
                        showSubtitleTranslation={showSubtitleTranslation}
                        subtitleContentMode={subtitleContentMode}
                        cappellaCustomEmojiImages={cappellaCustomEmojiImages}
                        cappellaCustomAvatarImages={cappellaCustomAvatarImages}
                        monetPortraitImage={monetPortraitImage}
                        seed={getVisualizerScopedSeed(visualizerMode, `theme-park-${mode}`)}
                    />
                </div>

                <div className={`relative z-10 flex h-full p-4 pointer-events-none ${overlayPositionClass}`}>
                    <div className={`flex max-w-full flex-col gap-2 ${badgeRowAlignmentClass}`}>
                        {isBottomRight && (
                            <div className={`flex ${badgeRowAlignmentClass}`}>
                                <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 backdrop-blur-md" style={{ backgroundColor: `${theme.backgroundColor}88` }}>
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.accentColor }} />
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.secondaryColor }} />
                                </div>
                            </div>
                        )}
                        <div className={`flex max-w-full flex-wrap items-center gap-2 ${badgeRowAlignmentClass}`}>
                            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em] backdrop-blur-md" style={{ color: theme.primaryColor, borderColor: `${theme.primaryColor}30`, backgroundColor: `${theme.backgroundColor}80` }}>
                                {isLight ? <Sun size={13} /> : <Moon size={13} />}
                                <span>{isLight ? 'Light' : 'Dark'}</span>
                            </div>
                            {isActive && (
                                <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs backdrop-blur-md" style={{ color: theme.backgroundColor, backgroundColor: theme.accentColor }}>
                                    <Check size={12} />
                                    <span>{t('theme.editingBadge')}</span>
                                </div>
                            )}
                            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] backdrop-blur-md" style={{ color: theme.secondaryColor, borderColor: `${theme.secondaryColor}25`, backgroundColor: `${theme.backgroundColor}88` }}>
                                <span>{visualizerModeLabel}</span>
                            </div>
                        </div>
                        {!isBottomRight && (
                            <div className={`flex ${badgeRowAlignmentClass}`}>
                                <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 backdrop-blur-md" style={{ backgroundColor: `${theme.backgroundColor}88` }}>
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.accentColor }} />
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.secondaryColor }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

const ThemePreview: React.FC<{
    theme: Theme;
    mode: EditableMode;
    visualizerMode: VisualizerMode;
    visualizerTunings?: VisualizerTuningBundle;
    visualizerModeLabel: string;
    staticMode: boolean;
    visualizerOpacity: number;
    backgroundConfig?: VisualizerBackgroundConfig;
    cappellaCustomEmojiImages: CappellaEmojiImage[];
    cappellaCustomAvatarImages: CappellaAvatarImage[];
    monetPortraitImage?: MonetPortraitImage | null;
    showSubtitleTranslation: boolean;
    subtitleContentMode?: SubtitleContentMode;
    lyricsFontScale: number;
    currentTime: ReturnType<typeof useMotionValue<number>>;
    currentLineIndex: number;
    audioPower: ReturnType<typeof useMotionValue<number>>;
    audioBands: AudioBands;
    isPaused: boolean;
    onTogglePause: () => void;
}> = ({
    theme,
    mode,
    visualizerMode,
    visualizerTunings,
    visualizerModeLabel,
    staticMode,
    visualizerOpacity,
    backgroundConfig,
    cappellaCustomEmojiImages,
    cappellaCustomAvatarImages,
    monetPortraitImage,
    showSubtitleTranslation,
    subtitleContentMode,
    lyricsFontScale,
    currentTime,
    currentLineIndex,
    audioPower,
    audioBands,
    isPaused,
    onTogglePause,
}) => {
        const { t } = useTranslation();
        const borderColor = theme.accentColor;

        return (
            <div
                className="relative isolate h-[min(46vh,460px)] min-h-[300px] overflow-hidden rounded-[30px] border shadow-[0_18px_50px_rgba(0,0,0,0.18)] lg:h-full lg:min-h-0"
                style={{ borderColor }}
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onTogglePause();
                    }}
                    className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-950/40 text-white backdrop-blur-md transition-all hover:bg-zinc-950/60 hover:scale-105 active:scale-95 shadow-sm pointer-events-auto"
                    title={isPaused ? t('ui.play') : t('ui.pause')}
                    aria-label={isPaused ? t('ui.playPreview') : t('ui.pausePreview')}
                >
                    {isPaused ? <Play size={16} className="translate-x-[1px]" fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                </button>

                <ThemePreviewLayer
                    theme={theme}
                    mode={mode}
                    isActive={true}
                    visualizerMode={visualizerMode}
                    visualizerTunings={visualizerTunings}
                    visualizerModeLabel={visualizerModeLabel}
                    staticMode={staticMode}
                    visualizerOpacity={visualizerOpacity}
                    backgroundConfig={backgroundConfig}
                    cappellaCustomEmojiImages={cappellaCustomEmojiImages}
                    cappellaCustomAvatarImages={cappellaCustomAvatarImages}
                    monetPortraitImage={monetPortraitImage}
                    showSubtitleTranslation={showSubtitleTranslation}
                    subtitleContentMode={subtitleContentMode}
                    lyricsFontScale={lyricsFontScale}
                    currentTime={currentTime}
                    currentLineIndex={currentLineIndex}
                    audioPower={audioPower}
                    audioBands={audioBands}
                    overlayAlign="top-left"
                />
            </div>
        );
    };

export default ThemePreview;
