import { describe, expect, it } from 'vitest';
import { createFoliaIgnoreMatcher, isIgnoredByFoliaMatchers } from '@/utils/foliaIgnore';

// test/unit/utils/foliaIgnore.test.ts

describe('.foliaignore', () => {
    it('supports comments, basename globs, root paths, directories, and double-star paths', () => {
        const matcher = createFoliaIgnoreMatcher(`
# generated content
*.tmp
/private.mp3
cache/
archive/**/draft?.flac
`);

        expect(matcher.isIgnored('album/note.tmp', false)).toBe(true);
        expect(matcher.isIgnored('private.mp3', false)).toBe(true);
        expect(matcher.isIgnored('album/private.mp3', false)).toBe(false);
        expect(matcher.isIgnored('cache', true)).toBe(true);
        expect(matcher.isIgnored('cache', false)).toBe(false);
        expect(matcher.isIgnored('archive/2025/demo/draft1.flac', false)).toBe(true);
    });

    it('lets later negated rules override earlier rules', () => {
        const matcher = createFoliaIgnoreMatcher(`
*.mp3
!keep.mp3
`);

        expect(matcher.isIgnored('music/drop.mp3', false)).toBe(true);
        expect(matcher.isIgnored('music/keep.mp3', false)).toBe(false);
    });

    it('supports escaped leading comment and negation markers', () => {
        const matcher = createFoliaIgnoreMatcher('\\#notes\n\\!demo');
        expect(matcher.isIgnored('#notes', false)).toBe(true);
        expect(matcher.isIgnored('!demo', false)).toBe(true);
    });

    it('applies nested matchers relative to their folder and lets child rules override parents', () => {
        const parent = createFoliaIgnoreMatcher('*.mp3');
        const child = createFoliaIgnoreMatcher('!keep.mp3\nlocal.flac', 'album/disc');

        expect(isIgnoredByFoliaMatchers([parent, child], 'album/disc/keep.mp3', false)).toBe(false);
        expect(isIgnoredByFoliaMatchers([parent, child], 'album/disc/drop.mp3', false)).toBe(true);
        expect(isIgnoredByFoliaMatchers([parent, child], 'album/disc/local.flac', false)).toBe(true);
        expect(isIgnoredByFoliaMatchers([parent, child], 'album/other/keep.mp3', false)).toBe(true);
    });
});
