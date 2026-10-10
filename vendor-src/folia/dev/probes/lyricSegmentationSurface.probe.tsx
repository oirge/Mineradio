import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LyricSegmentationSurfaceView from '../../src/components/command-palette/surfaces/LyricSegmentationSurfaceView';
import { parseLyricsByFormat } from '../../src/utils/lyrics/parserCore';
import { createLyricSegmentationRecord, getLyricLineSegmentationKey } from '../../src/utils/lyrics/lyricSegmentationRecord';
import { DEFAULT_THEME } from '../../src/services/baseThemes';
import type { ProbeDefinition } from './definition';
import type { LyricData } from '../../src/types';
import { lyricSegmentationSurface } from '../../src/components/command-palette/surfaces/lyricSegmentationSurface';
import type { CommandSurfaceRenderArgs } from '../../src/components/command-palette/surfaces/types';
// dev/probes/lyricSegmentationSurface.probe.tsx

/**
 * 歌词分词面板，装在一个和命令面板 body 一样的固定高度盒子里。
 *
 * 盯的是「内容再多也不能把盒子撑开」：预览行数跟着歌词走、没有上限，靠 min-h-0 flex-1 从固定
 * 父级分高度。这条只有在真实浏览器里量得出来，整应用的 UI 测试又拿不到已加载的歌词
 * （测试夹具只塞了歌曲，没有歌词），所以放在探针里。
 */
const LINE_COUNT = 60;

const SAMPLE = Array.from({ length: LINE_COUNT }, (_, index) => {
    const minutes = String(Math.floor(index * 3 / 60)).padStart(2, '0');
    const seconds = String(index * 3 % 60).padStart(2, '0');
    return `[${minutes}:${seconds}.00]我想要说的话，你听见了吗`;
}).join('\n');

/** 与命令面板 body 的 h-[min(496px,50vh)] 同形：高度由 CSS 给死，不随内容变。 */
const BODY_HEIGHT_CLASS = 'h-[min(496px,50vh)] overflow-y-auto p-2';

const LyricSegmentationSurfaceProbe: React.FC<{ lyricDelayMs?: number }> = ({ lyricDelayMs = 250 }) => {
    const { t } = useTranslation();
    const parsedLyrics = useMemo(() => parseLyricsByFormat('lrc', SAMPLE), []);
    const [lyrics, setLyrics] = useState<LyricData | null>(null);
    const [query, setQuery] = useState('');
    const [savedCount, setSavedCount] = useState(0);
    const initialRecord = useMemo(() => {
        if (!parsedLyrics) return null;
        const lines: Record<string, string[]> = {};
        parsedLyrics.lines.forEach(line => {
            if (line.fullText) {
                lines[getLyricLineSegmentationKey(line)] = ['我', '想要', '说', '的话', '，', '你', '听见', '了吗'];
            }
        });
        return createLyricSegmentationRecord('local:probe', 'ai', lines);
    }, [parsedLyrics]);
    const [record, setRecord] = useState(initialRecord);
    // Match real lyric loading: the surface first mounts empty, then receives its lyrics later.
    useEffect(() => {
        const timer = window.setTimeout(() => setLyrics(parsedLyrics), lyricDelayMs);
        return () => window.clearTimeout(timer);
    }, [parsedLyrics, lyricDelayMs]);
    // The paste handler only needs setQuery; use the actual surface contract without app setup.
    const inputProps = lyricSegmentationSurface.inputProps?.({ setQuery } as CommandSurfaceRenderArgs);

    return (
        <div className="min-h-screen bg-zinc-950 p-6 text-white">
            <input
                {...inputProps}
                aria-label="Segmentation input"
                value={query}
                onChange={event => setQuery(event.target.value)}
                className="mb-2 w-[42rem] rounded bg-zinc-900 p-2"
            />
            <div data-probe-saved-count={savedCount} data-probe-record={JSON.stringify(record)} />
            <div data-probe-body className={`w-[42rem] rounded-xl bg-zinc-900 ${BODY_HEIGHT_CLASS}`}>
                <LyricSegmentationSurfaceView
                    isDaylight={false}
                    theme={DEFAULT_THEME}
                    t={(key, fallback) => t(key, { defaultValue: fallback ?? key })}
                    lyrics={lyrics}
                    setStatusMsg={() => {}}
                    record={record}
                    isAiAvailable
                    onSave={async (lines, source) => {
                        setRecord(createLyricSegmentationRecord('local:probe', source, lines));
                        setSavedCount(count => count + 1);
                    }}
                    onReset={async () => { setRecord(null); }}
                />
            </div>
        </div>
    );
};

const probe: ProbeDefinition = {
    id: 'lyricSegmentationSurface',
    title: '歌词分词面板',
    description: '固定高度的命令面板 body 里，逐行分词预览不能把盒子撑开',
    Component: LyricSegmentationSurfaceProbe,
};

export default probe;
