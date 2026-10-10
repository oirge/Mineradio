// src/utils/settingLabelLookup.ts
// Find the label a settings panel already uses for one field of a tuning object.
//
// The panels declare nothing: a slider is `<SliderControl label={t('options.monetBackgroundBlur')}
// onChange={v => onTuningChange({ backgroundBlurPx: v })} />`, so the field and its label only meet
// inside JSX. Hand-copying that into a table would duplicate a mapping that already exists and grow
// by a line for every new slider.
//
// The naming is not uniform but it is patterned: a prefix taken from the tuning, and the field name
// with the noise that panels drop (a unit suffix, a segment the prefix already says). So generate
// the plausible keys and keep the first one i18n actually has. A miss returns null and the caller
// falls back to the field name — a guess is never displayed as if it were a label.
//
// The prefix comes from two places. A standalone tuning names it in the owner field
// (`monetBackgroundTuning` -> `monetBackground`), while the visualizerTunings bundle names it in the
// path (`monet.audioStyle` -> `monet`). The bundle is the ordinary case: every export carries one.

// Suffixes panels leave out because the value's unit is shown next to the slider instead.
const UNIT_SUFFIXES = ['Px', 'Deg', 'Sec', 'Ms'];

// Leading segments that negate the field rather than describe it. Dropping one turns
// `disableGeometricBackground` into `geometricBackground`, whose label reads as the opposite of what
// the value means — so these are never dropped, even when the shortened key exists.
const NEGATION_SEGMENTS = new Set(['disable', 'hide', 'no', 'not', 'off', 'without', 'suppress']);

const capitalize = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : value);
const decapitalize = (value: string) => (value ? value[0].toLowerCase() + value.slice(1) : value);

// `monetBackgroundTuning` reads as both `monetBackground` and `monet` in key names, and either can
// be the one that was used.
//
// Deliberately not plural-tolerant: the bundle field is `visualizerTunings`, and a `visualizer`
// stem would reach generic keys like options.visualizerMode and label a renderer's own `mode` leaf
// with the lyrics-animation label. The bundle is handled by the path instead (see prefixesForPath).
const prefixesForOwner = (ownerField: string): string[] => {
    const stem = ownerField.replace(/Tuning$/, '');
    const prefixes = [stem];
    const shortened = stem.replace(/Background$/, '');
    if (shortened && shortened !== stem) prefixes.push(shortened);
    return prefixes;
};

// Under the visualizerTunings bundle a leaf arrives as `monet.audioStyle`: the renderer id that the
// panel used as its key prefix is in the path, not in the owner field. Every real export carries the
// bundle (buildVisualSettingsConfig always fills it), so this is the ordinary shape, not an edge
// case. Path segments come first because they are the more specific of the two.
const prefixesForPath = (ownerField: string, segments: readonly string[]): string[] => [
    ...segments.slice(0, -1),
    ...prefixesForOwner(ownerField),
];

// `backgroundBlurPx` is also worth trying as `backgroundBlur`, `blurPx` and `blur`: the prefix may
// already carry the segment the field repeats.
const leafVariantsFor = (leaf: string): string[] => {
    const variants = new Set<string>([leaf]);

    for (const suffix of UNIT_SUFFIXES) {
        if (leaf.endsWith(suffix) && leaf.length > suffix.length) variants.add(leaf.slice(0, -suffix.length));
    }

    for (const variant of [...variants]) {
        const match = variant.match(/^([a-z]+)([A-Z].*)$/);
        if (match && !NEGATION_SEGMENTS.has(match[1])) variants.add(decapitalize(match[2]));
    }

    return [...variants];
};

const resolveOne = (ownerField: string, leafPath: string, hasKey: (key: string) => boolean): string | null => {
    // Nested groups are labelled by their own leaf; the enclosing group rarely has a key of its own.
    const segments = leafPath.split('.');
    const leaf = segments[segments.length - 1];
    if (!leaf) return null;

    for (const prefix of prefixesForPath(ownerField, segments)) {
        for (const variant of leafVariantsFor(leaf)) {
            const key = `options.${prefix}${capitalize(variant)}`;
            if (hasKey(key)) return key;
        }
    }

    // Some fields are named the same in the panel as in the store, with no prefix at all.
    for (const variant of leafVariantsFor(leaf)) {
        const key = `options.${variant}`;
        if (hasKey(key)) return key;
    }

    return null;
};

/**
 * The i18n key a settings panel uses for `leafPath` inside `ownerField`, or null when nothing
 * matches. `hasKey` decides existence so this stays pure and testable.
 *
 * `siblingPaths` are the other paths shown alongside this one. Shortening can make two distinct
 * fields land on the same key — `ditheringAudioSpeed` and `meshAudioSpeed` both reduce to
 * `latentAudioSpeed` — and two rows under one label cannot be told apart, so an ambiguous match is
 * dropped in favour of the field name.
 */
export function resolveSettingLabelKey(
    ownerField: string,
    leafPath: string,
    hasKey: (key: string) => boolean,
    siblingPaths?: readonly string[],
): string | null {
    const key = resolveOne(ownerField, leafPath, hasKey);
    if (!key || !siblingPaths) return key;

    for (const siblingPath of siblingPaths) {
        if (siblingPath === leafPath) continue;
        // Same-named leaves collide just as surely as shortened ones do -- but only when they
        // resolve alike, so `monet.audioStyle` and `latent.audioStyle` stay distinct.
        if (resolveOne(ownerField, siblingPath, hasKey) === key) return null;
    }

    return key;
}

/**
 * The i18n key a panel uses for one enum VALUE of a field, or null. Panels name these by appending
 * the capitalized value to the field's own key: `options.monetAudioStyle` + `'bar'` ->
 * `options.monetAudioStyleBar`.
 *
 * Exact match only. Some values do not follow the rule (`monetBackgroundSource: 'cover-derived'` is
 * labelled by `...SourceCover`), and printing the raw id is better than printing a neighbouring
 * option's name — a settings row that names the wrong choice is worse than one that names none.
 */
export function resolveSettingValueLabelKey(
    fieldLabelKey: string | null,
    value: unknown,
    hasKey: (key: string) => boolean,
): string | null {
    if (!fieldLabelKey || typeof value !== 'string' || !value) return null;
    const key = `${fieldLabelKey}${capitalize(value)}`;
    return hasKey(key) ? key : null;
}
