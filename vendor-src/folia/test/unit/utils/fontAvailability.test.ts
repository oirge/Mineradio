import { afterEach, describe, expect, it, vi } from 'vitest';
import { isFontFamilyAvailable } from '@/utils/fontAvailability';

// test/unit/utils/fontAvailability.test.ts
// Measuring a font family instead of asking queryLocalFonts for it. Installed families are faked by
// giving the stub canvas a width per family, so the widths differ exactly as a real substitution
// would make them differ.

// Widths are keyed on whatever family the caller put first in the font shorthand.
const stubCanvas = (installed: Record<string, number>, fallbackWidth = 100) => {
    const context = {
        font: '',
        measureText: () => {
            // "72px "Name", monospace" -> Name; "72px monospace" -> monospace
            const first = context.font.replace(/^\d+px\s+/, '').split(',')[0].trim().replace(/^"|"$/g, '');
            return { width: installed[first] ?? fallbackWidth };
        },
    };
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => context }) });
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('isFontFamilyAvailable', () => {
    it('detects a family whose metrics differ from the generics', () => {
        stubCanvas({ 'Comic Sans MS': 250 });
        expect(isFontFamilyAvailable('Comic Sans MS')).toBe(true);
    });

    // An absent family falls through to the sentinel, so every measurement matches the baseline.
    it('reports a family that is not installed', () => {
        stubCanvas({});
        expect(isFontFamilyAvailable('Nope Not Installed')).toBe(false);
    });

    // Matching one generic's metrics by chance must not hide a family that differs from the others.
    it('still detects a family that matches a single generic', () => {
        stubCanvas({ 'Coincidence': 100, monospace: 100, serif: 140, 'sans-serif': 180 });
        expect(isFontFamilyAvailable('Coincidence')).toBe(true);
    });

    it('treats the CSS generics as always available', () => {
        stubCanvas({});
        for (const generic of ['serif', 'sans-serif', 'monospace', 'system-ui']) {
            expect(isFontFamilyAvailable(generic)).toBe(true);
        }
    });

    it('strips quotes and whitespace before measuring', () => {
        stubCanvas({ 'Comic Sans MS': 250 });
        expect(isFontFamilyAvailable('  "Comic Sans MS"  ')).toBe(true);
    });

    it('rejects an empty family', () => {
        stubCanvas({});
        expect(isFontFamilyAvailable('   ')).toBe(false);
    });

    // A warning nobody can verify is worse than none, so an unmeasurable environment stays quiet.
    it('assumes available when there is no DOM to measure with', () => {
        expect(isFontFamilyAvailable('Anything At All')).toBe(true);
    });

    it('assumes available when a 2d context cannot be obtained', () => {
        vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
        expect(isFontFamilyAvailable('Anything At All')).toBe(true);
    });
});
