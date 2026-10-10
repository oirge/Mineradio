import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import type { Line, LyricData } from '../../../types';
import { findLatestActiveLineIndex } from '../../../utils/appPlaybackHelpers';

// src/components/modal/settings/GlobalLyricOffsetPreview.tsx
// 全局时间偏移校准窗口的实时歌词预览：沿用 LyricPreviewPanel 的逐字渐变高亮做法，
// 但时间源是已应用偏移的歌词时钟，再叠加“草稿偏移 - 已生效偏移”的差值，
// 让用户在点击应用前就能看到调整后的推进位置。高频更新只写 DOM，行切换才进 React state。

type GlobalLyricOffsetPreviewProps = {
    lyrics: LyricData | null;
    lyricCurrentTime: MotionValue<number>;
    /** 相对已生效偏移的草稿增量（毫秒），正值表示歌词更晚出现。 */
    draftDeltaMs: number;
    isDaylight: boolean;
};

type PreviewDisplay = {
    currentLine: Line | null;
    nextLine: Line | null;
};

const EMPTY_DISPLAY: PreviewDisplay = { currentLine: null, nextLine: null };

const clampProgress = (value: number) => Math.max(0, Math.min(100, value));

const buildGradient = (activeColor: string, baseColor: string, progress: number) => (
    `linear-gradient(to right, ${activeColor} ${progress}%, ${baseColor} ${progress}%)`
);

const resolveDisplay = (lyrics: LyricData | null, time: number): PreviewDisplay => {
    if (!lyrics?.lines.length) {
        return EMPTY_DISPLAY;
    }

    const index = findLatestActiveLineIndex(lyrics.lines, time);
    if (index !== -1) {
        return { currentLine: lyrics.lines[index] ?? null, nextLine: lyrics.lines[index + 1] ?? null };
    }

    const upcomingIndex = lyrics.lines.findIndex(line => line.startTime > time);
    return {
        currentLine: null,
        nextLine: upcomingIndex === -1 ? null : lyrics.lines[upcomingIndex] ?? null,
    };
};

const getLineKey = (line: Line | null) => (
    line ? `${line.startTime}-${line.endTime}-${line.fullText}` : 'empty'
);

const GlobalLyricOffsetPreview: React.FC<GlobalLyricOffsetPreviewProps> = ({
    lyrics,
    lyricCurrentTime,
    draftDeltaMs,
    isDaylight,
}) => {
    const { t } = useTranslation();
    const [display, setDisplay] = useState<PreviewDisplay>(EMPTY_DISPLAY);
    const displayRef = useRef(display);
    const wordRefs = useRef<HTMLElement[]>([]);
    const singleLineRef = useRef<HTMLSpanElement | null>(null);
    // 草稿增量放进 ref，change 回调里读最新值，避免每次微调都重建订阅。
    const draftDeltaRef = useRef(draftDeltaMs);
    // 最近一次预览时间：换行后新节点首帧就能按正确进度着色，不闪回未唱状态。
    const previewTimeRef = useRef(0);

    const activeColor = isDaylight ? '#2563eb' : '#60a5fa';
    const mutedColor = isDaylight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.3)';

    const updateProgress = useCallback((time: number) => {
        wordRefs.current.forEach(node => {
            if (!node) return;
            const start = Number.parseFloat(node.getAttribute('data-start') || '0');
            const end = Number.parseFloat(node.getAttribute('data-end') || '0');
            const progress = end > start
                ? clampProgress(((time - start) / (end - start)) * 100)
                : (time >= start ? 100 : 0);
            node.style.backgroundImage = buildGradient(activeColor, mutedColor, progress);
        });

        const singleLine = singleLineRef.current;
        if (singleLine) {
            const start = Number.parseFloat(singleLine.getAttribute('data-start') || '0');
            const end = Number.parseFloat(singleLine.getAttribute('data-end') || '0');
            const progress = end > start
                ? clampProgress(((time - start) / (end - start)) * 100)
                : (time >= start ? 100 : 0);
            singleLine.style.backgroundImage = buildGradient(activeColor, mutedColor, progress);
        }
    }, [activeColor, mutedColor]);

    const applyTime = useCallback((appliedLyricTime: number) => {
        const previewTime = appliedLyricTime - draftDeltaRef.current / 1000;
        previewTimeRef.current = previewTime;
        const nextDisplay = resolveDisplay(lyrics, previewTime);
        if (
            displayRef.current.currentLine !== nextDisplay.currentLine
            || displayRef.current.nextLine !== nextDisplay.nextLine
        ) {
            displayRef.current = nextDisplay;
            setDisplay(nextDisplay);
        }
        updateProgress(previewTime);
    }, [lyrics, updateProgress]);

    useEffect(() => {
        draftDeltaRef.current = draftDeltaMs;
        applyTime(lyricCurrentTime.get());
    }, [applyTime, draftDeltaMs, lyricCurrentTime]);

    useEffect(() => {
        applyTime(lyricCurrentTime.get());
        const unsubscribe = lyricCurrentTime.on('change', applyTime);
        return () => unsubscribe();
    }, [applyTime, lyricCurrentTime]);

    const currentLine = display.currentLine;
    const nextLine = display.nextLine;
    const words = useMemo(() => currentLine?.words ?? [], [currentLine]);
    const subLineText = currentLine?.translation || nextLine?.fullText || '';
    const isTranslation = Boolean(currentLine?.translation);
    const previewBoxBg = isDaylight ? 'bg-black/[0.03] border-black/5' : 'bg-white/[0.04] border-white/10';
    const mutedText = isDaylight ? 'text-zinc-500' : 'text-white/50';

    // 第一个词负责清空上一行残留的节点，逐字模式和整行模式互相排斥，各自持有自己的引用。
    const registerWordRef = useCallback((node: HTMLElement | null, index: number) => {
        if (index === 0) {
            wordRefs.current = [];
        }
        if (node) {
            wordRefs.current[index] = node;
        }
    }, []);

    const registerSingleLineRef = useCallback((node: HTMLSpanElement | null) => {
        wordRefs.current = [];
        singleLineRef.current = node;
    }, []);

    const initialProgress = (startTime: number, endTime: number) => (
        endTime > startTime
            ? clampProgress(((previewTimeRef.current - startTime) / (endTime - startTime)) * 100)
            : (previewTimeRef.current >= startTime ? 100 : 0)
    );

    if (!lyrics?.lines.length) {
        return (
            <div className={`flex min-h-[132px] items-center justify-center rounded-2xl border border-dashed px-4 text-xs ${previewBoxBg} ${mutedText}`}>
                {t('globalLyricOffset.noLyrics')}
            </div>
        );
    }

    return (
        <div className={`flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border px-4 py-5 ${previewBoxBg}`}>
            <div className="flex h-9 w-full items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`line-${getLineKey(currentLine)}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="w-full min-w-0 truncate text-center text-lg font-semibold select-none"
                    >
                        {currentLine ? (
                            words.length > 0 ? (
                                words.map((word, index) => (
                                    <span
                                        key={`${word.startTime}-${word.endTime}-${index}`}
                                        ref={node => registerWordRef(node, index)}
                                        data-start={word.startTime}
                                        data-end={word.endTime}
                                        style={{
                                            backgroundImage: buildGradient(activeColor, mutedColor, initialProgress(word.startTime, word.endTime)),
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            display: 'inline-block',
                                            marginRight: '0.25em',
                                        }}
                                    >
                                        {word.text}
                                    </span>
                                ))
                            ) : (
                                <span
                                    ref={registerSingleLineRef}
                                    data-start={currentLine.startTime}
                                    data-end={currentLine.endTime}
                                    style={{
                                        backgroundImage: buildGradient(activeColor, mutedColor, initialProgress(currentLine.startTime, currentLine.endTime)),
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        display: 'inline-block',
                                    }}
                                >
                                    {currentLine.fullText}
                                </span>
                            )
                        ) : (
                            <span className={`text-sm font-normal ${mutedText}`}>{t('globalLyricOffset.waitingForLine')}</span>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="flex h-5 w-full items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={`sub-${subLineText || 'none'}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15, ease: 'easeOut', delay: 0.04 }}
                        className={`max-w-full truncate text-center text-xs leading-none ${
                            isTranslation
                                ? (isDaylight ? 'text-emerald-600' : 'text-emerald-400/80')
                                : mutedText
                        }`}
                    >
                        {subLineText || ' '}
                    </motion.p>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default GlobalLyricOffsetPreview;
