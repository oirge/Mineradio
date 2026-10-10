import { parseCommandQuery } from './parse';
import type { CommandSyntaxSpec } from './types';

// src/components/command-palette/syntax/format.ts
// Round-trips a parsed query back into text, so accepting a completion or clearing a token
// rewrites the input instead of appending to it.

const normalizeSpaces = (value: string) => value.trim().replace(/\s+/g, ' ');

const formatFacetValue = (value: string) => (/\s|"/.test(value) ? JSON.stringify(value) : value);

export const formatCommandQuery = ({
    flag,
    facetKind,
    facetValue,
    text,
}: {
    flag?: string | null;
    facetKind?: string | null;
    facetValue?: string;
    text?: string;
}) => [
    flag ? `--${flag}` : '',
    facetKind && facetValue ? `@${facetKind}:${formatFacetValue(facetValue)}` : '',
    normalizeSpaces(text ?? ''),
].filter(Boolean).join(' ');

export const replaceCommandFlag = (spec: CommandSyntaxSpec, input: string, flag: string | null): string => {
    const parsed = parseCommandQuery(spec, input);
    return formatCommandQuery({
        flag,
        facetKind: parsed.facetKind,
        facetValue: parsed.facetValue,
        // An unresolved facet draft is not a facet yet, so it has to survive as free text.
        text: parsed.facetDraft !== null && !parsed.facetKind
            ? `${parsed.isBareFacet ? '@' : `@${parsed.facetDraft}`} ${parsed.text}`
            : parsed.text,
    });
};

export const replaceCommandFacet = (
    spec: CommandSyntaxSpec,
    input: string,
    facetKind: string | null,
    facetValue = '',
): string => {
    const parsed = parseCommandQuery(spec, input);
    return formatCommandQuery({
        flag: parsed.flag,
        facetKind,
        facetValue,
        text: parsed.text,
    });
};
