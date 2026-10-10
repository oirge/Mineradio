import React from 'react';
import type { LyricData } from '../../../types';
import type { LyricSegmentationRecord } from '../../../types/lyricSegmentation';
import { getLyricLineSegmentationKey } from '../../../utils/lyrics/lyricSegmentationRecord';
import { segmentLyricWords } from '../../../utils/lyrics/wordSegmentation';

// src/components/command-palette/surfaces/LyricSegmentationLineList.tsx
// Read-only preview of how every lyric line is currently split into words, so the effect of an AI
// run or an import is visible before the user leaves the palette. Lines carrying a saved split are
// marked, which is also how a stale record shows itself: it simply stops marking anything.

type LyricSegmentationLineListProps = {
    isDaylight: boolean;
    accentColor: string;
    lyrics: LyricData;
    record: LyricSegmentationRecord | null;
};

const LyricSegmentationLineList: React.FC<LyricSegmentationLineListProps> = ({
    isDaylight,
    accentColor,
    lyrics,
    record,
}) => {
    const chipClass = isDaylight
        ? 'rounded bg-black/[0.06] px-1 py-px'
        : 'rounded bg-white/[0.10] px-1 py-px';

    return (
        <div className="flex flex-col gap-0.5">
            {lyrics.lines.map((line, index) => {
                if (!line.fullText) {
                    return null;
                }

                const isOverridden = Boolean(record?.lines[getLyricLineSegmentationKey(line)]);
                return (
                    <div key={`${line.startTime}-${index}`} className="flex items-start gap-2 px-1">
                        <span
                            className="w-6 shrink-0 pt-px text-right text-[10px] tabular-nums opacity-40"
                            aria-hidden
                        >
                            {index + 1}
                        </span>
                        <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs">
                            {segmentLyricWords(line).map((part, partIndex) => (
                                <span
                                    key={`${part.index}-${partIndex}`}
                                    className={part.isWordLike ? chipClass : 'px-0.5 opacity-50'}
                                    style={part.isWordLike && isOverridden ? { color: accentColor } : undefined}
                                >
                                    {part.segment}
                                </span>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default LyricSegmentationLineList;
