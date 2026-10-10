import React from 'react';
import PonderSurfaceStateLayer, { PonderSurfaceBase } from './PonderSurfaceStateLayer';
import { EditorHeader, PanelSection, TabStrip, type RowKind } from './PonderFullEditorSurfaces';
import type { PonderSettingsSurfaceProps as SurfaceProps } from './ponderSettingsParts';
import { LYRIC_STYLE_GEOMETRY as L, VIS_PLAYGROUND_GEOMETRY as V, relativeRectStyle } from './ponderSurfaceGeometry';

// src/components/ponder/surfaces/PonderLyricStyleSurface.tsx
// 歌词样式那张图：调参台的布局（设置直达打开的就是它），左边预览、右边一页设置。
//
// 预览和右栏是两个各自可换的槽位，而预览里又分背景和歌词两层 —— 这张图要讲的正是
// 「换歌词样式，右栏整页跟着换」和「背景、歌词各换各的」，两件事都得能只动一半。
// 结果层只能淡入，所以每个变体都是一整块预览或一整页右栏，替换对应的槽位。

/** 预览槽位和右栏槽位在登记表里的名字。变体层用 replaces 指向它们。 */
export const LYRIC_STYLE_PREVIEW_STATE = 'lyric-style-preview';
export const LYRIC_STYLE_PANEL_STATE = 'lyric-style-panel';

type BackgroundVariant = 'a' | 'b';
type StyleVariant = 'a' | 'b' | 'monet' | 'monet-bare';
type SubtitleVariant = 'translation' | 'romanization';

type PaintProps = Pick<SurfaceProps, 'accent' | 'line' | 'outline'>;

/** 两种背景：柔光色块和斜向条纹。形状差得够远，换了一眼就看得出来。 */
const Background: React.FC<PaintProps & { variant: BackgroundVariant }> = ({ variant, accent, line }) => (
    variant === 'a' ? (
        <span
            data-ponder-lyric-style-background="a"
            className="absolute inset-0"
            style={{
                background: `radial-gradient(circle at 22% 30%, ${accent}33, transparent 42%), radial-gradient(circle at 78% 72%, ${accent}26, transparent 46%)`,
            }}
        />
    ) : (
        <span
            data-ponder-lyric-style-background="b"
            className="absolute inset-0"
            style={{ background: `repeating-linear-gradient(135deg, ${line} 0 2px, transparent 2px 22px)`, opacity: 0.55 }}
        />
    )
);

/** 通用底部副字幕。罗马音那一版换一种字形节奏，并且描出来，表示「这一条改过了」。 */
const Subtitle: React.FC<PaintProps & { variant: SubtitleVariant }> = ({ variant, accent, line, outline }) => (
    <span
        data-ponder-lyric-style-subtitle
        className="flex items-center justify-center gap-[3%] rounded-lg"
        style={{
            ...relativeRectStyle(L.subtitle),
            backgroundColor: 'rgba(0,0,0,0.35)',
            boxShadow: `inset 0 0 0 1px ${variant === 'romanization' ? accent : outline}`,
        }}
    >
        {(variant === 'translation' ? [38, 22, 30] : [14, 12, 16, 10, 14]).map((width, index) => (
            <span
                key={index}
                className="h-1 rounded-full"
                style={{ width: `${width}%`, backgroundColor: variant === 'romanization' ? accent : line, opacity: 0.7 }}
            />
        ))}
    </span>
);

/** 样式 A：居中几行，当前行高亮。 */
const LyricsA: React.FC<PaintProps> = ({ accent, line }) => (
    <span data-ponder-lyric-style-lyrics className="flex flex-col items-center justify-center gap-[10%]" style={relativeRectStyle(L.lyrics)}>
        {[64, 88, 52].map((width, index) => (
            <span
                key={width}
                className="h-2 rounded-full"
                style={{ width: `${width}%`, backgroundColor: index === 1 ? accent : line, opacity: index === 1 ? 0.9 : 0.45 }}
            />
        ))}
    </span>
);

/** 样式 B：左对齐、错落倾斜的大字块。和 A 放在一起，说明「样式」换的是整套排版。 */
const LyricsB: React.FC<PaintProps> = ({ accent, line }) => (
    <span data-ponder-lyric-style-lyrics className="flex flex-col justify-center gap-[8%]" style={relativeRectStyle(L.lyrics)}>
        {[[0, 46], [18, 62], [8, 34]].map(([indent, width], index) => (
            <span
                key={index}
                className="h-4 rounded-md"
                style={{
                    marginLeft: `${indent}%`,
                    width: `${width}%`,
                    backgroundColor: index === 1 ? accent : line,
                    opacity: index === 1 ? 0.85 : 0.4,
                    transform: `rotate(${index === 1 ? -4 : 3}deg)`,
                }}
            />
        ))}
    </span>
);

/**
 * 莫奈：左边一列歌词，右边肖像。bare 是三件可隐藏的部件都关掉之后的样子：
 * 歌曲描述、肖像上的拖拽调整按钮、肖像下的音频图案。
 */
const Monet: React.FC<PaintProps & { bare: boolean }> = ({ bare, accent, line, outline }) => (
    <>
        <span className="flex flex-col justify-center gap-[9%]" style={relativeRectStyle(L.monetRail)}>
            {[70, 92, 58, 80].map((width, index) => (
                <span
                    key={width}
                    className="h-2 rounded-full"
                    style={{ width: `${width}%`, backgroundColor: index === 1 ? accent : line, opacity: index === 1 ? 0.9 : 0.45 }}
                />
            ))}
        </span>
        <span
            data-ponder-lyric-style-monet-portrait
            className="rounded-[6%]"
            style={{ ...relativeRectStyle(L.monetPortrait), backgroundColor: accent, opacity: 0.3 }}
        />
        {!bare && (
            <>
                <span
                    data-ponder-lyric-style-monet-description
                    className="flex flex-col justify-center gap-[14%] rounded-lg px-[3%]"
                    style={{ ...relativeRectStyle(L.monetDescription), boxShadow: `inset 0 0 0 1px ${outline}` }}
                >
                    {[90, 72].map(width => (
                        <span key={width} className="h-1 rounded-full opacity-50" style={{ width: `${width}%`, backgroundColor: line }} />
                    ))}
                </span>
                <span
                    data-ponder-lyric-style-monet-hanger
                    className="rounded-full"
                    style={{ ...relativeRectStyle(L.monetHanger), boxShadow: `inset 0 0 0 1px ${outline}`, backgroundColor: 'rgba(0,0,0,0.55)' }}
                />
                <span
                    data-ponder-lyric-style-monet-audio
                    className="flex items-end justify-between px-[4%] pb-[2%]"
                    style={relativeRectStyle(L.monetAudio)}
                >
                    {[40, 75, 55, 90, 35, 65, 80, 45, 60, 30].map((height, index) => (
                        <span key={index} className="w-[6%] rounded-sm" style={{ height: `${height}%`, backgroundColor: accent, opacity: 0.6 }} />
                    ))}
                </span>
            </>
        )}
    </>
);

/** 一整块预览：背景一层、歌词一层，自己排版的样式（莫奈）不带通用副字幕。 */
const Preview: React.FC<PaintProps & {
    background: BackgroundVariant;
    style: StyleVariant;
    subtitle?: SubtitleVariant;
    marker?: string;
}> = ({ background, style, subtitle = 'translation', marker, ...paint }) => {
    const isMonet = style === 'monet' || style === 'monet-bare';
    return (
        <div
            {...(marker ? { [marker]: true } : {})}
            className="overflow-hidden rounded-[4%]"
            style={{ ...relativeRectStyle(V.preview), boxShadow: `inset 0 0 0 1px ${paint.outline}`, backgroundColor: 'rgba(0,0,0,0.35)' }}
        >
            <Background variant={background} {...paint} />
            {style === 'a' && <LyricsA {...paint} />}
            {style === 'b' && <LyricsB {...paint} />}
            {isMonet && <Monet bare={style === 'monet-bare'} {...paint} />}
            {!isMonet && <Subtitle variant={subtitle} {...paint} />}
        </div>
    );
};

/** 右栏一页。activeIndex 按调参台的四页：通用、背景、动画、字幕。 */
const Panel: React.FC<PaintProps & {
    activeIndex: number;
    rows: readonly { kind: RowKind; on?: boolean; marker?: string }[];
    marker: string;
    frameMarker?: string;
}> = ({ activeIndex, rows, marker, frameMarker, accent, line, outline }) => (
    <div
        {...(frameMarker ? { [frameMarker]: true } : {})}
        className="rounded-[6%]"
        style={{ ...relativeRectStyle(V.panel), boxShadow: `inset 0 0 0 1px ${outline}`, backgroundColor: 'rgba(10,10,12,0.96)' }}
    >
        <TabStrip rect={V.tabs} line={line} accent={accent} count={4} activeIndex={activeIndex} marker={`${marker}-tabs`} />
        <PanelSection rows={rows} line={line} outline={outline} accent={accent} marker={marker} />
    </div>
);

/** 样式 A 的专属设置。 */
const STYLE_A_ROWS = [
    { kind: 'picker' as const, marker: 'data-ponder-lyric-style-mode' },
    { kind: 'slider' as const },
    { kind: 'slider' as const },
    { kind: 'toggle' as const },
];

/** 样式 B：同一个模式选择，下面是完全不同的一组。 */
const STYLE_B_ROWS = [
    { kind: 'picker' as const },
    { kind: 'toggle' as const, on: true },
    { kind: 'segmented' as const },
    { kind: 'toggle' as const },
    { kind: 'slider' as const },
];

/** 莫奈：描述、拖拽调整按钮、音频图案三个开关在第二到第四行。 */
const monetRows = (on: boolean) => [
    { kind: 'picker' as const },
    { kind: 'toggle' as const, on, marker: 'data-ponder-lyric-style-monet-toggle' },
    { kind: 'toggle' as const, on, marker: 'data-ponder-lyric-style-monet-toggle' },
    { kind: 'toggle' as const, on, marker: 'data-ponder-lyric-style-monet-toggle' },
    { kind: 'slider' as const },
];

const BACKGROUND_ROWS = [
    { kind: 'picker' as const, marker: 'data-ponder-lyric-style-background-mode' },
    { kind: 'slider' as const },
    { kind: 'toggle' as const, on: true },
];

/** 字幕页，按真实次序：内容（翻译 / 罗马音 / 不显示）、叠底、模糊、继承歌词字体、缩放。 */
const SUBTITLE_ROWS = [
    { kind: 'segmented' as const, marker: 'data-ponder-lyric-style-subtitle-content' },
    { kind: 'toggle' as const, on: true },
    { kind: 'toggle' as const, on: true, marker: 'data-ponder-lyric-style-subtitle-blur' },
    { kind: 'toggle' as const, on: true, marker: 'data-ponder-lyric-style-subtitle-font' },
    { kind: 'slider' as const, marker: 'data-ponder-lyric-style-subtitle-size' },
];

/** 预览槽位的变体：[结果层名, 背景, 样式, 副字幕]。 */
const PREVIEW_VARIANTS = [
    ['preview-style-b', 'a', 'b', 'translation'],
    ['preview-monet', 'a', 'monet', 'translation'],
    ['preview-monet-bare', 'a', 'monet-bare', 'translation'],
    ['preview-background-b', 'b', 'a', 'translation'],
    ['preview-background-b-style-b', 'b', 'b', 'translation'],
    ['preview-romanization', 'a', 'a', 'romanization'],
] as const;

/** 右栏槽位的变体：[结果层名, 选中的分页, 行]。 */
const PANEL_VARIANTS = [
    ['panel-style-b', 2, STYLE_B_ROWS],
    ['panel-monet', 2, monetRows(true)],
    ['panel-monet-off', 2, monetRows(false)],
    ['panel-background', 1, BACKGROUND_ROWS],
    ['panel-subtitle', 3, SUBTITLE_ROWS],
] as const;

export const PonderLyricStyleSurface: React.FC<SurfaceProps> = ({ accent, line, outline, registerStateNode }) => {
    const paint = { accent, line, outline };
    return (
        <div className="absolute inset-0 overflow-hidden" data-ponder-lyric-style-structure>
            <PonderSurfaceBase registerStateNode={registerStateNode}>
                <EditorHeader rect={V.header} line={line} outline={outline} marker="data-ponder-lyric-style-header" />
                <PonderSurfaceStateLayer state={LYRIC_STYLE_PREVIEW_STATE} registerStateNode={registerStateNode} visible>
                    <Preview background="a" style="a" marker="data-ponder-lyric-style-preview" {...paint} />
                </PonderSurfaceStateLayer>
                {/* 基础层停在「动画」那一页：从控制页的歌词样式那一行点「更多设置」，落的就是这一页。 */}
                <PonderSurfaceStateLayer state={LYRIC_STYLE_PANEL_STATE} registerStateNode={registerStateNode} visible>
                    <Panel activeIndex={2} rows={STYLE_A_ROWS} marker="data-ponder-lyric-style-rows" frameMarker="data-ponder-lyric-style-panel" {...paint} />
                </PonderSurfaceStateLayer>
            </PonderSurfaceBase>

            {PREVIEW_VARIANTS.map(([state, background, style, subtitle]) => (
                <PonderSurfaceStateLayer key={state} state={state} registerStateNode={registerStateNode} replaces={LYRIC_STYLE_PREVIEW_STATE}>
                    <Preview background={background} style={style} subtitle={subtitle} {...paint} />
                </PonderSurfaceStateLayer>
            ))}

            {PANEL_VARIANTS.map(([state, activeIndex, rows]) => (
                <PonderSurfaceStateLayer key={state} state={state} registerStateNode={registerStateNode} replaces={LYRIC_STYLE_PANEL_STATE}>
                    <Panel activeIndex={activeIndex} rows={rows} marker={`data-ponder-lyric-style-rows-${state}`} {...paint} />
                </PonderSurfaceStateLayer>
            ))}
        </div>
    );
};

export default PonderLyricStyleSurface;
