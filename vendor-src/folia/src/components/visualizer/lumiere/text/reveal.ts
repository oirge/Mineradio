// Copyright (c) 2026 chthollyphile
import type { Line } from '../../../../types';
import { buildLineGraphemeTimeline } from '../../../../utils/lyrics/graphemeTiming';

// src/components/visualizer/lumiere/text/reveal.ts
// 逐字的点亮时刻与进度。时刻取自解析器的逐字时间轴（词内按音节，没有音节按比例，同 fume 的 reveal），
// 进度与闪点包络都是 t 的纯函数。
export interface GlyphTiming {
    start: number;
    end: number;
}

export const buildGlyphTimings = (line: Line): GlyphTiming[] => (
    buildLineGraphemeTimeline(line).map(timing => ({ start: timing.startTime, end: timing.endTime }))
);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** 0 = 还没唱到，1 = 已唱完。字的时长太短时至少给 80ms，点亮不至于一闪而过。 */
export const glyphProgress = (timing: GlyphTiming, time: number) => (
    clamp01((time - timing.start) / Math.max(timing.end - timing.start, 0.08))
);

/** 点亮瞬间的闪点：attack 秒平滑升起，之后按 decay 秒指数衰减。 */
export const flashEnvelope = (timing: GlyphTiming, time: number, decay = 0.5, attack = 0.15) => {
    const age = time - timing.start;
    if (age <= 0) return 0;
    if (age < attack) {
        const t = age / attack;
        return t * t * (3 - 2 * t);
    }
    return Math.exp(-(age - attack) / decay);
};
