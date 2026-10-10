import type { Line, LyricData } from '../../types';
import { finalizeParsedLyricLines, isInterludeLine } from './parserCore';
import { ensureLyricDataRenderHints } from './renderHints';
import { createStaffCreditMatcher, detectLeadingStaffBlock } from './staffCredits';
import type { StaffCreditBlock } from './staffCredits';
import { absorbAdjacentLines } from './staffCreditsAbsorb';
import { resolveStaffDecision } from './staffCreditsDecision';
import { rebuildStaffLines } from './staffCreditsRewrite';
import type {
    LyricStaffAbsorbMode,
    LyricStaffDecision,
    LyricStaffPolicy,
    LyricStaffPolicyOptions,
} from './types';

// src/utils/lyrics/staffCreditsPolicy.ts
// 按前奏时间预算决定开头 staff 块的去留：够长就保留（必要时重排），
// 勉强就压缩成几张卡，塞不下就整块隐藏。

export type {
    LyricStaffAbsorbMode,
    LyricStaffDecision,
    LyricStaffPolicy,
    LyricStaffPolicyOptions,
    LyricStaffVerdict,
} from './types';

export const DEFAULT_LYRIC_STAFF_POLICY: LyricStaffPolicy = 'smart';
export const DEFAULT_LYRIC_STAFF_MIN_DWELL_SECONDS = 1.5;
export const DEFAULT_LYRIC_STAFF_ABSORB_MODE: LyricStaffAbsorbMode = 'off';
export const LYRIC_STAFF_MIN_DWELL_RANGE = { min: 0.6, max: 4 } as const;

const POLICY_CYCLE: LyricStaffPolicy[] = ['keep', 'smart', 'hide'];
const ABSORB_MODE_CYCLE: LyricStaffAbsorbMode[] = ['off', 'before', 'both'];

export const nextLyricStaffPolicy = (policy: LyricStaffPolicy): LyricStaffPolicy =>
    POLICY_CYCLE[(POLICY_CYCLE.indexOf(policy) + 1) % POLICY_CYCLE.length];

export const nextLyricStaffAbsorbMode = (mode: LyricStaffAbsorbMode): LyricStaffAbsorbMode =>
    ABSORB_MODE_CYCLE[(ABSORB_MODE_CYCLE.indexOf(mode) + 1) % ABSORB_MODE_CYCLE.length];

const NO_BLOCK_DECISION: LyricStaffDecision = {
    verdict: 'none',
    blockLineCount: 0,
    windowSeconds: 0,
    requiredSeconds: 0,
    staffIndexes: [],
    memberIndexes: [],
    absorbedLineCount: 0,
    absorbedIndexes: [],
};

const clampMinDwell = (value?: number): number => {
    if (!Number.isFinite(value)) {
        return DEFAULT_LYRIC_STAFF_MIN_DWELL_SECONDS;
    }

    return Math.min(LYRIC_STAFF_MIN_DWELL_RANGE.max, Math.max(LYRIC_STAFF_MIN_DWELL_RANGE.min, value as number));
};

const stripInterludes = (lines: Line[]): Line[] => lines.filter(line => !isInterludeLine(line));

const analyze = (
    lyrics: LyricData,
    options: LyricStaffPolicyOptions
): { lines: Line[]; block: StaffCreditBlock | null; decision: LyricStaffDecision; minDwell: number } => {
    const minDwell = clampMinDwell(options.minDwellSeconds);
    const policy = options.policy ?? DEFAULT_LYRIC_STAFF_POLICY;
    const lines = stripInterludes(lyrics.lines);
    const detected = detectLeadingStaffBlock(lines, createStaffCreditMatcher(options.pattern), {
        meta: { title: lyrics.title, artist: lyrics.artist },
    });
    // 吸收必须发生在判定之前：吸收行进块后前奏窗口和停留预算都要跟着变，
    // 先判定再吸收会让「够不够放得下」这个问题算在错误的块上。
    //
    // hide 不吸收：它不参与判定，吸收在这里唯一的作用就是让一起删掉的行变多，
    // 而它依赖的「每行最少停留」在这个策略下并不显示，用户无从得知边界在哪。
    const block = detected && (policy === 'hide'
        ? detected
        : absorbAdjacentLines(lines, detected, {
            mode: options.absorbMode ?? DEFAULT_LYRIC_STAFF_ABSORB_MODE,
            maxDuration: minDwell,
        }));

    if (!block) {
        return { lines, block: null, decision: NO_BLOCK_DECISION, minDwell };
    }

    if (policy === 'hide') {
        return {
            lines,
            block,
            minDwell,
            decision: {
                ...NO_BLOCK_DECISION,
                verdict: 'hide',
                blockLineCount: block.staffIndexes.length,
                staffIndexes: block.staffIndexes,
                memberIndexes: block.memberIndexes,
                absorbedLineCount: block.absorbedIndexes.length,
                absorbedIndexes: block.absorbedIndexes,
            },
        };
    }

    return { lines, block, decision: resolveStaffDecision(lines, block, minDwell), minDwell };
};

export const applyLyricStaffPolicy = (
    lyrics: LyricData | null | undefined,
    options: LyricStaffPolicyOptions = {}
): LyricData | null => {
    if (!lyrics) {
        return null;
    }

    const policy = options.policy ?? DEFAULT_LYRIC_STAFF_POLICY;
    if (policy === 'keep') {
        return ensureLyricDataRenderHints(lyrics);
    }

    const { lines, block, decision, minDwell } = analyze(lyrics, options);
    if (!block || decision.verdict === 'none' || decision.verdict === 'keep') {
        return ensureLyricDataRenderHints(lyrics);
    }

    return {
        ...lyrics,
        lines: finalizeParsedLyricLines(rebuildStaffLines(lines, block, decision, minDwell), { includeInterludes: true }),
    };
};

export interface LyricStaffPreviewLine {
    line: Line;
    index: number;
    isStaff: boolean;
    removed: boolean;
}

export interface LyricStaffPreviewResult {
    decision: LyricStaffDecision;
    lines: LyricStaffPreviewLine[];
}

export const buildLyricStaffPreview = (
    lyrics: LyricData | null | undefined,
    options: LyricStaffPolicyOptions = {}
): LyricStaffPreviewResult => {
    if (!lyrics) {
        return { decision: NO_BLOCK_DECISION, lines: [] };
    }

    const policy = options.policy ?? DEFAULT_LYRIC_STAFF_POLICY;
    if (policy === 'keep') {
        return {
            decision: NO_BLOCK_DECISION,
            lines: stripInterludes(lyrics.lines).map((line, index) => ({ line, index, isStaff: false, removed: false })),
        };
    }

    const { lines, decision } = analyze(lyrics, options);
    const staffIndexes = new Set(decision.staffIndexes);
    const memberIndexes = new Set(decision.memberIndexes);

    return {
        decision,
        lines: lines.map((line, index) => ({
            line,
            index,
            isStaff: staffIndexes.has(index),
            removed: decision.verdict === 'hide' && memberIndexes.has(index),
        })),
    };
};
