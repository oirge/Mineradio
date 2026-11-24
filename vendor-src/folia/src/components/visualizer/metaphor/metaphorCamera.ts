import type { MetaphorLayout, MetaphorRect } from './metaphorLayout';
import { METAPHOR_TAIL, type MetaphorCue, type MetaphorProgram, type MetaphorShot } from './metaphorProgram';

// src/components/visualizer/metaphor/metaphorCamera.ts
// 隐喻的镜头（纯函数，不碰 three）：一个镜头在某一刻的机位，以及句与句之间转场在这一刻的量（漫墨）、
// 一句歌词出现和化开的进度。
// 机位永远正对画面：只有平移、远近、绕视线的滚转，没有偏转和俯仰（不做假 3D）。
// 拉远、冲镜仍然分档跳切；跟词镜头在成组的词之间短暂缓动。

export interface MetaphorPose {
    /** 看向的点（机位在它正前方）。 */
    x: number; y: number;
    /** 离画面多远。 */
    distance: number;
    roll: number;
    /** 竖直视角，度。 */
    fov: number;
}

export interface MetaphorTransitionFx {
    /** 加到墨场上的量：到 1 左右整个画面都是墨。 */
    flood: number;
}

/** 所有镜头同一个视角：远近只靠机位的距离。 */
export const METAPHOR_FOV = 30;

/** 间奏没有字：留给融球的舞台。 */
export const METAPHOR_EMPTY_STAGE: MetaphorRect = { x0: -4.5, y0: -2.6, x1: 4.5, y1: 2.6 };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const easeOutCubic = (u: number) => 1 - (1 - u) ** 3;

interface Focus { x: number; y: number; width: number; height: number; }

const rectFocus = (rect: MetaphorRect): Focus => ({
    x: (rect.x0 + rect.x1) / 2,
    y: (rect.y0 + rect.y1) / 2,
    width: Math.max(1.6, rect.x1 - rect.x0),
    height: Math.max(1.2, rect.y1 - rect.y0),
});

/** time 这一刻正在唱（或刚唱过）的词；还没开唱是第一个。 */
const wordIndexAt = (layout: MetaphorLayout, time: number) => {
    let found = 0;
    let latest = Number.NEGATIVE_INFINITY;
    layout.words.forEach((word, index) => {
        if (word.t0 <= time && word.t0 >= latest) {
            latest = word.t0;
            found = index;
        }
    });
    return found;
};

/** 没有字时（间奏）：舞台里按镜头的随机数挑的一小块。 */
const emptyFocus = (bounds: MetaphorRect, seed: number): Focus => {
    const width = bounds.x1 - bounds.x0;
    const height = bounds.y1 - bounds.y0;
    return {
        x: bounds.x0 + width * (0.2 + 0.6 * seed),
        y: bounds.y0 + height * (0.2 + 0.6 * ((seed * 7.31) % 1)),
        width: width * 0.3,
        height: height * 0.3,
    };
};

/** 正在唱的词，用作拉远和冲镜的起止点。 */
const wordFocus = (layout: MetaphorLayout, time: number, seed: number): Focus => (
    layout.words.length === 0 ? emptyFocus(layout.bounds, seed) : rectFocus(layout.words[wordIndexAt(layout, time)])
);

/** 把窗口内正在唱或即将开唱的词一起构图。 */
const lyricFocus = (layout: MetaphorLayout, start: number, end: number, seed: number): Focus => {
    if (layout.words.length === 0) return emptyFocus(layout.bounds, seed);
    const bounds = { ...layout.words[wordIndexAt(layout, start)] };
    for (const word of layout.words) {
        if (word.t0 >= end || (word.t0 < start && word.t1 <= start)) continue;
        bounds.x0 = Math.min(bounds.x0, word.x0);
        bounds.y0 = Math.min(bounds.y0, word.y0);
        bounds.x1 = Math.max(bounds.x1, word.x1);
        bounds.y1 = Math.max(bounds.y1, word.y1);
    }
    return rectFocus(bounds);
};

const FOLLOW_HOLD = 0.55;
const FOLLOW_BLEND = 0.2;

/** 前一组多留出一段缓动时间，让接下来的词在镜头移动时也留在画内。 */
const followFocus = (layout: MetaphorLayout, shot: MetaphorShot, time: number): Focus => {
    const index = Math.floor(Math.max(0, time - shot.start) / FOLLOW_HOLD);
    const start = shot.start + index * FOLLOW_HOLD;
    const next = shot.start + (index + 1) * FOLLOW_HOLD;
    const focus = lyricFocus(layout, start, Math.min(shot.end, next + FOLLOW_BLEND), shot.seed);
    const progress = clamp01((time - start) / FOLLOW_BLEND);
    if (index === 0 || progress >= 1) return focus;
    const previousStart = shot.start + (index - 1) * FOLLOW_HOLD;
    const previous = lyricFocus(layout, previousStart, Math.min(shot.end, start + FOLLOW_BLEND), shot.seed);
    const amount = progress * progress * (3 - 2 * progress);
    return {
        x: lerp(previous.x, focus.x, amount),
        y: lerp(previous.y, focus.y, amount),
        width: lerp(previous.width, focus.width, amount),
        height: lerp(previous.height, focus.height, amount),
    };
};

const glyphFocus = (layout: MetaphorLayout, time: number, seed: number): Focus => {
    if (layout.glyphs.length === 0) return emptyFocus(layout.bounds, seed);
    let found = layout.glyphs[0];
    for (const glyph of layout.glyphs) {
        if (glyph.t0 <= time && glyph.t0 >= found.t0) found = glyph;
    }
    return { x: found.x, y: found.y, width: found.size * 0.9, height: found.size * 0.9 };
};

const HALF_FOV_TAN = Math.tan((METAPHOR_FOV * Math.PI) / 360);
const fitDistance = (focus: Focus, margin: number, aspect: number) => (
    Math.max(focus.height, focus.width / Math.max(0.2, aspect)) * margin / (2 * HALF_FOV_TAN)
);

/**
 * 一个镜头分几档跳切时，time 这一刻跳到了第几档（0..steps）。跳的时刻取镜头里词开唱的时刻（卡在词上）；
 * 镜头里的词不够就按时间均分。
 */
const stepAt = (shot: MetaphorShot, layout: MetaphorLayout, time: number, steps: number) => {
    const onsets = [...new Set(layout.words.map(word => word.t0))]
        .filter(onset => onset > shot.start + 0.3 && onset < shot.end - 0.3)
        .sort((a, b) => a - b);
    const times: number[] = [];
    if (onsets.length >= steps) {
        for (let index = 0; index < steps; index += 1) times.push(onsets[Math.floor((index * onsets.length) / steps)]);
    } else {
        for (let index = 1; index <= steps; index += 1) times.push(shot.start + ((shot.end - shot.start) * index) / (steps + 1));
    }
    return times.filter(at => at <= time).length;
};

/** 极慢的漂：十几秒才晃一个来回。 */
const wobble = (time: number, phase: number) => Math.sin(time * 0.23 + phase) * 0.6 + Math.sin(time * 0.37 + phase * 2.3) * 0.4;

/** 全景里整句占画面的几分之一的倒数：字尽量大，四周只留一圈边。 */
const WIDE_MARGIN = 1.1;
const PULLBACK_STEPS = 3;
const PUSHIN_STEPS = 3;
/** 冲镜的三档隔这么久跳一格。 */
const PUSHIN_BEAT = 0.16;

export interface MetaphorPoseInput {
    shot: MetaphorShot;
    layout: MetaphorLayout;
    /** cue 里的时间（循环的 cue 已经折回）。 */
    time: number;
    aspect: number;
    /** 运镜幅度，0..2。 */
    motion: number;
}

/** 一个镜头在 time 这一刻的机位。 */
export const resolveMetaphorPose = ({ shot, layout, time, aspect, motion }: MetaphorPoseInput): MetaphorPose => {
    const u = clamp01((time - shot.start) / Math.max(0.001, shot.end - shot.start));
    // 一个镜头从头到尾只推近（或拉开）百分之几，匀速
    const creep = 1 - 0.035 * motion * u;
    const whole = rectFocus(layout.bounds);
    let focus = whole;
    let distance: number;
    let { roll } = shot;
    switch (shot.kind) {
        case 'wide':
            distance = fitDistance(whole, WIDE_MARGIN, aspect) * creep;
            break;
        case 'close':
            focus = lyricFocus(layout, shot.start, shot.end, shot.seed);
            distance = fitDistance(focus, 1.3, aspect) * creep;
            break;
        case 'follow':
            focus = followFocus(layout, shot, time);
            distance = fitDistance(focus, 1.45, aspect);
            break;
        case 'macro':
            focus = glyphFocus(layout, shot.start, shot.seed);
            distance = fitDistance(focus, 0.62, aspect) * creep;
            roll += 0.03 * motion * (u - 0.5);
            break;
        case 'dutch':
            distance = fitDistance(whole, 1.1, aspect) * creep;
            break;
        case 'void':
            distance = fitDistance(whole, 1.85, aspect) * (2 - creep);
            break;
        case 'pullback': {
            // 从正在唱的词上一格一格跳开，最后露出整句和周围的墨
            const near = wordFocus(layout, shot.start, shot.seed);
            const out = stepAt(shot, layout, time, PULLBACK_STEPS) / PULLBACK_STEPS;
            focus = { x: lerp(near.x, whole.x, out), y: lerp(near.y, whole.y, out), width: whole.width, height: whole.height };
            distance = lerp(fitDistance(near, 1.15, aspect), fitDistance(whole, 1.4, aspect), out);
            break;
        }
        case 'pushin': {
            // 冲镜：从很远处连跳三格，落到第一个词上
            const near = wordFocus(layout, shot.start, shot.seed);
            const into = Math.min(PUSHIN_STEPS, Math.floor(Math.max(0, time - shot.start) / PUSHIN_BEAT)) / PUSHIN_STEPS;
            focus = { x: lerp(whole.x, near.x, into), y: lerp(whole.y, near.y, into), width: near.width, height: near.height };
            distance = lerp(fitDistance(whole, 3.2, aspect), fitDistance(near, 1.3, aspect), into) * creep;
            break;
        }
    }
    const phase = shot.seed * 40;
    const drift = 0.008 * motion;
    roll += wobble(time, phase + 23) * 0.004 * motion;
    let offsetX = wobble(time, phase) * drift - shot.offsetX;
    let offsetY = wobble(time, phase + 11) * drift - shot.offsetY;
    if ((shot.kind === 'close' || shot.kind === 'follow') && layout.words.length > 0) {
        // 滚转和偏心后按屏幕坐标留边，竖屏也不会裁掉目标词。
        const cos = Math.cos(roll), sin = Math.sin(roll);
        const screenX = Math.min(aspect * 0.25, Math.max(-aspect * 0.25, offsetX));
        const screenY = offsetY;
        const width = Math.abs(cos) * focus.width + Math.abs(sin) * focus.height;
        const height = Math.abs(sin) * focus.width + Math.abs(cos) * focus.height;
        const visible = Math.max(width / (aspect - 2 * Math.abs(screenX)), height / (1 - 2 * Math.abs(screenY)));
        distance = Math.max(distance, visible * 1.08 / (2 * HALF_FOV_TAN));
        offsetX = cos * screenX - sin * screenY;
        offsetY = sin * screenX + cos * screenY;
    }
    const visible = 2 * distance * HALF_FOV_TAN;
    return {
        x: focus.x + offsetX * visible,
        y: focus.y + offsetY * visible,
        distance,
        roll,
        fov: METAPHOR_FOV,
    };
};

/** 静态模式：每句一个锁死的全景。 */
export const resolveMetaphorStillPose = (layout: MetaphorLayout, aspect: number): MetaphorPose => {
    const whole = rectFocus(layout.bounds);
    return { x: whole.x, y: whole.y, distance: fitDistance(whole, WIDE_MARGIN, aspect), roll: 0, fov: METAPHOR_FOV };
};

const FLOOD_IN = 0.7;
const FLOOD_OUT = 0.9;

/** 转场在 time 这一刻的量：进当前 cue 的那一半，和出到下一个 cue 的那一半。 */
export const resolveMetaphorTransitionFx = (program: MetaphorProgram, cueIndex: number, time: number, out: MetaphorTransitionFx): MetaphorTransitionFx => {
    out.flood = 0;
    const cue = program.cues[cueIndex];
    const since = time - cue.start;
    if (since >= 0 && cue.transition === 'flood' && since < FLOOD_OUT) out.flood = 1.15 * (1 - easeOutCubic(since / FLOOD_OUT));
    if (cueIndex + 1 < program.cues.length) {
        const next = program.cues[cueIndex + 1];
        const until = next.start - time;
        if (next.transition === 'flood' && until < FLOOD_IN) out.flood = Math.max(out.flood, 1.15 * (1 - until / FLOOD_IN) ** 2);
    }
    return out;
};

/** 一句歌词的影子出现到几成（开唱前的预告）。 */
export const resolveMetaphorReveal = (cue: MetaphorCue, time: number) => clamp01((time - cue.start) / 0.5 + (cue.lineIndex < 0 ? 1 : 0));

/** 一句歌词化开到几成：只有唱完后还留着一段尾巴的才化，紧跟下一句的直接硬切。 */
export const resolveMetaphorMelt = (cue: MetaphorCue, time: number) => {
    if (cue.lineIndex < 0 || cue.end - cue.singEnd < METAPHOR_TAIL * 0.6) return 0;
    const from = Math.max(cue.singEnd + 0.3, cue.end - 1.5);
    return clamp01((time - from) / Math.max(0.05, cue.end - from));
};
