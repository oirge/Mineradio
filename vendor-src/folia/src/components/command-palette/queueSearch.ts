import type { SongResult } from '../../types';
import {
    parseQueueQuery,
    QUEUE_SYNTAX_SPEC,
    type ParsedQueueQuery,
    type QueueBatchAction,
    type QueueFacetKind,
} from './queueQuery';
import { buildFacetSuggestions, buildFlagSuggestions, type SyntaxFacetCandidate, type SyntaxSuggestion } from './syntax/suggest';
import type { ParsedCommandQuery } from './syntax/types';
import {
    getCurrentQueueIndex,
    getSongQueueFacets,
    normalizeQueueSearchText as normalize,
    type QueueSearchEntry,
} from './queueSearchIndex';

export { buildQueueSearchIndex } from './queueSearchIndex';

// src/components/command-palette/queueSearch.ts
// Builds a metadata index once per queue and evaluates queue syntax without touching provider APIs.

export type QueueSearchSuggestion = {
    id: string;
    type: 'action' | 'facet';
    replacement: string;
    action?: QueueBatchAction;
    facetKind?: QueueFacetKind;
    label?: string;
    count?: number;
    isCurrent?: boolean;
};

export type QueueSearchMatch = {
    entry: QueueSearchEntry;
    score: number;
    reasons: QueueFacetKind[];
};

export type QueueSearchEvaluation = {
    parsed: ParsedQueueQuery;
    matches: QueueSearchMatch[];
    suggestions: QueueSearchSuggestion[];
    eligibleTargetIndices: number[];
    skippedCurrentCount: number;
    hasMeaningfulFilter: boolean;
};

// The parsed queue query is the generic parsed shape under queue-specific field names.
const toParsedCommandQuery = (parsed: ParsedQueueQuery): ParsedCommandQuery => ({
    flag: parsed.action,
    flagDraft: parsed.actionDraft,
    facetKind: parsed.facetKind,
    facetValue: parsed.facetValue,
    facetDraft: parsed.facetDraft,
    isBareFacet: parsed.isBareFacet,
    text: parsed.text,
    filterInput: parsed.filterInput,
});

const toQueueSuggestion = (suggestion: SyntaxSuggestion): QueueSearchSuggestion => ({
    id: suggestion.type === 'flag' ? `action:${suggestion.flag}` : suggestion.id,
    type: suggestion.type === 'flag' ? 'action' : 'facet',
    replacement: suggestion.replacement,
    action: suggestion.flag as QueueBatchAction | undefined,
    facetKind: suggestion.facetKind as QueueFacetKind | undefined,
    label: suggestion.label,
    count: suggestion.count,
    isCurrent: suggestion.isPreferred,
});

// Collapses the queue index into one completion candidate per distinct artist / album.
const collectFacetCandidates = (
    index: QueueSearchEntry[],
    currentSong: SongResult | null,
): SyntaxFacetCandidate[] => {
    const currentFacetKeys = new Set(currentSong ? getSongQueueFacets(currentSong).map(facet => facet.key) : []);
    const groups = new Map<string, { kind: QueueFacetKind; label: string; indices: Set<number>; isPreferred: boolean; }>();

    for (const entry of index) {
        for (const facet of entry.facets) {
            const groupKey = `${facet.kind}:${facet.normalizedLabel}`;
            const group = groups.get(groupKey) ?? {
                kind: facet.kind,
                label: facet.label,
                indices: new Set<number>(),
                isPreferred: false,
            };
            group.indices.add(entry.queueIndex);
            group.isPreferred ||= currentFacetKeys.has(facet.key);
            groups.set(groupKey, group);
        }
    }

    return [...groups.values()].map(group => ({
        kind: group.kind,
        label: group.label,
        weight: group.indices.size,
        isPreferred: group.isPreferred,
    }));
};

export const evaluateQueueSearch = (
    index: QueueSearchEntry[],
    currentSong: SongResult | null,
    input: string,
): QueueSearchEvaluation => {
    const parsed = parseQueueQuery(input);
    const parsedCommandQuery = toParsedCommandQuery(parsed);
    const facetSuggestions = buildFacetSuggestions(
        parsedCommandQuery,
        collectFacetCandidates(index, currentSong),
    ).map(toQueueSuggestion);
    const currentFacets = currentSong ? getSongQueueFacets(currentSong) : [];
    const currentFacetKeys = new Set(currentFacets.map(facet => facet.key));
    const facetDraft = normalize(parsed.facetValue || parsed.facetDraft || '');
    const normalizedText = normalize(parsed.text);

    const matches = index.flatMap((entry): QueueSearchMatch[] => {
        let reasons: QueueFacetKind[] = [];
        let facetMatches = true;
        if (parsed.isBareFacet) {
            reasons = entry.facets
                .filter(facet => currentFacetKeys.has(facet.key))
                .map(facet => facet.kind)
                .filter((kind, facetIndex, kinds) => kinds.indexOf(kind) === facetIndex);
            facetMatches = reasons.length > 0;
        } else if (parsed.facetDraft !== null) {
            const matchingFacets = entry.facets.filter(facet => (
                (!parsed.facetKind || facet.kind === parsed.facetKind)
                && facet.normalizedLabel.includes(facetDraft)
            ));
            reasons = matchingFacets.map(facet => facet.kind)
                .filter((kind, facetIndex, kinds) => kinds.indexOf(kind) === facetIndex);
            facetMatches = matchingFacets.length > 0;
        }

        if (!facetMatches || (normalizedText && !entry.searchText.includes(normalizedText))) {
            return [];
        }

        const startsWithText = normalizedText
            ? normalize(entry.song.name).startsWith(normalizedText) || String(entry.queueIndex + 1).startsWith(normalizedText)
            : false;
        return [{ entry, reasons, score: (startsWithText ? 120 : 100) - entry.queueIndex }];
    }).sort((left, right) => right.score - left.score);

    const currentQueueIndex = getCurrentQueueIndex(index, currentSong);
    const targetIndices = matches.map(match => match.entry.queueIndex);
    const eligibleTargetIndices = targetIndices.filter(queueIndex => queueIndex !== currentQueueIndex);

    return {
        parsed,
        matches,
        // Only facets. Flag completions are the palette shell's job now (CommandPaletteSyntaxHints),
        // so every command with a `syntax` gets them rather than just this one.
        suggestions: facetSuggestions,
        eligibleTargetIndices,
        skippedCurrentCount: targetIndices.length - eligibleTargetIndices.length,
        hasMeaningfulFilter: Boolean(normalizedText || parsed.facetDraft !== null),
    };
};
