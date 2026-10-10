import type { CommandSyntaxSpec, ParsedCommandQuery } from './types';

// src/components/command-palette/syntax/parse.ts
// Spec-driven parser for the palette's `--flag @facet:value text` dialect.

const normalizeSpaces = (value: string) => value.trim().replace(/\s+/g, ' ');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildFlagAliases = (spec: CommandSyntaxSpec) => {
    const aliases = new Map<string, string>();
    spec.flags.forEach(flag => {
        aliases.set(flag.name.toLowerCase(), flag.name);
        flag.aliases?.forEach(alias => aliases.set(alias.toLowerCase(), flag.name));
    });
    return aliases;
};

const parseQuotedValue = (rawValue: string): string => {
    if (!rawValue.startsWith('"')) {
        return rawValue;
    }

    try {
        return JSON.parse(rawValue) as string;
    } catch {
        return rawValue.slice(1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
};

// A flag is accepted either as a leading token or as a trailing one, so it can be typed before
// or after the filter without reordering what the user already wrote.
const stripFlagToken = (input: string, aliases: Map<string, string>) => {
    const prefixMatch = input.match(/^\s*--([a-z-]*)(?:\s+|$)/i);
    if (prefixMatch) {
        const rawFlag = prefixMatch[1].toLowerCase();
        return {
            flag: aliases.get(rawFlag) ?? null,
            flagDraft: aliases.get(rawFlag) ? null : rawFlag,
            filterInput: input.slice(prefixMatch[0].length),
        };
    }

    const suffixMatch = input.match(/(?:^|\s)--([a-z-]*)\s*$/i);
    if (suffixMatch && suffixMatch.index !== undefined) {
        const rawFlag = suffixMatch[1].toLowerCase();
        return {
            flag: aliases.get(rawFlag) ?? null,
            flagDraft: aliases.get(rawFlag) ? null : rawFlag,
            filterInput: input.slice(0, suffixMatch.index),
        };
    }

    return { flag: null, flagDraft: null, filterInput: input };
};

export const parseCommandQuery = (spec: CommandSyntaxSpec, input: string): ParsedCommandQuery => {
    const flagToken = stripFlagToken(input, buildFlagAliases(spec));
    const filterInput = normalizeSpaces(flagToken.filterInput);

    const facetNames = spec.facets.map(facet => escapeRegExp(facet.name)).join('|');
    const explicitFacetMatch = facetNames
        ? filterInput.match(new RegExp(`(^|\\s)@(${facetNames}):("(?:\\\\.|[^"\\\\])*"|[^\\s]*)`, 'i'))
        : null;
    const shorthandFacetMatch = explicitFacetMatch ? null : filterInput.match(/(^|\s)@([^\s]*)/);

    let facetKind: string | null = null;
    let facetValue = '';
    let facetDraft: string | null = null;
    let isBareFacet = false;
    let text = filterInput;

    if (explicitFacetMatch && explicitFacetMatch.index !== undefined) {
        facetKind = explicitFacetMatch[2].toLowerCase();
        facetValue = parseQuotedValue(explicitFacetMatch[3]);
        facetDraft = facetValue;
        const start = explicitFacetMatch.index + explicitFacetMatch[1].length;
        text = `${filterInput.slice(0, start)} ${filterInput.slice(start + explicitFacetMatch[0].length - explicitFacetMatch[1].length)}`;
    } else if (shorthandFacetMatch && shorthandFacetMatch.index !== undefined) {
        facetDraft = shorthandFacetMatch[2];
        isBareFacet = facetDraft.length === 0;
        const start = shorthandFacetMatch.index + shorthandFacetMatch[1].length;
        text = `${filterInput.slice(0, start)} ${filterInput.slice(start + shorthandFacetMatch[0].length - shorthandFacetMatch[1].length)}`;
    }

    return {
        flag: flagToken.flag,
        flagDraft: flagToken.flagDraft,
        facetKind,
        facetValue,
        facetDraft,
        isBareFacet,
        text: normalizeSpaces(text).replace(/\\([@-])/g, '$1'),
        filterInput,
    };
};
