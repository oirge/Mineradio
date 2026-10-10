import { createRequire } from 'module';
import path from 'path';
import { describe, expect, it } from 'vitest';

// test/unit/electron/localCoverAssets.test.ts
// Locks local-library cover binaries to Electron userData instead of the configurable media cache directory.

const require = createRequire(import.meta.url);
const { getLocalCoverAssetDirectory, parseThumbnailSize } = require('../../../electron/localCoverAssets.cjs') as {
    getLocalCoverAssetDirectory: (userDataDirectory: string) => string;
    parseThumbnailSize: (url: URL) => number | null;
};

describe('localCoverAssets', () => {
    it('places local-library covers directly under userData', () => {
        const userDataDirectory = path.join('C:', 'Users', 'tester', 'Folia');

        expect(getLocalCoverAssetDirectory(userDataDirectory)).toBe(
            path.join(userDataDirectory, 'local-cover-assets'),
        );
    });

    it('accepts only the supported clear thumbnail sizes', () => {
        expect(parseThumbnailSize(new URL('folia-cover://asset/id?size=512'))).toBe(512);
        expect(parseThumbnailSize(new URL('folia-cover://asset/id?size=1024'))).toBe(1024);
        expect(parseThumbnailSize(new URL('folia-cover://asset/id?size=256'))).toBeNull();
    });
});
