import { describe, expect, it, vi } from 'vitest';
import { PlayerState } from '../../../src/types';
import {
    DEFAULT_PERSONAL_FM_SELECTION,
    getPersonalFmSelectionLabel,
    normalizePersonalFmSelection,
    toPersonalFmRequestOptions,
} from '../../../src/services/onlineMusic/fmModes';
import { buildPersonalFmMatches, readPersonalFmOption } from '../../../src/components/command-palette/commands/fmModeOptions';
import { buildPersonalFmSections } from '../../../src/components/command-palette/surfaces/fmModeSurface';
import type { CommandPaletteContext } from '../../../src/components/command-palette/types';

// test/unit/command-palette/fmModePicker.test.ts
// Covers the Personal FM picker's pure parts: selection normalisation, the flat match list the
// surface navigates, and the sections the view renders from it.

const setPersonalFmSelection = vi.fn();

const createContext = (selection = DEFAULT_PERSONAL_FM_SELECTION): CommandPaletteContext => ({
    shared: {
        t: (_key: string, fallback?: string) => fallback ?? '',
        setStatusMsg: vi.fn(),
        currentSong: null,
        playerState: PlayerState.PAUSED,
    },
    playback: {
        personalFmSelection: selection,
        isPersonalFmModeSupported: true,
        setPersonalFmSelection,
    },
} as unknown as CommandPaletteContext);

describe('personal FM selection', () => {
    it('drops a scene from modes that cannot carry one', () => {
        expect(normalizePersonalFmSelection({ mode: 'EXPLORE', scene: 'SLEEP_HELP' }))
            .toEqual({ mode: 'EXPLORE', scene: null });
    });

    it('falls back to the default mode when SCENE_RCMD has no usable scene', () => {
        expect(normalizePersonalFmSelection({ mode: 'SCENE_RCMD', scene: null })).toEqual(DEFAULT_PERSONAL_FM_SELECTION);
        expect(normalizePersonalFmSelection({ mode: 'SCENE_RCMD', scene: 'NOT_A_SCENE' })).toEqual(DEFAULT_PERSONAL_FM_SELECTION);
    });

    it('sends the submode only alongside SCENE_RCMD', () => {
        expect(toPersonalFmRequestOptions({ mode: 'SCENE_RCMD', scene: 'SLEEP_HELP' }))
            .toEqual({ mode: 'SCENE_RCMD', submode: 'SLEEP_HELP' });
        expect(toPersonalFmRequestOptions({ mode: 'FAMILIAR', scene: null }))
            .toEqual({ mode: 'FAMILIAR', submode: null });
    });

    it('labels a scene selection with both halves', () => {
        const t = (_key: string, fallback?: string) => fallback ?? '';
        expect(getPersonalFmSelectionLabel({ mode: 'SCENE_RCMD', scene: 'SLEEP_HELP' }, t)).toBe('Scene · Sleep');
        expect(getPersonalFmSelectionLabel({ mode: 'EXPLORE', scene: null }, t)).toBe('Explore');
    });
});

describe('personal FM matches', () => {
    it('lists every mode and scene when nothing is typed', () => {
        const matches = buildPersonalFmMatches(createContext(), '');
        const kinds = matches.map(match => readPersonalFmOption(match.command.id)?.kind);
        expect(kinds.filter(kind => kind === 'mode')).toHaveLength(5);
        expect(kinds.filter(kind => kind === 'scene')).toHaveLength(42);
    });

    it('filters on the label and on the raw API id', () => {
        expect(buildPersonalFmMatches(createContext(), 'sleep').map(match => match.command.id))
            .toEqual(['fm-scene-pick-SLEEP_HELP']);
        expect(buildPersonalFmMatches(createContext(), 'SLEEP_HELP').map(match => match.command.id))
            .toEqual(['fm-scene-pick-SLEEP_HELP']);
    });

    it('filters on full pinyin and on initials', () => {
        // The stub translator returns the English fallback, so these only match through keywords.
        expect(buildPersonalFmMatches(createContext(), 'zhumian').map(match => match.command.id))
            .toEqual(['fm-scene-pick-SLEEP_HELP']);
        expect(buildPersonalFmMatches(createContext(), 'zm').map(match => match.command.id))
            .toEqual(['fm-scene-pick-SLEEP_HELP']);
        expect(buildPersonalFmMatches(createContext(), 'changjing').map(match => match.command.id))
            .toEqual(['fm-mode-pick-SCENE_RCMD']);
    });

    it('filters on the Chinese label the user actually sees', () => {
        const zhContext = createContext();
        zhContext.shared.t = (key: string) => (key.endsWith('SLEEP_HELP') ? '助眠' : key);
        expect(buildPersonalFmMatches(zhContext, '助眠').map(match => match.command.id))
            .toEqual(['fm-scene-pick-SLEEP_HELP']);
    });

    it('applies scene mode when a scene is picked', () => {
        setPersonalFmSelection.mockClear();
        const context = createContext();
        const match = buildPersonalFmMatches(context, 'sleep')[0];
        match.command.execute('', context);
        expect(setPersonalFmSelection).toHaveBeenCalledWith({ mode: 'SCENE_RCMD', scene: 'SLEEP_HELP' });
    });

    it('keeps the current scene when the Scene mode pill itself is picked', () => {
        setPersonalFmSelection.mockClear();
        const context = createContext({ mode: 'SCENE_RCMD', scene: 'FOCUS' });
        const match = buildPersonalFmMatches(context, '')
            .find(entry => entry.command.id === 'fm-mode-pick-SCENE_RCMD');
        match?.command.execute('', context);
        expect(setPersonalFmSelection).toHaveBeenCalledWith({ mode: 'SCENE_RCMD', scene: 'FOCUS' });
    });
});

describe('personal FM sections', () => {
    it('groups the full list into the mode row and four scene categories', () => {
        const sections = buildPersonalFmSections(buildPersonalFmMatches(createContext(), ''));
        expect(sections.map(section => section.key)).toEqual(['mode', 'mood', 'activity', 'genre', 'language']);
        expect(sections.reduce((total, section) => total + section.indices.length, 0)).toBe(47);
    });

    it('drops sections that the filter emptied', () => {
        const sections = buildPersonalFmSections(buildPersonalFmMatches(createContext(), 'sleep'));
        expect(sections.map(section => section.key)).toEqual(['activity']);
    });
});
