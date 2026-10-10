import type { Variants } from 'framer-motion';
import { colorWithAlpha } from './colorMix';
import { isGlowBlurQuantized } from '../../utils/glowBlurQuantize';

// src/components/visualizer/wordGlow.ts
// The per-glyph glow shared by classic and partita.
//
// The glow grows out of nothing to a double halo and fades back. It used to be drawn with
// `text-shadow`, interpolated from `none`, and that is the animation this module must not ship on
// Linux: Chromium's GPU rasterizer caches glyphs per strike, a strike key includes the shadow's blur
// sigma in device space (CSS radius x the layer's raster scale), and each new strike takes a
// discardable handle out of 4 KiB shared-memory chunks that are never returned. A radius that changes
// every frame mints strikes without end; the renderer and GPU process each gain an fd and a memory
// mapping every thousand or so, and on Linux the renderer's soft limit of 1024 runs out after ~35
// minutes of playback and the compositor stops producing frames. See docs/linux-glyph-cache-fd-leak.md.
//
// Rounding the radius does not help here: the words' raster scales are all different, so a bounded
// set of CSS radii is still an unbounded set of device sigmas (measured: -70%, not -100%).
//
// So while the switch is on (utils/glowBlurQuantize.ts, on by default on Linux) the halo is drawn with
// `filter: drop-shadow()` instead. A filter is applied to the whole layer by the compositor and never
// goes through the glyph cache, so its radius may animate freely. The glow layer then has to carry the
// glyph in colour (drop-shadow shadows what is painted) - it sits exactly under the body text, so the
// copy itself is never seen. The radii were fitted against the text-shadow version by pixel
// difference: drop-shadow(0.4r1 @0.7) + drop-shadow(0.4r2) matches text-shadow r1, r2 to within
// 1/255 on average across colours.

/** drop-shadow radius per text-shadow radius, fitted by pixel difference (see above). */
const DROP_SHADOW_RADIUS_SCALE = 0.4;
/** Alpha of the inner drop-shadow: chained, the outer one also shadows it, so it must be weaker. */
const DROP_SHADOW_INNER_ALPHA = 0.7;

interface WordGlowCustom {
    activeColor?: string;
    duration?: number;
    index?: number;
    total?: number;
    charStartTime?: number;
    charEndTime?: number;
    wordStartTime?: number;
    wordRevealMode?: string | null;
}

/** colorWithAlpha only parses hex and rgb(); anything else keeps its own alpha rather than turning white. */
const withAlpha = (color: string, alpha: number) => (
    /^\s*(#|rgba?\()/.test(color) ? colorWithAlpha(color, alpha) : color
);

/** The text-shadow halo at `inner` / `outer` radii - the original glow. */
const textShadowAt = (color: string, inner: number, outer: number) => (
    `0 0 ${inner}px ${color}, 0 0 ${outer}px ${color}`
);

/** The same halo as a compositor filter, for text-shadow radii `inner` / `outer`. */
const dropShadowAt = (color: string, inner: number, outer: number) => (
    `drop-shadow(0 0 ${inner * DROP_SHADOW_RADIUS_SCALE}px ${withAlpha(color, DROP_SHADOW_INNER_ALPHA)}) `
    + `drop-shadow(0 0 ${outer * DROP_SHADOW_RADIUS_SCALE}px ${color})`
);

/**
 * One glow ramp as framer keyframes: from nothing to the halo (or back), with `peaks[i]` in 0..1.
 * text-shadow: `none` <-> halo, exactly the old animation. drop-shadow: the same radii ramp on the
 * filter, while opacity carries the alpha ramp `none` used to give the shadow colour.
 */
const glowKeyframes = (color: string, inner: number, outer: number, peaks: number[]) => {
    if (!isGlowBlurQuantized()) {
        return {
            color: 'transparent',
            textShadow: peaks.map(peak => (peak > 0 ? textShadowAt(color, inner, outer) : 'none')),
        };
    }
    return {
        color,
        opacity: peaks,
        filter: peaks.map(peak => dropShadowAt(color, inner * peak, outer * peak)),
    };
};

/**
 * Glow layer is transparent text + text-shadow only (or, leak-free, the glyph under a drop-shadow),
 * which is why active highlights can look large without changing the readable body thickness. The
 * form is resolved each time a word turns active, so flipping the switch applies from the next word on.
 */
export const wordGlowVariants: Variants = {
    waiting: () => (isGlowBlurQuantized()
        ? { color: 'transparent', opacity: 0, filter: 'none', transition: { duration: 0 } }
        // opacity / filter reset too, for words left over from before the switch was turned off.
        : { color: 'transparent', textShadow: 'none', opacity: 1, filter: 'none' }),
    active: ({ activeColor = '', duration, index, total, charStartTime, charEndTime, wordStartTime, wordRevealMode }: WordGlowCustom) => {
        if (wordRevealMode === 'instant') {
            return {
                ...glowKeyframes(activeColor, 14, 24, [0, 1, 0]),
                transition: {
                    duration: Math.min(duration || 0.08, 0.12),
                    times: [0, 0.35, 1],
                    ease: 'easeOut',
                },
            };
        }

        if (wordRevealMode === 'fast') {
            return {
                ...glowKeyframes(activeColor, 18, 32, [0, 1, 0]),
                transition: {
                    duration: Math.min(Math.max(duration || 0.12, 0.12), 0.2),
                    times: [0, 0.4, 1],
                    ease: 'easeInOut',
                },
            };
        }

        // Letter-level sweep glow
        if (total !== undefined && total > 1) {
            const singleDuration = (duration ?? 0) / total;
            const hasCharTiming = typeof charStartTime === 'number'
                && typeof charEndTime === 'number'
                && typeof wordStartTime === 'number';
            const charDuration = hasCharTiming
                ? Math.max(charEndTime - charStartTime, 0.001)
                : singleDuration;
            const charDelay = hasCharTiming
                ? Math.max(0, charStartTime - wordStartTime)
                : singleDuration * (index ?? 0);
            return {
                ...glowKeyframes(activeColor, 20, 40, [0, 1, 0]),
                transition: {
                    duration: charDuration * 6, // stretch the fade over a few letters
                    times: [0, 0.3, 1], // peak early, then fade
                    delay: charDelay,
                    ease: 'easeInOut',
                },
            };
        }

        // Single char / CJK: sustained glow
        return {
            ...glowKeyframes(activeColor, 20, 40, [0, 1, 1]),
            transition: {
                duration: (duration || 0.1), // stretch the fade over the word duration
                times: [0, 0.9, 1], // peak early, then fade
                ease: 'easeInOut',
            },
        };
    },
    passed: ({ activeColor = '', wordRevealMode }: WordGlowCustom) => {
        const transition = { duration: wordRevealMode === 'instant' ? 0.12 : wordRevealMode === 'fast' ? 0.22 : 0.9, ease: 'easeOut' as const };
        if (!isGlowBlurQuantized()) {
            return { color: 'transparent', textShadow: 'none', transition };
        }
        // Fade out from wherever the ramp is, shrinking the halo with it the way `none` used to. The
        // colour must be restated: framer resets a key the new variant leaves out to its `initial`
        // (`waiting`, transparent) value at once, and a transparent glyph casts no drop-shadow - the
        // halo would vanish at full brightness instead of fading.
        return { color: activeColor, opacity: 0, filter: dropShadowAt(activeColor, 0, 0), transition };
    },
};
