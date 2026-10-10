import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// src/components/ponder/PonderNextChapterCue.tsx
// 一章播完后，在右边缘浮出的「下一章」箭头。
//
// 这里原本是一张居中的弹窗卡片。卡片确实把章节结构说清楚了，但它盖住画面、需要被关掉，
// 每看完一章就被打断一次 —— 教程的连贯感是它最值钱的东西。改成贴边的箭头：
// 同样指明还有下一章、同样可点，但不遮挡刚刚演完的那幅画面，不想看就直接无视。
//
// 箭头横向轻微呼吸，方向就是它要去的方向；这条动效走 CSS 类，reduced motion 下自动停。
// 只有图标在动、按钮框不动：会动的点击目标难点中。
//
// 按钮底下还有一条读条：不点它，条走完也会进下一章。指针一碰到这颗按钮就取消 ——
// 把指针移过来的人要么正要点它，要么是想停下来把字幕读完，两种意图都不该被推走。

type PonderNextChapterCueProps = {
    /** 下一章的标题；已经是最后一章时为 null。 */
    nextSceneTitle: string | null;
    onNextScene: () => void;
    /** 读条时长；null 表示这次不自动续播（暂停了，或者已经被取消）。 */
    autoAdvanceMs: number | null;
    onCancelAutoAdvance: () => void;
    theme?: { accentColor?: string };
    isDaylight: boolean;
};

const PonderNextChapterCue: React.FC<PonderNextChapterCueProps> = ({
    nextSceneTitle,
    onNextScene,
    autoAdvanceMs,
    onCancelAutoAdvance,
    theme,
    isDaylight,
}) => {
    const { t } = useTranslation();
    const accent = theme?.accentColor || (isDaylight ? '#27272a' : '#fafafa');
    const muted = isDaylight ? 'rgba(24, 24, 27, 0.55)' : 'rgba(255, 255, 255, 0.55)';
    const surface = isDaylight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(24, 24, 27, 0.9)';
    const border = isDaylight ? 'rgba(24, 24, 27, 0.12)' : 'rgba(255, 255, 255, 0.14)';

    // 最后一章：只留一行静默的提示，不给箭头 —— 没有下一章可去。
    if (!nextSceneTitle) {
        return (
            <div
                data-testid="ponder-chapters-done"
                className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 rounded-full border px-3.5 py-2 text-xs shadow-lg backdrop-blur-sm"
                style={{ backgroundColor: surface, borderColor: border, color: muted }}
            >
                {t('ponder.allChaptersDone')}
            </div>
        );
    }

    return (
        <button
            type="button"
            data-testid="ponder-next-chapter"
            onClick={onNextScene}
            onPointerEnter={onCancelAutoAdvance}
            onFocus={onCancelAutoAdvance}
            aria-label={`${t('ponder.nextChapter')}: ${nextSceneTitle}`}
            className="pointer-events-auto absolute right-6 top-1/2 flex -translate-y-1/2 items-center gap-2.5 overflow-hidden rounded-full border py-2 pl-4 pr-3 text-left shadow-lg backdrop-blur-sm transition-transform hover:scale-[1.03] active:scale-[0.98]"
            style={{ backgroundColor: surface, borderColor: border }}
        >
            {autoAdvanceMs !== null && (
                <span
                    data-testid="ponder-next-chapter-countdown"
                    aria-hidden="true"
                    className="ponder-next-cue-countdown absolute inset-x-0 bottom-0 h-0.5"
                    style={{ backgroundColor: accent, animationDuration: `${autoAdvanceMs}ms` }}
                />
            )}
            <span className="min-w-0 max-w-[12rem]">
                <span className="block text-[10px] leading-tight" style={{ color: muted }}>
                    {autoAdvanceMs !== null ? t('ponder.nextChapterAuto') : t('ponder.nextChapter')}
                </span>
                <span className="block truncate text-xs font-medium" style={{ color: accent }}>
                    {nextSceneTitle}
                </span>
            </span>
            <ChevronRight size={18} className="ponder-next-cue-arrow" style={{ color: accent }} />
        </button>
    );
};

export default PonderNextChapterCue;
