import * as THREE from 'three';
import type { Theme } from '../../../types';
import {
    buildWordColorRangesFromMatchers,
    prepareWordColorMatchers,
    resolveTokenColorMap,
    type WordColorMatcher,
} from '../wordColoring';
// Generic WCAG ratio between two linear-space THREE.Colors. It lives in the particle module and is
// named for it, but the maths is plain WCAG and duplicating it here would be worse than the name.
import { getDioramaParticleContrastRatio as wcagContrastRatio } from './dioramaParticleMaterials';

// src/components/visualizer/diorama/dioramaKeywordColor.ts
// 关键字着色 for the diorama, reusing the shared keyword system every other visualizer draws from:
// the keywords and their colours are the theme's own `wordColors` - which the AI theme generates from
// the song's own lyrics - matched by prepareWordColorMatchers.
//
// What this module returns is a follow-sing TARGET per unit, not a colour anything is painted with at
// rest. The scene rests every glyph at the plain lyric colour and dyes it toward this only as that unit
// is sung. That is why the adaptation below is judged at the ACTIVE opacity: the sung instant is the
// only instant this colour is ever on screen.
//
// It resolves by RANGE (character offsets), the way Monet and Claddagh do, NOT by token text the way
// Fume does. Fume matches a token's text against the keyword with `bidirectional-contains`, which is
// safe there because Fume's tokens are whole words. The diorama splits every CJK line into ONE-CHARACTER
// units, and text matching on a single character bleeds: with a keyword 花火, the 火 of 火车 also matches
// and colours a character that is not part of any keyword. Ranges resolve by position, so only the real
// 花火 colours.

/** The unsung / sung opacities a unit's base material is drawn at (mirrors DioramaScene). */
const ACTIVE_LINE_OPACITY = 0.92;

// Legibility target for a keyword glyph against the scene, judged on the pixel it actually becomes.
const KEYWORD_MIN_BG_CONTRAST = 4.5;
// Below this Manhattan RGB distance from the ordinary lyric colour a keyword reads as ordinary text -
// the same metric and threshold DioramaScene already uses to detect a degenerate accent ~= primary.
// This one carries more weight now that the colour is a sung TARGET: the glyph is dyed FROM primary
// TOWARD it, so a target too close to primary means the dye does nothing and the keyword never shows.
const KEYWORD_MIN_PRIMARY_SEPARATION = 0.4;

const separationFromPrimary = (color: THREE.Color, primary: THREE.Color): number => (
    Math.abs(color.r - primary.r) + Math.abs(color.g - primary.g) + Math.abs(color.b - primary.b)
);

/**
 * What a text glyph of this colour actually becomes on screen: the base material is a white raster
 * multiplied by the colour and composited at ACTIVE_LINE_OPACITY, and the framebuffer is sRGB-encoded
 * so that blend runs on ENCODED values. ACTIVE is the right - and now the only honest - opacity to judge
 * at: a keyword colour is a sung target, so the sung instant is the only instant it is ever on screen.
 * (The unsung 0.5 never shows this colour at all; judging there would demand more of a keyword than of
 * the plain text beside it and bleach every keyword toward white on dark themes.)
 *
 * meshBasicMaterial is one of three's OWN materials, so three encodes it; unlike the point cloud's
 * custom ShaderMaterial there is no colour-space bug to model here.
 */
const asDisplayedText = (color: THREE.Color, background: THREE.Color): THREE.Color => {
    const src = color.clone().convertLinearToSRGB();
    const dst = background.clone().convertLinearToSRGB();
    const blend = (s: number, d: number) => s * ACTIVE_LINE_OPACITY + d * (1 - ACTIVE_LINE_OPACITY);
    return new THREE.Color(blend(src.r, dst.r), blend(src.g, dst.g), blend(src.b, dst.b))
        .convertSRGBToLinear();
};

/** The contrast ratio of the PIXEL a keyword glyph of this colour becomes, against the scene behind it. */
export const getDioramaKeywordDisplayedContrastRatio = (
    color: THREE.Color,
    background: THREE.Color,
): number => wcagContrastRatio(asDisplayedText(color, background), background);

/** Smallest lerp toward `target` that clears `minimum`, or the full lerp if even that cannot. */
const nudgeUntil = (
    color: THREE.Color,
    target: THREE.Color,
    minimum: number,
    measure: (candidate: THREE.Color) => number,
): THREE.Color => {
    if (measure(color) >= minimum) return color.clone();
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 10; iteration += 1) {
        const amount = (low + high) * 0.5;
        if (measure(color.clone().lerp(target, amount)) >= minimum) high = amount;
        else low = amount;
    }
    return color.clone().lerp(target, high);
};

/**
 * Bring a theme's keyword colour into the scene: distinguishable from the ordinary lyric colour, and
 * legible against the background - the smallest correction that achieves each, so a theme's palette is
 * bent no further than the two things a keyword must do.
 *
 * Order matters. Separation runs first and legibility second, so legibility always has the final say:
 * a keyword you cannot read is a worse failure than one that merely fails to stand out.
 *
 * That ordering has a known, measured cost. Legibility can undo separation, because on a light theme
 * every legible colour is dark and so is the lyric text: a keyword set to the background colour lands
 * at 0.32 separation, under the target. It stays legible and still reads as a different colour, and the
 * alternative - letting separation win - would mean an unreadable keyword. Only a theme that sets a
 * keyword to its own background reaches this, and no iteration is attempted for it: two corrections
 * chasing each other would oscillate for a case nobody configures on purpose.
 */
export const resolveDioramaKeywordColor = (
    keyword: THREE.Color,
    primary: THREE.Color,
    accent: THREE.Color,
    background: THREE.Color,
): THREE.Color => {
    // 1. A keyword that looks like ordinary text is not a keyword. Nudge toward the theme's ACCENT -
    //    its own designated emphasis colour, and what Fume already falls back to for emphasis - rather
    //    than inventing a hue the theme never chose. If the accent is degenerate too this cannot help,
    //    and the colour is left as the theme set it rather than fabricated.
    const separated = nudgeUntil(
        keyword,
        accent,
        KEYWORD_MIN_PRIMARY_SEPARATION,
        (candidate) => separationFromPrimary(candidate, primary),
    );
    // 2. Legibility against the scene, on the displayed pixel: toward whichever pole the background
    //    contrasts with more, so dark scenes brighten their keywords and light scenes darken them.
    const lightTarget = new THREE.Color(0xffffff);
    const darkTarget = new THREE.Color(0x050505);
    const pole = getDioramaKeywordDisplayedContrastRatio(lightTarget, background)
        >= getDioramaKeywordDisplayedContrastRatio(darkTarget, background)
        ? lightTarget
        : darkTarget;
    return nudgeUntil(
        separated,
        pole,
        KEYWORD_MIN_BG_CONTRAST,
        (candidate) => getDioramaKeywordDisplayedContrastRatio(candidate, background),
    );
};

export const prepareDioramaKeywordMatchers = (
    wordColors: Theme['wordColors'],
    enabled: boolean,
): WordColorMatcher[] => prepareWordColorMatchers(wordColors, enabled);

/**
 * Scene-ready keyword colour for each unit of a line, by unit index. Absent = an ordinary unit that
 * keeps the plain lyric colour. Empty whenever the toggle is off or the theme defines no keywords, so
 * the scene falls back to exactly its original colouring.
 */
export const resolveDioramaKeywordUnitColors = (
    lineText: string,
    units: { charStart: number; charEnd: number }[],
    matchers: WordColorMatcher[],
    primary: THREE.Color,
    accent: THREE.Color,
    background: THREE.Color,
): Map<number, THREE.Color> => {
    const resolved = new Map<number, THREE.Color>();
    if (!lineText || units.length === 0 || matchers.length === 0) return resolved;

    const ranges = buildWordColorRangesFromMatchers(lineText, matchers);
    if (ranges.length === 0) return resolved;

    const colorByKey = resolveTokenColorMap(
        units.map((unit, index) => ({
            key: String(index),
            timed: true,
            startOffset: unit.charStart,
            endOffset: unit.charEnd,
        })),
        ranges,
    );
    // One adaptation per distinct keyword colour, not per unit: a line repeating a keyword resolves the
    // same hex to the same THREE.Color instead of running the search again for every character.
    const adapted = new Map<string, THREE.Color>();
    colorByKey.forEach((hex, key) => {
        let color = adapted.get(hex);
        if (!color) {
            color = resolveDioramaKeywordColor(new THREE.Color(hex), primary, accent, background);
            adapted.set(hex, color);
        }
        resolved.set(Number(key), color);
    });
    return resolved;
};
