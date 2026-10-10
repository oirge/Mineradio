import { describe, expect, it } from 'vitest';
import { parseCommandQuery } from '../../../src/components/command-palette/syntax/parse';
import { formatCommandQuery, replaceCommandFacet, replaceCommandFlag } from '../../../src/components/command-palette/syntax/format';
import { buildFacetSuggestions, buildFlagSuggestions } from '../../../src/components/command-palette/syntax/suggest';
import type { CommandSyntaxSpec } from '../../../src/components/command-palette/syntax/types';

// test/unit/command-palette/commandSyntax.test.ts
// Exercises the shared `--flag @facet:value` dialect against a spec that is not the queue's, so
// the layer stays reusable rather than queue-shaped.

const SPEC: CommandSyntaxSpec = {
    flags: [{ name: 'archive', aliases: ['ar'] }, { name: 'pin' }],
    facets: [{ name: 'tag' }, { name: 'author' }],
};

describe('command palette syntax layer', () => {
    it('parses a leading flag, a quoted facet, and free text', () => {
        expect(parseCommandQuery(SPEC, '--ar @author:"Ada Lovelace" analytical engine')).toMatchObject({
            flag: 'archive',
            flagDraft: null,
            facetKind: 'author',
            facetValue: 'Ada Lovelace',
            text: 'analytical engine',
        });
    });

    it('parses a trailing flag and reports an unresolved draft', () => {
        expect(parseCommandQuery(SPEC, 'notes --pi')).toMatchObject({ flag: null, flagDraft: 'pi', text: 'notes' });
        expect(parseCommandQuery(SPEC, 'notes --pin')).toMatchObject({ flag: 'pin', flagDraft: null, text: 'notes' });
    });

    it('treats a bare @ as an empty facet draft and unescapes literal markers', () => {
        expect(parseCommandQuery(SPEC, '@')).toMatchObject({ facetDraft: '', isBareFacet: true });
        expect(parseCommandQuery(SPEC, String.raw`\@home \-draft`)).toMatchObject({ facetDraft: null, text: '@home -draft' });
    });

    it('ignores facet names the spec does not declare', () => {
        expect(parseCommandQuery(SPEC, '@artist:hoshimachi')).toMatchObject({
            facetKind: null,
            facetDraft: 'artist:hoshimachi',
        });
    });

    it('round-trips through format and the replace helpers', () => {
        expect(formatCommandQuery({ flag: 'pin', facetKind: 'tag', facetValue: 'live set', text: 'encore' }))
            .toBe('--pin @tag:"live set" encore');
        expect(replaceCommandFlag(SPEC, '@tag:live encore', 'archive')).toBe('--archive @tag:live encore');
        expect(replaceCommandFlag(SPEC, '--archive @tag:live encore', null)).toBe('@tag:live encore');
        expect(replaceCommandFacet(SPEC, '--pin @tag:live encore', null)).toBe('--pin encore');
    });

    it('keeps an unresolved facet draft as free text when a flag is applied', () => {
        expect(replaceCommandFlag(SPEC, '@liv encore', 'pin')).toBe('--pin @liv encore');
    });

    it('completes flags from the spec only while a draft is pending', () => {
        expect(buildFlagSuggestions(SPEC, parseCommandQuery(SPEC, '--p')).map(item => item.flag)).toEqual(['pin']);
        expect(buildFlagSuggestions(SPEC, parseCommandQuery(SPEC, '--pin'))).toEqual([]);
    });

    it('ranks preferred facet candidates first, then prefix matches, then weight', () => {
        const candidates = [
            { kind: 'tag', label: 'live', weight: 2, isPreferred: false },
            { kind: 'tag', label: 'delivery', weight: 9, isPreferred: false },
            { kind: 'tag', label: 'lively', weight: 1, isPreferred: true },
        ];

        expect(buildFacetSuggestions(parseCommandQuery(SPEC, '@liv'), candidates).map(item => item.label))
            .toEqual(['lively', 'live', 'delivery']);
    });

    it('stops suggesting once the draft already names an exact candidate', () => {
        const candidates = [{ kind: 'tag', label: 'live', weight: 2, isPreferred: false }];
        expect(buildFacetSuggestions(parseCommandQuery(SPEC, '@tag:live'), candidates)).toEqual([]);
    });
});
