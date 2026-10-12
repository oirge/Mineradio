import { describe, expect, it, vi } from 'vitest';
import type { Line } from '@/types';
import {
    buildTemperaSegments,
    compileTemperaProgram,
    findTemperaParagraphIndexAtTime,
    resolveTemperaParagraphGapThreshold,
    TEMPERA_SHOT_KINDS,
} from '@/components/visualizer/tempera/temperaProgram';
import { TEMPERA_DECOR_MOTIFS, TEMPERA_TRANSITION_KINDS } from '@/components/visualizer/tempera/types';
import { TEMPERA_SHOT_PROFILES } from '@/components/visualizer/tempera/temperaShotProfiles';
import { resolveTemperaComposition } from '@/components/visualizer/tempera/temperaCompositions';

// test/unit/visualizer/temperaProgram.test.ts
// Locks Tempera's lossless segment compiler, deterministic shot direction, and seek-safe lookup.
const line = (
    fullText: string,
    startTime: number,
    endTime: number,
    words: Line['words'] = [{ text: fullText, startTime, endTime }],
    extra: Partial<Line> = {},
): Line => ({ fullText, startTime, endTime, words, ...extra });

describe('Tempera program compiler', () => {
    it('gives every shot kind a layout profile and a composition', () => {
        // A half-phrase shot list has to be long enough that a paragraph rarely repeats one.
        expect(TEMPERA_SHOT_KINDS.length).toBeGreaterThanOrEqual(62);
        expect(new Set(TEMPERA_SHOT_KINDS).size).toBe(TEMPERA_SHOT_KINDS.length);

        TEMPERA_SHOT_KINDS.forEach(kind => {
            const profile = TEMPERA_SHOT_PROFILES[kind];
            expect(profile, kind).toBeDefined();
            expect(profile.region.w, kind).toBeGreaterThan(0);
            expect(profile.region.h, kind).toBeGreaterThan(0);
            expect(profile.camera.travel, kind).toBeGreaterThanOrEqual(0);
            // A missing drawer silently falls back to duo-split, so identity is what has to
            // be checked - `typeof === 'function'` would pass for every gap.
            expect(resolveTemperaComposition(kind), kind).toBeTypeOf('function');
            if (kind !== 'duo-split') {
                expect(resolveTemperaComposition(kind), kind).not.toBe(resolveTemperaComposition('duo-split'));
            }
        });
        // Both mood extremes must exist, otherwise the chorus/breath filters have nothing to pick.
        const moods = new Set(TEMPERA_SHOT_KINDS.map(kind => TEMPERA_SHOT_PROFILES[kind].mood));
        expect(moods.has('quiet')).toBe(true);
        expect(moods.has('loud')).toBe(true);
    });

    it('keeps the interstitial cards bare and everything else decorated', () => {
        // A Monogatari-style card is a flat field with type on it; the shared crossing lines
        // and motif overlay would defeat the whole point.
        TEMPERA_SHOT_KINDS.forEach(kind => {
            const bare = TEMPERA_SHOT_PROFILES[kind].sharedDecor === false;
            expect(bare, kind).toBe(kind.startsWith('monogatari-'));
        });
        expect(TEMPERA_SHOT_KINDS.filter(kind => kind.startsWith('monogatari-')).length).toBeGreaterThan(0);
        expect(TEMPERA_SHOT_KINDS.filter(kind => kind.startsWith('cinema-')).length).toBeGreaterThan(0);
    });

    it('preserves CJK, whitespace, punctuation, and parser timing losslessly', () => {
        const source = line('世界， 再见！', 1, 4, [
            { text: '世界', startTime: 1, endTime: 2 },
            { text: '再见', startTime: 2.5, endTime: 3.7 },
        ]);
        const segments = buildTemperaSegments(source);

        expect(segments.map(segment => segment.text).join('')).toBe(source.fullText);
        expect(segments[0].text).toContain('，');
        expect(segments.at(-1)?.endTime).toBeLessThanOrEqual(source.endTime);
    });

    it('times sticky punctuation with the word it merges into', () => {
        // The parser's words never cover a comma, so the grapheme timeline pins it zero-length
        // to the *next* word's start. Merging it forward without re-timing made it arrive with
        // the word after the one it is attached to, and dragged its segment's end there too.
        const source = line('hello, world', 0, 2, [
            { text: 'hello', startTime: 0, endTime: 1 },
            { text: 'world', startTime: 1.2, endTime: 2 },
        ]);
        const [first] = buildTemperaSegments(source);

        expect(first.text).toBe('hello,');
        expect(first.endTime).toBeCloseTo(1, 6);
        const comma = first.graphemes.at(-1)!;
        expect(comma.char).toBe(',');
        expect(comma.startTime).toBeCloseTo(1, 6);
        expect(comma.endTime).toBeCloseTo(1, 6);
    });

    it('reports each shot\'s lyric end separately from its tiled end', () => {
        // Shot ends are tiled up to the next shot's start, so the closing shot of a paragraph
        // runs seconds past its last word. Anything paced against the words needs the real end.
        const lines = [
            line('one two three', 0, 1.5, [
                { text: 'one', startTime: 0, endTime: 0.5 },
                { text: 'two', startTime: 0.5, endTime: 1 },
                { text: 'three', startTime: 1, endTime: 1.5 },
            ]),
            // The 1.5s rest before this line is what a shot ends up holding through.
            line('four five six', 3, 4.5, [
                { text: 'four', startTime: 3, endTime: 3.5 },
                { text: 'five', startTime: 3.5, endTime: 4 },
                { text: 'six', startTime: 4, endTime: 4.5 },
            ]),
        ];
        const program = compileTemperaProgram(lines, 'lyric-end');
        const shots = program.paragraphs.flatMap(paragraph => paragraph.shots);
        expect(shots.length).toBeGreaterThan(0);
        shots.forEach(shot => {
            expect(shot.lyricEndTime).toBeGreaterThan(shot.startTime);
            expect(shot.lyricEndTime).toBeLessThanOrEqual(shot.endTime + 1e-6);
        });
        // A bridge has no words of its own, so it paces over the whole gap.
        shots.filter(shot => shot.isBridge).forEach(shot => {
            expect(shot.lyricEndTime).toBeCloseTo(shot.endTime, 6);
        });
        // And at least one lyric shot really does hold well past its last word.
        expect(shots.some(shot => !shot.isBridge && shot.endTime - shot.lyricEndTime > 1)).toBe(true);
    });

    it('keeps repeated Latin words and contractions in source order', () => {
        const source = line("It's time, time.", 0, 3, [
            { text: "It's", startTime: 0, endTime: 0.8 },
            { text: 'time', startTime: 1, endTime: 1.7 },
            { text: 'time', startTime: 2, endTime: 2.7 },
        ]);
        const segments = buildTemperaSegments(source);

        expect(segments.map(segment => segment.text).join('')).toBe(source.fullText);
        expect(segments.filter(segment => segment.text.includes('time'))).toHaveLength(2);
        expect(segments.filter(segment => segment.text.includes('time'))[1].startTime).toBeGreaterThanOrEqual(2);
    });

    // temperaLayout tells a real word gap (0.26em) from a bare CJK word boundary (0.035em) by the
    // hole a dropped whitespace segment leaves in the offsets. A saved segmentation carrying the
    // space inside a word left the segments touching, so every Latin word gap collapsed to the
    // CJK hair. The edge split in segmentLyricWords is what restores the hole.
    it('leaves an offset gap at a real space whether the split is saved or default', () => {
        const words = [
            { text: "It's", startTime: 0, endTime: 0.8 },
            { text: 'unbelievable', startTime: 1, endTime: 2 },
        ];
        const fullText = "It's unbelievable";
        const gaps = (source: Line) => {
            const rendered = buildTemperaSegments(source).filter(segment => segment.text.trim().length > 0);
            return rendered.slice(1).map((segment, index) => segment.startOffset > rendered[index].endOffset);
        };

        expect(gaps(line(fullText, 0, 3, words))).toEqual([true]);
        expect(gaps(line(fullText, 0, 3, words, { wordSegments: ["It's ", 'unbelievable'] }))).toEqual([true]);
    });

    it('falls back losslessly when Intl.Segmenter is unavailable', () => {
        const original = Intl.Segmenter;
        vi.stubGlobal('Intl', { ...Intl, Segmenter: undefined });
        const source = line('歌🎵 A!', 0, 2);

        expect(buildTemperaSegments(source).map(segment => segment.text).join('')).toBe(source.fullText);
        vi.stubGlobal('Intl', { ...Intl, Segmenter: original });
    });

    it('computes an adaptive threshold and respects timed and metadata boundaries', () => {
        const lines = [
            line('one', 0, 1, undefined, { blockIndex: 0 }),
            line('two', 1.2, 2.2, undefined, { blockIndex: 0 }),
            line('three', 5, 6, undefined, { blockIndex: 1 }),
        ];

        expect(resolveTemperaParagraphGapThreshold(lines)).toBeGreaterThanOrEqual(1.25);
        const program = compileTemperaProgram(lines, 'stable-song');
        expect(program.paragraphs).toHaveLength(2);
        expect(program.paragraphs[1].boundary).toBe('metadata');
    });

    it('is deterministic for the same seed and never repeats adjacent shot kinds', () => {
        const lines = Array.from({ length: 12 }, (_, index) => line(
            `歌词第 ${index} 行`,
            index * 4,
            index * 4 + 3,
        ));
        const first = compileTemperaProgram(lines, 'seed-a');
        const second = compileTemperaProgram(lines, 'seed-a');

        const shotKinds = first.paragraphs.flatMap(paragraph => paragraph.shots.map(shot => shot.kind));
        expect(shotKinds.length).toBeGreaterThan(1);
        expect(second.paragraphs.flatMap(paragraph => paragraph.shots.map(shot => shot.kind)))
            .toEqual(shotKinds);
        for (let index = 1; index < shotKinds.length; index += 1) {
            expect(shotKinds[index]).not.toBe(shotKinds[index - 1]);
        }
        expect(shotKinds.every(kind => TEMPERA_SHOT_KINDS.includes(kind))).toBe(true);
    });

    it('slices lines into half-phrase shots that tile the paragraph without holes', () => {
        const lines = Array.from({ length: 6 }, (_, index) => line(
            `first second third fourth fifth ${index}`,
            index * 4,
            index * 4 + 3.6,
            [
                { text: 'first', startTime: index * 4, endTime: index * 4 + 0.6 },
                { text: 'second', startTime: index * 4 + 0.6, endTime: index * 4 + 1.2 },
                { text: 'third', startTime: index * 4 + 1.2, endTime: index * 4 + 1.8 },
                { text: 'fourth', startTime: index * 4 + 1.8, endTime: index * 4 + 2.4 },
                { text: 'fifth', startTime: index * 4 + 2.4, endTime: index * 4 + 3 },
                { text: `${index}`, startTime: index * 4 + 3, endTime: index * 4 + 3.6 },
            ],
        ));
        const program = compileTemperaProgram(lines, 'grouping');

        program.paragraphs.forEach(paragraph => {
            // Every shot draws from exactly one line, and a line takes more than one shot.
            const perLine = new Map<number, number>();
            paragraph.shots.filter(shot => !shot.isBridge).forEach(shot => {
                expect(shot.slices).toHaveLength(1);
                const slice = shot.slices[0];
                expect(slice.segmentEnd).toBeGreaterThan(slice.segmentStart);
                expect(shot.endTime).toBeGreaterThan(shot.startTime);
                perLine.set(slice.lineIndex, (perLine.get(slice.lineIndex) ?? 0) + 1);
            });
            expect(Math.max(...perLine.values())).toBeGreaterThan(1);

            // Consecutive shots tile: the next one opens exactly where the last one closed.
            paragraph.shots.forEach((shot, index) => {
                const next = paragraph.shots[index + 1];
                if (next) expect(shot.endTime).toBeCloseTo(next.startTime, 6);
            });
            expect(paragraph.shots.at(-1)!.endTime)
                .toBeGreaterThanOrEqual(paragraph.lines.at(-1)!.renderEndTime);

            paragraph.lines.forEach((compiled, index) => {
                const next = paragraph.lines[index + 1];
                if (next) expect(compiled.renderEndTime).toBeLessThanOrEqual(next.line.startTime);
            });
        });
    });

    it('keeps each complete lyric line in one shot when splitting is disabled', () => {
        const lines = [
            line('世界， 再见！', 0, 3.6, [
                { text: '世界', startTime: 0, endTime: 1.2 },
                { text: '再见', startTime: 1.8, endTime: 3.4 },
            ]),
            line('time time, again.', 4, 7.6, [
                { text: 'time', startTime: 4, endTime: 4.8 },
                { text: 'time', startTime: 5, endTime: 5.8 },
                { text: 'again', startTime: 6.1, endTime: 7.4 },
            ]),
        ];
        const program = compileTemperaProgram(lines, 'whole-lines', { wholeLineLyrics: true });
        const lyricShots = program.paragraphs.flatMap(paragraph => paragraph.shots.filter(shot => !shot.isBridge));

        expect(lyricShots).toHaveLength(lines.length);
        lyricShots.forEach((shot, index) => {
            expect(shot.slices).toHaveLength(1);
            const slice = shot.slices[0];
            const compiled = program.paragraphs
                .flatMap(paragraph => paragraph.lines)
                .find(candidate => candidate.sourceIndex === slice.lineIndex)!;
            expect(compiled.segments.slice(slice.segmentStart, slice.segmentEnd).map(segment => segment.text).join(''))
                .toBe(lines[index].fullText);
            expect(shot.startTime).toBeGreaterThanOrEqual(lines[index].startTime);
            expect(shot.lyricEndTime).toBeLessThanOrEqual(lines[index].endTime);
        });
        expect(lyricShots[0].endTime).toBeCloseTo(lyricShots[1].startTime, 6);
    });

    it('never draws decor from the glyphs its own shot is showing', () => {
        // Whole-line mode makes single-line paragraphs cover their whole line, so the decor pool
        // has to reach into the rest of the song instead of echoing the words on screen.
        const alphabets = ['aaaa bbbb', 'cccc dddd', 'eeee ffff', 'gggg hhhh'];
        const lines = alphabets.map((text, index) => line(text, index * 8, index * 8 + 3, [
            { text: text.split(' ')[0], startTime: index * 8, endTime: index * 8 + 1.4 },
            { text: text.split(' ')[1], startTime: index * 8 + 1.6, endTime: index * 8 + 3 },
        ]));
        const program = compileTemperaProgram(lines, 'decor-pool', { wholeLineLyrics: true });
        const lyricShots = program.paragraphs.flatMap(paragraph => paragraph.shots.filter(shot => !shot.isBridge));

        expect(lyricShots).toHaveLength(lines.length);
        expect(lyricShots.some(shot => shot.decor.fragments.length > 0)).toBe(true);
        lyricShots.forEach((shot, index) => {
            const own = new Set(Array.from(alphabets[index].replace(/\s/g, '')));
            shot.decor.fragments.forEach(fragment => {
                expect(own.has(fragment.char), `${alphabets[index]} -> ${fragment.char}`).toBe(false);
            });
            if (shot.decor.watermark) {
                expect(own.has(shot.decor.watermark.text[0])).toBe(false);
            }
        });
    });

    it('drops decor rather than echoing the only line in the song', () => {
        const program = compileTemperaProgram([line('alone', 0, 2)], 'decor-pool-empty', { wholeLineLyrics: true });
        const lyricShots = program.paragraphs.flatMap(paragraph => paragraph.shots.filter(shot => !shot.isBridge));

        expect(lyricShots.length).toBeGreaterThan(0);
        lyricShots.forEach(shot => {
            expect(shot.decor.fragments).toEqual([]);
            expect(shot.decor.watermark).toBeNull();
        });
    });

    it('assigns valid, non-repeating transitions between paragraphs only', () => {
        const lines = [
            line('alpha', 0, 2),
            line('beta', 2.2, 4),
            line('gamma', 8, 10),
            line('delta', 10.2, 12),
            line('omega', 16, 18),
        ];
        const program = compileTemperaProgram(lines, 'transitions');
        expect(program.paragraphs.length).toBeGreaterThanOrEqual(3);

        const transitions = program.paragraphs.map(paragraph => paragraph.transitionOut);
        expect(transitions.at(-1)).toBeNull();
        const kinds = transitions.filter(Boolean).map(transition => transition!.kind);
        kinds.forEach(kind => expect(TEMPERA_TRANSITION_KINDS).toContain(kind));
        for (let index = 1; index < kinds.length; index += 1) {
            expect(kinds[index]).not.toBe(kinds[index - 1]);
        }
        transitions.filter(Boolean).forEach(transition => {
            expect(transition!.endTime).toBeGreaterThan(transition!.startTime);
        });
    });

    it('routes breath paragraphs to quiet compositions and a chorus away from them', () => {
        // A trailing normal paragraph keeps the short opener from being classified as outro.
        const breath = compileTemperaProgram([
            line('嗯', 0, 2),
            line('后面还有一整段歌词继续唱下去', 10, 14),
        ], 'breath');
        expect(breath.paragraphs[0].kind).toBe('breath');
        expect(TEMPERA_SHOT_PROFILES[breath.paragraphs[0].shots[0].kind].mood).toBe('quiet');

        const chorus = compileTemperaProgram([
            line('副歌来了', 0, 2, undefined, { isChorus: true }),
            line('一起唱吧', 2.2, 4, undefined, { isChorus: true }),
        ], 'chorus');
        expect(chorus.paragraphs[0].kind).toBe('chorus');
        expect(TEMPERA_SHOT_PROFILES[chorus.paragraphs[0].shots[0].kind].mood).not.toBe('quiet');
    });

    it('compiles deterministic screentone decor for every shot', () => {
        const lines = [
            line('第一句歌词很长可以撑满一个镜头', 0, 3),
            line('第二句歌词继续往下走', 3.2, 6),
            line('第三句换一个分镜', 10, 13),
            line('第四句收尾', 13.2, 16),
        ];
        const first = compileTemperaProgram(lines, 'decor');
        const second = compileTemperaProgram(lines, 'decor');
        expect(first).toEqual(second);

        const shots = first.paragraphs.flatMap(paragraph => paragraph.shots);
        expect(shots.length).toBeGreaterThan(1);
        shots.forEach(shot => {
            expect(TEMPERA_DECOR_MOTIFS).toContain(shot.decor.motif);
            expect(Math.abs(shot.decor.hatchAngle)).toBeLessThanOrEqual(Math.PI / 4);
            expect(shot.decor.crossCount).toBeGreaterThanOrEqual(1);
            expect(shot.decor.crossCount).toBeLessThanOrEqual(3);
            expect(Number.isInteger(shot.decor.scribbleSeed)).toBe(true);
        });
        // Neighbouring shots must not repeat a motif, otherwise the MG layer stops reading
        // as a cut. The guarantee spans paragraph boundaries too.
        const motifs = shots.map(shot => shot.decor.motif);
        for (let index = 1; index < motifs.length; index += 1) {
            expect(motifs[index]).not.toBe(motifs[index - 1]);
        }
        expect(compileTemperaProgram(lines, 'other-seed').paragraphs.flatMap(p => p.shots).map(s => s.decor.motif))
            .not.toEqual(motifs);
    });

    it('scatters margin fragments taken from the paragraph text on sparse shots', () => {
        const program = compileTemperaProgram([
            line('嗯', 0, 2),
            line('后面还有一整段歌词继续唱下去', 10, 14),
        ], 'fragments');
        const quiet = program.paragraphs[0].shots[0];
        expect(TEMPERA_SHOT_PROFILES[quiet.kind].mood).toBe('quiet');
        expect(quiet.decor.fragments.length).toBeGreaterThan(0);

        const pool = program.paragraphs.flatMap(paragraph => paragraph.lines)
            .map(item => item.line.fullText).join('');
        quiet.decor.fragments.forEach(fragment => {
            expect(pool).toContain(fragment.char);
            expect(fragment.char.trim()).toBe(fragment.char);
            expect(fragment.x).toBeGreaterThan(0);
            expect(fragment.x).toBeLessThan(1);
            expect(fragment.y).toBeGreaterThan(0);
            expect(fragment.y).toBeLessThan(1);
            expect(fragment.scale).toBeGreaterThan(0);
        });
    });

    it('leaves dense compositions free of margin fragments', () => {
        const program = compileTemperaProgram([
            line('副歌来了要唱得很满', 0, 2, undefined, { isChorus: true }),
            line('一起唱吧把声音放大', 2.2, 4, undefined, { isChorus: true }),
        ], 'dense');
        expect(program.paragraphs[0].kind).toBe('chorus');
        expect(program.paragraphs[0].shots[0].decor.fragments).toEqual([]);
    });

    it('turns the flow angle only slightly between consecutive shots', () => {
        const program = compileTemperaProgram([
            line('第一句歌词很长可以撑满一个镜头', 0, 3),
            line('第二句歌词继续往下走', 3.2, 6),
            line('第三句换一个分镜', 10, 13),
            line('第四句收尾这里也要够长', 13.2, 16),
            line('第五句还要再多一点内容', 20, 23),
        ], 'flow');
        const flows = program.paragraphs.flatMap(paragraph => paragraph.shots).map(shot => shot.flowAngle);
        expect(flows.length).toBeGreaterThan(2);
        for (let index = 1; index < flows.length; index += 1) {
            // A small turn keeps the graphics sweeping the same way across a cut; a big jump
            // would make the boundary read as an edit.
            expect(Math.abs(flows[index] - flows[index - 1])).toBeLessThanOrEqual(0.4);
        }
        // Camera travel is aligned to that flow rather than to a fixed axis.
        program.paragraphs.flatMap(paragraph => paragraph.shots).forEach(shot => {
            const travelX = shot.cameraEnd.x - shot.camera.x;
            const travelY = shot.cameraEnd.y - shot.camera.y;
            if (Math.hypot(travelX, travelY) < 1e-6) return;
            const alignment = Math.cos(shot.flowAngle) * travelX + Math.sin(shot.flowAngle) * travelY;
            expect(alignment).toBeGreaterThan(0);
        });
    });

    it('gives boundaries a transition long enough for the graphics to carry the cut', () => {
        const program = compileTemperaProgram([
            line('alpha', 0, 2),
            line('beta', 8, 10),
            line('gamma', 20, 22),
        ], 'duration');
        const transitions = program.paragraphs.map(paragraph => paragraph.transitionOut).filter(Boolean);
        expect(transitions.length).toBeGreaterThan(0);
        transitions.forEach(transition => {
            const duration = transition!.endTime - transition!.startTime;
            expect(duration).toBeGreaterThanOrEqual(0.35);
            expect(duration).toBeLessThanOrEqual(1.0001);
        });
    });

    it('draws the decorative watermark from words the shot is not setting', () => {
        const lines = [
            line('第一句歌词很长可以撑满一个镜头', 0, 3),
            line('第二句歌词继续往下走', 3.2, 6),
            line('第三句换一个分镜收尾', 10, 13),
        ];
        const program = compileTemperaProgram(lines, 'watermark');
        expect(program).toEqual(compileTemperaProgram(lines, 'watermark'));

        const shots = program.paragraphs.flatMap(paragraph => paragraph.shots);
        const watermarked = shots.filter(shot => shot.decor.watermark);
        // Not every shot gets one - it is an accent, not a fixture.
        expect(watermarked.length).toBeGreaterThan(0);
        expect(watermarked.length).toBeLessThan(shots.length);

        watermarked.forEach(shot => {
            const watermark = shot.decor.watermark!;
            const slice = shot.slices[0];
            const own = program.paragraphs
                .flatMap(paragraph => paragraph.lines)
                .find(item => item.sourceIndex === slice.lineIndex)!
                .segments.slice(slice.segmentStart, slice.segmentEnd)
                .map(segment => segment.text)
                .join('');
            expect(watermark.text.trim()).toBe(watermark.text);
            expect(own).not.toContain(watermark.text);
            expect(watermark.scale).toBeGreaterThan(2);
            expect(watermark.x).toBeGreaterThan(0);
            expect(watermark.x).toBeLessThan(1);
            expect(watermark.y).toBeGreaterThan(0);
            expect(watermark.y).toBeLessThan(1);
            // A loud composition already carries a dominant shape; a watermark would fight it.
            expect(TEMPERA_SHOT_PROFILES[shot.kind].mood).not.toBe('loud');
        });
    });

    it('starts a paragraph\'s opening composition inside the previous transition', () => {
        // Boundaries often sit in a lyric gap. If the incoming scene only began at its own
        // paragraph start, a translating transition would slide away into nothing.
        const program = compileTemperaProgram([
            line('第一段第一句要够长撑满镜头', 0, 3),
            line('第一段第二句继续往下走', 3.2, 6),
            line('第二段开场句在间隙之后', 12, 15),
            line('第二段收尾句', 15.2, 18),
        ], 'preroll');
        expect(program.paragraphs.length).toBeGreaterThan(1);

        program.paragraphs.forEach((paragraph, index) => {
            const transition = program.paragraphs[index - 1]?.transitionOut;
            const opening = paragraph.shots[0];
            if (!transition || transition.kind === 'block-wipe') {
                expect(opening.startTime).toBeGreaterThanOrEqual(program.paragraphs[index - 1]?.endTime ?? 0);
                return;
            }
            // The composition is already building while the previous paragraph exits...
            expect(opening.startTime).toBeLessThanOrEqual(transition.endTime);
            expect(opening.startTime).toBeGreaterThanOrEqual(transition.startTime - 1e-6);
            // ...but never reaches back into the previous paragraph's own content.
            expect(opening.startTime).toBeGreaterThanOrEqual(program.paragraphs[index - 1].endTime - 1e-6);
            expect(opening.endTime).toBeGreaterThan(opening.startTime);
        });
    });

    it('leaves glyph timing untouched by the composition pre-roll', () => {
        const lines = [
            line('第一段第一句要够长撑满镜头', 0, 3),
            line('第二段开场句在间隙之后', 12, 15),
        ];
        const program = compileTemperaProgram(lines, 'preroll');
        // The type still lands exactly when it is sung; only the shot's own clock moved.
        program.paragraphs.flatMap(paragraph => paragraph.lines).forEach((compiled, index) => {
            expect(compiled.line.startTime).toBe(lines[index].startTime);
            compiled.segments.forEach(segment => {
                expect(segment.startTime).toBeGreaterThanOrEqual(lines[index].startTime);
            });
        });
    });

    it('bridges an instrumental gap with lyric-free shots', () => {
        const program = compileTemperaProgram([
            line('第一段唱完这里就断开了', 0, 3),
            line('间隙之后第二段才进来', 14, 17),
        ], 'bridge');
        expect(program.paragraphs.length).toBeGreaterThan(1);

        const bridges = program.paragraphs[0].shots.filter(shot => shot.isBridge);
        expect(bridges.length).toBeGreaterThan(0);
        bridges.forEach(bridge => {
            // No type at all: a bridge is composition only.
            expect(bridge.slices).toEqual([]);
            expect(bridge.endTime).toBeGreaterThan(bridge.startTime);
            // An instrumental beat is never the loudest thing in the song.
            expect(TEMPERA_SHOT_PROFILES[bridge.kind].mood).not.toBe('loud');
        });

        // The bridge picks up exactly where the sung shots stop and carries to the next
        // paragraph, so the gap is never an empty frame.
        const shots = program.paragraphs[0].shots;
        shots.forEach((shot, index) => {
            const next = shots[index + 1];
            if (next) expect(shot.endTime).toBeCloseTo(next.startTime, 6);
        });
        expect(shots.at(-1)!.isBridge).toBe(true);
        expect(shots.at(-1)!.endTime).toBeCloseTo(program.paragraphs[1].startTime, 6);
    });

    it('leaves short gaps to the transition instead of bridging them', () => {
        const program = compileTemperaProgram([
            line('第一段唱完这里就断开了', 0, 3),
            line('很快就接上的第二段', 3.6, 6),
        ], 'short-gap');
        expect(program.paragraphs.flatMap(paragraph => paragraph.shots).some(shot => shot.isBridge)).toBe(false);
    });

    it('resolves the active paragraph for any seek target', () => {
        const lines = [
            line('one', 0, 2),
            line('two', 10, 12),
            line('three', 20, 22),
        ];
        const program = compileTemperaProgram(lines, 'seek');
        const lastIndex = program.paragraphs.length - 1;

        expect(findTemperaParagraphIndexAtTime(program, -5)).toBe(0);
        expect(findTemperaParagraphIndexAtTime(program, 0)).toBe(0);
        expect(findTemperaParagraphIndexAtTime(program, 999)).toBe(lastIndex);
    });
});
