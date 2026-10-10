import {
    clamp01,
    easeTemperaEnter,
    easeTemperaInOut,
    easeTemperaSoftBack,
    resolveCubicBezier,
} from './temperaMotionEasing';
import { resolveTemperaEnterFrame, type TemperaEnterStyle } from './temperaEnterStyles';

// src/components/visualizer/tempera/temperaMotion.ts
// Pure absolute-time motion evaluation for Tempera. Every value is derived from the clock
// and per-glyph constants, so a seek paints exactly the frame continuous playback would.
export { clamp01, easeTemperaEnter, easeTemperaInOut, easeTemperaSoftBack, resolveCubicBezier };

export interface TemperaGlyphMotionInput {
    startTime: number;
    settleTime: number;
    /** When the grapheme stops being sung; drives the small current-glyph emphasis. */
    endTime: number;
    enterX: number;
    enterY: number;
    enterRotation: number;
    enterScale: number;
    rotation: number;
    enterStyle: TemperaEnterStyle;
    /**
     * When the post-sung release reaches full amplitude. Bounded by the line's own duration,
     * so a glyph keeps opening up for as long as its line lasts and no longer.
     */
    releaseTime: number;
    /** Offset of this glyph from the block centre; the release scales it to widen tracking. */
    trackingX: number;
    trackingY: number;
}

export interface TemperaGlyphMotionFrame {
    visible: boolean;
    alpha: number;
    x: number;
    y: number;
    rotation: number;
    /** Separate axes: several entrance styles open the glyph on one axis only. */
    scaleX: number;
    scaleY: number;
    /** Offset of the first motion echo, and its opacity; both die by the settle time. */
    echoX: number;
    echoY: number;
    echoAlpha: number;
}

const CURRENT_EMPHASIS = 0.05;
/** How long the sung swell takes to fall away once the glyph is done. */
const EMPHASIS_DECAY = 0.26;
const ECHO_ALPHA = 0.5;
/**
 * Longest window the *reveal* - opacity and the motion echo - is allowed to run over.
 *
 * The settle window itself is stretched to the end of the glyph's line so the block is still
 * easing into place as the line finishes. Fading in and trailing ghost copies over that whole
 * stretch would be a different thing entirely: the type has to be readable while it travels,
 * and an echo that outlives the opening reads as a smear rather than as motion. This is the
 * cap the settle window used to carry, so any entrance short enough to predate the stretch
 * behaves exactly as it did.
 */
const MAX_REVEAL_WINDOW = 1.35;
/** How much wider the sung block gets. Deliberately small: this is tracking, not drift. */
const RELEASE_TRACKING = 0.055;

// Resolves one glyph's entrance plus the post-sung tracking release that keeps a finished
// line alive without breaking its layout.
// `motion` is the tuning/theme-scaled amount; 0 pins glyphs to their layout position.
export const resolveTemperaGlyphMotion = (
    glyph: TemperaGlyphMotionInput,
    time: number,
    motion: number,
): TemperaGlyphMotionFrame => {
    const window = Math.max(glyph.settleTime - glyph.startTime, 0.08);
    const linear = clamp01((time - glyph.startTime) / window);
    const travel = 1 - easeTemperaEnter(linear);
    const entrance = resolveTemperaEnterFrame(glyph.enterStyle, glyph, travel, linear);
    // Opacity and the echo run on their own capped window; position and scale keep the full
    // stretched one, which is what turns a long line into one continuous move.
    const reveal = clamp01((time - glyph.startTime) / Math.min(window, MAX_REVEAL_WINDOW));
    // Alpha resolves faster than position, so the glyph is readable while it is still moving.
    const alpha = easeTemperaInOut(clamp01(reveal * 2.4));

    // Current-glyph emphasis is a small scale swell, not a painted backing block: anything
    // drawn behind the glyph would become the backdrop the inversion filter reads, which is
    // exactly what turns the effect into a colored box instead of a reaction to the artwork.
    //
    // It tracks the sung window itself - rise, hold, decay - rather than counting down from
    // the start over a synthetic length. The old form gave every glyph a pulse whether or not
    // it was ever sung, so each merged punctuation mark (zero-length by construction, since
    // the parser's words do not cover it) popped on its own.
    const sungWindow = glyph.endTime - glyph.startTime;
    const attack = Math.min(0.12, sungWindow * 0.5);
    const emphasis = sungWindow <= 0
        ? 0
        : easeTemperaInOut(clamp01((time - glyph.startTime) / Math.max(attack, 0.02)))
            * (1 - easeTemperaInOut(clamp01((time - glyph.endTime) / EMPHASIS_DECAY)));

    // Release: once a glyph has been sung the block slowly opens its tracking instead of
    // freezing. A line that finished early would otherwise sit dead for the rest of a long
    // shot. This is a rigid, centre-out expansion - no wander, no float, no rotation - because
    // a drifting glyph would contradict the deterministic typesetting the mode is built on.
    // The ramp starts at the later of "sung" and "settled" so it never fights the entrance.
    const releaseStart = Math.max(glyph.endTime, glyph.settleTime);
    const release = easeTemperaInOut(clamp01(
        (time - releaseStart) / Math.max(glyph.releaseTime - releaseStart, 0.001),
    ));
    const spread = release * clamp01(motion) * RELEASE_TRACKING;
    const driftX = glyph.trackingX * spread;
    const driftY = glyph.trackingY * spread;

    // A muted motion setting pulls the entrance back toward the resting pose instead of
    // inverting it, so `glyphMotion: 0` pins every style to its layout position.
    const amount = clamp01(motion);
    const swell = emphasis * CURRENT_EMPHASIS * amount;
    return {
        visible: time >= glyph.startTime,
        alpha,
        x: entrance.x * motion + driftX,
        y: entrance.y * motion + driftY,
        rotation: glyph.rotation + entrance.rotation * motion,
        scaleX: entrance.scaleX + (1 - entrance.scaleX) * (1 - amount) + swell,
        scaleY: entrance.scaleY + (1 - entrance.scaleY) * (1 - amount) + swell,
        echoX: entrance.x * motion,
        echoY: entrance.y * motion,
        echoAlpha: entrance.echo * (1 - easeTemperaEnter(reveal)) * ECHO_ALPHA * amount,
    };
};

/**
 * Maps a shot-relative fraction onto seconds, clamped so a very short or very long shot
 * still animates at a watchable speed. This is what ties block motion to the line's pace
 * instead of to a fixed wall-clock duration.
 */
export const resolveShotPacedDuration = (
    shotDuration: number,
    fraction: number,
    minSeconds: number,
    maxSeconds: number,
) => Math.min(maxSeconds, Math.max(minSeconds, shotDuration * fraction));
