// Copyright (c) 2026 chthollyphile
import type { Line } from '../../../types';
import { createRng } from './lumiereRandom';
import type { Mood, ParagraphBoundary, ParagraphKind, StructureLine } from './lumiereKernel';
import { LUMIERE_KINDS, profileOf } from './catalog';

// 编排历史窗口的参考值。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((0xb9e72008 ^ lumiereScaleMask) + Math.imul(0x5efd6ee0 ^ lumiereScaleMask, 0x1a8ce47b ^ lumiereScaleMask))
    - ((0xb9e72008 ^ lumiereScaleMask) + Math.imul(0x5efd6ee0 ^ lumiereScaleMask, 0x1a8ce47b ^ lumiereScaleMask));


// src/components/visualizer/lumiere/program.ts
// 绘光的切块与选光位：切块（一个镜头 1–2 行，长间隙出间奏镜头）与选光位（按段落性质 / energy 定 mood，
// 族不连续重复、最近用过的不马上再用）。纯数据，不碰 Pixi。整首歌的编译（分段、转场、开场）在 lumiereProgram.ts。
// folia 里是全自动的：没有锁定风格、风格库偏好与族限制，energy 恒为 null（按段落性质定 mood）。
export interface LumiereShot {
    id: string;
    kind: string;
    /** 覆盖的歌词行（全曲行序号）；间奏镜头为空。 */
    lineIndices: number[];
    startTime: number;
    endTime: number;
    lyricEndTime: number;
    isBridge: boolean;
}

export interface LumiereParagraph {
    id: string;
    /** 在程序里的序号。 */
    index: number;
    kind: ParagraphKind;
    boundary: ParagraphBoundary;
    /**
     * 场景单元的时间范围：从这一段第一行开始（第一段从 0 开始）到下一段开始（最后一段到歌曲结束或最后一行唱完），
     * 段与段首尾相接；段后的长间奏在这一段里以间奏镜头的形式出现。
     */
    startTime: number;
    endTime: number;
    /** 最后一行的视觉结束时间；没有歌词的间奏段（前奏、纯音乐）等于 endTime。 */
    lyricEndTime: number;
    /** 单元涉及的歌词行（全曲行序号）与行本身，窗口排它们。 */
    lineIndices: number[];
    lines: Line[];
    shots: LumiereShot[];
    /** 出场转场；lights-out 时场景自己在窗口里收光，其余由运行时做交叉渐变 / 模糊。 */
    transitionOut: { kind: LumiereTransitionKind; startTime: number; endTime: number } | null;
    /** 这个单元是段落的开头（星空点亮的开场只在这里播放）。 */
    opening: boolean;
    /**
     * 轨迹过渡把整首歌并成一个单元时，原来各段落的范围（运镜按段落往返推拉）；按段落切单元时不给。
     */
    sections?: LumiereSection[];
}

/** 并进一个单元的原段落范围（lumiereSeamless.ts）。 */
export interface LumiereSection {
    startTime: number;
    endTime: number;
    kind: ParagraphKind;
}

export const LUMIERE_TRANSITION_KINDS = ['lights-out', 'flare-cut', 'focus-pull'] as const;
export type LumiereTransitionKind = typeof LUMIERE_TRANSITION_KINDS[number];

export interface LumiereChain {
    /** 最近用过的光位（新的在后）。 */
    recent: string[];
    family: string | null;
}

export interface LumiereParams {
    /** 一个镜头最长多少秒（两行合成一个镜头时的上限）。 */
    maxShotDuration: number;
    /** 一个镜头最多几行。 */
    maxLinesPerShot: number;
    /** 一行本身长于这么多秒就单独成镜头。 */
    longLine: number;
    /** 行与行之间空隙超过这么多秒出间奏镜头。 */
    bridgeGap: number;
}

export const DEFAULT_LUMIERE_PARAMS: LumiereParams = {
    maxShotDuration: 7,
    maxLinesPerShot: 2,
    longLine: 3.6,
    bridgeGap: 4,
};

/** 最近用过的几个光位不马上再用。 */
const RECENT = 3 + LUMIERE_NEUTRAL_OFFSET;
/** 间奏镜头偏向的族。 */
const BRIDGE_FAMILIES = ['motes', 'astral', 'zenith'];

const MOODS_BY_KIND: Record<ParagraphKind, Mood[] | null> = {
    chorus: ['loud', 'neutral'],
    lift: ['loud', 'neutral'],
    verse: ['quiet', 'neutral'],
    breath: ['quiet', 'neutral'],
    outro: ['quiet'],
    break: null,
};

/** 显式 energy：低能量排除喧哗的光位，高能量排除安静的，中段不限。 */
export const moodsForEnergy = (energy: number): Mood[] | null => (
    energy < 0.33 ? ['quiet', 'neutral'] : energy < 0.66 ? null : ['neutral', 'loud']
);

interface Group {
    lines: StructureLine[];
}

/** 切块：短行两两合成一个镜头（不超过时长上限），长行单独成镜头。 */
export const groupLines = (lines: readonly StructureLine[], params: LumiereParams): Group[] => {
    const groups: Group[] = [];
    for (const line of lines) {
        const duration = line.renderEndTime - line.line.startTime;
        const last = groups.at(-1);
        const lastStart = last?.lines[0]?.line.startTime ?? 0;
        const lastLong = last ? last.lines.length === 1 && (last.lines[0]!.renderEndTime - lastStart) >= params.longLine : true;
        if (
            last
            && !lastLong
            && duration < params.longLine
            && last.lines.length < params.maxLinesPerShot
            && line.renderEndTime - lastStart <= params.maxShotDuration
        ) {
            last.lines.push(line);
        } else {
            groups.push({ lines: [line] });
        }
    }
    return groups;
};

export interface PlannedShot {
    lines: StructureLine[];
    startTime: number;
    endTime: number;
    lyricEndTime: number;
    isBridge: boolean;
}

/**
 * 镜头的时间：每个镜头从它的第一行开始（段首镜头从段落开始），到下一个镜头开始为止；
 * 行后的空隙超过 bridgeGap 时，镜头在行唱完后 0.6 秒收住，空隙交给间奏镜头。
 */
export const planShots = (
    lines: readonly StructureLine[],
    paragraphStart: number,
    paragraphEnd: number,
    params: LumiereParams,
): PlannedShot[] => {
    const groups = groupLines(lines, params);
    const shots: PlannedShot[] = [];
    groups.forEach((group, index) => {
        const start = index === 0 ? Math.min(paragraphStart, group.lines[0]!.line.startTime) : group.lines[0]!.line.startTime;
        const lyricEnd = Math.max(...group.lines.map(line => line.renderEndTime));
        const nextStart = groups[index + 1]?.lines[0]?.line.startTime ?? paragraphEnd;
        if (nextStart - lyricEnd >= params.bridgeGap) {
            const end = lyricEnd + 0.6;
            shots.push({ lines: group.lines, startTime: start, endTime: end, lyricEndTime: lyricEnd, isBridge: false });
            shots.push({ lines: [], startTime: end, endTime: nextStart, lyricEndTime: nextStart, isBridge: true });
        } else {
            shots.push({ lines: group.lines, startTime: start, endTime: Math.max(nextStart, lyricEnd), lyricEndTime: Math.min(lyricEnd, nextStart), isBridge: false });
        }
    });
    if (groups.length === 0 && paragraphEnd > paragraphStart) {
        shots.push({ lines: [], startTime: paragraphStart, endTime: paragraphEnd, lyricEndTime: paragraphEnd, isBridge: true });
    }
    return shots;
};

/**
 * 选光位：全部光位 → 间奏限定族 → mood → 避开最近用过的与上一个的族，每一步筛空了就退回上一步。
 * energy 为 null 时按段落性质定 mood（folia 里总是 null）。
 */
export const castShot = (options: {
    seed: string;
    paragraphIndex: number;
    shotIndex: number;
    kind: ParagraphKind;
    isBridge: boolean;
    chain: LumiereChain;
    energy?: number | null;
}): string => {
    const { chain } = options;
    let candidates: readonly string[] = LUMIERE_KINDS;
    /** 按条件收窄；收窄后少于 atLeast 个就不收（族还不全时，避开同族会变成两族来回交替）。 */
    const narrow = (keep: (kind: string) => boolean, atLeast = 1) => {
        const next = candidates.filter(keep);
        if (next.length >= atLeast) candidates = next;
    };
    const energy = options.energy ?? null;
    const moods = energy === null ? MOODS_BY_KIND[options.kind] : moodsForEnergy(energy);
    if (options.isBridge) narrow(kind => BRIDGE_FAMILIES.includes(profileOf(kind).family) && profileOf(kind).mood !== 'loud');
    if (moods) narrow(kind => moods.includes(profileOf(kind).mood));
    narrow(kind => !chain.recent.includes(kind));
    if (chain.family) narrow(kind => profileOf(kind).family !== chain.family, 3);
    const random = createRng(`${options.seed}:${options.paragraphIndex}:${options.shotIndex}:cast`);
    return candidates[Math.floor(random() * candidates.length)]!;
};

/** 选定之后更新 chain（跨段落保留）。 */
export const advanceChain = (chain: LumiereChain, kind: string) => {
    chain.recent = [...chain.recent, kind].slice(-RECENT);
    chain.family = profileOf(kind).family;
};
