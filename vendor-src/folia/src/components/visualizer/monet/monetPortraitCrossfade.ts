// src/components/visualizer/monet/monetPortraitCrossfade.ts
// The layer stack a Monet cover crossfade renders, kept pure so the ordering rules can be tested
// without a DOM.
//
// A cover swap is a stack rather than a pair because skipping tracks faster than one fade can
// finish is ordinary: with a pair the half-faded cover would have to be thrown away to make room,
// which shows the one underneath for a moment - the flash the crossfade exists to remove. Stacked,
// every new cover simply fades in over whatever is already there, and nothing is removed until the
// top one is fully opaque and hiding all of them.

export interface MonetPortraitLayer {
    /** Stable across the promotion to the bottom of the stack, so React keeps the decoded node. */
    key: string;
    src: string;
}

/** Default crossfade length. Matches the Monet background layer's own image swap. */
export const MONET_PORTRAIT_FADE_MS = 900;

/**
 * How deep the stack may get before the bottom is dropped.
 *
 * Only reached by holding skip down, and by then the bottom layers are completely covered by the
 * ones above; the cap is there so a stuck fade cannot grow the stack without bound.
 */
export const MONET_PORTRAIT_MAX_LAYERS = 4;

/** The cover the stack is heading towards - the top layer, which is the one still fading in. */
export const monetPortraitTargetSource = (layers: MonetPortraitLayer[]): string | null => (
    layers.length === 0 ? null : layers[layers.length - 1].src
);

/**
 * Stacks a decoded cover on top. A repeat of the cover already on top is dropped: the effect that
 * decodes re-runs whenever the URL changes, and a URL that changes to itself is not a new cover.
 */
export const pushMonetPortraitLayer = (
    layers: MonetPortraitLayer[],
    src: string,
    key: string,
): MonetPortraitLayer[] => {
    if (monetPortraitTargetSource(layers) === src) {
        return layers;
    }
    const next = [...layers, { key, src }];
    return next.length > MONET_PORTRAIT_MAX_LAYERS
        ? next.slice(next.length - MONET_PORTRAIT_MAX_LAYERS)
        : next;
};

/**
 * Drops everything below `key` once that layer has finished fading in.
 *
 * Keyed rather than "keep the last one" because the timer that calls this is armed against a
 * particular layer, and a cover that arrived while it was running has its own timer behind it.
 * A key no longer in the stack has already been settled past, so the stack is left alone.
 */
export const settleMonetPortraitLayers = (
    layers: MonetPortraitLayer[],
    key: string,
): MonetPortraitLayer[] => {
    const index = layers.findIndex(layer => layer.key === key);
    return index <= 0 ? layers : layers.slice(index);
};
