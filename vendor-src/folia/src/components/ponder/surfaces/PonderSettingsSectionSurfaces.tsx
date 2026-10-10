import React from 'react';
import { ChevronRight, Monitor, Palette, Settings2, Sparkles, Sun } from 'lucide-react';
import PonderSurfaceStateLayer, { PonderSurfaceBase, type PonderSurfaceStateRegistrar } from './PonderSurfaceStateLayer';
import type { PonderRelativeRect } from '../../../types/ponder';
import {
    LYRICS_ANIMATION_SETTINGS_GEOMETRY as L,
    THEME_SETTINGS_GEOMETRY as T,
    THEME_SETTINGS_TOGGLES,
    relativeRectStyle,
} from './ponderSurfaceGeometry';

// src/components/ponder/surfaces/PonderSettingsSectionSurfaces.tsx
// 设置 · 外观里两组最常被翻的东西：歌词动画、配色主题。
//
// 两个放同一个文件，因为它们是同一类东西 —— 设置面板里的一组卡片，形状简单、结构相近，
// 各拆一个文件只会多两个只有几十行的模块。
//
// 两组各自打开的那个整屏界面（动画调参台、Theme Park）是同一个形状：左边一块大的实时
// 预览，右边一条窄的设置栏，栏顶是一排分页。这不是巧合，它们本来就是同一套布局，
// 所以 FullScreenEditor 只写一遍。

type SurfaceProps = {
    accent: string;
    line: string;
    outline: string;
    registerStateNode?: PonderSurfaceStateRegistrar;
};

/** 分组标题：一个小图标加一条标题文字。 */
const SectionHeading: React.FC<{
    rect: PonderRelativeRect;
    line: string;
    icon: typeof Monitor;
}> = ({ rect, line, icon: Icon }) => (
    <span className="flex items-center gap-[6%]" style={relativeRectStyle(rect)}>
        <Icon className="h-[60%] w-auto opacity-55" />
        <span className="h-[28%] flex-1 rounded-full opacity-70" style={{ backgroundColor: line }} />
    </span>
);

/** 设置里的一行开关：左边标题加说明，右边一个 48×24 的滑块。 */
const ToggleRow: React.FC<{
    rect: PonderRelativeRect;
    line: string;
    accent: string;
    on?: boolean;
    marker: string;
}> = ({ rect, line, accent, on, marker }) => (
    <div {...{ [marker]: true }} className="flex items-center gap-[4%]" style={relativeRectStyle(rect)}>
        <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-1.5 w-[44%] rounded-full" style={{ backgroundColor: line }} />
            <span className="h-1 w-[68%] rounded-full opacity-45" style={{ backgroundColor: line }} />
        </span>
        <span
            className="relative h-4 w-8 shrink-0 rounded-full"
            style={{ backgroundColor: on ? accent : line, opacity: on ? 0.75 : 1 }}
        >
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white ${on ? 'right-0.5' : 'left-0.5'}`} />
        </span>
    </div>
);

/**
 * 调参台和 Theme Park 共用的那个整屏编辑器。
 *
 * 左边那块大的是**实时预览**，右边那条窄的才是设置栏 —— 两边反过来画的话，
 * 字幕说「左边选模式」时，屏幕上左边摆的是预览，教程自己就对不上了。
 */
const FullScreenEditor: React.FC<{
    marker: string;
    accent: string;
    line: string;
    outline: string;
    /** 右栏顶上那排分页的格数。 */
    tabCount: number;
    activeTab: number;
    children: React.ReactNode;
}> = ({ marker, accent, line, outline, tabCount, activeTab, children }) => (
    <div
        {...{ [marker]: true }}
        className="absolute inset-[3%] flex flex-col overflow-hidden rounded-[4%] border bg-zinc-950/96"
        style={{ borderColor: outline }}
    >
        <div className="flex h-[12%] shrink-0 items-center gap-[2%] border-b px-[3%]" style={{ borderColor: outline }}>
            <span className="aspect-square h-[46%] rounded-full border" style={{ borderColor: outline }} />
            <span className="h-[16%] w-[24%] rounded-full" style={{ backgroundColor: line }} />
        </div>

        <div className="flex min-h-0 flex-1 gap-[3%] p-[3%]">
            {/* 左：实时预览。占掉一大半，里面是歌词行加角上两枚徽标。 */}
            <div
                data-ponder-editor-preview
                className="relative min-w-0 flex-[1.25] overflow-hidden rounded-[6%] border"
                style={{ borderColor: outline, backgroundColor: 'rgba(0,0,0,0.35)' }}
            >
                <span className="absolute left-[6%] top-[7%] h-[6%] w-[30%] rounded-full" style={{ backgroundColor: line }} />
                <span className="absolute right-[6%] top-[7%] h-[6%] w-[16%] rounded-full" style={{ backgroundColor: line }} />
                <span className="absolute inset-x-[10%] top-[38%] flex flex-col gap-[8%]">
                    {[78, 96, 58].map((width, index) => (
                        <span
                            key={width}
                            className="h-2 rounded-full"
                            style={{
                                width: `${width}%`,
                                backgroundColor: index === 1 ? accent : line,
                                opacity: index === 1 ? 0.85 : 0.5,
                            }}
                        />
                    ))}
                </span>
            </div>

            {/* 右：窄的设置栏，顶上一排分页。 */}
            <div
                data-ponder-editor-panel
                className="flex w-[30%] shrink-0 flex-col gap-[4%] rounded-[8%] border p-[5%]"
                style={{ borderColor: outline, backgroundColor: 'rgba(255,255,255,0.03)' }}
            >
                {/* 每一格里画一条标签文字，不然只有选中的那格看得见，读起来像一颗孤零零的胶囊。 */}
                <div className="flex h-[10%] shrink-0 items-center gap-[2%] rounded-full p-[1.5%]" style={{ backgroundColor: line }}>
                    {Array.from({ length: tabCount }, (_, index) => (
                        <span
                            key={index}
                            data-ponder-editor-tab
                            className="flex h-full flex-1 items-center justify-center rounded-full"
                            style={{ backgroundColor: index === activeTab ? `${accent}66` : 'transparent' }}
                        >
                            <span
                                className="h-[24%] w-[62%] rounded-full"
                                style={{ backgroundColor: index === activeTab ? accent : outline, opacity: index === activeTab ? 1 : 0.7 }}
                            />
                        </span>
                    ))}
                </div>
                {children}
            </div>
        </div>
    </div>
);

/**
 * 歌词动画：一个通往调参台的大入口，加一张装着两个开关的卡片。
 *
 * 两个开关同属一张卡、中间只有一条分隔线，不是两张并排的卡。
 */
export const PonderLyricsAnimationSettingsSurface: React.FC<SurfaceProps> = ({
    accent,
    line,
    outline,
    registerStateNode,
}) => (
    <div className="absolute inset-0 overflow-hidden" data-ponder-lyrics-animation-structure>
        <PonderSurfaceBase registerStateNode={registerStateNode}>
            <SectionHeading rect={L.heading} line={line} icon={Monitor} />

            <div
                data-ponder-lyrics-animation-entry
                className="flex items-center gap-[3%] rounded-xl border-2 px-[4%]"
                style={{ ...relativeRectStyle(L.entry), borderColor: `${accent}66` }}
            >
                <span
                    className="flex aspect-square h-[52%] shrink-0 items-center justify-center rounded-xl border"
                    style={{ borderColor: `${accent}55`, color: accent, backgroundColor: `${accent}18` }}
                >
                    <Settings2 className="h-1/2 w-1/2" />
                </span>
                <span className="flex flex-1 flex-col gap-1.5">
                    <span className="h-2 w-[42%] rounded-full" style={{ backgroundColor: line }} />
                    <span className="h-1 w-[76%] rounded-full opacity-45" style={{ backgroundColor: line }} />
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-45" />
            </div>

            {/* 两个开关同属这一张卡，中间那条线是它们之间的分隔线。 */}
            <div
                data-ponder-lyrics-animation-card
                className="rounded-xl border"
                style={{ ...relativeRectStyle(L.card), borderColor: outline }}
            >
                <span className="absolute inset-x-[6%] top-1/2 h-px" style={{ backgroundColor: outline }} />
            </div>
            <ToggleRow marker="data-ponder-lyrics-transparent" rect={L.transparent} line={line} accent={accent} />
            <ToggleRow marker="data-ponder-lyrics-auto-hide" rect={L.autoHide} line={line} accent={accent} on />
        </PonderSurfaceBase>

        {/* 点那个入口打开的是整屏的动画调参台：左边实时预览，右边设置栏，模式在「动画」那一页里选。 */}
        <PonderSurfaceStateLayer state="playground-open" registerStateNode={registerStateNode} replaces>
            <FullScreenEditor
                marker="data-ponder-lyrics-playground"
                accent={accent}
                line={line}
                outline={outline}
                tabCount={4}
                activeTab={2}
            >
                <div className="flex flex-1 flex-col gap-[5%] rounded-[8%] border p-[6%]" style={{ borderColor: outline }}>
                    <span className="h-1.5 w-[54%] shrink-0 rounded-full" style={{ backgroundColor: line }} />
                    {/* 模式是一组可换行的小胶囊，不是一整列大块。 */}
                    <span data-ponder-lyrics-mode-chips className="flex flex-wrap gap-[4%]">
                        {[0, 1, 2, 3, 4, 5].map(index => (
                            <span
                                key={index}
                                className="h-3 w-[28%] rounded-full"
                                style={{ backgroundColor: index === 1 ? accent : line, opacity: index === 1 ? 0.7 : 1 }}
                            />
                        ))}
                    </span>
                </div>
            </FullScreenEditor>
        </PonderSurfaceStateLayer>
    </div>
);

/**
 * 配色主题：Theme Park 入口、两张预设、主题生成来源，以及下面那三个开关。
 *
 * 全部装在同一张卡里。Theme Park 是标题行右端一颗**圆形图标按钮**，不是带文字的大胶囊。
 */
export const PonderThemeSettingsSurface: React.FC<SurfaceProps> = ({
    accent,
    line,
    outline,
    registerStateNode,
}) => (
    <div className="absolute inset-0 overflow-hidden" data-ponder-theme-settings-structure>
        <PonderSurfaceBase registerStateNode={registerStateNode}>
            <SectionHeading rect={T.heading} line={line} icon={Palette} />

            <div className="rounded-xl border" style={{ ...relativeRectStyle(T.card), borderColor: outline }} />

            <div className="flex items-center" style={relativeRectStyle(T.titleRow)}>
                <span className="h-[24%] w-[36%] rounded-full" style={{ backgroundColor: line }} />
            </div>
            <span
                data-ponder-theme-park
                className="flex items-center justify-center rounded-full border"
                style={{ ...relativeRectStyle(T.themePark), borderColor: outline, color: accent }}
            >
                <Palette className="h-[42%] w-auto" />
            </span>

            {/* 两张预设：一枚渐变小圆加一行标签，不是三条色带。 */}
            {([
                ['data-ponder-theme-default', T.presetDefault, true],
                ['data-ponder-theme-custom', T.presetCustom, false],
            ] as const).map(([marker, rect, isDefault]) => (
                <div
                    key={marker}
                    {...{ [marker]: true }}
                    className="flex flex-col items-center justify-center gap-[12%] rounded-lg border"
                    style={{
                        ...relativeRectStyle(rect),
                        borderColor: isDefault ? accent : outline,
                        backgroundColor: isDefault ? `${accent}14` : undefined,
                    }}
                >
                    <span
                        className="aspect-square h-[34%] rounded-full"
                        style={{ background: isDefault ? `linear-gradient(135deg, ${accent}, ${line})` : line, opacity: isDefault ? 0.9 : 0.5 }}
                    />
                    <span className="h-1.5 w-[42%] rounded-full" style={{ backgroundColor: line }} />
                </div>
            ))}

            {/* 主题生成来源：说明加**两个**按钮 —— AI 推断和封面取色，没有第三个。 */}
            <div
                data-ponder-theme-source
                className="flex flex-col justify-center gap-[10%] rounded-xl border px-[4%]"
                style={{ ...relativeRectStyle(T.source), borderColor: outline }}
            >
                <span className="h-1.5 w-[34%] rounded-full" style={{ backgroundColor: line }} />
                <span className="h-1 w-[62%] rounded-full opacity-45" style={{ backgroundColor: line }} />
                <span className="grid grid-cols-2 gap-[4%]">
                    {[0, 1].map(index => (
                        <span
                            key={index}
                            data-ponder-theme-source-option
                            className="flex h-6 items-center justify-center gap-1.5 rounded-lg border"
                            style={{
                                borderColor: index === 1 ? accent : outline,
                                backgroundColor: index === 1 ? `${accent}14` : undefined,
                            }}
                        >
                            {index === 0 ? <Sparkles className="h-3 w-3 opacity-70" /> : null}
                            <span className="h-1 w-[40%] rounded-full" style={{ backgroundColor: index === 1 ? accent : line }} />
                        </span>
                    ))}
                </span>
            </div>

            {/* 这一组下半截是三个开关行，它们占了整组一半的高度。 */}
            {THEME_SETTINGS_TOGGLES.map(({ name, marker }, index) => (
                <ToggleRow
                    key={name}
                    marker={marker}
                    rect={T[name]}
                    line={line}
                    accent={accent}
                    on={index === 0}
                />
            ))}
        </PonderSurfaceBase>

        {/* Theme Park：整屏的配色编辑器 —— 左边实时预览，右边配色 / 信息 / 内容 / AI 四页。 */}
        <PonderSurfaceStateLayer state="theme-park-open" registerStateNode={registerStateNode} replaces>
            <FullScreenEditor
                marker="data-ponder-theme-park-open"
                accent={accent}
                line={line}
                outline={outline}
                tabCount={4}
                activeTab={0}
            >
                <div className="flex flex-1 flex-col gap-[5%] rounded-[8%] border p-[6%]" style={{ borderColor: outline }}>
                    <span className="flex shrink-0 items-center gap-[4%]">
                        <Sun className="h-3 w-3 opacity-50" />
                        <span className="h-1 flex-1 rounded-full opacity-55" style={{ backgroundColor: line }} />
                    </span>
                    {/* 配色页：一排可选的色槽加一块取色区。 */}
                    <span className="flex shrink-0 gap-[4%]">
                        {[0, 1, 2, 3].map(index => (
                            <span
                                key={index}
                                data-ponder-theme-park-swatch
                                className="aspect-square h-4 rounded-full border"
                                style={{ borderColor: index === 0 ? accent : outline, backgroundColor: index === 0 ? accent : line }}
                            />
                        ))}
                    </span>
                    <span className="min-h-0 flex-1 rounded-lg" style={{ background: `linear-gradient(135deg, ${accent}, ${line})`, opacity: 0.55 }} />
                </div>
            </FullScreenEditor>
        </PonderSurfaceStateLayer>
    </div>
);
