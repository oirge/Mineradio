import { COMMAND_PALETTE_COMMANDS, matchCommandsExactly } from '../../../command-palette/commandRegistry';
import { normalizeSearchText } from '../../../command-palette/search/normalize';
import type { SettingsAnchorId } from './settingsAnchorModel';
import type { SettingsNavGroup, SettingsSectionId } from './settingsNavModel';

// src/components/modal/settings/navigation/settingsNavSearch.ts
// Filters the wide settings sidebar down to what a query names. Besides the sidebar's own text
// (section titles, descriptions and anchor labels) it asks the command palette's index about every
// command that opens a settings section: those carry the hand-written synonyms and generated pinyin
// that let "fps" or "zhenlv" find the frame-rate cap, which no sidebar label spells out.

/** Commands that land somewhere in the options tab. A module constant so the search index caches. */
const SETTINGS_TARGET_COMMANDS = COMMAND_PALETTE_COMMANDS.filter(command => command.settingsTarget);

export type SettingsNavSearchHit = {
    sectionId: SettingsSectionId;
    anchorId: SettingsAnchorId | null;
};

export type SettingsNavSearchResult = {
    groups: SettingsNavGroup[];
    /** Where Enter in the search box goes: the first visible entry, an anchor over its section. */
    firstHit: SettingsNavSearchHit | null;
};

/**
 * Keeps the sections and anchors the query matches, in sidebar order. An anchor hit keeps only the
 * matching anchors of its section; a hit on the section itself keeps all of them, so the listener
 * still sees what that page holds.
 */
export const searchSettingsNav = (
    groups: SettingsNavGroup[],
    query: string,
    locale: string,
): SettingsNavSearchResult => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
        return { groups, firstHit: null };
    }

    const contains = (text: string) => normalizeSearchText(text).includes(normalizedQuery);
    const sectionHits = new Set<string>();
    const anchorHits = new Set<string>();
    matchCommandsExactly(query, SETTINGS_TARGET_COMMANDS, locale).forEach(command => {
        const target = command.settingsTarget!;
        if (target.anchorId) {
            anchorHits.add(target.anchorId);
        } else {
            sectionHits.add(target.subview);
        }
    });

    let firstHit: SettingsNavSearchHit | null = null;
    const filtered = groups
        .map(group => ({
            ...group,
            items: group.items.flatMap(section => {
                const matchedAnchors = section.anchors.filter(anchor => anchorHits.has(anchor.id) || contains(anchor.label));
                const sectionMatched = contains(group.label)
                    || sectionHits.has(section.id)
                    || contains(section.label)
                    || contains(section.description);
                if (!sectionMatched && matchedAnchors.length === 0) {
                    return [];
                }
                firstHit ??= { sectionId: section.id, anchorId: matchedAnchors[0]?.id ?? null };
                return [{ ...section, anchors: matchedAnchors.length > 0 ? matchedAnchors : section.anchors }];
            }),
        }))
        .filter(group => group.items.length > 0);

    return { groups: filtered, firstHit };
};
