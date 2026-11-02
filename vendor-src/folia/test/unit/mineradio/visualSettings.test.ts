// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useVisualSettings, restoredTunings } from '../../../src/mineradio/local/useVisualSettings';
import { LyricRenderQualityPinContext } from '../../../src/components/visualizer/renderQuality/lyricRenderQualityPin';
import { useLyricRenderQuality } from '../../../src/components/visualizer/renderQuality/useLyricRenderQuality';
import { DEFAULT_LYRIC_RENDER_QUALITY } from '../../../src/utils/lyricRenderQuality';
import { MACHI_QUALITY_REVISION } from '../../../src/components/visualizer/machi/types';

// test/unit/mineradio/visualSettings.test.ts
const STORAGE_KEY = 'mineradio-folia-local-visuals-v1';
let root: Root | null = null;
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;

beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    useVisualSettings.getState().reset();
});
afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    useVisualSettings.getState().reset();
    localStorage.clear();
    document.body.replaceChildren();
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

describe('embedded visual preference migration', () => {
    it('restores an old preference bundle without losing playback view or effect choices', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: {
            view: 'posters', mode: 'nebbia', daylight: true, lyricsFontScale: 1.25, translation: false,
            randomMode: true, randomPool: ['nebbia', 'machi'], subtitleLayout: 'current+translation', harmony: false,
            tunings: {
                nebbia: { resolution: 1.3, behind: 'aquarium', scenery: [], rain: 'off', strokeWidth: 0.12 },
                machi: { quality: { renderScale: 1, antialias: 'smaa', shadows: 'low', reflections: 'off', glow: false } },
                sonnet: { audioResponse: 1.4 },
            },
        }, version: 0 }));
        await useVisualSettings.persist.rehydrate();
        const state = useVisualSettings.getState();
        expect(state).toMatchObject({
            view: 'posters', mode: 'nebbia', daylight: true, lyricsFontScale: 1.25, translation: false,
            randomMode: true, randomPool: ['nebbia', 'machi'], subtitleLayout: 'current+translation', harmony: false,
            lyricRenderQuality: DEFAULT_LYRIC_RENDER_QUALITY,
        });
        expect(state.tunings.nebbia).toMatchObject({
            render: { scale: 1.5, antialias: 'global' }, behind: 'aquarium', glass: 'dew',
            scenery: [], rain: 'off', strokeWidth: 0.12,
        });
        expect(state.tunings.machi?.quality).toMatchObject({
            renderScale: 'global', antialias: 'global', revision: MACHI_QUALITY_REVISION,
            shadows: 'low', reflections: 'off', glow: false,
        });
        expect(state.tunings.sonnet).toMatchObject({ audioResponse: 1.4, render: { scale: 'global', antialias: 'global' } });
    });

    it('preserves explicit new quality overrides across persistence and reset', async () => {
        const state = useVisualSettings.getState();
        state.update({ lyricRenderQuality: { scale: 2, antialias: 'off' } });
        state.tune('nebbia', { render: { scale: 0.75, antialias: 'on' } });
        state.tune('machi', { quality: { renderScale: 1, antialias: 'smaa', revision: MACHI_QUALITY_REVISION } });
        const saved = localStorage.getItem(STORAGE_KEY)!;
        state.reset();
        localStorage.setItem(STORAGE_KEY, saved);
        await useVisualSettings.persist.rehydrate();
        expect(useVisualSettings.getState().lyricRenderQuality).toEqual({ scale: 2, antialias: 'off' });
        expect(useVisualSettings.getState().tunings.nebbia?.render).toEqual({ scale: 0.75, antialias: 'on' });
        expect(useVisualSettings.getState().tunings.machi?.quality).toMatchObject({ renderScale: 1, antialias: 'smaa' });
        useVisualSettings.getState().reset();
        expect(useVisualSettings.getState().lyricRenderQuality).toEqual(DEFAULT_LYRIC_RENDER_QUALITY);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.lyricRenderQuality).toEqual(DEFAULT_LYRIC_RENDER_QUALITY);
    });

    it('does not let default injection hide legacy quality fields', () => {
        const old = restoredTunings({ nebbia: { resolution: 1 }, machi: { quality: { renderScale: 0.5, antialias: 'off' } } });
        expect(old.nebbia?.render).toEqual({ scale: 'global', antialias: 'global' });
        expect(old.machi?.quality).toMatchObject({ renderScale: 0.5, antialias: 'off' });
        const explicit = restoredTunings({ nebbia: { resolution: 2, render: { scale: 'global', antialias: 'off' } } });
        expect(explicit.nebbia?.render).toEqual({ scale: 'global', antialias: 'off' });
    });

    it('normalizes invalid global settings field by field', () => {
        useVisualSettings.getState().update({ lyricRenderQuality: { scale: 99, antialias: 'on' } as never });
        expect(useVisualSettings.getState().lyricRenderQuality).toEqual({ scale: 1, antialias: 'on' });
        expect(restoredTunings(null).nebbia?.glass).toBe('rain');
    });
});

function QualityProbe() {
    const render = useVisualSettings(state => state.tunings.sonnet?.render);
    const quality = useLyricRenderQuality(render);
    return createElement('output', null, `${quality.scale}:${quality.antialias}`);
}

describe('real embedded render quality hook', () => {
    it('reacts to the local global setting, per-effect overrides and pinned rendering', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        act(() => root!.render(createElement(QualityProbe)));
        expect(host.textContent).toBe('1:auto');
        act(() => useVisualSettings.getState().update({ lyricRenderQuality: { scale: 2, antialias: 'auto' } }));
        expect(host.textContent).toBe('2:auto');
        act(() => useVisualSettings.getState().tune('sonnet', { render: { scale: 'global', antialias: 'off' } }));
        expect(host.textContent).toBe('2:off');
        act(() => root!.render(createElement(LyricRenderQualityPinContext.Provider,
            { value: DEFAULT_LYRIC_RENDER_QUALITY }, createElement(QualityProbe))));
        expect(host.textContent).toBe('1:auto');
        act(() => useVisualSettings.getState().update({ lyricRenderQuality: { scale: 0.5, antialias: 'off' } }));
        expect(host.textContent).toBe('1:auto');
    });
});
