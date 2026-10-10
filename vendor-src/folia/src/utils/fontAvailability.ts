// src/utils/fontAvailability.ts
// Whether a font family can actually render on this machine, without asking for a permission.
//
// queryLocalFonts() would answer authoritatively but it is the Local Font Access API: Chromium only,
// behind a permission prompt, and unavailable in the OBS browser source. Measuring instead costs
// nothing and works everywhere: render a probe string in the candidate family backed by a generic,
// and compare against the generic alone. A different width means the candidate did the rendering.

// Mixes wide/narrow latin and CJK so a substitution shows up in the measured width.
const PROBE_TEXT = 'mmmmmmmmmmlliWWWWWWWWWW永和九年';

// Comparing against all three makes a false negative far less likely: a family that happens to
// match one generic's metrics is very unlikely to match the others too.
const SENTINELS = ['monospace', 'serif', 'sans-serif'];

const CSS_GENERIC_FAMILIES = new Set([
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'fantasy',
    'system-ui',
    'ui-serif',
    'ui-sans-serif',
    'ui-monospace',
    'ui-rounded',
    'emoji',
    'math',
    'fangsong',
]);

const quote = (family: string) => `"${family.replace(/["\\]/g, '\\$&')}"`;

/**
 * True when `family` renders here. Unmeasurable environments (no DOM, no 2d context) return true:
 * the caller uses this to warn about a font that will silently fall back, and a warning nobody can
 * verify is worse than none.
 */
export function isFontFamilyAvailable(family: string): boolean {
    const name = family.trim().replace(/^['"]|['"]$/g, '').trim();
    if (!name) return false;
    // A generic family always resolves to something.
    if (CSS_GENERIC_FAMILIES.has(name.toLowerCase())) return true;
    if (typeof document === 'undefined') return true;

    const context = document.createElement('canvas').getContext('2d');
    if (!context) return true;

    return SENTINELS.some((sentinel) => {
        context.font = `72px ${sentinel}`;
        const baseline = context.measureText(PROBE_TEXT).width;
        context.font = `72px ${quote(name)}, ${sentinel}`;
        return context.measureText(PROBE_TEXT).width !== baseline;
    });
}
