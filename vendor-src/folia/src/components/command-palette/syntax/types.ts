// src/components/command-palette/syntax/types.ts
// Shape of the small `--flag @facet:value free text` dialect that command palette commands can
// opt into. The queue command is the first consumer; the parser itself knows nothing about queues.

export type SyntaxFlagSpec = {
    name: string;
    aliases?: string[];
    /**
     * What the flag does, shown when the user types `--`. A flag with no description still
     * completes; it just lists its name alone.
     */
    descriptionKey?: string;
    descriptionFallback?: string;
};

export type SyntaxFacetSpec = {
    name: string;
};

export type CommandSyntaxSpec = {
    flags: SyntaxFlagSpec[];
    facets: SyntaxFacetSpec[];
};

export type ParsedCommandQuery = {
    /** Resolved flag name, after alias lookup. */
    flag: string | null;
    /** Raw flag text typed so far when it does not resolve to a known flag. */
    flagDraft: string | null;
    facetKind: string | null;
    facetValue: string;
    /** Raw facet text typed so far, including an empty string for a bare `@`. */
    facetDraft: string | null;
    isBareFacet: boolean;
    /** Free text with the flag and facet tokens stripped and escapes unwrapped. */
    text: string;
    /** Everything after the flag token, before facet extraction. */
    filterInput: string;
};
