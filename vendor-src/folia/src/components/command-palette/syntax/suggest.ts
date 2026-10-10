import { formatCommandQuery } from './format';
import type { CommandSyntaxSpec, ParsedCommandQuery } from './types';

// src/components/command-palette/syntax/suggest.ts
// Completion generation for the shared palette dialect. Flag completions come straight from the
// spec; facet completions rank caller-supplied candidates, since only the command knows what
// values exist.

export type SyntaxSuggestion = {
    id: string;
    type: 'flag' | 'facet';
    replacement: string;
    flag?: string;
    /** Alternate spellings that resolve to the same flag, so the hint can show them. */
    aliases?: string[];
    descriptionKey?: string;
    descriptionFallback?: string;
    facetKind?: string;
    label?: string;
    count?: number;
    isPreferred?: boolean;
};

/** One completable facet value, already grouped by the command. */
export type SyntaxFacetCandidate = {
    kind: string;
    label: string;
    /** Higher wins when both candidates are equally close to the draft. */
    weight: number;
    /** Surfaced first, e.g. the currently playing song's own artist. */
    isPreferred: boolean;
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

// An unresolved facet draft is not a facet yet, so a flag completion has to keep it as free text.
const textWithPendingFacet = (parsed: ParsedCommandQuery) => (
    parsed.facetDraft !== null && !parsed.facetKind
        ? `${parsed.isBareFacet ? '@' : `@${parsed.facetDraft}`} ${parsed.text}`
        : parsed.text
);

export const buildFlagSuggestions = (
    spec: CommandSyntaxSpec,
    parsed: ParsedCommandQuery,
): SyntaxSuggestion[] => {
    if (parsed.flagDraft === null) {
        return [];
    }

    const draft = normalize(parsed.flagDraft);
    return spec.flags
        // An alias the user is part-way through typing has to match too, or `--rm` offers nothing.
        .filter(flag => flag.name.startsWith(draft) || (flag.aliases ?? []).some(alias => alias.startsWith(draft)))
        .map(flag => ({
            id: `flag:${flag.name}`,
            type: 'flag' as const,
            flag: flag.name,
            aliases: flag.aliases,
            descriptionKey: flag.descriptionKey,
            descriptionFallback: flag.descriptionFallback,
            replacement: formatCommandQuery({
                flag: flag.name,
                facetKind: parsed.facetKind,
                facetValue: parsed.facetValue,
                text: textWithPendingFacet(parsed),
            }),
        }));
};

export const buildFacetSuggestions = (
    parsed: ParsedCommandQuery,
    candidates: SyntaxFacetCandidate[],
    limit = 6,
): SyntaxSuggestion[] => {
    if (parsed.facetDraft === null) {
        return [];
    }

    const draft = normalize(parsed.facetDraft);
    const scoped = candidates.filter(candidate => !parsed.facetKind || candidate.kind === parsed.facetKind);

    // Nothing left to complete once the draft already names an exact candidate.
    if (parsed.facetKind && parsed.facetValue && scoped.some(candidate => normalize(candidate.label) === draft)) {
        return [];
    }

    return scoped
        .filter(candidate => (parsed.isBareFacet ? candidate.isPreferred : normalize(candidate.label).includes(draft)))
        .sort((left, right) => {
            if (left.isPreferred !== right.isPreferred) return left.isPreferred ? -1 : 1;
            const leftPrefix = normalize(left.label).startsWith(draft);
            const rightPrefix = normalize(right.label).startsWith(draft);
            if (leftPrefix !== rightPrefix) return leftPrefix ? -1 : 1;
            return right.weight - left.weight || left.label.localeCompare(right.label);
        })
        .slice(0, limit)
        .map(candidate => ({
            id: `facet:${candidate.kind}:${normalize(candidate.label)}`,
            type: 'facet' as const,
            facetKind: candidate.kind,
            label: candidate.label,
            count: candidate.weight,
            isPreferred: candidate.isPreferred,
            replacement: formatCommandQuery({
                flag: parsed.flag,
                facetKind: candidate.kind,
                facetValue: candidate.label,
                text: parsed.text,
            }),
        }));
};
