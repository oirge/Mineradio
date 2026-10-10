import { Filter } from 'lucide-react';
import type { CommandPaletteCommand } from '../types';
import { filterViewSurface } from '../surfaces/filterViewSurface';
import { GRID_FILTER_SYNTAX_SPEC } from '../gridFilterQuery';

// src/components/command-palette/commands/filterViewCommand.ts
// Filters whatever surface currently reads typed characters — the home grids, today.

export const FILTER_VIEW_COMMAND_ID = 'filter-view';

export const filterViewCommand: CommandPaletteCommand = {
    id: FILTER_VIEW_COMMAND_ID,
    group: 'search',
    title: 'Filter this view',
    description: 'Narrow the cards on screen by name',
    icon: Filter,
    keywords: ['filter', 'filter view', 'narrow', '筛选', '过滤', '筛选视图'],
    // Ctrl/Cmd+F was already how GridMap opened its box; it keeps working, now registry-wide.
    openHotkey: { key: 'f', ctrl: true },
    surface: filterViewSurface,
    // `--play` / `--add` finish what the filter starts: they are the info panel's two buttons,
    // which already act on the filtered set rather than on the whole collection.
    syntax: GRID_FILTER_SYNTAX_SPEC,
    // Nothing registers a filter on the player, so the command is only offered where it can act.
    scope: 'filtering-surface',
    requiresInput: true,
    // Picking the command out of the list resumes the filter already in place rather than
    // silently discarding it.
    getInitialInput: context => context.scope.filter?.getQuery() ?? '',
    placeholder: context => context.shared.t('home.gridSearchPlaceholder', 'Filter this view'),
    // The surface writes on every keystroke, and Enter is handled there too — a flag turns it
    // into an action, no flag leaves it swallowed. Nothing is left for the registry to run.
    execute: () => true,
};
