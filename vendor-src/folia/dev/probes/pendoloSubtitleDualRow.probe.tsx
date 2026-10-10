import React from 'react';
import { useMotionValue } from 'framer-motion';
import { DEFAULT_THEME } from '../../src/services/baseThemes';
import { getVisualizerRegistryEntry } from '../../src/components/visualizer/registry';
import { DEFAULT_PENDOLO_TUNING, type Line, type SubtitleContentMode } from '../../src/types';
import type { ProbeDefinition } from './definition';

// dev/probes/pendoloSubtitleDualRow.probe.tsx

/**
 * 时计（Pendolo）转盘上的副字幕双行（issue #425 第 2 阶段）：罗马音在上、翻译在下。
 *
 * 挂的是真实的 VisualizerPendolo（经 registry），时间冻结在第 0 行，只用按钮切换第 0 行的数据变体和内容模式。
 * 要看的是：两种都有时焦点行下两行叠放且罗马音在上、第二行字号更小更淡；缺哪种就少哪行；单来源模式保持单行。
 */

const buildLine = (index: number, extra: Partial<Line> = {}): Line => ({
    id: `line-${index}`,
    startTime: index * 4,
    endTime: index * 4 + 3.9,
    fullText: `Line number ${index} of the wheel`,
    words: [{ text: `Line number ${index} of the wheel`, startTime: index * 4, endTime: index * 4 + 3.9 }],
    ...extra,
});

const VARIANTS: Record<string, Partial<Line>> = {
    both: { romanization: 'ohayou gozaimasu', translation: '早上好' },
    romanizationOnly: { romanization: 'ohayou gozaimasu' },
    translationOnly: { translation: '早上好' },
    neither: {},
    placeholder: { romanization: '//', translation: '早上好' },
    same: { romanization: 'good morning', translation: 'good morning' },
};

const MODES: SubtitleContentMode[] = ['translation', 'romanization', 'both', 'none'];

const PendoloSubtitleDualRowProbe: React.FC = () => {
    const [mode, setMode] = React.useState<SubtitleContentMode>('both');
    const [variant, setVariant] = React.useState<keyof typeof VARIANTS>('both');
    const currentTime = useMotionValue(0.5);
    const audioPower = useMotionValue(0);
    const bass = useMotionValue(0);
    const lowMid = useMotionValue(0);
    const mid = useMotionValue(0);
    const vocal = useMotionValue(0);
    const treble = useMotionValue(0);
    const audioBands = React.useMemo(() => ({ bass, lowMid, mid, vocal, treble }), [bass, lowMid, mid, vocal, treble]);
    const lines = React.useMemo(
        () => [0, 1, 2, 3].map(index => buildLine(index, index === 0 ? VARIANTS[variant] : { translation: `译文 ${index}` })),
        [variant],
    );
    const entry = getVisualizerRegistryEntry('pendolo');

    return (
        <div className="fixed inset-0">
            <div className="absolute left-2 top-2 z-50 flex flex-wrap gap-2 text-xs">
                {MODES.map(value => (
                    <button key={value} type="button" data-probe-mode={value} className="rounded border border-white/20 bg-black/60 px-2 py-1 text-white" onClick={() => setMode(value)}>
                        {value}
                    </button>
                ))}
                {Object.keys(VARIANTS).map(value => (
                    <button key={value} type="button" data-probe-line={value} className="rounded border border-white/20 bg-black/60 px-2 py-1 text-white" onClick={() => setVariant(value)}>
                        {value}
                    </button>
                ))}
            </div>
            {entry.render({
                currentTime,
                currentLineIndex: 0,
                lines,
                theme: DEFAULT_THEME,
                audioPower,
                audioBands,
                showText: true,
                paused: true,
                seed: 'pendolo-subtitle-probe',
                pendoloTuning: { ...DEFAULT_PENDOLO_TUNING, showGearDecor: 'none' as const, showCenterGradient: false, showCoverOnWatchFace: false },
                subtitleContentMode: mode,
            } as never)}
        </div>
    );
};

const definition: ProbeDefinition = {
    id: 'pendoloSubtitleDualRow',
    title: '时计副字幕双行（罗马音 + 翻译）',
    description: '时计焦点行下「罗马音 + 翻译」两行叠放、罗马音在上、第二行更小更淡；缺一种数据只显示一行；单来源模式保持单行。',
    Component: PendoloSubtitleDualRowProbe,
};

export default definition;
