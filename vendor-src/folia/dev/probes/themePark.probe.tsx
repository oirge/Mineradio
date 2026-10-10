import React, { useState } from 'react';
import ThemePark from '../../src/components/modal/ThemePark';
import { useThemeQuickEditorStore } from '../../src/stores/useThemeQuickEditorStore';
import type { DualTheme } from '../../src/types';
import type { ProbeDefinition } from './definition';
// dev/probes/themePark.probe.tsx

/**
 * Theme Park 的坑都在浏览器里：右栏四个 tab 的挂载、编辑目标（AI / 自定义）切换时草稿是否互不污染、
 * 颜色拖拽的节流写回、以及 wordColors / lyricsIcons 这类新增编辑区的命中与滚动。
 * 探针不加载首页数据，只把编辑器需要的 store 上下文塞进去，再挂真实的可视化预览。
 */

const AI_THEME: DualTheme = {
    light: {
        name: '暮霭破晓',
        description: '推开窗是一整片蓝，我忽然不想去任何地方了。',
        backgroundColor: '#eef2f3',
        primaryColor: '#21353d',
        accentColor: '#2d4fbe',
        secondaryColor: '#435d7d',
        fontStyle: 'sans',
        animationIntensity: 'normal',
        wordColors: [{ word: 'summer', color: '#2d4fbe' }, { word: 'ocean', color: '#0ea5e9' }],
        lyricsIcons: ['Waves', 'Moon'],
        provider: 'AI',
    },
    dark: {
        name: '暮霭子夜',
        description: '深夜的海把所有声音都吞掉了，只剩下呼吸。',
        backgroundColor: '#0f1a1f',
        primaryColor: '#e7edef',
        accentColor: '#5975d1',
        secondaryColor: '#adbfd1',
        fontStyle: 'sans',
        animationIntensity: 'normal',
        wordColors: [{ word: 'summer', color: '#2d4fbe' }, { word: 'ocean', color: '#0ea5e9' }],
        lyricsIcons: ['Waves', 'Moon'],
        provider: 'AI',
    },
};

const CUSTOM_THEME: DualTheme = {
    light: {
        name: 'My Daylight',
        backgroundColor: '#f5f5f4',
        primaryColor: '#1c1917',
        accentColor: '#ea580c',
        secondaryColor: '#44403c',
        fontStyle: 'sans',
        animationIntensity: 'normal',
        wordColors: [],
        lyricsIcons: [],
        provider: 'Custom',
    },
    dark: {
        name: 'My Midnight',
        backgroundColor: '#09090b',
        primaryColor: '#f4f4f5',
        accentColor: '#f4f4f5',
        secondaryColor: '#71717a',
        fontStyle: 'sans',
        animationIntensity: 'normal',
        wordColors: [],
        lyricsIcons: [],
        provider: 'Custom',
    },
};

// The real app fills this context long before the editor can be opened, so the probe seeds it at
// module scope rather than in an effect.
useThemeQuickEditorStore.getState().setContext({
    aiTheme: AI_THEME,
    customTheme: CUSTOM_THEME,
    bgMode: 'ai',
    coverUrl: null,
    song: null,
    songKey: 'probe-song',
    isDaylight: false,
    promptSourceText: 'probe lyrics snippet',
    isPureMusic: false,
    songTitle: 'Probe Song',
});

const ThemeParkProbe: React.FC = () => {
    const [savedTarget, setSavedTarget] = useState<string>('');
    const [savedName, setSavedName] = useState<string>('');

    return (
        <div
            className="min-h-screen bg-zinc-950"
            style={{ ['--text-primary' as string]: '#fafafa', ['--text-secondary' as string]: '#a1a1aa' }}
            data-probe-saved-target={savedTarget}
            data-probe-saved-name={savedName}
        >
            <ThemePark
                initialTheme={CUSTOM_THEME}
                isDaylight={false}
                visualizerMode="classic"
                staticMode
                lyricsFontStyle="sans"
                lyricsFontScale={1}
                onClose={() => undefined}
                onSaveCustomTheme={(dualTheme) => {
                    setSavedTarget('custom');
                    setSavedName(dualTheme.dark.name);
                }}
                onSaveAiTheme={(dualTheme) => {
                    setSavedTarget('ai');
                    setSavedName(dualTheme.dark.name);
                }}
            />
        </div>
    );
};

const definition: ProbeDefinition = {
    id: 'themePark',
    title: 'Theme Park · 完整主题编辑器',
    description: '四个编辑 tab、AI / 自定义目标切换、词语配色与歌词图标编辑，以及实时可视化预览。',
    Component: ThemeParkProbe,
};

export default definition;
