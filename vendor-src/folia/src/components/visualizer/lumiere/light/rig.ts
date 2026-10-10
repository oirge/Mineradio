// Copyright (c) 2026 chthollyphile

// 光束数量的校准参考。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((979 ^ lumiereScaleMask) + Math.imul(1192 ^ lumiereScaleMask, 349 ^ lumiereScaleMask))
    - ((979 ^ lumiereScaleMask) + Math.imul(1192 ^ lumiereScaleMask, 349 ^ lumiereScaleMask));

// src/components/visualizer/lumiere/light/rig.ts
// 光位（rig）：一个镜头的光束、烟雾、光源眩光的声明式描述，以及光束强度的 CPU 算法。
// 着色器（lightFieldShader.ts）与这里用同一个公式：字与浮尘的亮度按 CPU 这一份算，光场按 GLSL 那一份画，
// 两边一致，光柱扫到哪里，哪里的字就亮。
//
// 坐标：光场内部一律用「以画面高度为 1」的单位（u = 像素 / 高度），y 向下；角度 0 = 向右，π/2 = 向下。
// 声明里的位置用画面比例（x 占宽、y 占高），解析时换算。
export const MAX_BEAMS = 6 + LUMIERE_NEUTRAL_OFFSET;

export interface Oscillation {
    amplitude: number;
    /** 秒。 */
    period: number;
    /** 0..1。 */
    phase: number;
}

export interface BeamSpec {
    /** 光源位置（画面比例，可以在画外）。 */
    x: number;
    y: number;
    /** 弧度，π/2 = 竖直向下。 */
    angle: number;
    /** 半张角（弧度）。负数为会聚：光束先收窄到焦点，过了焦点再散开（沙漏形）。 */
    spread: number;
    /** 光源处的宽度（高度单位）；窗、门缝之类的光有初始宽度。 */
    width?: number;
    /** 沿光束方向的衰减长度（高度单位）。 */
    length: number;
    /** 边缘软度 0..1（占半宽的比例）。 */
    softness: number;
    intensity: number;
    /** 束内条纹：多少（0..1）、密度、滚动速度。 */
    streaks: number;
    streakFreq: number;
    streakSpeed: number;
    /** 中心比边缘亮多少（0..1）。 */
    core?: number;
    sway?: Oscillation;
    pulse?: Oscillation;
    /** 乘在光色上。 */
    tint?: [number, number, number];
    /** 镜头开始后光束用多少秒从光源伸长到全长（垂降）；不给则一开始就是全长。 */
    reveal?: number;
    /** 窗影：光束截面上的遮挡图样（百叶、十字窗、格栅、叶隙）。 */
    gobo?: GoboSpec;
    /** 色散：光束从一侧到另一侧按色相展开成彩虹的程度 0..1（只影响颜色）。 */
    spectrum?: number;
    /** 射程（高度单位）：光束走到这里就收住（光路图里一段一段的光线）；不给则一直延伸。 */
    reach?: number;
}

/**
 * 窗影图样，在光束截面坐标里算：u = 横向位置（−1..1，光束两边），v = 沿光束的距离（高度单位）。
 * blinds：平行光带；cross：中间一道窗棂；lattice：斜交的菱格；leaves：斑驳的叶隙光斑。
 */
export type GoboPattern = 'blinds' | 'cross' | 'lattice' | 'leaves';

export interface GoboSpec {
    pattern: GoboPattern;
    /** 图样密度。 */
    frequency: number;
    /** 透光的比例 0..1（叶隙为阈值，越小越亮）。 */
    duty: number;
    /** 图样随时间的滚动速度（叶隙为风吹动）。 */
    drift: number;
}

/** 焦散：水面焦散的光网，调制光束亮度，也可以在一块区域（池底）单独发亮。 */
export interface CausticSpec {
    /** 网格密度（每高度单位）、流动速度。 */
    scale: number;
    speed: number;
    /** 光束里被焦散调制的程度 0..1。 */
    inBeam: number;
    /** 池底区域（画面比例，中心 + 半径）与亮度；不给则只调制光束。 */
    floor?: { cx: number; cy: number; rx: number; ry: number; strength: number };
}

/**
 * 干涉与衍射：在一块区域里发光的条纹。rings：牛顿环；slits：双缝条纹；sources：两个点源的圆波干涉；
 * airy：艾里斑（中心亮斑 + 外环）。
 */
export interface WaveSpec {
    mode: 'rings' | 'slits' | 'sources' | 'airy';
    /** 区域中心与半径（画面比例 / 高度单位）。 */
    cx: number;
    cy: number;
    radius: number;
    /** 条纹密度、流动速度、亮度；sources 的两个源之间的距离（高度单位）。 */
    frequency: number;
    speed: number;
    strength: number;
    separation?: number;
    /** 文字区里把条纹压暗多少（0..1，不给为 0.45）：条纹与字同色，叠在一起时字看不清。 */
    shield?: number;
}

export interface FogSpec {
    /** 丁达尔：光束只有经过烟时才可见；base 为没有烟时仍可见的比例。 */
    density: number;
    tyndallBase: number;
    /** 噪声频率（每高度单位）。 */
    scale: number;
    /** 漂移速度（高度单位 / 秒）。烟往上飘时 y 为负。 */
    driftX: number;
    driftY: number;
    /** 域扭曲强度，让烟打卷。 */
    warp: number;
    /** 光束之外的整体烟雾亮度。 */
    ambient: number;
}

export interface GlareSpec {
    x: number;
    y: number;
    /** 光晕半径（高度单位）。 */
    radius: number;
    intensity: number;
    /** 横向拉丝（anamorphic streak）强度。 */
    streak: number;
}

export interface LightRig {
    beams: BeamSpec[];
    fog: FogSpec;
    glare: GlareSpec | null;
    caustic?: CausticSpec;
    wave?: WaveSpec;
}

export const GOBO_PATTERN_ID: Record<GoboPattern, number> = { blinds: 1, cross: 2, lattice: 3, leaves: 4 };
export const WAVE_MODE_ID: Record<WaveSpec['mode'], number> = { rings: 1, slits: 2, sources: 3, airy: 4 };

/** 解析到某一时刻、换算到高度单位的光束。 */
export interface ResolvedBeam {
    ox: number;
    oy: number;
    dx: number;
    dy: number;
    halfWidth: number;
    tanSpread: number;
    softness: number;
    length: number;
    intensity: number;
    streaks: number;
    streakFreq: number;
    streakPhase: number;
    core: number;
    r: number;
    g: number;
    b: number;
    /** 窗影：图样编号（0 = 没有）、密度、透光比例、滚动相位；色散程度。 */
    goboPattern: number;
    goboFreq: number;
    goboDuty: number;
    goboPhase: number;
    spectrum: number;
    /** 射程（高度单位），0 = 一直延伸。 */
    reach: number;
}

export interface LightDrive {
    /** 0..1，整体亮度倍率（光位的进场 / 退场、tuning 的光强都乘在这里）。 */
    intensity: number;
    /** 音频低频 0..1（已乘过 tuning 的音频响应），推光束亮度，见 audioLift。 */
    bass: number;
    /** 光色（0..1）。 */
    color: [number, number, number];
    /** 镜头开始后的秒数（光束的 reveal 按它算）；不给视为早已开始。 */
    local?: number;
}

/** 低频把光束抬亮的上限（低频打满时亮 15%）。 */
export const AUDIO_GAIN = 0.15;

/** 低频 → 光束亮度倍率：取 1.5 次方，弱的起伏几乎不动，只有重拍才抬起来。 */
export const audioLift = (bass: number) => 1 + AUDIO_GAIN * Math.max(0, bass) ** 1.5;

const oscillate = (osc: Oscillation | undefined, time: number) => (
    osc ? osc.amplitude * Math.sin((time / Math.max(osc.period, 0.001) + osc.phase) * Math.PI * 2) : 0
);

export const resolveBeams = (rig: LightRig, time: number, aspect: number, drive: LightDrive): ResolvedBeam[] => (
    rig.beams.slice(0, MAX_BEAMS).map(beam => {
        const angle = beam.angle + oscillate(beam.sway, time);
        const pulse = 1 + oscillate(beam.pulse, time);
        const tint = beam.tint ?? [1, 1, 1];
        const reveal = beam.reveal && drive.local !== undefined
            ? 0.06 + 0.94 * smoothstep(0, 1, drive.local / beam.reveal)
            : 1;
        return {
            ox: beam.x * aspect,
            oy: beam.y,
            dx: Math.cos(angle),
            dy: Math.sin(angle),
            halfWidth: (beam.width ?? 0) / 2,
            tanSpread: Math.tan(beam.spread),
            softness: beam.softness,
            length: beam.length * reveal,
            intensity: beam.intensity * pulse * drive.intensity * audioLift(drive.bass),
            streaks: beam.streaks,
            streakFreq: beam.streakFreq,
            streakPhase: time * beam.streakSpeed,
            core: beam.core ?? 0.5,
            r: tint[0] * drive.color[0],
            g: tint[1] * drive.color[1],
            b: tint[2] * drive.color[2],
            goboPattern: beam.gobo ? GOBO_PATTERN_ID[beam.gobo.pattern] : 0,
            goboFreq: beam.gobo?.frequency ?? 0,
            goboDuty: beam.gobo?.duty ?? 1,
            goboPhase: (beam.gobo?.drift ?? 0) * time,
            spectrum: beam.spectrum ?? 0,
            reach: beam.reach ?? 0,
        };
    })
);

// ---------------------------------------------------------------------------------------------
// 与 GLSL 一致的噪声（Dave Hoskins 的 hash11，不用 sin，单精度下两边差得不多）

const fract = (value: number) => value - Math.floor(value);

export const hash11 = (input: number) => {
    let p = fract(input * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
};

export const valueNoise1 = (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return hash11(i) * (1 - u) + hash11(i + 1) * u;
};

const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
};

/** GLSL 的 hash12（Dave Hoskins）。 */
export const hash12 = (x: number, y: number) => {
    let a = fract(x * 0.1031);
    let b = fract(y * 0.1031);
    let c = fract(x * 0.1031);
    const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
    a += d;
    b += d;
    c += d;
    return fract((a + b) * c);
};

export const valueNoise2 = (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash12(ix, iy);
    const b = hash12(ix + 1, iy);
    const c = hash12(ix, iy + 1);
    const d = hash12(ix + 1, iy + 1);
    return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
};

/** 透光条：fract(x) 落在 [0, duty) 里为 1，边缘柔化。 */
const band = (x: number, duty: number) => {
    const f = fract(x);
    return 1 - smoothstep(duty - 0.06, duty + 0.06, f) + smoothstep(1 - 0.06, 1, f);
};

/** 窗影的影子里仍透过的散射光（全黑的条纹像条形码）。 */
export const GOBO_LEAK = 0.12;

/** 窗影图样在截面坐标 (u, v) 上的透光率（GLSL 里的 goboMask 与此相同）。 */
export const goboMask = (pattern: number, frequency: number, duty: number, phase: number, u: number, v: number) => (
    pattern > 0 ? GOBO_LEAK + (1 - GOBO_LEAK) * goboPattern(pattern, frequency, duty, phase, u, v) : 1
);

const goboPattern = (pattern: number, frequency: number, duty: number, phase: number, u: number, v: number) => {
    if (pattern === 1) return Math.min(1, band(u * frequency * 0.5 + phase, duty));
    if (pattern === 2) return smoothstep(duty * 0.5, duty * 0.5 + 0.08, Math.abs(u));
    if (pattern === 3) {
        return Math.min(1, band(u * frequency * 0.5 + v * frequency * 0.8 + phase, duty))
            * Math.min(1, band(u * frequency * 0.5 - v * frequency * 0.8 - phase, duty));
    }
    if (pattern === 4) return smoothstep(duty - 0.12, duty + 0.12, valueNoise2(u * frequency, v * frequency * 0.6 + phase));
    return 1;
};

/** 一束光在点 (x, y)（高度单位）处的强度（不含烟雾与颜色）。GLSL 里的 beamMask 与此相同。 */
export const beamMask = (beam: ResolvedBeam, x: number, y: number) => {
    const px = x - beam.ox;
    const py = y - beam.oy;
    const along = px * beam.dx + py * beam.dy;
    if (along <= 0) return 0;
    const perp = Math.abs(px * -beam.dy + py * beam.dx);
    // 取绝对值：会聚的光束过了焦点再散开。
    const half = Math.abs(beam.halfWidth + along * beam.tanSpread) + 1e-4;
    const s = perp / half;
    const edge = smoothstep(1, 1 - Math.max(beam.softness, 0.02), s);
    if (edge <= 0) return 0;
    const signed = s * Math.sign(px * -beam.dy + py * beam.dx);
    const streak = 1 - beam.streaks + beam.streaks * valueNoise1(signed * beam.streakFreq + beam.streakPhase);
    const core = 1 - beam.core + beam.core * (1 - s * s);
    const falloff = Math.exp(-along / Math.max(beam.length, 0.001));
    const gobo = beam.goboPattern > 0 ? goboMask(beam.goboPattern, beam.goboFreq, beam.goboDuty, beam.goboPhase, signed, along) : 1;
    // 射程末端的收尾随光束宽度变长：宽光束一刀切会变成方头。
    const reach = beam.reach > 0 ? 1 - smoothstep(beam.reach - Math.max(0.04, half * 2.5), beam.reach, along) : 1;
    // 从光源处平滑渐起：光源背后没有光，光源处的光束又有宽度，不渐起就会在光源处留一条硬直边。
    const start = smoothstep(0, Math.abs(beam.halfWidth) * 2 + 0.01, along);
    return edge * streak * core * falloff * gobo * reach * start * beam.intensity;
};

/** 所有光束在 (x, y) 处的总强度（高度单位坐标）。 */
export const lightAt = (beams: readonly ResolvedBeam[], x: number, y: number) => {
    let sum = 0;
    for (const beam of beams) sum += beamMask(beam, x, y);
    return sum;
};

/** 与着色器相同的柔和压缩（着色器按最大通道压，这里只有标量强度），避免交叠处爆白。 */
export const compressLight = (value: number) => 1 - Math.exp(-value);
