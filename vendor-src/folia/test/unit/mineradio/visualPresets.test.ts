// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useVisualSettings, useVisualSceneSettings } from '../../../src/mineradio/local/useVisualSettings';
import { captureVisualPreset } from '../../../src/mineradio/local/visualPresetData';
import LocalVisualOptions from '../../../src/mineradio/local/LocalVisualOptions';
import LocalVisualPresets from '../../../src/mineradio/local/LocalVisualPresets';

// test/unit/mineradio/visualPresets.test.ts
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }) }));
vi.mock('../../../src/components/visualizer/registry', () => ({
    VISUALIZER_REGISTRY: ['classic', 'partita', 'machi'].map(mode => ({ mode })),
    getVisualizerModeLabel: (mode: string) => mode,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLDivElement;
beforeEach(() => {
    localStorage.clear(); useVisualSettings.getState().reset(); useVisualSettings.setState({ presets: [] });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root?.unmount()); host.remove(); localStorage.clear(); });
const current = () => useVisualSettings.getState();

it('captures a deep combination, applies it without navigating, and preserves presets on reset', async () => {
    current().update({ view: 'posters', mode: 'machi', rhythm: false, randomMode: true, randomPool: ['machi', 'nebbia'],
        background: { mode: 'sora', transparent: true, common: { opacity: 0.42 } }, lyricRenderQuality: { scale: 1.5, antialias: 'off' } });
    current().tune('nebbia', { behind: 'aquarium' });
    const id = current().savePreset('  Rain  ')!;
    expect(id).toBeTruthy(); expect(current().presets[0].name).toBe('Rain');
    const snapshot = current().presets[0].settings;
    current().tune('nebbia', { behind: 'street' });
    current().update({ background: { mode: 'latent', common: { opacity: 0.8 } }, randomPool: ['classic'] });
    expect(snapshot.background.common?.opacity).toBe(0.42);
    expect(snapshot.randomPool).toEqual(['machi', 'nebbia']);
    current().reset(); expect(current().presets).toHaveLength(1);
    current().update({ view: 'records' }); current().applyPreset(id);
    expect(current()).toMatchObject({ view: 'records', mode: 'machi', rhythm: false, randomMode: true,
        lyricRenderQuality: { scale: 1.5, antialias: 'off' }, background: { mode: 'sora', transparent: true } });
    expect(current().tunings.nebbia?.behind).toBe('aquarium');
    expect(current().background).not.toBe(snapshot.background);
    const stored = localStorage.getItem('mineradio-folia-local-visuals-v1')!;
    useVisualSettings.setState({ presets: [] }); localStorage.setItem('mineradio-folia-local-visuals-v1', stored);
    await useVisualSettings.persist.rehydrate();
    expect(current().presets[0].settings).toEqual(snapshot);
});

it('overwrites, renames and deletes explicitly; names and storage are bounded', () => {
    const id = current().savePreset('First')!;
    expect(current().savePreset('first')).toBeNull();
    current().update({ mode: 'nebbia' }); expect(current().savePreset('First', id)).toBe(id);
    expect(current().presets[0].settings.mode).toBe('nebbia');
    expect(current().renamePreset(id, 'New')).toBe(true);
    expect(current().renamePreset(id, ' ')).toBe(false);
    for (let n = 1; n < 24; n++) expect(current().savePreset(`Preset ${n}`)).toBeTruthy();
    expect(current().savePreset('Overflow')).toBeNull();
    current().deletePreset(id); expect(current().presets).toHaveLength(23);
    const next = current().savePreset('x'.repeat(90))!;
    expect(current().presets.find(item => item.id === next)?.name).toHaveLength(48);
});

it('normalizes damaged persisted presets and excludes navigation, actions and image leases', async () => {
    localStorage.setItem('mineradio-folia-local-visuals-v1', JSON.stringify({ state: { presets: [
        null, { id: 'bad', name: '', settings: {} },
        { id: 'valid', name: 'Valid', settings: { mode: 'mod:missing', background: { mode: 'url', url: { items: [] }, customImage: { url: 'blob:old' } },
            randomPool: ['missing'], lyricsFontScale: 300, tunings: { nebbia: { resolution: 1.3 } } } },
        { id: 'valid', name: 'Duplicate ID', settings: {} }, { id: 'other', name: 'valid', settings: {} },
    ] }, version: 0 }));
    await useVisualSettings.persist.rehydrate();
    expect(current().presets).toHaveLength(1);
    const snapshot = current().presets[0].settings;
    expect(snapshot.mode).toBe('classic'); expect(snapshot.background.mode).toBe('latent');
    expect(snapshot.lyricsFontScale).toBe(1.6); expect(snapshot.tunings.nebbia?.render?.scale).toBe(1.5);
    const captured = captureVisualPreset(current());
    expect(captured).not.toHaveProperty('view'); expect(captured).not.toHaveProperty('presets');
    expect(captured).not.toHaveProperty('update'); expect(captured.background).not.toHaveProperty('customImage');
    expect(captured.background).not.toHaveProperty('url');
});

it('commits consecutive pool edits against the current state and disables the final checked option', () => {
    current().update({ randomPool: ['classic', 'partita', 'machi'] });
    act(() => root!.render(React.createElement(LocalVisualOptions, { label: key => key })));
    const box = (mode: string) => host.querySelector<HTMLInputElement>(`[data-mode="${mode}"]`)!;
    act(() => { box('machi').click(); box('partita').click(); });
    expect(current().randomPool).toEqual(['classic']); expect(box('classic').disabled).toBe(true);
    act(() => box('classic').click()); expect(current().randomPool).toEqual(['classic']);
    act(() => box('machi').click()); expect(box('classic').disabled).toBe(false);
    expect(current().randomPool).toEqual(['classic', 'machi']);
    act(() => current().toggleRandomPool('machi', true)); expect(current().randomPool).toEqual(['classic', 'machi']);
});

it('keeps GPU scene subscribers idle during pool edits and preset bookkeeping', () => {
    let renders = 0;
    function Scene() { const value = useVisualSceneSettings(); renders++; return React.createElement('output', null, value.mode); }
    act(() => root!.render(React.createElement(Scene)));
    const baseline = renders;
    act(() => { current().toggleRandomPool('machi', false); current().savePreset('First'); });
    expect(renders).toBe(baseline);
    act(() => current().update({ mode: 'machi' })); expect(renders).toBe(baseline + 1);
});

it('uses the real preset buttons to save, apply, overwrite, rename and delete', () => {
    act(() => root!.render(React.createElement(LocalVisualPresets)));
    const input = host.querySelector<HTMLInputElement>('input')!;
    const click = (label: string) => act(() => [...host.querySelectorAll('button')].find(button => button.textContent === label)!.click());
    const name = (value: string) => act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    name('Night'); click('presetSaveNew'); expect(current().presets).toHaveLength(1);
    act(() => current().update({ mode: 'machi' })); click('presetOverwrite');
    act(() => current().update({ mode: 'classic' })); click('presetApply'); expect(current().mode).toBe('machi');
    name('Rain'); click('presetRename'); expect(current().presets[0].name).toBe('Rain');
    click('presetDelete'); expect(current().presets).toHaveLength(0);
});
