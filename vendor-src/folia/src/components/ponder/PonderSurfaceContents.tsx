import React from 'react';
import { ChevronDown, Command, GripVertical, ListMusic, Move, RotateCcw, Search, Volume2 } from 'lucide-react';
import type { PonderSurfaceKind } from '../../types/ponder';
import PonderGridPageSurface from './surfaces/PonderGridPageSurface';
import PonderGridViewPageSurface from './surfaces/PonderGridViewPageSurface';
import PonderLatticePageSurface from './surfaces/PonderLatticePageSurface';
import PonderPlayerBarSurface from './surfaces/PonderPlayerBarSurface';
import PonderPlayerPageSurface from './surfaces/PonderPlayerPageSurface';
import PonderSidePanelSurface from './surfaces/PonderSidePanelSurface';
import PonderOnboardingSurface from './surfaces/PonderOnboardingSurface';
import PonderDesktopFeaturesSurface from './surfaces/PonderDesktopFeaturesSurface';
import PonderQueueCommandSurface from './surfaces/PonderQueueCommandSurface';
import PonderLyricExportSurface from './surfaces/PonderLyricExportSurface';
import {
    PonderGridHotkeySurface,
    PonderLibraryWatchSurface,
    PonderLyricsSourceSurface,
    PonderQueueSettingsSurface,
    PonderReplayGainSurface,
    PonderTransitionSettingsSurface,
} from './surfaces/PonderPlaybackSettingsSurfaces';
import {
    PonderCustomShortcutSurface,
    PonderPinnedCommandsSurface,
} from './surfaces/PonderCommandSettingsSurfaces';
import PonderImportExportSurface from './surfaces/PonderImportExportSurface';
import PonderAudioEqualizerSurface from './surfaces/PonderAudioEqualizerSurface';
import PonderLyricStyleSurface from './surfaces/PonderLyricStyleSurface';
import {
    PonderThemeParkSurface,
    PonderVisPlaygroundSurface,
} from './surfaces/PonderFullEditorSurfaces';
import PonderLatticeChromeSurface from './surfaces/PonderLatticeChromeSurface';
import {
    PonderLyricsAnimationSettingsSurface,
    PonderThemeSettingsSurface,
} from './surfaces/PonderSettingsSectionSurfaces';
import {
    PonderGridActionButtonSurface,
    PonderGridViewCardsSurface,
    PonderLocalFolderActionsSurface,
    PonderLocalTrackListSurface,
} from './surfaces/PonderGridViewSurfaces';
import {
    PonderGrid3dCardStyleSurface,
    PonderGridViewCardSurface,
    PonderLatticeStyleSurface,
} from './surfaces/PonderAppearanceSettingsSurfaces';
import {
    PonderLocalGridControlsSurface,
    PonderLocalGridMapSurface,
    PonderOnlineCollectionActionsSurface,
} from './surfaces/PonderLocalLibrarySurfaces';
import type { PonderSurfaceStateRegistrar } from './surfaces/PonderSurfaceStateLayer';

// src/components/ponder/PonderSurfaceContents.tsx
// Synthetic surfaces imitate the silhouette of the real UI without mounting live settings or
// command-palette state. Their job is recognition: a queue should read as songs, not paragraph text.

type PonderSurfaceContentsProps = {
    kind?: PonderSurfaceKind;
    accent: string;
    line: string;
    outline: string;
    registerStateNode?: PonderSurfaceStateRegistrar;
};

type PonderPageSurfaceKind = Extract<PonderSurfaceKind, `${string}-page`>;

const isPageSurfaceKind = (kind: PonderSurfaceKind): kind is PonderPageSurfaceKind => kind.endsWith('-page');

const PaletteHeader: React.FC<{ line: string; outline: string }> = ({ line, outline }) => (
    <div data-ponder-palette-header className="flex h-[22%] items-center gap-2 border-b px-[4%]" style={{ borderColor: outline }}>
        <Search className="h-[34%] w-auto opacity-50" />
        <div className="h-[24%] flex-1 rounded-full" style={{ backgroundColor: line }} />
        <div className="h-[38%] w-[9%] rounded-full border" style={{ borderColor: outline }} />
    </div>
);

const PaletteContents: React.FC<{ line: string; outline: string }> = ({ line, outline }) => (
    <div className="absolute inset-0">
        <PaletteHeader line={line} outline={outline} />
        <div className="flex h-[78%] flex-col justify-evenly px-[4%] py-[2%]">
            {[78, 92, 68].map((width, index) => (
                <div key={width} className="flex h-[27%] min-h-0 items-center gap-[3%] rounded-lg px-[2%]" style={{ backgroundColor: index === 0 ? line : undefined }}>
                    <span className="flex aspect-square h-[68%] items-center justify-center rounded-md border" style={{ borderColor: outline }}>
                        <Command className="h-1/2 w-1/2 opacity-55" />
                    </span>
                    <span className="flex flex-1 flex-col gap-1">
                        <span className="h-1.5 rounded-full" style={{ width: `${width}%`, backgroundColor: line }} />
                        <span className="h-1 rounded-full opacity-70" style={{ width: `${Math.max(42, width - 24)}%`, backgroundColor: line }} />
                    </span>
                </div>
            ))}
        </div>
    </div>
);

const PickerContents: React.FC<{ line: string; outline: string; accent: string }> = ({ line, outline, accent }) => (
    <div className="absolute inset-0 flex flex-col justify-center gap-[12%] px-[8%] py-[8%]">
        <div className="flex items-center gap-2">
            <div className="h-2 w-[42%] rounded-full" style={{ backgroundColor: line }} />
            <div className="h-px flex-1" style={{ backgroundColor: outline }} />
        </div>
        <div className="grid grid-cols-2 gap-[6%]">
            {[0, 1].map(index => (
                <div key={index} className="flex flex-col gap-2">
                    <div className="h-1.5 w-[58%] rounded-full" style={{ backgroundColor: line }} />
                    <div data-ponder-picker-field className="flex h-9 items-center gap-2 rounded-lg border px-2" style={{ borderColor: outline }}>
                        <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: line }}>
                            {index === 0 ? <ListMusic className="h-3 w-3" style={{ color: accent }} /> : <Volume2 className="h-3 w-3" style={{ color: accent }} />}
                        </span>
                        <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: line }} />
                        <ChevronDown className="h-3 w-3 opacity-45" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

/**
 * 设置里的「底部界面」那一组：一根决定离底边多远的滑杆，下面是「在播放页拖动调整」和「重置」。
 *
 * 用 picker 那块泛化的下拉框讲不清这一章 —— 字幕说的是滑杆和一个把胶囊变成可拖物体的按钮，
 * 画面上就得真的有这两样。
 */
const BottomUiSettingsContents: React.FC<{ line: string; outline: string; accent: string }> = ({ line, outline, accent }) => (
    <div data-ponder-bottom-ui-settings className="absolute inset-0 flex flex-col justify-center gap-[9%] px-[7%]">
        <div className="flex flex-col gap-2">
            <span className="h-2 w-[38%] rounded-full" style={{ backgroundColor: line }} />
            <span className="h-1.5 w-[62%] rounded-full opacity-60" style={{ backgroundColor: line }} />
        </div>
        <div data-ponder-bottom-ui-offset-track className="relative h-2 rounded-full" style={{ backgroundColor: line }}>
            <span className="absolute inset-y-0 left-0 w-[46%] rounded-full" style={{ backgroundColor: accent, opacity: 0.6 }} />
            <span
                className="absolute left-[46%] top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                style={{ borderColor: outline, backgroundColor: accent }}
            />
        </div>
        <div className="flex items-center gap-[4%]">
            <span
                data-ponder-bottom-ui-reposition
                className="flex h-9 flex-1 items-center justify-center gap-2 rounded-full border"
                style={{ borderColor: accent, color: accent }}
            >
                <Move className="h-3.5 w-3.5" />
                <span className="h-1.5 w-[42%] rounded-full" style={{ backgroundColor: accent, opacity: 0.55 }} />
            </span>
            <span className="flex h-9 w-[32%] items-center justify-center gap-2 rounded-full border" style={{ borderColor: outline }}>
                <RotateCcw className="h-3.5 w-3.5 opacity-55" />
                <span className="h-1.5 w-[38%] rounded-full" style={{ backgroundColor: line }} />
            </span>
        </div>
    </div>
);

const QueueContents: React.FC<{ line: string; outline: string; accent: string }> = ({ line, outline, accent }) => (
    <div className="absolute inset-0">
        <PaletteHeader line={line} outline={outline} />
        <div className="flex h-[78%] flex-col px-[4%] py-[2%]">
            {[82, 64, 74, 56].map((width, index) => (
                <div key={width} data-ponder-queue-row className="flex min-h-0 flex-1 items-center gap-2 border-b" style={{ borderColor: outline }}>
                    <GripVertical className="h-3 w-3 opacity-30" />
                    <span className="aspect-square h-[68%] rounded-md" style={{ backgroundColor: index === 0 ? accent : line, opacity: index === 0 ? 0.35 : 1 }} />
                    <span className="flex flex-1 flex-col gap-1.5">
                        <span className="h-1.5 rounded-full" style={{ width: `${width}%`, backgroundColor: line }} />
                        <span className="h-1 rounded-full opacity-65" style={{ width: `${Math.max(34, width - 28)}%`, backgroundColor: line }} />
                    </span>
                    <span className="h-4 w-4 rounded-full border" style={{ borderColor: outline }} />
                </div>
            ))}
        </div>
    </div>
);

const VolumeContents: React.FC<{ line: string; outline: string; accent: string }> = ({ line, outline, accent }) => (
    <div className="absolute inset-0">
        <PaletteHeader line={line} outline={outline} />
        <div className="flex h-[78%] flex-col justify-center gap-[16%] px-[10%]">
            <div className="flex items-center gap-3">
                <Volume2 className="h-5 w-5" style={{ color: accent }} />
                <div className="flex flex-1 flex-col gap-1.5">
                    <div className="h-2 w-[38%] rounded-full" style={{ backgroundColor: line }} />
                    <div className="h-1.5 w-[62%] rounded-full opacity-65" style={{ backgroundColor: line }} />
                </div>
                <div className="h-3 w-[13%] rounded-full" style={{ backgroundColor: line }} />
            </div>
            <div data-ponder-volume-track className="relative h-2 rounded-full" style={{ backgroundColor: line }}>
                <div className="absolute inset-y-0 left-0 w-[68%] rounded-full" style={{ backgroundColor: accent, opacity: 0.55 }} />
                <div className="absolute left-[68%] top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border" style={{ borderColor: outline, backgroundColor: accent }} />
            </div>
        </div>
    </div>
);

const PageContents: React.FC<{
    kind: PonderPageSurfaceKind;
    line: string;
    outline: string;
    accent: string;
    registerStateNode?: PonderSurfaceStateRegistrar;
}> = ({ kind, line, outline, accent, registerStateNode }) => {
    if (kind === 'grid-page') {
        return <PonderGridPageSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />;
    }

    if (kind === 'grid-view-page') {
        return <PonderGridViewPageSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />;
    }

    if (kind === 'lattice-page') {
        return <PonderLatticePageSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />;
    }

    if (kind === 'player-page') {
        return <PonderPlayerPageSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />;
    }

    if (kind === 'settings-page') {
        return (
            <div className="absolute inset-0 flex p-[4%]">
                <div className="flex w-[27%] flex-col gap-[5%] border-r pr-[4%]" style={{ borderColor: outline }}>
                    {[56, 82, 68, 74, 60].map((width, index) => (
                        <span key={width} className="h-[8%] rounded-full" style={{ width: `${width}%`, backgroundColor: index === 1 ? accent : line, opacity: index === 1 ? 0.55 : 1 }} />
                    ))}
                </div>
                <div className="grid flex-1 grid-cols-2 gap-[5%] pl-[5%]">
                    {[0, 1, 2, 3].map(index => (
                        <span key={index} className="rounded-[8%] border" style={{ borderColor: outline, backgroundColor: line, opacity: 0.75 }} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex flex-col gap-[5%] p-[5%]">
            <div className="flex h-[9%] items-center gap-[3%]">
                <Search className="h-full w-auto opacity-45" />
                <span className="h-[55%] w-[38%] rounded-full" style={{ backgroundColor: line }} />
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-[3%]">
                {Array.from({ length: 8 }, (_, index) => (
                    <span
                        key={index}
                        className="rounded-[10%] border"
                        style={{ borderColor: outline, backgroundColor: index === 1 ? accent : line, opacity: index === 1 ? 0.5 : 0.8 }}
                    />
                ))}
            </div>
        </div>
    );
};

const PonderSurfaceContents: React.FC<PonderSurfaceContentsProps> = ({ kind, accent, line, outline, registerStateNode }) => {
    const resolvedKind = kind ?? 'palette';
    const contents = resolvedKind === 'plain'
        ? null
        : resolvedKind === 'player-bar'
        ? <PonderPlayerBarSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : isPageSurfaceKind(resolvedKind)
        ? <PageContents kind={resolvedKind} line={line} outline={outline} accent={accent} registerStateNode={registerStateNode} />
        : resolvedKind === 'lattice-chrome'
        ? <PonderLatticeChromeSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'lyrics-animation-settings'
        ? <PonderLyricsAnimationSettingsSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'theme-settings'
        ? <PonderThemeSettingsSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'grid3d-card-style'
        ? <PonderGrid3dCardStyleSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'grid-view-card-settings'
        ? <PonderGridViewCardSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'lattice-style-settings'
        ? <PonderLatticeStyleSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'transition-settings'
        ? <PonderTransitionSettingsSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'library-watch-settings'
        ? <PonderLibraryWatchSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'queue-settings'
        ? <PonderQueueSettingsSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'lyrics-source-settings'
        ? <PonderLyricsSourceSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'grid-hotkey-settings'
        ? <PonderGridHotkeySurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'replay-gain-settings'
        ? <PonderReplayGainSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'custom-shortcut-settings'
        ? <PonderCustomShortcutSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'pinned-commands-settings'
        ? <PonderPinnedCommandsSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'import-export-settings'
        ? <PonderImportExportSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'audio-equalizer'
        ? <PonderAudioEqualizerSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'vis-playground'
        ? <PonderVisPlaygroundSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'lyric-style'
        ? <PonderLyricStyleSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'theme-park'
        ? <PonderThemeParkSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'queue-command'
        ? <PonderQueueCommandSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'lyric-export'
        ? <PonderLyricExportSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'desktop-features'
        ? <PonderDesktopFeaturesSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'ponder-onboarding'
        ? <PonderOnboardingSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'grid-action-button'
        ? <PonderGridActionButtonSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'grid-view-cards'
        ? <PonderGridViewCardsSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'local-folder-actions'
        ? <PonderLocalFolderActionsSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'local-track-list'
        ? <PonderLocalTrackListSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'local-grid-controls'
        ? <PonderLocalGridControlsSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'online-collection-actions'
        ? <PonderOnlineCollectionActionsSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'local-grid-map'
        ? <PonderLocalGridMapSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'side-panel'
        ? <PonderSidePanelSurface accent={accent} line={line} outline={outline} registerStateNode={registerStateNode} />
        : resolvedKind === 'bottom-ui-settings'
        ? <BottomUiSettingsContents line={line} outline={outline} accent={accent} />
        : resolvedKind === 'picker'
        ? <PickerContents line={line} outline={outline} accent={accent} />
        : resolvedKind === 'queue'
            ? <QueueContents line={line} outline={outline} accent={accent} />
            : resolvedKind === 'volume'
                ? <VolumeContents line={line} outline={outline} accent={accent} />
                : <PaletteContents line={line} outline={outline} />;

    return (
        <div className="absolute inset-0" data-ponder-surface-kind={resolvedKind}>
            {contents}
        </div>
    );
};

export default PonderSurfaceContents;
