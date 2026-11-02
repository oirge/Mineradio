// @vitest-environment jsdom
import { Blob } from 'node:buffer';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { exportVisualPreset, importVisualPreset, parseVisualPreset, PRESET_FILE_LIMIT } from '../../../src/mineradio/local/visualPresetTransfer';
import { useVisualSettings } from '../../../src/mineradio/local/useVisualSettings';
import { getFromCache, saveToCache, saveVisualAssetLibrary } from '../../../src/mineradio/local/visualAssetCache';

beforeEach(() => {
    vi.stubGlobal('Blob', Blob); vi.stubGlobal('indexedDB', new IDBFactory());
    localStorage.clear(); useVisualSettings.getState().reset();
    useVisualSettings.setState({ presets: [], playlistPresets: {} });
});
afterEach(() => vi.unstubAllGlobals());
const state = () => useVisualSettings.getState();
function saved(name = 'Rain') {
    const id = state().savePreset(name)!;
    return state().presets.find(entry => entry.id === id)!;
}

it('shares a parameter combination without playback or image leases, renaming duplicate imports', async () => {
    state().update({ mode: 'nebbia', view: 'posters', randomPool: ['nebbia', 'machi'], background: { mode: 'sora', transparent: true } });
    const text = await exportVisualPreset(saved(), false);
    const raw = JSON.parse(text);
    expect(raw).not.toHaveProperty('assets'); expect(raw.preset.settings).not.toHaveProperty('view');
    state().update({ mode: 'classic', view: 'records' });
    const id = await importVisualPreset(text);
    expect(state().presets.find(entry => entry.id === id)?.name).toBe('Rain (2)');
    expect(state().mode).toBe('classic');
    state().applyPreset(id);
    expect(state()).toMatchObject({ mode: 'nebbia', view: 'records', randomPool: ['nebbia', 'machi'], background: { mode: 'sora', transparent: true } });
});

it('carries image bytes and atomically replaces included shared categories, preserving unrelated images', async () => {
    const image = { id: 'one', name: 'one.png', mimeType: 'image/png', blob: new Blob([Uint8Array.of(137, 80, 78, 71)], { type: 'image/png' }) };
    await saveToCache('cappella_custom_avatar', [image]);
    const text = await exportVisualPreset(saved(), true);
    await saveToCache('cappella_custom_avatar', []);
    await saveToCache('monet_background_image', { ...image, id: 'keep' });
    await importVisualPreset(text);
    const restored = await getFromCache<typeof image[]>('cappella_custom_avatar');
    expect(restored?.[0].id).not.toBe('one');
    expect(new Uint8Array(await restored![0].blob.arrayBuffer())).toEqual(Uint8Array.of(137, 80, 78, 71));
    expect(await getFromCache('monet_background_image')).toMatchObject({ id: 'keep' });
});

it('rejects invalid file versions, excess size, arbitrary cache keys and damaged base64 before mutation', async () => {
    const text = await exportVisualPreset(saved(), false), raw = JSON.parse(text);
    expect(() => parseVisualPreset('x'.repeat(PRESET_FILE_LIMIT + 1))).toThrow('presetFileInvalid');
    for (const patch of [ { version: 2 }, { format: 'other' }, { preset: { name: '', settings: {} } },
        { assets: { other: [] } }, { assets: { cappella_custom_avatar: [{ name: 'x.png', mimeType: 'image/png', data: '====' }] } } ]) {
        await expect(importVisualPreset(JSON.stringify({ ...raw, ...patch }))).rejects.toThrow('presetFileInvalid');
    }
    expect(state().presets).toHaveLength(1);
});

it('carries referenced Tempera layer images under fresh IDs without overwriting existing placements', async () => {
    const image = { id: 'layer-one', name: 'one.png', mimeType: 'image/png', blob: new Blob(['image'], { type: 'image/png' }) };
    await saveToCache('tempera_layer_image_layer-one', image);
    state().tune('tempera', { layerImages: [{ id: 'layer-one', name: 'one.png', x: 0.4 }] });
    const text = await exportVisualPreset(saved(), true);
    const id = await importVisualPreset(text);
    const layer = state().presets.find(entry => entry.id === id)!.settings.tunings.tempera!.layerImages[0];
    expect(layer).toMatchObject({ name: 'one.png', x: 0.4 }); expect(layer.id).not.toBe('layer-one');
    const restored = await getFromCache<typeof image>('tempera_layer_image_' + layer.id);
    expect(await restored!.blob.text()).toBe('image');
    expect(await getFromCache('tempera_layer_image_layer-one')).toMatchObject({ id: 'layer-one' });
});

it('does not alter images when the preset list is full and removes the reserved preset on failed image writes', async () => {
    const text = await exportVisualPreset(saved(), false);
    for (let index = 1; index < 24; index++) saved(`Item ${index}`);
    await expect(importVisualPreset(text)).rejects.toThrow('presetInvalid');
    expect(state().presets).toHaveLength(24);
    state().deletePreset(state().presets[0].id);
    const raw = JSON.parse(text);
    raw.assets = { cappella_custom_avatar: [{ name: 'x.png', mimeType: 'image/png', data: 'iVBORw==' }] };
    vi.stubGlobal('indexedDB', undefined);
    await expect(importVisualPreset(JSON.stringify(raw))).rejects.toThrow('unavailable');
    expect(state().presets).toHaveLength(23);
});

it('aborts earlier image writes if a later entry cannot be cloned', async () => {
    await saveToCache('monet_background_image', 'original');
    await expect(saveVisualAssetLibrary({ monet_background_image: 'changed', monet_portrait_image: () => {} })).rejects.toThrow();
    expect(await getFromCache('monet_background_image')).toBe('original');
});
