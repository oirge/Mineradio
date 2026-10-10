// Copyright (c) 2026 chthollyphile
// src/components/visualizer/lumiere/text/lineClearance.ts
// 当前行与邻行之间的间隙：两件事，都是 t 的纯函数、不存历史。
//
// 1. 漂移让开当前行（源头）：每行永不停止的漂移（匀速 + 绕行）沿「堆叠轴」（横排与纵横交错是上下、竖排是左右）
//    拆开看，邻行朝当前行的那一份平滑地翻成背离（速度不变，字仍在动，只是不往当前行里钻）。当前行自己不再
//    越漂越远：沿自己的方向起步，随即绕一个半径 HOLD 的小圆，速度不变、永不停。邻行 / 当前行的身份与堆叠
//    方向都按槽位滑动的进度混合，换行时不跳。
// 2. 当前行的保护框（兜底）：当前行按它自己的位置、缩放、转角取墨迹框（外扩一个邻字的半个字号，再留一段
//    渐变的边），非当前行的字落进框里时透明度（连同光晕、闪点、径迹）压到 PROTECT_FLOOR，边上平滑过渡。
//    换行时新旧当前行的框按滑动进度交接（权重 = 两次换行的缓动进度之差，求和恒为 1，连续）。

/** 软绝对值的圆角（高度单位）：邻行的漂移在「朝向 / 背离」当前行之间换向时速度也连续。 */
const AWAY_SOFTNESS = 0.005;
/** 当前行漂移绕的小圆半径（高度单位）：最多离槽位 2 × HOLD，比邻行与当前行之间的空隙小得多。 */
export const HOLD = 0.018;

/** 平滑的 |a|（a = 0 时为 0，远处比 |a| 小 AWAY_SOFTNESS）。 */
const softAbs = (a: number) => Math.sqrt(a * a + AWAY_SOFTNESS * AWAY_SOFTNESS) - AWAY_SOFTNESS;

/**
 * 邻行一条轴上的漂移（高度单位）：away 为这一行背离当前行的方向（±1）× 它作为邻行的权重（0..1）。
 * 朝当前行的那一份平滑地翻成背离（|a| 的软版本），背离的那一份不变；away = 0 时原样返回。
 */
export const awayDrift = (drift: number, away: number) => {
    if (away === 0) return drift;
    const sign = away > 0 ? 1 : -1;
    const along = drift * sign;
    return drift + Math.abs(away) * (softAbs(along) - along) * sign;
};

/**
 * 当前行的匀速漂移（不含绕行）在 axis（0 = x，1 = y）上的分量：速度 (vx, vy)、从开始唱起 age 秒。
 * 起步时与匀速漂移一样（沿自己的方向），随即向左拐进半径 HOLD 的圆，速度大小不变。
 */
export const heldDrift = (vx: number, vy: number, age: number, axis: 0 | 1) => {
    const speed = Math.hypot(vx, vy);
    if (speed < 1e-9) return 0;
    const phi = (speed * age) / HOLD;
    const along = HOLD * Math.sin(phi);
    const turn = HOLD * (1 - Math.cos(phi));
    const ux = vx / speed;
    const uy = vy / speed;
    return axis === 0 ? along * ux - turn * uy : along * uy + turn * ux;
};

/** 保护框里非当前行的字最暗压到原来的多少。 */
export const PROTECT_FLOOR = 0.4;
/** 保护框外扩的渐变边宽（以当前行的字号为单位）。 */
export const PROTECT_MARGIN = 0.5;

/** 一个当前行的保护框（逻辑像素）：中心、转角、半宽半高（墨迹框，已缩放）、渐变边宽、交接权重、属于哪一行。 */
export interface ProtectBox {
    line: number;
    x: number;
    y: number;
    cos: number;
    sin: number;
    halfW: number;
    halfH: number;
    margin: number;
    weight: number;
}

export const createProtectBox = (): ProtectBox => ({ line: -1, x: 0, y: 0, cos: 1, sin: 0, halfW: 0, halfH: 0, margin: 1, weight: 0 });

const smooth = (value: number) => {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
};

/**
 * 第 line 行一个字（字心 x, y，半个字号 half）被保护的程度 0..1：在别的行的框里（转到那一行自己的方向上看，
 * 字的方块碰到墨迹框就算在里面）为 1，出了框按渐变边平滑降到 0；多个框按交接权重相加。自己那一行的框不算。
 */
export const protectionAt = (boxes: readonly ProtectBox[], count: number, line: number, x: number, y: number, half: number) => {
    let protect = 0;
    for (let i = 0; i < count; i += 1) {
        const box = boxes[i]!;
        if (box.line === line || box.weight <= 0) continue;
        const dx = x - box.x;
        const dy = y - box.y;
        const u = Math.abs(dx * box.cos + dy * box.sin) - box.halfW - half;
        const v = Math.abs(dy * box.cos - dx * box.sin) - box.halfH - half;
        const outside = u > 0 && v > 0 ? Math.hypot(u, v) : Math.max(u, v, 0);
        protect += box.weight * (1 - smooth(outside / box.margin));
    }
    return Math.min(1, protect);
};

/** 被保护程度 → 透明度倍率。 */
export const protectedAlpha = (protect: number) => 1 - (1 - PROTECT_FLOOR) * protect;
