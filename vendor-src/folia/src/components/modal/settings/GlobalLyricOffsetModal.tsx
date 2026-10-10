import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import type { LyricData } from '../../../types';
import GlobalLyricOffsetPreview from './GlobalLyricOffsetPreview';
import GlobalLyricOffsetRuler from './GlobalLyricOffsetRuler';
import { useLyricSettingsStore } from '../../../stores/useLyricSettingsStore';
import { clampGlobalLyricTimelineOffsetMs, GLOBAL_LYRIC_TIMELINE_OFFSET_LIMIT_MS } from '../../../stores/useLyricSettingsStore';

// src/components/modal/settings/GlobalLyricOffsetModal.tsx
// 实验室里的“全局时间偏移”校准窗口：正在播放的歌词按草稿偏移实时推进，
// 用户对着耳机听到的声音微调 1ms / 10ms / 50ms，确认后再应用到设备级设置。

type GlobalLyricOffsetModalProps = {
    isOpen: boolean;
    isDaylight: boolean;
    lyrics: LyricData | null;
    lyricCurrentTime: MotionValue<number>;
    onClose: () => void;
};

const STEPS_MS = [50, 10, 1];

const shellTransition = {
    duration: 0.28,
    ease: [0.22, 1, 0.36, 1] as const,
};

const panelMotion = {
    initial: { y: 24, opacity: 0, scale: 0.985 },
    animate: { y: 0, opacity: 1, scale: 1 },
    exit: { y: 24, opacity: 0, scale: 0.985 },
};

const GlobalLyricOffsetModal: React.FC<GlobalLyricOffsetModalProps> = ({
    isOpen,
    isDaylight,
    lyrics,
    lyricCurrentTime,
    onClose,
}) => {
    const { t } = useTranslation();
    const appliedOffsetMs = useLyricSettingsStore(state => state.globalLyricTimelineOffsetMs);
    const setGlobalOffsetMs = useLyricSettingsStore(state => state.handleSetGlobalLyricTimelineOffsetMs);
    const [draftOffsetMs, setDraftOffsetMs] = useState(appliedOffsetMs);

    useEffect(() => {
        if (isOpen) {
            setDraftOffsetMs(appliedOffsetMs);
        }
    }, [appliedOffsetMs, isOpen]);

    const adjust = (deltaMs: number) => {
        setDraftOffsetMs(previous => clampGlobalLyricTimelineOffsetMs(previous + deltaMs));
    };

    const handleApply = () => {
        setGlobalOffsetMs(draftOffsetMs);
        onClose();
    };

    const glassBg = isDaylight ? 'bg-white/70' : 'bg-black/40';
    const borderColor = isDaylight ? 'border-black/5' : 'border-white/10';
    const overlayBackground = isDaylight ? 'rgba(244, 244, 245, 0.9)' : 'rgba(10, 10, 12, 0.82)';
    const mutedText = isDaylight ? 'text-zinc-500' : 'text-white/50';
    const stepButtonClass = isDaylight
        ? 'border-black/10 bg-black/[0.04] hover:bg-black/[0.08]'
        : 'border-white/10 bg-white/5 hover:bg-white/10';
    const isDirty = draftOffsetMs !== appliedOffsetMs;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={shellTransition}
                    className="fixed inset-0 z-[140] flex items-center justify-center backdrop-blur-xl p-3 sm:p-5"
                    style={{ backgroundColor: overlayBackground }}
                    onClick={onClose}
                >
                    <motion.div
                        {...panelMotion}
                        transition={shellTransition}
                        className={`flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border ${borderColor} ${glassBg} shadow-[0_24px_80px_rgba(0,0,0,0.28)]`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className={`flex items-center justify-between border-b ${borderColor} px-4 py-4 sm:px-6`}>
                            <div className="flex min-w-0 items-center gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors hover:bg-white/10"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <div className="min-w-0">
                                    <div className="truncate text-lg font-semibold sm:text-xl" style={{ color: 'var(--text-primary)' }}>
                                        {t('globalLyricOffset.title')}
                                    </div>
                                    <div className={`mt-1 text-xs ${mutedText}`}>
                                        {t('globalLyricOffset.subtitle')}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={!isDirty}
                                onClick={handleApply}
                                className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/15 disabled:opacity-40"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {t('globalLyricOffset.apply')}
                            </button>
                        </div>

                        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-8">
                            <GlobalLyricOffsetPreview
                                lyrics={lyrics}
                                lyricCurrentTime={lyricCurrentTime}
                                draftDeltaMs={draftOffsetMs - appliedOffsetMs}
                                isDaylight={isDaylight}
                            />

                            <div className={`rounded-2xl border p-5 ${borderColor} ${isDaylight ? 'bg-black/[0.02]' : 'bg-white/[0.03]'}`}>
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className="font-mono text-4xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                                        {draftOffsetMs > 0 ? `+${draftOffsetMs}` : draftOffsetMs}
                                    </span>
                                    <span className={`text-sm ${mutedText}`}>ms</span>
                                </div>
                                <div className={`mt-1 text-center text-xs ${mutedText}`}>
                                    {draftOffsetMs === 0
                                        ? t('globalLyricOffset.neutralHint')
                                        : draftOffsetMs > 0
                                            ? t('globalLyricOffset.laterHint')
                                            : t('globalLyricOffset.earlierHint')}
                                </div>

                                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                                    {STEPS_MS.map(step => (
                                        <button
                                            key={`minus-${step}`}
                                            type="button"
                                            onClick={() => adjust(-step)}
                                            className={`rounded-full border px-3 py-2 font-mono text-xs transition-colors ${stepButtonClass}`}
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            -{step}ms
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setDraftOffsetMs(0)}
                                        disabled={draftOffsetMs === 0}
                                        className={`mx-1 flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:opacity-30 ${stepButtonClass}`}
                                        style={{ color: 'var(--text-primary)' }}
                                        title={t('globalLyricOffset.reset')}
                                    >
                                        <RotateCcw size={14} />
                                    </button>
                                    {[...STEPS_MS].reverse().map(step => (
                                        <button
                                            key={`plus-${step}`}
                                            type="button"
                                            onClick={() => adjust(step)}
                                            className={`rounded-full border px-3 py-2 font-mono text-xs transition-colors ${stepButtonClass}`}
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            +{step}ms
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-5">
                                    <GlobalLyricOffsetRuler
                                        valueMs={draftOffsetMs}
                                        limitMs={GLOBAL_LYRIC_TIMELINE_OFFSET_LIMIT_MS}
                                        isDaylight={isDaylight}
                                        ariaLabel={t('globalLyricOffset.title')}
                                        onChange={(nextMs) => setDraftOffsetMs(clampGlobalLyricTimelineOffsetMs(nextMs))}
                                    />
                                </div>

                                <div className={`mt-3 text-center text-xs ${mutedText}`}>
                                    {isDirty
                                        ? t('globalLyricOffset.pendingApply', { applied: appliedOffsetMs })
                                        : t('globalLyricOffset.description')}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default GlobalLyricOffsetModal;
