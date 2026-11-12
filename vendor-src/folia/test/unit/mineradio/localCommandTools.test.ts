// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type { HostState } from '../../../src/mineradio/client';
import { executeLocalAction, localActionView, localCommandMatches, LOCAL_ACTIONS, type LocalActionServices } from '../../../src/mineradio/local/localCommandCatalog';
import { normalizeLocalSlots, useLocalControlsStore } from '../../../src/mineradio/local/useLocalControlsStore';
import { normalizeVisualPreferences, useVisualSettings } from '../../../src/mineradio/local/useVisualSettings';

// test/unit/mineradio/localCommandTools.test.ts
afterEach(() => { useLocalControlsStore.getState().reset(); useVisualSettings.getState().reset(); localStorage.clear(); });
it('restores damaged shortcuts to distinct available actions and swaps duplicate assignments', async () => {
    expect(normalizeLocalSlots(null)).toEqual(['mode', 'like']);
    expect(normalizeLocalSlots(['like', 'like'])).toEqual(['like', 'mode']);
    expect(normalizeLocalSlots(['next', 'missing'])).toEqual(['mode', 'like']);
    useLocalControlsStore.getState().assign(0, 'like');
    expect(useLocalControlsStore.getState().slots).toEqual(['like', 'mode']);
    useLocalControlsStore.getState().assign(1, 'audio');
    const saved = localStorage.getItem('mineradio-folia-local-controls-v1')!;
    useLocalControlsStore.getState().reset();
    localStorage.setItem('mineradio-folia-local-controls-v1', saved);
    await useLocalControlsStore.persist.rehydrate();
    expect(useLocalControlsStore.getState().slots).toEqual(['like', 'audio']);
});
it('dispatches shuffle, favorites and navigation through the host and correct local services', () => {
    const services: LocalActionServices = { state: { currentTrack: { id: 'local:a' }, playMode: 'loop' } as HostState,
        command: vi.fn().mockResolvedValue({}), tool: vi.fn(), library: vi.fn(), playback: vi.fn(), visuals: vi.fn(), focus: vi.fn(), view: vi.fn() };
    executeLocalAction('mode', services); executeLocalAction('like', services); executeLocalAction('shuffle', services);
    expect(services.command).toHaveBeenNthCalledWith(1, 'setPlayMode', { mode: 'shuffle' });
    expect(services.command).toHaveBeenNthCalledWith(2, 'toggleLike', { id: 'local:a' });
    expect(services.command).toHaveBeenNthCalledWith(3, 'shuffleQueue', undefined);
    executeLocalAction('audio', services); expect(services.tool).toHaveBeenCalledWith('audio');
    executeLocalAction('queue', services); expect(services.library).toHaveBeenCalledWith(true);
    executeLocalAction('posters', services); expect(services.view).toHaveBeenCalledWith('posters');
    executeLocalAction('like', { ...services, state: null }); expect(services.command).toHaveBeenCalledTimes(3);
});
it('matches English, Chinese and pinyin without loading the upstream application registry', () => {
    const audio = LOCAL_ACTIONS.find(action => action.id === 'audio')!;
    for (const query of ['EQ', '输出设备', 'yx', '  audio   eq ']) expect(localCommandMatches(audio.keywords, query)).toBe(true);
    expect(localCommandMatches(audio.keywords, 'nonsense')).toBe(false);
    expect(localActionView('like', { currentTrack: { liked: true } } as HostState).label).toBe('unlike');
});
it('finds custom translation settings in both languages and opens only the host settings action', () => {
    const action = LOCAL_ACTIONS.find(item => item.id === 'translationSource')!;
    for (const query of ['custom translation', 'api key', '翻译源', 'fyy']) expect(localCommandMatches(action.keywords, query)).toBe(true);
    const services: LocalActionServices = { state: null, command: vi.fn().mockResolvedValue({}),
        tool: vi.fn(), library: vi.fn(), playback: vi.fn(), visuals: vi.fn(), focus: vi.fn(), view: vi.fn() };
    executeLocalAction('translationSource', services);
    expect(services.command).toHaveBeenCalledWith('openTranslationSettings', undefined);
    expect(services.tool).not.toHaveBeenCalled();
    expect(localActionView('translationSource', null).disabled).toBe(false);
});
it('migrates old translation choices and saves independent subtitle controls in named presets', () => {
    expect(normalizeVisualPreferences({ translation: false })).toMatchObject({ subtitleHidden: true, subtitleContentMode: 'none' });
    expect(normalizeVisualPreferences({ subtitleContentMode: 'bad' })).toMatchObject({ subtitleHidden: false, subtitleContentMode: 'translation' });
    const current = useVisualSettings.getState;
    current().update({ subtitleContentMode: 'both', subtitleHidden: true, subtitleBackground: false, subtitleLayout: 'current+romanization+translation' });
    const id = current().savePreset('Subtitles')!;
    current().reset(); current().applyPreset(id);
    expect(current()).toMatchObject({ translation: true, subtitleContentMode: 'both', subtitleHidden: true, subtitleBackground: false,
        subtitleLayout: 'current+romanization+translation' });
    current().update({ translation: false });
    expect(current()).toMatchObject({ subtitleContentMode: 'none', subtitleHidden: true });
    current().update({ translation: true });
    expect(current()).toMatchObject({ subtitleContentMode: 'translation', subtitleHidden: false });
});
