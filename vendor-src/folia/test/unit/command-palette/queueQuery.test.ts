import { describe, expect, it } from 'vitest';
import { formatQueueQuery, parseQueueQuery, replaceQueueAction, replaceQueueFacet } from '../../../src/components/command-palette/queueQuery';

// test/unit/command-palette/queueQuery.test.ts
// Covers queue syntax parsing, canonical formatting, suffix action invocation, and literal escaping.

describe('queue query syntax', () => {
    it('keeps ordinary search text unchanged', () => {
        expect(parseQueueQuery('  needle song  ')).toMatchObject({
            action: null,
            facetDraft: null,
            text: 'needle song',
        });
    });

    it('recognizes the bare current-song facet shortcut', () => {
        expect(parseQueueQuery('@')).toMatchObject({
            facetKind: null,
            facetDraft: '',
            isBareFacet: true,
            text: '',
        });
    });

    it('parses an action, quoted facet, and remaining text', () => {
        expect(parseQueueQuery('--remove @album:"Sun Dance" live')).toMatchObject({
            action: 'remove',
            facetKind: 'album',
            facetValue: 'Sun Dance',
            text: 'live',
        });
    });

    it('accepts an action trigger after an existing filter and normalizes it to a prefix', () => {
        expect(parseQueueQuery('Aimer --')).toMatchObject({
            actionDraft: '',
            text: 'Aimer',
        });
        expect(replaceQueueAction('Aimer --', 'next')).toBe('--next Aimer');
    });

    it('formats and clears structured facet tokens', () => {
        const query = formatQueueQuery({ action: 'end', facetKind: 'artist', facetValue: 'Aimer', text: 'live' });
        expect(query).toBe('--end @artist:Aimer live');
        expect(replaceQueueFacet(query, null)).toBe('--end live');
        expect(replaceQueueAction(query, null)).toBe('@artist:Aimer live');
    });

    it('treats escaped prefixes as literal search text', () => {
        expect(parseQueueQuery('\\@home')).toMatchObject({
            facetDraft: null,
            text: '@home',
        });
    });
});
