import React from 'react';
import { motionValue } from 'framer-motion';
import MonetLyricsRail from '../../src/components/visualizer/monet/MonetLyricsRail';
import { buildMonetVisibleLineEntries } from '../../src/components/visualizer/monet/monetLyricsModel';
import { DEFAULT_THEME } from '../../src/services/baseThemes';
import type { Line, SubtitleContentMode } from '../../src/types';
import type { ProbeDefinition } from './definition';
// dev/probes/monetSubtitleDualRow.probe.tsx

/**
 * Monet 歌词轨的副字幕双行（issue #425 第 2 阶段）：罗马音在上、翻译在下。
 *
 * 挂的是真实的 MonetLyricsRail，当前行固定在第 2 行，按钮切换副字幕模式和当前行携带的数据。
 * 要看的是：两种都有时两行叠放、第二行字号更小；只有一种时只剩一行；两种都没有时不渲染副字幕；
 * 每一行各自最多两行，超出被截断。
 */

const ACTIVE_VARIANTS: Record<string, Pick<Line, 'romanization' | 'translation'>> = {
    both: { romanization: 'ohayou gozaimasu', translation: '早安' },
    romanizationOnly: { romanization: 'ohayou gozaimasu' },
    translationOnly: { translation: '早安' },
    neither: {},
    long: {
        romanization: 'ohayou gozaimasu '.repeat(24).trim(),
        translation: '早安，今天也请多多关照。'.repeat(24),
    },
};

const MODES: SubtitleContentMode[] = ['translation', 'romanization', 'both', 'none'];

const buildLines = (variant: string): Line[] => [
    { startTime: 0, endTime: 2, fullText: 'before', words: [] },
    { startTime: 2, endTime: 4, fullText: 'おはようございます', ...ACTIVE_VARIANTS[variant], words: [] },
    { startTime: 4, endTime: 6, fullText: 'after', words: [] },
];

const MonetSubtitleDualRowProbe: React.FC = () => {
    const [mode, setMode] = React.useState<SubtitleContentMode>('both');
    const [variant, setVariant] = React.useState<string>('both');
    // 播放时间固定在当前行内，不推进：这里只看静态布局。
    const currentTime = React.useMemo(() => motionValue(3), []);
    const lines = React.useMemo(() => buildLines(variant), [variant]);
    const entries = React.useMemo(() => buildMonetVisibleLineEntries({
        lines,
        currentLineIndex: 1,
        activeLine: lines[1],
        recentCompletedLine: lines[0],
        upcomingLine: lines[2],
        currentTime: 3,
        before: 1,
        after: 1,
    }), [lines]);

    return (
        <div className="min-h-screen p-8 text-zinc-200" style={{ background: DEFAULT_THEME.backgroundColor }}>
            <div className="flex flex-wrap gap-2 text-xs">
                {MODES.map(value => (
                    <button
                        key={value}
                        type="button"
                        data-probe-mode={value}
                        className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5"
                        onClick={() => setMode(value)}
                    >
                        {value}
                    </button>
                ))}
                {Object.keys(ACTIVE_VARIANTS).map(value => (
                    <button
                        key={value}
                        type="button"
                        data-probe-line={value}
                        className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5"
                        onClick={() => setVariant(value)}
                    >
                        {value}
                    </button>
                ))}
            </div>
            <div className="mt-6 w-full max-w-[780px]">
                <MonetLyricsRail
                    entries={entries}
                    lines={lines}
                    currentLineIndex={1}
                    currentTime={currentTime}
                    theme={DEFAULT_THEME}
                    lyricFontPx={36}
                    inactiveFontPx={28}
                    translationFontPx={20}
                    fontStack="sans-serif"
                    keywordColoringEnabled={false}
                    emptyText=""
                    subtitleContentMode={mode}
                />
            </div>
        </div>
    );
};

const definition: ProbeDefinition = {
    id: 'monetSubtitleDualRow',
    title: 'Monet 副字幕双行（罗马音 + 翻译）',
    description: '「罗马音 + 翻译」模式下当前歌词下方两行叠放、罗马音在上、第二行更小；只有一种数据时只显示一行；每行各自最多两行。',
    Component: MonetSubtitleDualRowProbe,
};

export default definition;
