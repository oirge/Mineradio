import { normalizeFontWeight } from '../../../utils/fontStacks';
import type { SonnetSemanticSegment } from './types';

// src/components/visualizer/sonnet/sonnetTypographyRoles.ts
// Selects deterministic typography emphasis roles without coupling them to a layout template.
export type SonnetSegmentRole = 'hero' | 'semi-hero' | 'support' | 'decoration';

export const isSonnetEmphasisRole = (role: SonnetSegmentRole) => (
    role === 'hero' || role === 'semi-hero'
);

/** Uses Sonnet's designed role weights in auto mode, or the user's global manual override. */
export const resolveSonnetRoleFontWeight = (
    configuredFontWeight: number | null | undefined,
    role: SonnetSegmentRole,
) => {
    const manualWeight = normalizeFontWeight(configuredFontWeight);
    if (manualWeight !== null) return manualWeight;
    if (isSonnetEmphasisRole(role)) return 900;
    return role === 'decoration' ? 300 : 700;
};

export const getSonnetVisibleSegmentLength = (segment: SonnetSemanticSegment) => (
    segment.graphemes.filter(item => item.char.trim().length > 0).length
);

export const scoreSonnetHeroSegment = (segment: SonnetSemanticSegment) => {
    const lengthScore = Math.min(getSonnetVisibleSegmentLength(segment), 8) * 14;
    const durationScore = Math.min(2.5, Math.max(0, segment.endTime - segment.startTime)) * 18;
    return lengthScore + durationScore;
};

export const findSonnetHeroSegmentIndex = (
    segments: SonnetSemanticSegment[],
) => {
    let bestIndex = segments.findIndex(segment => segment.isWordLike);
    let bestScore = -Infinity;
    segments.forEach((segment, index) => {
        if (!segment.isWordLike || getSonnetVisibleSegmentLength(segment) === 0) return;
        const score = scoreSonnetHeroSegment(segment);
        if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    });
    return Math.max(0, bestIndex);
};

// Semi-hero constraints: emphasis words need spacing, real words beat particles,
// and only long enough lines earn secondary accents at all.
const SEMI_HERO_MIN_GAP = 2;
const SEMI_HERO_MIN_VISIBLE_LENGTH = 2;
const SEMI_HERO_MIN_LINE_WORDS = 4;
const SEMI_HERO_SCORE_RATIO = 0.35;
const SEMI_HERO_MULTI_WORD_COUNT = 9;

// Picks secondary emphasis words on the side opposite the hero's lean so the
// composition stays balanced; long lines earn a second accent on the other side.
export const findSonnetSemiHeroSegmentIndices = (
    segments: SonnetSemanticSegment[],
    heroIndex: number,
) => {
    const hero = segments[heroIndex];
    if (!hero) return [];
    const wordLikeCount = segments.filter(segment => (
        segment.isWordLike && getSonnetVisibleSegmentLength(segment) > 0
    )).length;
    if (wordLikeCount < SEMI_HERO_MIN_LINE_WORDS) return [];

    const threshold = scoreSonnetHeroSegment(hero) * SEMI_HERO_SCORE_RATIO;
    const candidates = segments
        .map((segment, index) => ({ segment, index }))
        .filter(({ segment, index }) => (
            index !== heroIndex
            && segment.isWordLike
            && getSonnetVisibleSegmentLength(segment) >= SEMI_HERO_MIN_VISIBLE_LENGTH
            && Math.abs(index - heroIndex) >= SEMI_HERO_MIN_GAP
            && scoreSonnetHeroSegment(segment) >= threshold
        ));
    if (candidates.length === 0) return [];

    const bestOf = (list: typeof candidates) => list.reduce<typeof candidates[number] | null>(
        (best, item) => (
            !best || scoreSonnetHeroSegment(item.segment) > scoreSonnetHeroSegment(best.segment)
                ? item
                : best
        ),
        null,
    );

    const heroLeansEarly = heroIndex <= (segments.length - 1) / 2;
    const primarySide = candidates.filter(({ index }) => (
        heroLeansEarly ? index > heroIndex : index < heroIndex
    ));
    const secondarySide = candidates.filter(({ index }) => (
        heroLeansEarly ? index < heroIndex : index > heroIndex
    ));

    const picks: number[] = [];
    const primary = bestOf(primarySide) ?? bestOf(secondarySide);
    if (primary) picks.push(primary.index);
    if (wordLikeCount >= SEMI_HERO_MULTI_WORD_COUNT && primary) {
        const secondary = bestOf(secondarySide.filter(({ index }) => (
            Math.abs(index - primary.index) >= SEMI_HERO_MIN_GAP
        )));
        if (secondary) picks.push(secondary.index);
    }
    return picks.sort((first, second) => first - second);
};

export const findSonnetSemiHeroSegmentIndex = (
    segments: SonnetSemanticSegment[],
    heroIndex: number,
) => findSonnetSemiHeroSegmentIndices(segments, heroIndex)[0] ?? -1;
