import { describe, expect, it } from 'vitest';
import { hasLegacyId3Tags, repairLatin1DecodedGbkText } from '../../../src/utils/legacyTagTextRepair';

// What music-metadata hands back for GBK bytes inside an ISO-8859-1 ID3 frame.
const latin1 = (...bytes: number[]) => String.fromCharCode(...bytes);

describe('repairLatin1DecodedGbkText', () => {
    it('recovers GBK text that was decoded as Latin-1', () => {
        expect(repairLatin1DecodedGbkText(latin1(0xb8, 0xc3, 0xcb, 0xc0, 0xb5, 0xc4, 0xce, 0xc2, 0xc8, 0xe1))).toBe('该死的温柔');
        expect(repairLatin1DecodedGbkText(latin1(0xc2, 0xed, 0xcc, 0xec, 0xd3, 0xee))).toBe('马天宇');
    });

    it('keeps ASCII mixed into the GBK text', () => {
        // "过火 (Live)"
        expect(repairLatin1DecodedGbkText(`${latin1(0xb9, 0xfd, 0xbb, 0xf0)} (Live)`)).toBe('过火 (Live)');
    });

    it.each([
        'Björk',
        'Homogénic',
        'Café del Mar',
        'Sigur Rós',
        'Mötley Crüe',
        'Sold Out',
    ])('leaves real Latin-1 text %s untouched', (text) => {
        expect(repairLatin1DecodedGbkText(text)).toBe(text);
    });

    it('leaves text that is already Unicode untouched', () => {
        expect(repairLatin1DecodedGbkText('该死的温柔')).toBe('该死的温柔');
        expect(repairLatin1DecodedGbkText('扉をあけて')).toBe('扉をあけて');
    });
});

describe('hasLegacyId3Tags', () => {
    it('matches ID3v1 and every ID3v2 revision only', () => {
        expect(hasLegacyId3Tags(['ID3v2.3', 'ID3v1'])).toBe(true);
        expect(hasLegacyId3Tags(['ID3v1'])).toBe(true);
        expect(hasLegacyId3Tags(['ID3v2.4'])).toBe(true);
        expect(hasLegacyId3Tags(['vorbis'])).toBe(false);
        expect(hasLegacyId3Tags(['iTunes'])).toBe(false);
        expect(hasLegacyId3Tags(undefined)).toBe(false);
    });
});
