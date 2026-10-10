// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

// Stores read localStorage at import time; see foliumUiRegistries.test.ts.
vi.hoisted(() => {
    const items = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => items.get(key) ?? null,
            setItem: (key: string, value: string) => { items.set(key, String(value)); },
            removeItem: (key: string) => { items.delete(key); },
            clear: () => items.clear(),
            key: (index: number) => Array.from(items.keys())[index] ?? null,
            get length() { return items.size; },
        },
    });
});

// Folium 1.4 lyrics parse in the lyrics worker; run the same parser inline.
vi.mock('@/utils/lyrics/workerClient', async () => {
    const { parseLyricsByFormat } = await import('@/utils/lyrics/parserCore');
    return {
        parseLyricsAsync: vi.fn(async (
            format: Parameters<typeof parseLyricsByFormat>[0],
            content: string,
            translation: string,
            options: Parameters<typeof parseLyricsByFormat>[3],
            romanization: string,
        ) => parseLyricsByFormat(format, content, translation, options, romanization)),
    };
});

import type { SongResult } from '@/types';
import type { ModRuntimeInfo } from '@/mods/types';
import { getOnlineMusicProvider } from '@/services/onlineMusic/providerRegistry';
import { omni } from '@/services/onlineMusic/omni';
import { applyOmniAudioHook, applyOmniLyricsHook } from '@/services/hostExtensionHooks';
import { findPonderTarget } from '@/components/ponder/ponderRegistry';
import i18n from '@/i18n/config';
import { createFoliumExperimental, ponderTargetsRegistry } from '@/mods/folium/experimental';
import { omniProvidersRegistry } from '@/mods/folium/registries/omniProviders';
import { createFoliumClientApi } from '@/mods/folium/api';
import { removeFoliumEventHandlers } from '@/mods/folium/events';

// test/unit/mod-system/foliumExperimental.test.ts
// The opt-in surfaces: a mod Omni provider adapted to the host contract, the
// Omni result hooks, Ponder targets, and the gate that keeps all of them out of
// reach without the manifest opt-in.

const mod = (overrides: Partial<ModRuntimeInfo> = {}): ModRuntimeInfo => ({
    id: 'mod-a', name: 'A', version: '1.0.0', author: null, description: null, permissions: [],
    status: 'loaded', error: null, enabled: true, trustStale: false, signature: { status: 'unsigned', reason: null, keyId: null, keyLabel: null, signedAt: null }, devSource: false, experimental: [], embedOrigins: [],
    folia: null, hasMain: false, clientUrl: null, ...overrides,
});

afterEach(() => {
    omniProvidersRegistry.unregisterAll('mod-a');
    ponderTargetsRegistry.unregisterAll('mod-a');
    removeFoliumEventHandlers('mod-a');
});

describe('omni.providers', () => {
    it('adapts a mod provider to the host contract and removes it again', async () => {
        const handle = omniProvidersRegistry.register('mod-a', {
            id: 'radio',
            displayName: 'Mod Radio',
            search: async (query) => ({ items: [{ id: 's1', title: `${query}!`, artists: ['X', 'Y'] }], hasMore: false }),
            getAudioUrl: async (song) => ({ url: `https://cdn.example/${song.id}.mp3` }),
            getLyrics: async () => ({ lrc: '[00:01.00]hello\n[00:03.00]world' }),
        });
        const provider = getOnlineMusicProvider('folium.mod-a.radio');
        expect(provider?.capabilities).toMatchObject({ search: true, playback: true, lyrics: true, auth: false });

        const page = await provider!.search!.searchSongs('q', 10, 0);
        const song = page.items[0];
        expect(song.sourceRef).toEqual({ kind: 'online', providerId: 'folium.mod-a.radio', mediaId: 's1' });
        expect(song.artists.map((artist) => artist.name)).toEqual(['X', 'Y']);
        expect(page.nextOffset).toBe(1);

        const audio = await provider!.playback!.getAudioSource(song, 'high');
        expect(audio).toMatchObject({ url: 'https://cdn.example/s1.mp3', quality: 'high' });

        const lyrics = await provider!.lyrics!.getLyrics(song);
        expect(lyrics.lyrics?.lines.map((line) => line.fullText)).toEqual(['hello', 'world']);

        handle.unregister();
        expect(getOnlineMusicProvider('folium.mod-a.radio')).toBeNull();
    });

    it('passes Folium 1.4 word-timed lyrics and chorus ranges through Omni', async () => {
        omniProvidersRegistry.register('mod-a', {
            id: 'wbw',
            displayName: 'Word by word',
            search: async () => ({ items: [{ id: 's1', title: 'S', artists: [] }], hasMore: false }),
            getLyrics: async () => ({
                main: { format: 'lrc', text: '[00:01.00]你好\n[00:03.00]世界', translationText: '[00:01.00]hello\n[00:03.00]world' },
                wordByWord: { format: 'yrc', text: '[1000,800](1000,250,0)你(1250,250,0)好\n[3000,800](3000,400,0)世(3400,400,0)界' },
                chorusRanges: [{ startTime: 2.5, endTime: 4 }],
            }),
        });
        const provider = getOnlineMusicProvider('folium.mod-a.wbw');
        expect(provider?.capabilities.wordByWordLyrics).toBe(true);

        const [song] = (await provider!.search!.searchSongs('q', 10, 0)).items;
        const result = await omni.getLyrics(song);
        const lines = result.lyrics!.lines.filter((line) => line.fullText !== '......');

        expect(result.lyrics?.isWordByWord).toBe(true);
        expect(lines.map((line) => [line.fullText, line.translation, Boolean(line.isChorus)])).toEqual([
            ['你好', 'hello', false],
            ['世界', 'world', true],
        ]);
        expect(lines[1].words.map((word) => word.startTime)).toEqual([3, 3.4]);
        expect(result.chorusRanges).toEqual([{ startTime: 2.5, endTime: 4 }]);
    });

    it('refuses a provider with no capability', () => {
        expect(() => omniProvidersRegistry.register('mod-a', { id: 'empty', displayName: 'x' })).toThrow('at least one');
    });
});

describe('omni.hooks', () => {
    const song = { id: 1, name: 'S', artists: [], album: { id: 1, name: '' }, durationMs: 0 } as unknown as SongResult;

    it('passes through while nobody listens and applies handlers once they do', async () => {
        const source = { url: 'https://a.example/x.mp3', fetchedAt: 1, quality: 'high' as const };
        expect(await applyOmniAudioHook(song, source)).toBe(source);

        const experimental = createFoliumExperimental(mod({ experimental: ['omni.hooks'] }));
        (experimental['omni.hooks'] as { on: (type: string, handler: (event: any) => void) => void }).on('audioSourceResolved', (event) => {
            event.url = 'https://b.example/y.mp3';
        });
        (experimental['omni.hooks'] as { on: (type: string, handler: (event: any) => void) => void }).on('lyricsResolved', (event) => {
            event.lines = event.lines.map((line: { fullText: string }) => ({ ...line, fullText: line.fullText.toUpperCase() }));
        });

        expect(await applyOmniAudioHook(song, source)).toMatchObject({ url: 'https://b.example/y.mp3', quality: 'high' });
        const lyrics = await applyOmniLyricsHook(song, {
            lyrics: { lines: [{ words: [], startTime: 0, endTime: 1, fullText: 'hi' }] },
            isPureMusic: false,
        });
        expect(lyrics.lyrics?.lines[0].fullText).toBe('HI');
    });
});

describe('ponder.targets', () => {
    const scene = {
        id: 'intro',
        titleKey: { 'zh-CN': '认识面板', en: 'Meet the panel' },
        action: { kind: 'openUrl', url: 'https://example.com', labelKey: 'Docs: open' },
        anchors: {
            panel: { kind: 'synthetic', rect: { left: 0.1, top: 0.1, width: 0.5, height: 0.5 }, role: 'surface', labelKey: { 'zh-CN': '面板', en: 'Panel' } },
            box: { kind: 'synthetic', rect: { left: 0.2, top: 0.2, width: 0.1, height: 0.1 } },
        },
        steps: [
            { kind: 'caption', textKey: { 'zh-CN': '按 {{mod}} + K 打开', en: 'Press {{mod}} + K to open' }, at: 'bottom', durationMs: 1000 },
            { kind: 'pause', dwellMs: 200 },
        ],
    };

    it('adds a namespaced target whose text reads through t()', () => {
        ponderTargetsRegistry.register('mod-a', {
            id: 'panel',
            titleKey: 'My mod panel. With: punctuation',
            category: 'playback',
            hoverSelector: '[data-folium-entry="mod-a:panel"]',
            scenes: [],
        });
        const target = findPonderTarget('mod-a:panel' as never);
        expect(target).not.toBeNull();
        expect(i18n.t(target!.titleKey)).toBe('My mod panel. With: punctuation');
        ponderTargetsRegistry.unregisterAll('mod-a');
        expect(findPonderTarget('mod-a:panel' as never)).toBeNull();
    });

    it('localizes every text field per language and interpolates {{mod}}', async () => {
        const definition = { id: 'tour', titleKey: { 'zh-CN': '导览', en: 'Tour' }, summaryKey: 'Only one text', category: 'playback', hoverSelector: null, scenes: [scene] };
        const before = JSON.stringify(definition);
        ponderTargetsRegistry.register('mod-a', definition);
        const target = findPonderTarget('mod-a:tour' as never)!;
        const [localized] = target.scenes;
        const caption = localized.steps[0] as { textKey: string };

        await i18n.changeLanguage('zh-CN');
        expect(i18n.t(target.titleKey)).toBe('导览');
        expect(i18n.t(localized.titleKey)).toBe('认识面板');
        expect(i18n.t(localized.anchors.panel.labelKey!)).toBe('面板');
        expect(i18n.t(caption.textKey, { mod: 'Ctrl' })).toBe('按 Ctrl + K 打开');

        await i18n.changeLanguage('en');
        expect(i18n.t(target.titleKey)).toBe('Tour');
        expect(i18n.t(target.summaryKey!)).toBe('Only one text');
        expect(i18n.t(localized.action!.labelKey)).toBe('Docs: open');
        expect(i18n.t(caption.textKey, { mod: '⌘' })).toBe('Press ⌘ + K to open');
        // A language the label does not name falls back like every other mod label.
        await i18n.changeLanguage('in');
        expect(i18n.t(localized.titleKey)).toBe('认识面板');
        await i18n.changeLanguage('en');

        expect(localized.anchors.box.labelKey).toBeUndefined();
        // A mod's panel is drawn as a bare frame unless it names a host skeleton.
        expect(localized.anchors.panel.surfaceKind).toBe('plain');
        expect(localized.anchors.box.surfaceKind).toBeUndefined();
        expect(JSON.stringify(definition)).toBe(before);

        ponderTargetsRegistry.unregisterAll('mod-a');
        expect(i18n.hasResourceBundle('en', 'folium-ponder/mod-a/tour')).toBe(false);
    });

    it('rejects a text field that is neither text nor a label', () => {
        expect(() => ponderTargetsRegistry.register('mod-a', {
            id: 'bad',
            titleKey: 'Fine',
            category: 'playback',
            hoverSelector: null,
            scenes: [{ ...scene, steps: [{ kind: 'caption', textKey: 42, at: 'bottom', durationMs: 1 }] }],
        })).toThrow(/scenes\[0\]\.steps\[0\]\.textKey/);
        expect(findPonderTarget('mod-a:bad' as never)).toBeNull();
    });
});

describe('experimental gate', () => {
    it('keeps undeclared surfaces and omni events out of reach', () => {
        const api = createFoliumClientApi(mod(), {
            context: 'main',
            internals: null,
            experimental: createFoliumExperimental(mod()),
        });
        expect(() => api.experimental['omni.providers']).toThrow('experimental-not-declared:omni.providers');
        expect(() => api.events.on('omni.audioSourceResolved', () => {})).toThrow('experimental-not-declared:omni.hooks');

        const optedIn = mod({ experimental: ['omni.providers'] });
        const allowed = createFoliumClientApi(optedIn, { context: 'main', internals: null, experimental: createFoliumExperimental(optedIn) });
        expect(allowed.experimental['omni.providers']).toHaveProperty('register');
    });
});
