import React from 'react';
import { Power, RotateCcw, Waves } from 'lucide-react';
import PonderSurfaceStateLayer, { PonderSurfaceBase } from './PonderSurfaceStateLayer';
import type { PonderSettingsSurfaceProps as SurfaceProps } from './ponderSettingsParts';
import { AUDIO_EQUALIZER_GEOMETRY as G, relativeRectStyle } from './ponderSurfaceGeometry';

// src/components/ponder/surfaces/PonderAudioEqualizerSurface.tsx
// 音频效果对话框：十段均衡的推子排，加下面那一片效果推子。
//
// 这一屏要演的是「拖一根推子会把预设换掉」，所以预设排和推子排必须在同一张图上，
// 而且换槽要真的演一遍 —— 只在字幕里说的话，读者没法把「我拖的是这根」和
// 「亮起来的变成了那颗」连上。

/** 一颗预设胶囊。`slot` 那种画得略宽，对应「自定义 1 / 自定义 2」两颗更长的标签。 */
const PresetChip: React.FC<{
    line: string;
    outline: string;
    accent: string;
    selected?: boolean;
}> = ({ line, outline, accent, selected }) => (
    <span
        data-ponder-eq-chip
        data-ponder-eq-chip-selected={selected || undefined}
        className="flex h-full flex-1 items-center justify-center rounded-full border"
        style={{
            borderColor: selected ? accent : outline,
            backgroundColor: selected ? `${accent}1f` : undefined,
        }}
    >
        <span className="h-1 w-[56%] rounded-full" style={{ backgroundColor: selected ? accent : line }} />
    </span>
);

/** 十根竖推子中的一根：上面一个数值，中间一条轨道加把手，下面一个频点。 */
const BandFader: React.FC<{
    line: string;
    accent: string;
    fill: number;
    active?: boolean;
    marker?: string;
}> = ({ line, accent, fill, active, marker }) => (
    <span
        data-ponder-eq-band
        {...(marker ? { [marker]: true } : {})}
        className="flex h-full min-w-0 flex-1 flex-col items-center gap-[6%]"
    >
        <span className="h-1 w-[70%] rounded-full" style={{ backgroundColor: active ? accent : line, opacity: active ? 1 : 0.5 }} />
        <span className="relative w-1 flex-1 rounded-full" style={{ backgroundColor: line }}>
            <span
                className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full"
                style={{ top: `${(1 - fill) * 100}%`, backgroundColor: active ? accent : line, opacity: active ? 1 : 0.8 }}
            />
        </span>
        <span className="h-1 w-[80%] rounded-full opacity-35" style={{ backgroundColor: line }} />
    </span>
);

const BAND_FILLS = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
/** 拖过之后那一根的位置。只有第四根动，其余不动 —— 换槽是拖一根就发生的。 */
const DRAGGED_BAND_FILLS = BAND_FILLS.map((fill, index) => (index === 3 ? 0.82 : fill));

/** `marker` 挂在第四根上：教程拖的是那一根，锚点也要落在它身上。 */
const Bands: React.FC<{ line: string; accent: string; fills: number[]; activeIndex?: number; marker: string }> = ({
    line, accent, fills, activeIndex, marker,
}) => (
    <div className="flex items-stretch gap-[1.5%]" style={relativeRectStyle(G.bands)}>
        {fills.map((fill, index) => (
            <BandFader
                key={index}
                line={line}
                accent={accent}
                fill={fill}
                active={index === activeIndex}
                marker={index === 3 ? marker : undefined}
            />
        ))}
    </div>
);

/**
 * 音频效果对话框。
 *
 * 结果层只有一个 `custom-written`：拖过之后，选中的预设从内置那颗跳到自定义槽 1，
 * 而且那一根推子停在新位置上 —— 这就是「静默换槽并覆写」的全部证据。
 */
export const PonderAudioEqualizerSurface: React.FC<SurfaceProps> = ({ accent, line, outline, registerStateNode }) => (
    <div className="absolute inset-0 overflow-hidden" data-ponder-audio-equalizer-structure>
        <PonderSurfaceBase registerStateNode={registerStateNode}>
            <span
                data-ponder-eq-enable
                className="flex items-center justify-center gap-[8%] rounded-full border"
                style={{ ...relativeRectStyle(G.enable), borderColor: accent, backgroundColor: `${accent}1a` }}
            >
                <Power className="h-[42%] w-auto" style={{ color: accent }} />
                <span className="h-1 w-[36%] rounded-full" style={{ backgroundColor: accent }} />
            </span>

            {/* 六颗内置预设，当前选中的是其中一颗 —— 拖推子之前，选中的就不该是自定义槽。 */}
            <div data-ponder-eq-presets className="flex items-stretch gap-[3%]" style={relativeRectStyle(G.presets)}>
                {[0, 1, 2, 3, 4, 5].map(index => (
                    <PresetChip key={index} line={line} outline={outline} accent={accent} selected={index === 2} />
                ))}
            </div>
            <div data-ponder-eq-custom-slots className="flex items-stretch gap-[6%]" style={relativeRectStyle(G.customSlots)}>
                {[0, 1].map(index => (
                    <PresetChip key={index} line={line} outline={outline} accent={accent} />
                ))}
            </div>
            {/* 内置预设不可编辑，所以停在内置上时这颗是灰的。 */}
            <span
                data-ponder-eq-reset
                className="flex items-center justify-center rounded-full border opacity-35"
                style={{ ...relativeRectStyle(G.reset), borderColor: outline }}
            >
                <RotateCcw className="h-[42%] w-auto" />
            </span>

            <Bands line={line} accent={accent} fills={BAND_FILLS} marker="data-ponder-eq-band-target" />

            {/* 描边走 inset box-shadow：border 会把里面那枚徽章的百分比挪掉 1px。 */}
            <div
                data-ponder-eq-effects
                className="rounded-2xl"
                style={{ ...relativeRectStyle(G.effects), boxShadow: `inset 0 0 0 1px ${outline}` }}
            >
                <span className="absolute left-[3%] top-[6%] flex h-[14%] items-center gap-[4%]">
                    <Waves className="h-full w-auto opacity-45" />
                    <span className="h-1 w-16 rounded-full opacity-55" style={{ backgroundColor: line }} />
                </span>
                <div className="absolute inset-x-[3%] bottom-[6%] top-[26%] grid grid-cols-3 gap-[4%]">
                    {[0, 1, 2, 3, 4, 5].map(index => (
                        <span key={index} className="flex flex-col justify-center gap-[14%]">
                            <span className="h-1 w-[46%] rounded-full opacity-55" style={{ backgroundColor: line }} />
                            <span className="relative h-1 rounded-full" style={{ backgroundColor: line }}>
                                <span className="absolute left-[38%] top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ backgroundColor: line }} />
                            </span>
                        </span>
                    ))}
                </div>
                {/* 「会加噪」那枚徽章：推子推没推上去它都在，为的是在打开之前就回答噪声从哪来。 */}
                <span
                    data-ponder-eq-noise-badge
                    className="flex items-center justify-center rounded-full border"
                    style={{ ...relativeRectStyle(G.noiseBadge), borderColor: '#f59e0b' }}
                >
                    <span className="h-0.5 w-[56%] rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                </span>
            </div>
        </PonderSurfaceBase>

        {/* 拖过一根之后：选中态从内置那颗跳到自定义槽 1，复位也跟着亮起来。 */}
        <PonderSurfaceStateLayer state="custom-written" registerStateNode={registerStateNode}>
            <div data-ponder-eq-presets-after className="flex items-stretch gap-[3%]" style={relativeRectStyle(G.presets)}>
                {[0, 1, 2, 3, 4, 5].map(index => (
                    <PresetChip key={index} line={line} outline={outline} accent={accent} />
                ))}
            </div>
            <div data-ponder-eq-custom-slots-after className="flex items-stretch gap-[6%]" style={relativeRectStyle(G.customSlots)}>
                {[0, 1].map(index => (
                    <PresetChip key={index} line={line} outline={outline} accent={accent} selected={index === 0} />
                ))}
            </div>
            <span
                data-ponder-eq-reset-on
                className="flex items-center justify-center rounded-full border"
                style={{ ...relativeRectStyle(G.reset), borderColor: accent, color: accent }}
            >
                <RotateCcw className="h-[42%] w-auto" />
            </span>
            <Bands line={line} accent={accent} fills={DRAGGED_BAND_FILLS} activeIndex={3} marker="data-ponder-eq-band-target-after" />
        </PonderSurfaceStateLayer>
    </div>
);

export default PonderAudioEqualizerSurface;
