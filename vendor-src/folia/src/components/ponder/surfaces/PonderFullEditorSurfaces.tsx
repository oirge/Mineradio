import React from 'react';
import { ChevronDown, ChevronLeft, Pause, Palette, RotateCcw, Sparkles } from 'lucide-react';
import PonderSurfaceStateLayer, { PonderSurfaceBase } from './PonderSurfaceStateLayer';
import type { PonderSettingsSurfaceProps as SurfaceProps } from './ponderSettingsParts';
import type { PonderRelativeRect } from '../../../types/ponder';
import {
    THEME_PARK_GEOMETRY as P,
    VIS_PLAYGROUND_GEOMETRY as V,
    relativeRectStyle,
} from './ponderSurfaceGeometry';

// src/components/ponder/surfaces/PonderFullEditorSurfaces.tsx
// 两块整屏编辑器：歌词动画调参台，和 Theme Park。
// 顶栏、分页、右栏一页这几件也导出给歌词样式那张图（PonderLyricStyleSurface）用：它画的是同一个调参台。
//
// 它们是同一套布局 —— 顶栏、左边一大块实时预览、右边一条窄设置栏，栏顶一排分页。
// 和 PonderSettingsSectionSurfaces 里那个 FullScreenEditor 不同的是：那个是别人章节里
// 一闪而过的结果层，用 flex 摆一下就够；这两块本身就是被教的对象，每个部件都要能被
// 锚点指住，所以一律走 ponderSurfaceGeometry 那张表。
//
// 里面还装着别的部件的那几个框，描边一律用 inset box-shadow 而不是 border：绝对定位子元素的
// 百分比按**内边距盒**算，而锚点按边框盒算 —— 一条 1px 的 border 就让两者差出 2px，
// 正好是「骨架和真实元素错位」。box-shadow 不占盒模型，两边于是重合。

/** 左边那块实时预览：角上两枚徽标，中间三行歌词。 */
const PreviewPane: React.FC<{
    rect: PonderRelativeRect;
    line: string;
    outline: string;
    accent: string;
    marker: string;
    children?: React.ReactNode;
}> = ({ rect, line, outline, accent, marker, children }) => (
    <div
        {...{ [marker]: true }}
        className="overflow-hidden rounded-[4%]"
        style={{ ...relativeRectStyle(rect), boxShadow: `inset 0 0 0 1px ${outline}`, backgroundColor: 'rgba(0,0,0,0.35)' }}
    >
        <span className="absolute left-[4%] top-[4%] flex h-[6%] items-center gap-[6%] rounded-full border px-[2%]" style={{ borderColor: outline }}>
            <Sparkles className="h-[70%] w-auto opacity-55" />
            <span className="h-1 w-10 rounded-full opacity-55" style={{ backgroundColor: line }} />
        </span>
        <span className="absolute right-[4%] top-[4%] h-[6%] w-[18%] rounded-full border" style={{ borderColor: outline }} />
        <span className="absolute inset-x-[12%] top-[40%] flex flex-col gap-[6%]">
            {[74, 96, 56].map((width, index) => (
                <span
                    key={width}
                    className="h-2 rounded-full"
                    style={{ width: `${width}%`, backgroundColor: index === 1 ? accent : line, opacity: index === 1 ? 0.85 : 0.45 }}
                />
            ))}
        </span>
        {children}
    </div>
);

/** 右栏顶上那排分页。每格都画一条标签，不然只有选中那格看得见。 */
export const TabStrip: React.FC<{
    rect: PonderRelativeRect;
    line: string;
    accent: string;
    count: number;
    activeIndex: number;
    marker: string;
}> = ({ rect, line, accent, count, activeIndex, marker }) => (
    <div
        {...{ [marker]: true }}
        className="flex items-stretch gap-[2%] rounded-full p-[1%]"
        style={{ ...relativeRectStyle(rect), backgroundColor: 'rgba(255,255,255,0.05)' }}
    >
        {Array.from({ length: count }, (_, index) => (
            <span
                key={index}
                data-ponder-editor-tab
                data-ponder-editor-tab-active={index === activeIndex || undefined}
                className="flex flex-1 items-center justify-center rounded-full"
                style={{ backgroundColor: index === activeIndex ? `${accent}26` : undefined }}
            >
                <span className="h-1 w-[62%] rounded-full" style={{ backgroundColor: index === activeIndex ? accent : line, opacity: index === activeIndex ? 1 : 0.5 }} />
            </span>
        ))}
    </div>
);

/**
 * 顶栏：左端一颗返回，旁边一条标题，右端那几件由 children 摆。
 *
 * 右端那些的几何在表里是「相对 header」的，所以它们必须**渲染在这个框里面** ——
 * 摆到外面去，百分比就按整屏算，锚点和元素立刻错开小半屏。
 */
export const EditorHeader: React.FC<{
    rect: PonderRelativeRect;
    line: string;
    outline: string;
    marker: string;
    children?: React.ReactNode;
}> = ({ rect, line, outline, marker, children }) => (
    <div
        {...{ [marker]: true }}
        className="flex items-center gap-[1.5%] rounded-2xl px-[2%]"
        style={{ ...relativeRectStyle(rect), boxShadow: `inset 0 0 0 1px ${outline}`, backgroundColor: 'rgba(255,255,255,0.03)' }}
    >
        <span className="flex aspect-square h-[54%] shrink-0 items-center justify-center rounded-full border" style={{ borderColor: outline }}>
            <ChevronLeft className="h-1/2 w-1/2 opacity-60" />
        </span>
        <span className="h-1.5 w-[18%] rounded-full" style={{ backgroundColor: line }} />
        {children}
    </div>
);

/** 结果层里的一块定位容器。用来把 header/preview/panel 相对的部件放回它们该在的坐标系。 */
const Frame: React.FC<{ rect: PonderRelativeRect; children: React.ReactNode }> = ({ rect, children }) => (
    <div style={relativeRectStyle(rect)}>{children}</div>
);


/** 右栏一行控件的四种形状。四页填的都是它们，只是次序和数量不同。 */
export type RowKind = 'picker' | 'slider' | 'toggle' | 'segmented';

const PanelRow: React.FC<{
    rect: PonderRelativeRect;
    kind: RowKind;
    line: string;
    outline: string;
    accent: string;
    on?: boolean;
    marker?: string;
}> = ({ rect, kind, line, outline, accent, on, marker }) => (
    <div
        {...(marker ? { [marker]: true } : {})}
        data-ponder-playground-row
        className="flex flex-col justify-center gap-[12%]"
        style={relativeRectStyle(rect)}
    >
        <span className="flex items-center gap-[3%]">
            <span className="h-1 rounded-full opacity-55" style={{ width: kind === 'toggle' ? '46%' : '38%', backgroundColor: line }} />
            <span className="flex-1" />
            {kind === 'toggle' && (
                <span
                    className="relative h-3 w-6 shrink-0 rounded-full"
                    style={{ backgroundColor: on ? accent : line, opacity: on ? 0.75 : 1 }}
                >
                    <span className={`absolute top-0.5 h-2 w-2 rounded-full bg-white ${on ? 'right-0.5' : 'left-0.5'}`} />
                </span>
            )}
            {kind === 'slider' && <span className="h-1 w-[12%] shrink-0 rounded-full opacity-45" style={{ backgroundColor: line }} />}
        </span>

        {kind === 'picker' && (
            <span className="flex h-[52%] items-center gap-[4%] rounded-lg px-[4%]" style={{ boxShadow: `inset 0 0 0 1px ${outline}` }}>
                <span className="h-1 flex-1 rounded-full" style={{ backgroundColor: accent, opacity: 0.8 }} />
                <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-45" />
            </span>
        )}
        {kind === 'slider' && (
            <span className="relative h-1 rounded-full" style={{ backgroundColor: line }}>
                <span className="absolute inset-y-0 left-0 w-[58%] rounded-full" style={{ backgroundColor: accent, opacity: 0.8 }} />
                <span className="absolute left-[58%] top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ backgroundColor: accent }} />
            </span>
        )}
        {kind === 'segmented' && (
            <span className="flex h-[52%] items-stretch gap-[3%] rounded-full p-[1%]" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                {[0, 1, 2].map(index => (
                    <span
                        key={index}
                        className="flex flex-1 items-center justify-center rounded-full"
                        style={{ backgroundColor: index === 1 ? `${accent}26` : undefined }}
                    >
                        <span className="h-1 w-[54%] rounded-full" style={{ backgroundColor: index === 1 ? accent : line, opacity: index === 1 ? 1 : 0.5 }} />
                    </span>
                ))}
            </span>
        )}
    </div>
);

const ROW_RECTS = [V.rowOne, V.rowTwo, V.rowThree, V.rowFour, V.rowFive] as const;

/**
 * 一页的内容：标题、一颗只管本页的复位，再按给定形状铺下去的几行。
 *
 * 每页各有一颗自己的复位是真实界面里的事，而且最容易看错 —— 它退的只是这一页，
 * 不是整张调参台，所以它在骨架上必须始终在场、且在标题那一行的右端。
 */
export const PanelSection: React.FC<{
    rows: readonly { kind: RowKind; on?: boolean; marker?: string }[];
    line: string;
    outline: string;
    accent: string;
    marker: string;
}> = ({ rows, line, outline, accent, marker }) => (
    <>
        <span className="flex items-center" style={relativeRectStyle(V.panelTitle)}>
            <span className="h-[26%] w-[76%] rounded-full opacity-60" style={{ backgroundColor: line }} />
        </span>
        <span
            data-ponder-playground-section-reset
            className="flex items-center justify-center rounded-full"
            style={{ ...relativeRectStyle(V.panelReset), boxShadow: `inset 0 0 0 1px ${outline}` }}
        >
            <span className="h-1 w-[54%] rounded-full opacity-45" style={{ backgroundColor: line }} />
        </span>
        <div {...{ [marker]: true }} style={relativeRectStyle(V.rows)} />
        {rows.map((row, index) => (
            <PanelRow
                key={index}
                rect={ROW_RECTS[index]}
                kind={row.kind}
                on={row.on}
                marker={row.marker}
                line={line}
                outline={outline}
                accent={accent}
            />
        ))}
    </>
);

/** 通用页：示例文本、歌词字体、字号、字重、可视化不透明度。 */
const COMMON_ROWS = [
    { kind: 'picker' as const, marker: 'data-ponder-playground-preview-text' },
    { kind: 'picker' as const, marker: 'data-ponder-playground-font' },
    { kind: 'slider' as const },
    { kind: 'slider' as const, marker: 'data-ponder-playground-font-weight' },
    { kind: 'slider' as const, marker: 'data-ponder-playground-opacity' },
];

/** 背景页：模式选择，加这个模式自带的几样参数。 */
const BACKGROUND_ROWS = [
    { kind: 'picker' as const, marker: 'data-ponder-playground-background-mode' },
    { kind: 'slider' as const },
    { kind: 'toggle' as const, on: true },
];

/** 动画页：歌词动画模式，加这个渲染器自带的调参。具体有哪些模式留给人自己翻。 */
const VISUALIZER_ROWS = [
    { kind: 'picker' as const, marker: 'data-ponder-playground-animation-mode' },
    { kind: 'slider' as const },
    { kind: 'slider' as const },
    { kind: 'toggle' as const },
];

/** 字幕页：内容三选一、叠底、未唱歌词模糊、和声字幕，以及「字体跟随歌词」。 */
const SUBTITLE_ROWS = [
    { kind: 'segmented' as const, marker: 'data-ponder-playground-subtitle-content' },
    { kind: 'toggle' as const, on: true },
    { kind: 'slider' as const },
    { kind: 'toggle' as const, marker: 'data-ponder-playground-harmony' },
    { kind: 'toggle' as const, on: true, marker: 'data-ponder-playground-subtitle-font' },
];

/**
 * 歌词动画调参台。
 *
 * 唯一要讲的是预览上那三块热区：它们完全透明，只有指针压上去才描边，所以这张图上
 * 基础层画的也是看不见的 —— 只有 `hotspots-visible` 那一层才把边框亮出来。
 */
export const PonderVisPlaygroundSurface: React.FC<SurfaceProps> = ({ accent, line, outline, registerStateNode }) => {
    const hotspots = [
        ['data-ponder-playground-hotspot-background', V.hotspotBackground],
        ['data-ponder-playground-hotspot-visualizer', V.hotspotVisualizer],
        ['data-ponder-playground-hotspot-subtitle', V.hotspotSubtitle],
    ] as const;

    return (
        <div className="absolute inset-0 overflow-hidden" data-ponder-vis-playground-structure>
            <PonderSurfaceBase registerStateNode={registerStateNode}>
                <EditorHeader rect={V.header} line={line} outline={outline} marker="data-ponder-playground-header" />
                <PreviewPane rect={V.preview} line={line} outline={outline} accent={accent} marker="data-ponder-playground-preview">
                    <span
                        data-ponder-playground-pause
                        className="flex items-center justify-center rounded-full border"
                        style={{ ...relativeRectStyle(V.pause), borderColor: outline, backgroundColor: 'rgba(0,0,0,0.45)' }}
                    >
                        <Pause className="h-[42%] w-auto opacity-75" />
                    </span>
                    {/* 平时的热区：位置就在这儿，但没有描边也没有底色，看不出任何东西。 */}
                    {hotspots.map(([marker, rect]) => (
                        <span key={marker} {...{ [marker]: true }} style={relativeRectStyle(rect)} />
                    ))}
                </PreviewPane>

                {/* 基础层停在「通用」那一页：它是唯一没有热区、只能从标签进的一页。 */}
                <div
                    data-ponder-playground-panel
                    className="rounded-[6%]"
                    style={{ ...relativeRectStyle(V.panel), boxShadow: `inset 0 0 0 1px ${outline}`, backgroundColor: 'rgba(255,255,255,0.03)' }}
                >
                    <TabStrip rect={V.tabs} line={line} accent={accent} count={4} activeIndex={0} marker="data-ponder-playground-tabs" />
                    <PanelSection rows={COMMON_ROWS} line={line} outline={outline} accent={accent} marker="data-ponder-playground-rows" />
                </div>

            </PonderSurfaceBase>


            {/* 换到另一页：整块右栏一起换，否则标签高亮会停在上一页上。 */}
            {([
                ['section-background', 1, BACKGROUND_ROWS],
                ['section-visualizer', 2, VISUALIZER_ROWS],
                ['section-subtitle', 3, SUBTITLE_ROWS],
            ] as const).map(([state, tabIndex, rows]) => (
                <PonderSurfaceStateLayer key={state} state={state} registerStateNode={registerStateNode}>
                    <div
                        className="rounded-[6%]"
                        style={{ ...relativeRectStyle(V.panel), boxShadow: `inset 0 0 0 1px ${outline}`, backgroundColor: 'rgba(10,10,12,0.96)' }}
                    >
                        <TabStrip rect={V.tabs} line={line} accent={accent} count={4} activeIndex={tabIndex} marker={`data-ponder-playground-tabs-${state}`} />
                        <PanelSection rows={rows} line={line} outline={outline} accent={accent} marker={`data-ponder-playground-rows-${state}`} />
                    </div>
                </PonderSurfaceStateLayer>
            ))}

            {/* 指针压上去才显形：描边加一枚标签。这一层是这一章的全部内容。 */}
            <PonderSurfaceStateLayer state="hotspots-visible" registerStateNode={registerStateNode}>
                <Frame rect={V.preview}>
                    {hotspots.map(([marker, rect], index) => (
                        <span
                            key={marker}
                            data-ponder-playground-hotspot-shown
                            className="rounded-[4%] border"
                            style={{
                                ...relativeRectStyle(rect),
                                borderColor: index === 1 ? accent : `${accent}55`,
                                backgroundColor: index === 1 ? `${accent}14` : undefined,
                            }}
                        >
                            <span
                                className="absolute left-[3%] top-[8%] h-[24%] w-[22%] rounded-full border"
                                style={{ borderColor: index === 1 ? accent : outline, backgroundColor: 'rgba(0,0,0,0.5)' }}
                            />
                        </span>
                    ))}
                </Frame>
            </PonderSurfaceStateLayer>
        </div>
    );
};

/**
 * Theme Park。
 *
 * 顶栏右端三件是这一屏的关键：在编辑哪一份主题、重置、保存。保存会因为名字没填而
 * 灰着，而名字在右栏「信息」那一页上 —— 所以 `save-blocked` 那一层要同时把灰掉的
 * 保存和那一格标签亮出来，两样分开画就讲不成一句话。
 */
export const PonderThemeParkSurface: React.FC<SurfaceProps> = ({ accent, line, outline, registerStateNode }) => (
    <div className="absolute inset-0 overflow-hidden" data-ponder-theme-park-structure>
        <PonderSurfaceBase registerStateNode={registerStateNode}>
            {/* 顶栏右端三件的几何是相对顶栏的，所以它们作为 children 长在顶栏里面。 */}
            <EditorHeader rect={P.header} line={line} outline={outline} marker="data-ponder-park-header">
                <div
                    data-ponder-park-target
                    className="flex items-stretch gap-[2%] rounded-full p-[1%]"
                    style={{ ...relativeRectStyle(P.targetToggle), backgroundColor: 'rgba(255,255,255,0.05)' }}
                >
                    {[0, 1].map(index => (
                        <span
                            key={index}
                            data-ponder-park-target-option
                            data-ponder-park-target-active={index === 1 || undefined}
                            className="flex flex-1 items-center justify-center rounded-full"
                            style={{ backgroundColor: index === 1 ? `${accent}26` : undefined }}
                        >
                            <span className="h-1 w-[58%] rounded-full" style={{ backgroundColor: index === 1 ? accent : line, opacity: index === 1 ? 1 : 0.5 }} />
                        </span>
                    ))}
                </div>
                <span
                    data-ponder-park-reset
                    className="flex items-center justify-center gap-[10%] rounded-full border"
                    style={{ ...relativeRectStyle(P.reset), borderColor: outline }}
                >
                    <RotateCcw className="h-[36%] w-auto opacity-60" />
                    <span className="h-1 w-[34%] rounded-full opacity-55" style={{ backgroundColor: line }} />
                </span>
                <span
                    data-ponder-park-save
                    className="flex items-center justify-center gap-[8%] rounded-full border"
                    style={{ ...relativeRectStyle(P.save), borderColor: accent, backgroundColor: `${accent}1a` }}
                >
                    <Palette className="h-[36%] w-auto" style={{ color: accent }} />
                    <span className="h-1 w-[40%] rounded-full" style={{ backgroundColor: accent }} />
                </span>
            </EditorHeader>

            <PreviewPane rect={P.preview} line={line} outline={outline} accent={accent} marker="data-ponder-park-preview" />

            <div
                data-ponder-park-panel
                className="rounded-[6%]"
                style={{ ...relativeRectStyle(P.panel), boxShadow: `inset 0 0 0 1px ${outline}`, backgroundColor: 'rgba(255,255,255,0.03)' }}
            >
                <TabStrip rect={P.tabs} line={line} accent={accent} count={4} activeIndex={0} marker="data-ponder-park-tabs" />

                {/* 亮 / 暗是两份独立的配色，这一对切的是「现在编辑哪一份」。 */}
                <div
                    data-ponder-park-mode
                    className="flex items-stretch gap-[3%] rounded-full p-[1%]"
                    style={{ ...relativeRectStyle(P.modeToggle), backgroundColor: 'rgba(255,255,255,0.05)' }}
                >
                    {[0, 1].map(index => (
                        <span
                            key={index}
                            className="flex flex-1 items-center justify-center rounded-full"
                            style={{ backgroundColor: index === 1 ? 'rgba(255,255,255,0.12)' : undefined }}
                        >
                            <span className="h-1 w-[52%] rounded-full" style={{ backgroundColor: line }} />
                        </span>
                    ))}
                </div>

                <div data-ponder-park-colors className="flex flex-col justify-evenly" style={relativeRectStyle(P.colorRows)}>
                    {[0, 1, 2, 3].map(index => (
                        <span
                            key={index}
                            data-ponder-park-color-row
                            className="flex h-[22%] items-center gap-[4%] rounded-xl border px-[4%]"
                            style={{ borderColor: index === 0 ? accent : outline }}
                        >
                            <span className="aspect-square h-[64%] shrink-0 rounded-md" style={{ backgroundColor: index === 0 ? accent : line }} />
                            <span className="flex flex-1 flex-col gap-1">
                                <span className="h-1 w-[52%] rounded-full" style={{ backgroundColor: line }} />
                                <span className="h-0.5 w-[76%] rounded-full opacity-40" style={{ backgroundColor: line }} />
                            </span>
                            <span className="h-1 w-[22%] shrink-0 rounded-full opacity-55" style={{ backgroundColor: line }} />
                        </span>
                    ))}
                </div>

                <div
                    data-ponder-park-picker
                    className="rounded-xl border"
                    style={{
                        ...relativeRectStyle(P.picker),
                        borderColor: outline,
                        background: `linear-gradient(135deg, ${accent}, rgba(0,0,0,0.65))`,
                    }}
                />
                <span
                    data-ponder-park-hex
                    className="flex items-center rounded-lg border px-[4%]"
                    style={{ ...relativeRectStyle(P.hex), borderColor: outline }}
                >
                    <span className="h-1 w-[34%] rounded-full opacity-55" style={{ backgroundColor: line }} />
                </span>
                {/* 从当前封面算出来的一排推荐色，点一下直接填进正在编辑的那一项。 */}
                {/* 六枚色块按 flex-1 分宽：写死成正方形的话，六枚加五道缝比这一行还宽，
                    最后一枚会从右栏边缘长出去。 */}
                <div data-ponder-park-recommended className="flex items-stretch gap-[3%]" style={relativeRectStyle(P.recommended)}>
                    {[0, 1, 2, 3, 4, 5].map(index => (
                        <span
                            key={index}
                            data-ponder-park-swatch
                            className="h-[54%] min-w-0 flex-1 self-center rounded-md border"
                            style={{ borderColor: outline, backgroundColor: index % 2 === 0 ? accent : line, opacity: 0.4 + index * 0.1 }}
                        />
                    ))}
                </div>
            </div>
        </PonderSurfaceBase>

        {/* 名字没填：保存灰着，而要填的地方在「信息」那一格上。 */}
        <PonderSurfaceStateLayer state="save-blocked" registerStateNode={registerStateNode}>
            <Frame rect={P.header}>
                <span
                    data-ponder-park-save-blocked
                    className="flex items-center justify-center gap-[8%] rounded-full border opacity-40"
                    style={{ ...relativeRectStyle(P.save), borderColor: outline }}
                >
                    <Palette className="h-[36%] w-auto opacity-60" />
                    <span className="h-1 w-[40%] rounded-full opacity-60" style={{ backgroundColor: line }} />
                </span>
            </Frame>
            <Frame rect={P.panel}>
                <span
                    data-ponder-park-tab-details
                    className="flex items-center justify-center rounded-full border"
                    style={{ ...relativeRectStyle(P.tabDetails), borderColor: accent, backgroundColor: `${accent}26` }}
                >
                    <span className="h-1 w-[62%] rounded-full" style={{ backgroundColor: accent }} />
                </span>
            </Frame>
        </PonderSurfaceStateLayer>
    </div>
);
