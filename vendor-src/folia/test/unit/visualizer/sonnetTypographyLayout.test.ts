import { describe, expect, it } from 'vitest';
import type { SonnetSemanticSegment, SonnetShotKind } from '@/components/visualizer/sonnet/types';
import type { SonnetTypographyPlacement } from '@/components/visualizer/sonnet/sonnetTypographyLayout';
import {
    findSonnetHeroSegmentIndex,
    findSonnetSemiHeroSegmentIndex,
    findSonnetSemiHeroSegmentIndices,
    isSonnetEmphasisRole,
    isSonnetLayoutSegment,
    resolveSonnetTypographyLayout,
} from '@/components/visualizer/sonnet/sonnetTypographyLayout';
import { resolveSonnetRoleFontWeight } from '@/components/visualizer/sonnet/sonnetTypographyRoles';
import {
    layoutSonnetPosterBlocks,
    type SonnetPosterBlockBox,
} from '@/components/visualizer/sonnet/sonnetPosterBlocksLayout';
import {
    layoutEditorialColumn,
    layoutQuietTableau,
    resolveSonnetFlowGaps,
    type SonnetFlowLayoutBox,
} from '@/components/visualizer/sonnet/sonnetShotFlowLayouts';

// test/unit/visualizer/sonnetTypographyLayout.test.ts
// Locks the semantic hero/support hierarchy and true stacked Japanese typography.
const segment = (text: string, isWordLike = true): SonnetSemanticSegment => ({
    text,
    startOffset: 0,
    endOffset: text.length,
    startTime: 0,
    endTime: 1,
    wordIndices: [],
    graphemes: Array.from(text, (char, index) => ({
        char,
        startTime: index / text.length,
        endTime: (index + 1) / text.length,
    })),
    isWordLike,
});

describe('Sonnet typography layout', () => {
    const segments = [segment('明かり'), segment('に', false), segment('あなたへ')];

    it('keeps designed role weights in auto mode and uses the manual global override', () => {
        expect(resolveSonnetRoleFontWeight(undefined, 'support')).toBe(700);
        expect(resolveSonnetRoleFontWeight(undefined, 'hero')).toBe(900);
        expect(resolveSonnetRoleFontWeight(null, 'semi-hero')).toBe(900);
        expect(resolveSonnetRoleFontWeight(null, 'decoration')).toBe(300);
        expect(resolveSonnetRoleFontWeight(520, 'support')).toBe(520);
        expect(resolveSonnetRoleFontWeight(520, 'hero')).toBe(520);
        expect(resolveSonnetRoleFontWeight(520, 'decoration')).toBe(520);
        expect(resolveSonnetRoleFontWeight(950, 'hero')).toBe(900);
    });

    it('chooses one semantic hero deterministically', () => {
        expect(findSonnetHeroSegmentIndex(segments)).toBe(2);
        expect(findSonnetHeroSegmentIndex(segments))
            .toBe(findSonnetHeroSegmentIndex(segments));
    });

    it('adds one smaller semi-hero when a long leading block precedes the hero', () => {
        const longSentence = [
            segment('在'),
            segment('漫长'),
            segment('句子'),
            segment('前部重点'),
            segment('仍然'),
            segment('不断'),
            segment('延伸'),
            segment('最终的核心词语'),
        ];
        const heroIndex = findSonnetHeroSegmentIndex(longSentence);
        const semiHeroIndex = findSonnetSemiHeroSegmentIndex(longSentence, heroIndex);
        const layout = resolveSonnetTypographyLayout({
            lines: [longSentence],
            shotKind: 'type-impact',
            paragraphKind: 'chorus',
            width: 1280,
            height: 720,
            baseFontSize: 40,
            fontFamily: 'sans-serif',
            fontWeight: 700,
        }).filter(item => item.role !== 'decoration');
        const hero = layout.find(item => item.role === 'hero')!;
        const semiHero = layout.find(item => item.role === 'semi-hero')!;
        const supports = layout.filter(item => item.role === 'support');

        expect(heroIndex).toBe(7);
        expect(semiHeroIndex).toBe(3);
        expect(semiHero.segmentIndex).toBe(semiHeroIndex);
        expect(semiHero.fontScale).toBeLessThan(hero.fontScale);
        expect(semiHero.fontScale).toBeGreaterThan(Math.max(...supports.map(item => item.fontScale)));
        expect(isSonnetEmphasisRole(semiHero.role)).toBe(true);
    });

    it('does not add a semi-hero for a short leading block', () => {
        const shortSentence = [
            segment('一'), segment('二'), segment('三'), segment('四'), segment('五'), segment('核心词语'),
        ];
        const heroIndex = findSonnetHeroSegmentIndex(shortSentence);
        expect(findSonnetSemiHeroSegmentIndex(shortSentence, heroIndex)).toBe(-1);
        expect(resolveSonnetTypographyLayout({
            lines: [shortSentence],
            shotKind: 'type-impact',
            paragraphKind: 'chorus',
            width: 1280,
            height: 720,
            baseFontSize: 40,
            fontFamily: 'sans-serif',
            fontWeight: 700,
        }).some(item => item.role === 'semi-hero')).toBe(false);
    });

    it('keeps semi-hero selection local to each long line in a grouped shot', () => {
        const longLine = [
            segment('很'), segment('长'), segment('的'), segment('前部重点'),
            segment('还'), segment('在'), segment('继续'), segment('最终核心词语'),
        ];
        const layout = resolveSonnetTypographyLayout({
            lines: [longLine, [segment('下一句'), segment('核心')]],
            shotKind: 'fragment-collage',
            paragraphKind: 'verse',
            width: 1280,
            height: 720,
            baseFontSize: 40,
            fontFamily: 'sans-serif',
            fontWeight: 700,
        }).filter(item => item.role !== 'decoration');

        expect(layout.filter(item => item.role === 'semi-hero')).toHaveLength(1);
        expect(layout.find(item => item.role === 'semi-hero')!.segmentIndex).toBe(3);
        expect(layout.filter(item => item.role === 'hero')).toHaveLength(2);
    });

    it('stacks the hero by grapheme and keeps support text small', () => {
        const layout = resolveSonnetTypographyLayout({
            lines: [segments],
            shotKind: 'editorial-column',
            paragraphKind: 'verse',
            width: 1280,
            height: 720,
            baseFontSize: 40,
            fontFamily: 'sans-serif',
            fontWeight: 700,
        });
        const hero = layout.find(item => item.role === 'hero')!;
        const supports = layout.filter(item => item.role === 'support');
        const textPlacements = layout.filter(item => item.role !== 'decoration');

        expect(hero.displayText).toBe('あ\nな\nた\nへ');
        expect(supports.every(item => item.fontScale < hero.fontScale)).toBe(true);
        expect(textPlacements.map(item => item.timingPhase)).toEqual([0, 0.5, 1]);
        expect(supports[0].x).toBeLessThan(supports[1].x);
    });

    it('changes composition across templates without changing segment order', () => {
        const impact = resolveSonnetTypographyLayout({
            lines: [segments],
            shotKind: 'type-impact',
            paragraphKind: 'chorus',
            width: 1280,
            height: 720,
            baseFontSize: 40,
            fontFamily: 'sans-serif',
            fontWeight: 700,
        });
        const quiet = resolveSonnetTypographyLayout({
            lines: [segments],
            shotKind: 'quiet-tableau',
            paragraphKind: 'outro',
            width: 1280,
            height: 720,
            baseFontSize: 40,
            fontFamily: 'sans-serif',
            fontWeight: 700,
        });

        expect(impact.filter(item => item.role !== 'decoration').map(item => item.role))
            .toEqual(quiet.map(item => item.role));
        expect(impact.find(item => item.role === 'hero')!.fontScale)
            .toBeGreaterThan(quiet.find(item => item.role === 'hero')!.fontScale);
    });

    it('uses semantic duration and timing order instead of seeded scatter', () => {
        const timed = [
            { ...segment('短'), startTime: 0, endTime: 0.3 },
            { ...segment('持续的主词'), startTime: 0.4, endTime: 2.2 },
            { ...segment('尾'), startTime: 2.3, endTime: 2.6 },
        ];
        const layout = resolveSonnetTypographyLayout({
            lines: [timed],
            shotKind: 'fragment-collage',
            paragraphKind: 'verse',
            width: 1280,
            height: 720,
            baseFontSize: 40,
            fontFamily: 'sans-serif',
            fontWeight: 700,
        });

        expect(findSonnetHeroSegmentIndex(timed)).toBe(1);
        const textPlacements = layout.filter(item => item.role !== 'decoration');
        expect(textPlacements.map(item => item.timingPhase)).toEqual([0, 0.5, 1]);
        expect(textPlacements.map(item => item.segmentIndex)).toEqual([0, 1, 2]);
    });

    it('tracks the segment flow direction independently from glyph writing direction', () => {
        const words = ['愛', 'を', '懐', 'い', 'て', '理想', 'を', '号', 'ん', 'だ'].map(text => segment(text));
        const layout = resolveSonnetTypographyLayout({
            lines: [words],
            shotKind: 'type-impact',
            paragraphKind: 'chorus',
            width: 1280,
            height: 720,
            baseFontSize: 40,
            fontFamily: 'sans-serif',
            fontWeight: 700,
        }).filter(item => item.role !== 'decoration');

        expect(layout.filter(item => [0, 1, 8, 9].includes(item.segmentIndex))
            .every(item => item.layoutDirection === 'vertical')).toBe(true);
        expect(layout.filter(item => [2, 3, 4, 6, 7].includes(item.segmentIndex))
            .every(item => item.layoutDirection === 'horizontal')).toBe(true);

        const bySegmentIndex = new Map(layout.map(item => [item.segmentIndex, item]));
        expect(Math.abs(bySegmentIndex.get(0)!.y - bySegmentIndex.get(1)!.y)).toBeGreaterThanOrEqual(96);
        expect(Math.abs(bySegmentIndex.get(8)!.y - bySegmentIndex.get(9)!.y)).toBeGreaterThanOrEqual(96);
    });

    it('keeps a visible gap in the compact centered vertical stack', () => {
        const layout = resolveSonnetTypographyLayout({
            lines: [[segment('傷'), segment('付け'), segment('合う')]],
            shotKind: 'quiet-tableau',
            paragraphKind: 'breath',
            width: 1280,
            height: 720,
            baseFontSize: 40,
            fontFamily: 'sans-serif',
            fontWeight: 700,
        });
        const hero = layout.find(item => item.role === 'hero')!;
        const supports = layout.filter(item => item.role === 'support');

        expect(supports.every(item => Math.abs(item.y - hero.y) >= 122.4)).toBe(true);
    });

    it('excludes whitespace-only semantic segments from scene layout', () => {
        expect(['a', ' ', 'bit'].map(text => segment(text, text !== ' ')).filter(isSonnetLayoutSegment)
            .map(item => item.text)).toEqual(['a', 'bit']);
    });

    it('measures a vertical non-CJK word as a rotated horizontal block', () => {
        const words = [segment('a'), segment('café'), segment('c')];
        const layout = resolveSonnetTypographyLayout({
            lines: [words],
            shotKind: 'quiet-tableau',
            paragraphKind: 'breath',
            width: 1280,
            height: 720,
            baseFontSize: 40,
            fontFamily: 'sans-serif',
            fontWeight: 700,
        }).filter(item => item.role !== 'decoration');
        const word = layout.find(item => item.segmentIndex === 1)!;

        expect(word.vertical).toBe(false);
        expect(word.rotation).toBeCloseTo(Math.PI / 2);
        expect(Math.abs(layout[0].y - word.y)).toBeLessThan(300);
    });

    it('builds poster blocks from measured text while retaining semantic hierarchy', () => {
        const words = [
            segment('沿着'), segment('漫长'), segment('叙事'), segment('半主视觉'),
            segment('继续'), segment('抵达'), segment('最终的英雄文字'), segment('之后'),
        ];
        const layout = resolveSonnetTypographyLayout({
            lines: [words],
            shotKind: 'poster-blocks',
            paragraphKind: 'verse',
            width: 1280,
            height: 720,
            baseFontSize: 40,
            fontFamily: 'sans-serif',
            fontWeight: 700,
        });
        const hero = layout.find(item => item.role === 'hero')!;
        const semiHero = layout.find(item => item.role === 'semi-hero')!;
        const supports = layout.filter(item => item.role === 'support');

        expect(layout).toHaveLength(words.length);
        expect(layout.every(item => item.layoutDirection === 'horizontal' && item.rotation === 0)).toBe(true);
        expect(layout.every(item => Number.isFinite(item.x) && Number.isFinite(item.y))).toBe(true);
        expect(hero.fontScale).toBeGreaterThan(semiHero.fontScale);
        expect(semiHero.fontScale).toBeGreaterThan(Math.max(...supports.map(item => item.fontScale)));
        // Supports never grow beyond their role size; global fitting only shrinks.
        expect(supports.every(item => item.fontScale <= 1.15 + 1e-6)).toBe(true);
    });

    it('picks a semi-hero after the hero when the hero leans early', () => {
        const words = [
            segment('核心词语'), segment('接着'), segment('继续'),
            segment('次要重点'), segment('还有'), segment('尾巴'),
        ];
        const heroIndex = findSonnetHeroSegmentIndex(words);
        expect(heroIndex).toBe(0);
        expect(findSonnetSemiHeroSegmentIndices(words, heroIndex)).toEqual([3]);
    });

    it('picks two semi-heroes on both sides of the hero in long lines', () => {
        const words = [
            segment('引子'), segment('主旋律'), segment('铺陈'), segment('展开'), segment('推进'),
            segment('英雄核心'), segment('过渡'), segment('余韵'), segment('副重点'), segment('收尾'),
        ];
        const heroIndex = findSonnetHeroSegmentIndex(words);
        expect(heroIndex).toBe(5);
        expect(findSonnetSemiHeroSegmentIndices(words, heroIndex)).toEqual([1, 8]);
    });

    it('never promotes particles or single glyphs to semi-hero', () => {
        const particles = [segment('あ'), segment('い'), segment('う'), segment('核心')];
        const heroIndex = findSonnetHeroSegmentIndex(particles);
        expect(findSonnetSemiHeroSegmentIndices(particles, heroIndex)).toEqual([]);
    });
});

describe('Sonnet poster blocks zone flow', () => {
    const posterBox = (partial: Partial<SonnetPosterBlockBox>): SonnetPosterBlockBox => ({
        isHero: false,
        isSemiHero: false,
        displayText: '詞',
        fontScale: 1.15,
        measuredWidth: 60,
        measuredHeight: 46,
        x: 0,
        y: 0,
        rotation: 0,
        vertical: false,
        layoutDirection: 'horizontal',
        enterX: 0,
        enterY: 0,
        ...partial,
    });

    const verticalDims = {
        verticalDisplayText: '詞',
        verticalMeasuredWidth: 46,
        verticalMeasuredHeight: 60,
        verticalFontScale: 1.15,
    };

    const buildBoxes = () => [
        posterBox({ displayText: '旅' }),
        posterBox({ displayText: 'は' }),
        posterBox({ displayText: '英雄', isHero: true, fontScale: 4.4, measuredWidth: 400, measuredHeight: 150 }),
        posterBox({ displayText: '副題', isSemiHero: true, fontScale: 3.2, measuredWidth: 200, measuredHeight: 100 }),
        posterBox({ displayText: '続く' }),
        posterBox({ displayText: '言葉' }),
        posterBox({ displayText: '粒々' }),
        posterBox({ displayText: '終わり' }),
    ];

    const rectOf = (box: SonnetPosterBlockBox) => ({
        left: box.x - box.measuredWidth / 2,
        right: box.x + box.measuredWidth / 2,
        top: box.y - box.measuredHeight / 2,
        bottom: box.y + box.measuredHeight / 2,
    });

    it('keeps horizontal zones spread out with gaps and strict reading order', () => {
        const boxes = buildBoxes();
        const { gap } = layoutSonnetPosterBlocks(boxes, 1280, 720, 40, 2);
        const rects = boxes.map(rectOf);

        boxes.forEach(box => {
            expect(box.layoutDirection).toBe('horizontal');
            expect(box.vertical).toBe(false);
        });
        const hero = boxes.find(box => box.isHero)!;
        const semi = boxes.find(box => box.isSemiHero)!;
        const supports = boxes.filter(box => !box.isHero && !box.isSemiHero);
        expect(hero.fontScale).toBeGreaterThan(semi.fontScale);
        expect(semi.fontScale).toBeGreaterThan(Math.max(...supports.map(box => box.fontScale)));
        expect(supports.every(box => box.fontScale <= 1.15 + 1e-6)).toBe(true);

        for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
                const dx = Math.max(rects[i].left - rects[j].right, rects[j].left - rects[i].right);
                const dy = Math.max(rects[i].top - rects[j].bottom, rects[j].top - rects[i].bottom);
                expect(Math.max(dx, dy)).toBeGreaterThanOrEqual(gap * 0.98);
            }
        }
        // Reading order: earlier segments sit on an earlier line, or further left on the same line.
        for (let i = 0; i < rects.length - 1; i++) {
            const sameLine = Math.abs(rects[i].top - rects[i + 1].top) <= 1;
            if (sameLine) expect(rects[i].left).toBeLessThanOrEqual(rects[i + 1].left + 1);
            else expect(rects[i].top).toBeLessThanOrEqual(rects[i + 1].top + 1);
        }
    });

    it('flows vertical columns right-to-left while preserving reading order', () => {
        const boxes = buildBoxes().map(box => ({ ...box, ...verticalDims }));
        layoutSonnetPosterBlocks(boxes, 1280, 720, 40, 3);

        boxes.forEach(box => {
            expect(box.layoutDirection).toBe('vertical');
            expect(box.vertical).toBe(true);
        });
        const rects = boxes.map(rectOf);
        for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
                const dx = Math.max(rects[i].left - rects[j].right, rects[j].left - rects[i].right);
                const dy = Math.max(rects[i].top - rects[j].bottom, rects[j].top - rects[i].bottom);
                expect(Math.max(dx, dy)).toBeGreaterThan(0);
            }
        }
        // Japanese vertical reading order: earlier columns sit further right,
        // earlier segments within a column sit higher.
        for (let i = 0; i < rects.length - 1; i++) {
            const sameColumn = Math.abs(rects[i].right - rects[i + 1].right) <= 1;
            if (sameColumn) expect(rects[i].top).toBeLessThanOrEqual(rects[i + 1].top + 1);
            else expect(rects[i].right).toBeGreaterThanOrEqual(rects[i + 1].right - 1);
        }
    });

    it('centers a lone hero zone when the shot has no supports', () => {
        const boxes = [
            posterBox({ displayText: '英雄', isHero: true, fontScale: 4.4, measuredWidth: 400, measuredHeight: 150 }),
        ];
        layoutSonnetPosterBlocks(boxes, 1280, 720, 40, 2);
        expect(Math.abs(boxes[0].x)).toBeLessThan(1);
    });
});


describe('Sonnet shot-kind flow layouts', () => {
    const WIDTH = 1280;
    const HEIGHT = 720;
    const BASE_FONT_SIZE = 40;
    // Same constants as resolveSonnetFlowGaps(40).
    const FLOW_GAP = 16;
    const STACK_GAP = 24;

    const layoutOf = (words: string[], shotKind: SonnetShotKind) => resolveSonnetTypographyLayout({
        lines: [words.map(text => segment(text))],
        shotKind,
        paragraphKind: 'verse',
        width: WIDTH,
        height: HEIGHT,
        baseFontSize: BASE_FONT_SIZE,
        fontFamily: 'sans-serif',
        fontWeight: 700,
    }).filter(item => item.role !== 'decoration');

    const byIndex = (layout: SonnetTypographyPlacement[]) => (
        new Map(layout.map(item => [item.segmentIndex, item]))
    );

    const rectOf = (item: SonnetTypographyPlacement) => ({
        left: item.x - item.measuredWidth / 2,
        right: item.x + item.measuredWidth / 2,
        top: item.y - item.measuredHeight / 2,
        bottom: item.y + item.measuredHeight / 2,
    });

    // Negative when the rects overlap, otherwise the distance between them.
    const separation = (first: SonnetTypographyPlacement, second: SonnetTypographyPlacement) => {
        const a = rectOf(first);
        const b = rectOf(second);
        return Math.max(
            Math.max(a.left - b.right, b.left - a.right),
            Math.max(a.top - b.bottom, b.top - a.bottom),
        );
    };

    const expectNoOverlap = (layout: SonnetTypographyPlacement[], minGap: number) => {
        for (let i = 0; i < layout.length; i++) {
            for (let j = i + 1; j < layout.length; j++) {
                expect(separation(layout[i], layout[j])).toBeGreaterThanOrEqual(minGap);
            }
        }
    };

    const expectHierarchy = (layout: SonnetTypographyPlacement[]) => {
        const heroes = layout.filter(item => item.role === 'hero');
        const semiHeroes = layout.filter(item => item.role === 'semi-hero');
        const supports = layout.filter(item => item.role === 'support');
        if (semiHeroes.length > 0) {
            expect(Math.min(...heroes.map(item => item.fontScale)))
                .toBeGreaterThan(Math.max(...semiHeroes.map(item => item.fontScale)));
            expect(Math.min(...semiHeroes.map(item => item.fontScale)))
                .toBeGreaterThan(Math.max(...supports.map(item => item.fontScale)));
        } else if (supports.length > 0) {
            expect(Math.min(...heroes.map(item => item.fontScale)))
                .toBeGreaterThan(Math.max(...supports.map(item => item.fontScale)));
        }
    };

    it('reads editorial side columns right-to-left in timeline order (variant 0)', () => {
        const layout = layoutOf(['春', 'の', '風', 'が', '吹', 'いて', '英雄核心', '走'], 'editorial-column');
        const items = byIndex(layout);
        const hero = items.get(6)!;

        // Earlier words occupy the column right of the pillar, later words the left one.
        for (let i = 0; i < 6; i++) expect(items.get(i)!.x).toBeGreaterThan(hero.x);
        expect(items.get(7)!.x).toBeLessThan(hero.x);
        // Inside a column, later indices sit lower (top-to-bottom reading).
        for (let i = 0; i < 5; i++) expect(items.get(i)!.y).toBeLessThan(items.get(i + 1)!.y);
        expectNoOverlap(layout, FLOW_GAP * 0.9);
        expectHierarchy(layout);
    });

    it('aligns the magazine rail flush-right in exact index order (variant 1)', () => {
        const layout = layoutOf(['明かり', 'に', 'あなたへ'], 'editorial-column');
        const items = byIndex(layout);

        const rightEdges = layout.map(item => rectOf(item).right);
        rightEdges.forEach(edge => expect(edge).toBeCloseTo(rightEdges[0], 6));
        expect(items.get(0)!.y).toBeLessThan(items.get(1)!.y);
        expect(items.get(1)!.y).toBeLessThan(items.get(2)!.y);
        expectNoOverlap(layout, FLOW_GAP * 0.9);
    });

    it('puts a kicker row above the header and paired rows below it (variant 2)', () => {
        const layout = layoutOf(
            ['導', 'き', 'の', '詞', 'を', '英雄主詞', '置く', '音', '声'],
            'editorial-column',
        );
        const items = byIndex(layout);
        const hero = items.get(5)!;
        const heroRect = rectOf(hero);

        // Kicker: earlier words sit above the hero, left-to-right in index order.
        for (let i = 0; i < 5; i++) {
            expect(rectOf(items.get(i)!).bottom).toBeLessThanOrEqual(heroRect.top + 1e-6);
            if (i > 0) expect(items.get(i)!.x).toBeGreaterThan(items.get(i - 1)!.x);
        }
        // Later words pair up row-by-row below the hero.
        for (let i = 6; i < 9; i++) {
            expect(rectOf(items.get(i)!).top).toBeGreaterThanOrEqual(heroRect.bottom - 1e-6);
        }
        expect(rectOf(items.get(6)!).top).toBeCloseTo(rectOf(items.get(7)!).top, 6);
        expect(items.get(6)!.x).toBeLessThan(items.get(7)!.x);
        expect(rectOf(items.get(8)!).top)
            .toBeGreaterThanOrEqual(rectOf(items.get(6)!).bottom + STACK_GAP * 0.9);
        expectNoOverlap(layout, FLOW_GAP * 0.9);
        expectHierarchy(layout);
    });

    it('spaces double hero lines by their real heights (variant 3)', () => {
        const layout = layoutOf(['音', 'が', '英雄一', '重', 'ね', '英雄二', '響'], 'editorial-column');
        const items = byIndex(layout);
        expect(layout.filter(item => item.role === 'hero')).toHaveLength(2);

        const line1 = [0, 1, 2].map(index => items.get(index)!);
        const line2 = [3, 4, 5, 6].map(index => items.get(index)!);
        line1.forEach(item => expect(item.y).toBe(line1[0].y));
        line2.forEach(item => expect(item.y).toBe(line2[0].y));
        expect(line1[0].y).toBeLessThan(line2[0].y);
        const line1Bottom = Math.max(...line1.map(item => rectOf(item).bottom));
        const line2Top = Math.min(...line2.map(item => rectOf(item).top));
        expect(line2Top - line1Bottom).toBeGreaterThanOrEqual(STACK_GAP * 0.9);
        for (let i = 1; i < line1.length; i++) expect(line1[i].x).toBeGreaterThan(line1[i - 1].x);
        for (let i = 1; i < line2.length; i++) expect(line2[i].x).toBeGreaterThan(line2[i - 1].x);
        expectNoOverlap(layout, FLOW_GAP * 0.9);
    });

    it('floats the logo badge pillar inside a zone flow (variant 4)', () => {
        const layout = layoutOf(
            ['そ', 'の', '風', 'が', '英雄主詞', 'を', '戴', 'く'],
            'editorial-column',
        );
        const items = byIndex(layout);
        const hero = items.get(4)!;
        const heroRect = rectOf(hero);
        expect(hero.layoutDirection).toBe('vertical');

        // Earlier words take rows fully above the pillar.
        for (let i = 0; i < 4; i++) {
            expect(rectOf(items.get(i)!).bottom).toBeLessThanOrEqual(heroRect.top + 1e-6);
        }
        // Later words wrap beside the pillar without touching it.
        for (let i = 5; i < 8; i++) {
            expect(rectOf(items.get(i)!).left).toBeGreaterThanOrEqual(heroRect.right + FLOW_GAP * 0.9);
        }
        // Supports scan in timeline order: later rows lower, same row further right.
        const supports = [0, 1, 2, 3, 5, 6, 7].map(index => items.get(index)!);
        for (let i = 1; i < supports.length; i++) {
            const sameRow = Math.abs(rectOf(supports[i]).top - rectOf(supports[i - 1]).top) <= 1;
            if (sameRow) expect(supports[i].x).toBeGreaterThan(supports[i - 1].x);
            else expect(supports[i].y).toBeGreaterThan(supports[i - 1].y);
        }
        expectNoOverlap(layout, FLOW_GAP * 0.9);
    });

    it('keeps the tracking ribbon on one baseline in strict reading order', () => {
        const layout = layoutOf(['駆', 'け', '抜', 'け', '英雄主詞', 'る', '風', '音'], 'tracking-ribbon');
        const items = byIndex(layout);

        const bottoms = layout.map(item => rectOf(item).bottom);
        bottoms.forEach(bottom => expect(bottom).toBeCloseTo(bottoms[0], 6));
        for (let i = 1; i < layout.length; i++) {
            expect(items.get(i)!.x).toBeGreaterThan(items.get(i - 1)!.x);
            expect(rectOf(items.get(i)!).left - rectOf(items.get(i - 1)!).right)
                .toBeGreaterThanOrEqual(FLOW_GAP * 0.9);
        }
        expectNoOverlap(layout, FLOW_GAP * 0.9);
    });

    it('orbits collage fragments clockwise in timeline order without overlap', () => {
        const layout = layoutOf(['星', 'が', '巡', 'る', '英雄主詞', '夜', '音'], 'fragment-collage');
        const items = byIndex(layout);
        const hero = items.get(4)!;
        expect(Math.abs(hero.x)).toBeLessThan(1);
        expect(Math.abs(hero.y)).toBeLessThan(1);

        // Unwrapped orbit angles grow strictly with the segment index.
        const supportOrder = [0, 1, 2, 3, 5, 6].map(index => items.get(index)!);
        let previousAngle = Math.atan2(supportOrder[0].y, supportOrder[0].x);
        for (let i = 1; i < supportOrder.length; i++) {
            let angle = Math.atan2(supportOrder[i].y, supportOrder[i].x);
            while (angle <= previousAngle) angle += Math.PI * 2;
            expect(angle).toBeGreaterThan(previousAngle);
            previousAngle = angle;
        }
        expectNoOverlap(layout, FLOW_GAP * 0.9);
    });

    // Regression: fragment-collage flattens rotated non-CJK blocks to rotation 0.
    // The measured footprint must be un-swapped with it, or the frame decor wraps a
    // tall vertical box around the horizontal text (the "encode/this" screenshot bug).
    // The word list is long enough to force global-fit retries, which used to
    // restore the tall pre-swap dimensions from the snapshot on the second rung.
    it('un-swaps measured bounds when the collage flattens rotated non-CJK words', () => {
        const layout = layoutOf([
            'encode', 'あ', 'い', 'う', 'this', 'え', 'お', '英雄核心词汇句',
            'か', 'き', 'く', 'け', 'こ', 'さ', 'し',
        ], 'fragment-collage');
        const items = byIndex(layout);

        [0, 4].forEach(index => {
            const flattened = items.get(index)!;
            expect(flattened.role).not.toBe('hero');
            expect(flattened.rotation).toBe(0);
            expect(flattened.measuredWidth).toBeGreaterThan(flattened.measuredHeight);
        });
    });

    // Regression: short cross columns used to stack tiny support words against the
    // hero and leave the vertical band mostly empty. Column words now grow (capped
    // below the hero) and justify across the available span.
    it('grows short cross columns to fill their vertical band', () => {
        const layout = layoutOf(['あ', 'い', '英雄主詞', 'う', 'え'], 'type-impact');
        const items = byIndex(layout);
        const hero = items.get(2)!;
        const bottom = items.get(4)!;

        expect(bottom.fontScale).toBeGreaterThan(1.8);
        expect(bottom.fontScale).toBeLessThanOrEqual(hero.fontScale * 0.6 + 1e-6);
        expectNoOverlap(layout, FLOW_GAP * 0.9);
        expectHierarchy(layout);
    });

    it('keeps the cross bands in scan order equal to timeline order', () => {
        const words = ['愛', 'を', '懐', 'い', 'て', '理想', 'を', '号', 'ん', 'だ'];
        const layout = layoutOf(words, 'type-impact');
        const items = byIndex(layout);
        const hero = items.get(5)!;
        const heroRect = rectOf(hero);

        // Top column reads downward, left/right rows read left-to-right,
        // bottom column reads downward — all ascending in segment index.
        expect(items.get(0)!.y).toBeLessThan(items.get(1)!.y);
        expect(rectOf(items.get(1)!).bottom).toBeLessThanOrEqual(heroRect.top + 1e-6);
        expect(items.get(2)!.x).toBeLessThan(items.get(3)!.x);
        expect(items.get(3)!.x).toBeLessThan(items.get(4)!.x);
        expect(rectOf(items.get(4)!).right).toBeLessThanOrEqual(heroRect.left + 1e-6);
        expect(items.get(6)!.x).toBeLessThan(items.get(7)!.x);
        expect(rectOf(items.get(6)!).left).toBeGreaterThanOrEqual(heroRect.right - 1e-6);
        expect(items.get(8)!.y).toBeLessThan(items.get(9)!.y);
        expect(rectOf(items.get(8)!).top).toBeGreaterThanOrEqual(heroRect.bottom - 1e-6);
        expectNoOverlap(layout, FLOW_GAP * 0.9);
    });

    it('measures the mask-reveal hero column exactly like the glyph renderer', () => {
        const layout = layoutOf(['光', 'の', '英雄主詞', 'へ'], 'mask-reveal');
        const hero = layout.find(item => item.role === 'hero')!;

        expect(hero.vertical).toBe(true);
        const renderFontSize = BASE_FONT_SIZE * hero.fontScale;
        // Vertical glyphs advance fontSize * 0.9 down the column (sonnetGlyphLayout).
        expect(hero.measuredHeight).toBeCloseTo(4 * renderFontSize * 0.9, 0);
    });

    it('fits long shots with one global scale while keeping the hierarchy', () => {
        const words = [
            'あ', 'い', 'う', 'え', 'お', 'か', '英雄主詞句',
            'き', 'く', 'け', 'こ', '副重点', 'さ', 'し',
        ];
        const layout = layoutOf(words, 'type-impact');

        layout.forEach(item => {
            expect(Math.abs(item.x) + item.measuredWidth / 2).toBeLessThanOrEqual(WIDTH * 0.48 + 1);
            expect(Math.abs(item.y) + item.measuredHeight / 2).toBeLessThanOrEqual(HEIGHT * 0.46 + 1);
        });
        expectHierarchy(layout);
        // Supports only shrink under the global retry, never upscale.
        expect(layout.filter(item => item.role === 'support')
            .every(item => item.fontScale <= 1.5 + 1e-6)).toBe(true);
        expectNoOverlap(layout, FLOW_GAP * 0.9);
    });

    it('keeps the quiet tableau stack monotone and separated', () => {
        const layout = layoutOf(['傷', '付け', '合う'], 'quiet-tableau');
        const items = byIndex(layout);

        expect(items.get(0)!.y).toBeLessThan(items.get(1)!.y);
        expect(items.get(1)!.y).toBeLessThan(items.get(2)!.y);
        expectNoOverlap(layout, FLOW_GAP * 0.9);
        expectHierarchy(layout);
    });
});

// Regression for the reported pile-up: a long two-line English shot ("And the
// face of the human cannonball / That I need to, I want to") used to overflow
// poster-blocks at every global scale and fall through to an empty placement
// list, leaving every segment stacked at the origin.
describe('Sonnet long multi-line shot layouts', () => {
    const WIDTH = 1280;
    const HEIGHT = 720;

    // Intl.Segmenter word granularity: words and whitespace are separate segments.
    const tokenize = (line: string) => (line.match(/\S+|\s+/g) ?? [])
        .map(part => segment(part, part.trim().length > 0));
    const lines = [
        tokenize('And the face of the human cannonball'),
        tokenize('That I need to, I want to'),
    ];
    const SHOT_KINDS: SonnetShotKind[] = [
        'editorial-column', 'type-impact', 'fragment-collage',
        'tracking-ribbon', 'mask-reveal', 'quiet-tableau', 'poster-blocks',
    ];

    const layoutFor = (shotKind: SonnetShotKind) => resolveSonnetTypographyLayout({
        lines,
        shotKind,
        paragraphKind: 'verse',
        width: WIDTH,
        height: HEIGHT,
        baseFontSize: 48,
        fontFamily: 'sans-serif',
        fontWeight: 700,
    }).filter(item => item.role !== 'decoration');

    it('never overlaps or piles segments at the origin in any shot kind', () => {
        SHOT_KINDS.forEach(shotKind => {
            const layout = layoutFor(shotKind);
            const atOrigin = layout.filter(item => Math.abs(item.x) < 1 && Math.abs(item.y) < 1);
            // At most one box (e.g. a centered hero) may sit exactly at the origin.
            expect(atOrigin.length, `${shotKind} piles segments at the origin`).toBeLessThanOrEqual(1);
            for (let i = 0; i < layout.length; i++) {
                for (let j = i + 1; j < layout.length; j++) {
                    const a = layout[i];
                    const b = layout[j];
                    const dx = Math.abs(a.x - b.x) - (a.measuredWidth + b.measuredWidth) / 2;
                    const dy = Math.abs(a.y - b.y) - (a.measuredHeight + b.measuredHeight) / 2;
                    expect(
                        dx >= -0.5 || dy >= -0.5,
                        `${shotKind} overlaps "${a.displayText}" with "${b.displayText}"`,
                    ).toBe(true);
                }
            }
        });
    });

    it('keeps poster-blocks placements inside the poster canvas', () => {
        const layout = layoutFor('poster-blocks');
        layout.forEach(item => {
            expect(Math.abs(item.x)).toBeLessThanOrEqual(WIDTH * 0.42 + 1);
            expect(Math.abs(item.y)).toBeLessThanOrEqual(HEIGHT * 0.40 + 1);
        });
        const heroes = layout.filter(item => item.role === 'hero');
        const supports = layout.filter(item => item.role === 'support');
        expect(heroes.length).toBeGreaterThan(0);
        expect(Math.min(...heroes.map(item => item.fontScale)))
            .toBeGreaterThan(Math.max(...supports.map(item => item.fontScale)));
    });
});

// Long stacks must wrap into side columns instead of shrinking — the "text too
// small" fix for quiet-tableau and the editorial single-rail variant.
describe('Sonnet stack column wrapping', () => {
    const WIDTH = 1280;
    const HEIGHT = 720;

    const flowBox = (index: number, measuredWidth: number, measuredHeight: number, isHero = false): SonnetFlowLayoutBox => ({
        index,
        isHero,
        isSemiHero: false,
        displayText: `w${index}`,
        fontScale: 1,
        measuredWidth,
        measuredHeight,
        vertical: false,
        layoutDirection: 'horizontal',
        rotation: 0,
        x: 0,
        y: 0,
        enterX: 0,
        enterY: 0,
    });

    const expectInSafeArea = (boxes: SonnetFlowLayoutBox[]) => {
        boxes.forEach(box => {
            expect(Math.abs(box.x) + box.measuredWidth / 2).toBeLessThanOrEqual(WIDTH * 0.48 + 1);
            expect(Math.abs(box.y) + box.measuredHeight / 2).toBeLessThanOrEqual(HEIGHT * 0.46 + 1);
        });
    };

    const expectNoBoxOverlap = (boxes: SonnetFlowLayoutBox[]) => {
        for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i];
                const b = boxes[j];
                const dx = Math.abs(a.x - b.x) - (a.measuredWidth + b.measuredWidth) / 2;
                const dy = Math.abs(a.y - b.y) - (a.measuredHeight + b.measuredHeight) / 2;
                expect(dx >= 0 || dy >= 0, `boxes ${i} and ${j} overlap`).toBe(true);
            }
        }
    };

    it('wraps the quiet tableau stack into side columns without shrinking', () => {
        const boxes = Array.from({ length: 15 }, (_, index) => flowBox(index, 80, 120, index === 7));
        layoutQuietTableau(
            { boxes, heroIndex: 7, width: WIDTH, height: HEIGHT, ...resolveSonnetFlowGaps(40) },
            0,
        );

        // First rung fits, so nothing was scaled down.
        expect(boxes.every(box => box.fontScale === 1)).toBe(true);
        // The tall stack actually wrapped into more than one column.
        const distinctColumns = new Set(boxes.slice(0, 7).map(box => Math.round(box.x)));
        expect(distinctColumns.size).toBeGreaterThan(1);
        expectInSafeArea(boxes);
        expectNoBoxOverlap(boxes);

        // Reading order: before-hero columns march rightward, and each column
        // reads top-to-bottom in ascending segment index.
        const before = boxes.slice(0, 7);
        const columns = [...new Set(before.map(box => Math.round(box.x)))].sort((a, b) => b - a);
        const scanOrder = columns.flatMap(columnX => before
            .filter(box => Math.round(box.x) === columnX)
            .sort((a, b) => a.y - b.y)
            .map(box => box.index));
        expect(scanOrder).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('wraps the editorial single rail into leftward rails without shrinking', () => {
        const boxes = Array.from({ length: 12 }, (_, index) => flowBox(index, 90, 120, index === 5));
        layoutEditorialColumn(
            { boxes, heroIndex: 5, width: WIDTH, height: HEIGHT, ...resolveSonnetFlowGaps(40) },
            1,
            -1,
        );

        expect(boxes.every(box => box.fontScale === 1)).toBe(true);
        const railXs = [...new Set(boxes.map(box => Math.round(box.x)))].sort((a, b) => b - a);
        expect(railXs.length).toBeGreaterThan(1);
        expectInSafeArea(boxes);
        expectNoBoxOverlap(boxes);

        // Rails read right-to-left; every rail reads top-to-bottom in ascending index.
        const scanOrder = railXs.flatMap(railX => boxes
            .filter(box => Math.round(box.x) === railX)
            .sort((a, b) => a.y - b.y)
            .map(box => box.index));
        expect(scanOrder).toEqual(boxes.map(box => box.index));
    });
});
