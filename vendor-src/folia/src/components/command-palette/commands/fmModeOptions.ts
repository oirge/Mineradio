import {
    PERSONAL_FM_MODES,
    PERSONAL_FM_SCENES,
    type PersonalFmSelection,
} from '../../../services/onlineMusic/fmModes';
import type { CommandPaletteCommand, CommandPaletteContext, CommandPaletteMatch } from '../types';

// src/components/command-palette/commands/fmModeOptions.ts
// Turns the Personal FM catalogue into palette matches. Modes and scenes share one flat list so
// filtering, arrow navigation and execution all stay on the palette's normal pipeline; the view
// re-groups them for display.

const MODE_ID_PREFIX = 'fm-mode-pick-';
const SCENE_ID_PREFIX = 'fm-scene-pick-';

export type PersonalFmOptionRef =
    | { kind: 'mode'; id: string }
    | { kind: 'scene'; id: string };

/** The grid needs to know what a tile represents, and matches only carry a command. */
export const readPersonalFmOption = (commandId: string): PersonalFmOptionRef | null => {
    if (commandId.startsWith(MODE_ID_PREFIX)) {
        return { kind: 'mode', id: commandId.slice(MODE_ID_PREFIX.length) };
    }
    if (commandId.startsWith(SCENE_ID_PREFIX)) {
        return { kind: 'scene', id: commandId.slice(SCENE_ID_PREFIX.length) };
    }
    return null;
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, '');

type PersonalFmOption = {
    id: string;
    label: string;
    matchId: string;
    /** Pinyin from the catalogue, so a Latin keyboard reaches the Chinese labels. */
    keywords: string[];
    selection: PersonalFmSelection;
};

const buildOptions = (context: CommandPaletteContext): PersonalFmOption[] => {
    const t = context.shared.t;
    return [
        ...PERSONAL_FM_MODES.map(entry => ({
            id: `${MODE_ID_PREFIX}${entry.id}`,
            label: t(entry.labelKey, entry.labelFallback),
            matchId: entry.id,
            keywords: entry.keywords,
            // Picking SCENE_RCMD from the mode row keeps the scene already in effect, so the row
            // acts as a label for the scene below it rather than a dead end.
            selection: entry.id === 'SCENE_RCMD'
                ? { mode: 'SCENE_RCMD' as const, scene: context.playback.personalFmSelection.scene }
                : { mode: entry.id, scene: null },
        })),
        // A scene carries its mode with it: clicking one selects SCENE_RCMD in the same step.
        ...PERSONAL_FM_SCENES.map(entry => ({
            id: `${SCENE_ID_PREFIX}${entry.id}`,
            label: t(entry.labelKey, entry.labelFallback),
            matchId: entry.id,
            keywords: entry.keywords,
            selection: { mode: 'SCENE_RCMD' as const, scene: entry.id },
        })),
    ];
};

const toCommand = (option: PersonalFmOption): CommandPaletteCommand => ({
    id: option.id,
    group: 'playback',
    title: option.label,
    // Labels come from the FM catalogue, not from commandPalette.commands.<id>.
    textSource: 'runtime',
    description: option.label,
    keywords: [option.matchId, ...option.keywords],
    hidden: true,
    execute: (_input, context) => {
        void context.playback.setPersonalFmSelection(option.selection);
        return true;
    },
});

// Ranked by how early the query hits the label, the API id or a pinyin keyword; an empty query
// keeps catalogue order so the grid stays still while the user is only looking.
export const buildPersonalFmMatches = (
    context: CommandPaletteContext,
    query: string,
): CommandPaletteMatch[] => {
    const normalizedQuery = normalize(query);
    return buildOptions(context)
        .map((option, index) => {
            if (!normalizedQuery) {
                return { option, score: 1000 - index };
            }
            const best = [option.label, option.matchId, ...option.keywords].map(normalize)
                .map(haystack => haystack.indexOf(normalizedQuery))
                .filter(position => position >= 0)
                .sort((left, right) => left - right)[0];
            return best === undefined ? null : { option, score: 1000 - best };
        })
        .filter((entry): entry is { option: PersonalFmOption; score: number } => entry !== null)
        .map(entry => ({ command: toCommand(entry.option), score: entry.score, input: '' }));
};
