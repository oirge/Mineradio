import React from 'react';
import { Images, LayoutGrid, PanelsTopLeft, RotateCcw } from 'lucide-react';
import PonderSurfaceStateLayer, { PonderSurfaceBase } from './PonderSurfaceStateLayer';
import {
    SettingsHeading as Heading,
    SettingsToggleRow as ToggleRow,
    type PonderSettingsSurfaceProps as SurfaceProps,
} from './ponderSettingsParts';
import type { PonderRelativeRect } from '../../../types/ponder';
import {
    GRID3D_CARD_STYLE_GEOMETRY as C,
    GRID_VIEW_CARD_GEOMETRY as V,
    LATTICE_STYLE_GEOMETRY as L,
    relativeRectStyle,
} from './ponderSurfaceGeometry';

// src/components/ponder/surfaces/PonderAppearanceSettingsSurfaces.tsx
// 设置 · 外观里管「卡片长什么样」的三组：首页卡片样式、网格卡片、队列拼贴。
//
// 和 PonderSettingsSectionSurfaces 分开一个文件，不是因为它们是另一类东西，而是因为
// 那个文件已经装着歌词动画和配色主题两组加一个整屏编辑器；再塞三组进去，改其中一组
// 就要在四百行里找位置。三组都只有开关、滑杆和并排选项，形状来自 ponderSettingsParts。

/** 一条带标题和百分比的滑杆。 */
const SliderRow: React.FC<{
    rect: PonderRelativeRect;
    line: string;
    accent: string;
    fill: number;
    marker: string;
}> = ({ rect, line, accent, fill, marker }) => (
    <div {...{ [marker]: true }} className="flex flex-col justify-center gap-[14%]" style={relativeRectStyle(rect)}>
        <span className="flex items-center gap-2">
            <span className="h-1.5 w-[34%] rounded-full opacity-70" style={{ backgroundColor: line }} />
            <span className="flex-1" />
            <span className="h-1.5 w-[10%] rounded-full opacity-55" style={{ backgroundColor: line }} />
        </span>
        <span className="relative h-1.5 rounded-full" style={{ backgroundColor: line }}>
            <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fill * 100}%`, backgroundColor: accent, opacity: 0.8 }} />
            <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                style={{ left: `${fill * 100}%`, borderColor: outlineOf(accent), backgroundColor: accent }}
            />
        </span>
    </div>
);

/** 滑块把手的描边跟着强调色走，省一个只为它存在的 prop。 */
const outlineOf = (accent: string) => `${accent}88`;

/**
 * 首页卡片样式：一句说明加两张并排的选项。
 *
 * 两张选项在真实界面里只有一行文字、没有缩略图 —— 画成带预览图的大卡会让人以为
 * 那里能看到效果，而实际上要切过去才看得见。
 */
export const PonderGrid3dCardStyleSurface: React.FC<SurfaceProps> = ({ accent, line, outline, registerStateNode }) => (
    <div className="absolute inset-0 overflow-hidden" data-ponder-grid3d-card-style-structure>
        <PonderSurfaceBase registerStateNode={registerStateNode}>
            <Heading rect={C.heading} line={line} icon={LayoutGrid} />
            <div className="rounded-xl border" style={{ ...relativeRectStyle(C.card), borderColor: outline }} />
            <div className="flex flex-col justify-center gap-[18%]" style={relativeRectStyle(C.copy)}>
                <span className="h-1.5 w-[30%] rounded-full" style={{ backgroundColor: line }} />
                <span className="h-1 w-[66%] rounded-full opacity-45" style={{ backgroundColor: line }} />
            </div>
            {([
                ['data-ponder-grid3d-style-image', C.optionImage, true],
                ['data-ponder-grid3d-style-card', C.optionCard, false],
            ] as const).map(([marker, rect, isActive]) => (
                <span
                    key={marker}
                    {...{ [marker]: true }}
                    className="flex items-center justify-center rounded-lg border"
                    style={{
                        ...relativeRectStyle(rect),
                        borderColor: isActive ? accent : outline,
                        backgroundColor: isActive ? `${accent}14` : undefined,
                    }}
                >
                    <span className="h-1.5 w-[44%] rounded-full" style={{ backgroundColor: isActive ? accent : line }} />
                </span>
            ))}
        </PonderSurfaceBase>
    </div>
);

/**
 * 网格卡片：一个开关解锁另一个开关，下面两条衰减滑杆加一颗复位。
 *
 * 「正方形卡片」画在结果层里：真实界面里它要等「全画幅封面」打开才渲染出来。
 */
export const PonderGridViewCardSurface: React.FC<SurfaceProps> = ({ accent, line, outline, registerStateNode }) => (
    <div className="absolute inset-0 overflow-hidden" data-ponder-grid-view-card-structure>
        <PonderSurfaceBase registerStateNode={registerStateNode}>
            <Heading rect={V.heading} line={line} icon={Images} />
            <div className="rounded-xl border" style={{ ...relativeRectStyle(V.card), borderColor: outline }} />
            <ToggleRow marker="data-ponder-grid-view-full-bleed" rect={V.fullBleed} line={line} accent={accent} />
            <SliderRow marker="data-ponder-grid-view-min-scale" rect={V.minScale} line={line} accent={accent} fill={0.62} />
            <SliderRow marker="data-ponder-grid-view-min-opacity" rect={V.minOpacity} line={line} accent={accent} fill={0.44} />
            <span
                data-ponder-grid-view-reset
                className="flex items-center justify-center gap-[8%] rounded-lg border"
                style={{ ...relativeRectStyle(V.reset), borderColor: outline }}
            >
                <RotateCcw className="h-[40%] w-auto opacity-55" />
                <span className="h-1 w-[40%] rounded-full opacity-55" style={{ backgroundColor: line }} />
            </span>
        </PonderSurfaceBase>

        {/* 开了全画幅封面，「正方形卡片」那一行才长出来。纯叠加：底下那屏要留着。 */}
        <PonderSurfaceStateLayer state="full-bleed-on" registerStateNode={registerStateNode}>
            <ToggleRow marker="data-ponder-grid-view-full-bleed-on" rect={V.fullBleed} line={line} accent={accent} on />
            <ToggleRow marker="data-ponder-grid-view-square" rect={V.square} line={line} accent={accent} />
        </PonderSurfaceStateLayer>
    </div>
);

/**
 * 队列拼贴：暗角，加一组层层解锁的海报叠色。
 *
 * 叠色关着时下面什么都没有；开了才有自定义颜色和强度；开了自定义颜色才有取色器。
 * 两层结果层照这个顺序叠。
 */
export const PonderLatticeStyleSurface: React.FC<SurfaceProps> = ({ accent, line, outline, registerStateNode }) => (
    <div className="absolute inset-0 overflow-hidden" data-ponder-lattice-style-structure>
        <PonderSurfaceBase registerStateNode={registerStateNode}>
            <Heading rect={L.heading} line={line} icon={PanelsTopLeft} />
            <div className="rounded-xl border" style={{ ...relativeRectStyle(L.card), borderColor: outline }}>
                <span className="absolute inset-x-[6%] top-[22%] h-px" style={{ backgroundColor: outline }} />
            </div>
            <ToggleRow marker="data-ponder-lattice-vignette" rect={L.vignette} line={line} accent={accent} on />
            <ToggleRow marker="data-ponder-lattice-tint" rect={L.tint} line={line} accent={accent} />
        </PonderSurfaceBase>

        {/* 开了叠色：自定义颜色开关和强度滑杆出现。 */}
        <PonderSurfaceStateLayer state="tint-on" registerStateNode={registerStateNode}>
            <ToggleRow marker="data-ponder-lattice-tint-on" rect={L.tint} line={line} accent={accent} on />
            <ToggleRow marker="data-ponder-lattice-custom-color" rect={L.customColor} line={line} accent={accent} />
            <SliderRow marker="data-ponder-lattice-intensity" rect={L.intensity} line={line} accent={accent} fill={0.55} />
        </PonderSurfaceStateLayer>

        {/* 再开自定义颜色：取色器占掉中间那块。 */}
        <PonderSurfaceStateLayer state="custom-color-on" registerStateNode={registerStateNode}>
            <ToggleRow marker="data-ponder-lattice-custom-color-on" rect={L.customColor} line={line} accent={accent} on />
            <div
                data-ponder-lattice-picker
                className="overflow-hidden rounded-lg border"
                style={{
                    ...relativeRectStyle(L.picker),
                    borderColor: outline,
                    background: `linear-gradient(90deg, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)`,
                }}
            >
                <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.55), transparent 45%, rgba(0,0,0,0.6))' }} />
            </div>
        </PonderSurfaceStateLayer>
    </div>
);
