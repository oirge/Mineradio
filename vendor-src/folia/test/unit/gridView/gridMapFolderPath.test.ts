import { describe, expect, it } from 'vitest';
import { formatGridMapFolderTitle } from '../../../src/utils/gridMapFolderPath';

// test/unit/gridView/gridMapFolderPath.test.ts
// Verifies local folder card titles preserve the root and final directory names.

describe('formatGridMapFolderTitle', () => {
    it('keeps shallow paths unchanged', () => {
        expect(formatGridMapFolderTitle('Astros')).toBe('Astros');
        expect(formatGridMapFolderTitle('Astros/Classics')).toBe('Astros/Classics');
    });

    it('compacts intermediate directories and preserves the final directory', () => {
        expect(formatGridMapFolderTitle('Astros/Classics/Cello/Ultimate Cello Classics'))
            .toBe('Astros/…/Ultimate Cello Classics');
    });

    it('normalizes Windows separators for display', () => {
        expect(formatGridMapFolderTitle('Astros\\Classics\\Cello'))
            .toBe('Astros/…/Cello');
    });
});
