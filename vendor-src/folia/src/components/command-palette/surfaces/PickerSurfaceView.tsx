import React, { useEffect, useRef } from 'react';
import { AudioLines, Check, CornerDownLeft, LayoutGrid, Wallpaper } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme, VisualizerBackgroundMode, VisualizerMode } from '../../../types';
import { BackgroundModeGlyph, VisualizerModeGlyph } from '../../visualizer/modeGlyphs';
import { getPickerModeLabel, readPickerMode } from '../commands/pickerOptions';
import type { CommandPaletteMatch } from '../types';

// src/components/command-palette/surfaces/PickerSurfaceView.tsx
// Visualizer and background pickers. Both are lists, so they wear the palette's own list shape —
// the caption bar the all-commands view uses, then rows built like the default match rows —
// rather than the centred hero layout the single-control volume and FM surfaces use. Rows carry
// the mode glyphs the player panel's mode stepper draws, so a mode looks identical wherever it is
// offered; unknown modes fall back inside the glyph components.

type PickerSurfaceViewProps = {
    kind: 'visualizer' | 'background';
    matches: CommandPaletteMatch[];
    activeIndex: number;
    setActiveIndex: (index: number) => void;
    executeMatch: (index: number) => Promise<boolean>;
    isDaylight: boolean;
    isExecuting: boolean;
    theme: Theme;
    currentMode: string;
};

const HEADER = {
    visualizer: { icon: LayoutGrid, commandId: 'visualizer-picker', title: 'Pick a visualizer' },
    background: { icon: Wallpaper, commandId: 'background-picker', title: 'Pick a background' },
} as const;

const PickerSurfaceView: React.FC<PickerSurfaceViewProps> = ({
    kind,
    matches,
    activeIndex,
    setActiveIndex,
    executeMatch,
    isDaylight,
    isExecuting,
    theme,
    currentMode,
}) => {
    const { t } = useTranslation();
    const translate = (key: string, fallback?: string) => t(key, { defaultValue: fallback ?? key });
    const activeRowRef = useRef<HTMLButtonElement | null>(null);

    // Arrow keys move activeIndex through the shared match pipeline, so the list only has to keep
    // the highlighted row in view.
    useEffect(() => {
        activeRowRef.current?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    if (matches.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center opacity-50">
                <AudioLines size={26} />
                <div className="text-sm">{t('commandPalette.empty', 'No matching command')}</div>
            </div>
        );
    }

    const itemActiveBg = isDaylight ? 'bg-black/10' : 'bg-white/10';
    const itemIdleBg = isDaylight ? 'hover:bg-black/5' : 'hover:bg-white/5';
    const header = HEADER[kind];
    const HeaderIcon = header.icon;

    return (
        <div>
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium opacity-60">
                <HeaderIcon size={14} />
                <span>{translate(`commandPalette.commands.${header.commandId}.title`, header.title)}</span>
                <span className="ml-auto min-w-0 truncate">
                    {t('commandPalette.pickerCurrent', {
                        defaultValue: 'Current: {{mode}}',
                        mode: getPickerModeLabel(kind, currentMode, translate),
                    })}
                </span>
            </div>
            {matches.map((match, index) => {
                const isActive = index === activeIndex;
                const mode = readPickerMode(kind, match.command.id);
                const isSelected = mode === currentMode;
                return (
                    <button
                        key={match.command.id}
                        ref={isActive ? activeRowRef : undefined}
                        type="button"
                        data-picker-mode={mode}
                        data-picker-active={isActive ? 'true' : 'false'}
                        data-picker-selected={isSelected ? 'true' : 'false'}
                        disabled={isExecuting}
                        onMouseEnter={() => {
                            if (!isExecuting) {
                                setActiveIndex(index);
                            }
                        }}
                        onClick={() => {
                            if (!isExecuting) {
                                setActiveIndex(index);
                                void executeMatch(index);
                            }
                        }}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                            isActive ? itemActiveBg : itemIdleBg
                        }`}
                    >
                        {/* No container around the glyph, but a fixed column, so every name starts
                            on the same edge whatever the glyph's own drawing width is. */}
                        <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center"
                            style={{ color: theme.accentColor }}
                        >
                            {kind === 'visualizer'
                                ? <VisualizerModeGlyph mode={mode as VisualizerMode} size={20} />
                                : <BackgroundModeGlyph mode={mode as VisualizerBackgroundMode} size={20} />}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{match.command.title}</span>
                            <span className="mt-0.5 block truncate text-xs opacity-50">{match.command.description}</span>
                        </span>
                        {isSelected && <Check size={16} className="shrink-0" style={{ color: theme.accentColor }} />}
                        {isActive && (
                            <span className="hidden shrink-0 items-center gap-1 text-xs opacity-45 sm:flex">
                                <CornerDownLeft size={13} />
                                {t('commandPalette.run', 'Run')}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default PickerSurfaceView;
