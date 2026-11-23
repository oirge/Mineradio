import { type Line } from '../../../types';

// src/components/visualizer/claddagh/claddaghTimeline.ts
// Claddagh 的字素时间轴：按视觉长度调整逐字时长、按时间插值出小数下标、整行偏移角与播放进度。

/**
 * Checks if a character belongs to the CJK (Chinese, Japanese, Korean) block.
 */
export const isCJKChar = (char: string): boolean => {
    return /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(char);
};

/**
 * Calculates a relative visual length score of a sentence.
 * CJK characters are counted as 1.0, while other half-width characters count as 0.5.
 */
export const getVisualLength = (text: string): number => {
    if (!text) return 0;
    let score = 0;
    for (let i = 0; i < text.length; i++) {
        score += isCJKChar(text[i]) ? 1.0 : 0.5;
    }
    return score;
};

/**
 * Adjusts character timeline specifically for Claddagh visualizer by smoothly
 * distributing time durations over gap/space characters.
 * If word spacing has zero or very small duration, it borrows time safely from neighboring characters.
 */
export const adjustCladdaghTimeline = <T extends { startTime: number; endTime: number; }>(
    timeline: T[],
    line: Line
): T[] => {
    if (timeline.length === 0) return timeline;

    const adjusted = timeline.map(item => ({ ...item }));
    const n = adjusted.length;
    let i = 0;

    while (i < n) {
        if (adjusted[i].startTime === adjusted[i].endTime) {
            let j = i;
            while (j < n && adjusted[j].startTime === adjusted[j].endTime) {
                j++;
            }
            const gapCount = j - i;
            let gapStart = i > 0 ? adjusted[i - 1].endTime : line.startTime;
            let gapEnd = j < n ? adjusted[j].startTime : line.endTime;

            const minNeeded = gapCount * 0.06; // 60ms per character
            let duration = gapEnd - gapStart;

            if (duration < minNeeded) {
                const deficit = minNeeded - duration;
                if (i > 0 && j < n) {
                    const half = deficit / 2;
                    const prevDuration = adjusted[i - 1].endTime - adjusted[i - 1].startTime;
                    const prevSteal = Math.min(half, Math.max(0, prevDuration - 0.04));

                    const nextDuration = adjusted[j].endTime - adjusted[j].startTime;
                    const nextSteal = Math.min(deficit - prevSteal, Math.max(0, nextDuration - 0.04));

                    gapStart -= prevSteal;
                    gapEnd += nextSteal;

                    adjusted[i - 1].endTime = gapStart;
                    adjusted[j].startTime = gapEnd;
                } else if (i > 0) {
                    const prevDuration = adjusted[i - 1].endTime - adjusted[i - 1].startTime;
                    const prevSteal = Math.min(deficit, Math.max(0, prevDuration - 0.04));
                    gapStart -= prevSteal;
                    adjusted[i - 1].endTime = gapStart;
                } else if (j < n) {
                    const nextDuration = adjusted[j].endTime - adjusted[j].startTime;
                    const nextSteal = Math.min(deficit, Math.max(0, nextDuration - 0.04));
                    gapEnd += nextSteal;
                    adjusted[j].startTime = gapEnd;
                }
                duration = gapEnd - gapStart;
            }

            const gapUnit = duration > 0 ? duration / gapCount : 0;
            for (let k = i; k < j; k++) {
                const idxInGap = k - i;
                adjusted[k].startTime = gapStart + gapUnit * idxInGap;
                adjusted[k].endTime = gapStart + gapUnit * (idxInGap + 1);
            }
            i = j;
        } else {
            i++;
        }
    }

    return adjusted;
};


/**
 * Calculates a fractional index corresponding to the current time,
 * interpolating smoothly between grapheme timestamps.
 */
const getFractionalActiveIndex = (
    timeline: Array<{ startTime: number; endTime: number; }>,
    t: number,
    renderEnd?: number
): number => {
    if (timeline.length === 0) return 0;
    if (timeline.length === 1) {
        const item = timeline[0];
        const targetEnd = typeof renderEnd === 'number' && Number.isFinite(renderEnd) ? renderEnd : item.endTime;
        const dur = Math.max(0.2, targetEnd - item.startTime);
        if (t <= item.startTime) return 0;
        return (t - item.startTime) / dur;
    }

    if (t <= timeline[0].startTime) return 0;

    const lastIdx = timeline.length - 1;
    // Allow smooth extrapolation/overshoot past the last character's start time to prevent freezing
    if (t >= timeline[lastIdx].startTime) {
        const lastItem = timeline[lastIdx];

        if (typeof renderEnd === 'number' && Number.isFinite(renderEnd) && renderEnd > lastItem.startTime) {
            const progress = clamp((t - lastItem.startTime) / (renderEnd - lastItem.startTime), 0, 1);
            return lastIdx + progress * 2.0;
        }

        const prevItem = timeline[lastIdx - 1];
        const itemDur = lastItem.endTime - lastItem.startTime;
        const gapDur = lastItem.startTime - prevItem.startTime;
        const stepDur = itemDur > 0 ? itemDur : (gapDur > 0 ? gapDur : 0.5);

        const progress = (t - lastItem.startTime) / stepDur;
        // Limit rotation allowance to 1.8 character units past the last char
        const cappedProgress = Math.min(progress, 1.8);
        return lastIdx + cappedProgress;
    }

    for (let i = 0; i < timeline.length - 1; i++) {
        const tStart = timeline[i].startTime;
        const tEnd = timeline[i + 1].startTime;
        if (t >= tStart && t < tEnd) {
            if (tEnd === tStart) return i;
            return i + (t - tStart) / (tEnd - tStart);
        }
    }
    return timeline.length - 1;
};



export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
export const getLineWordOffset = (
    spacingInfo: Array<{ nominalAngle: number; startTime: number; endTime: number; }>,
    latestTime: number,
    renderEnd?: number
) => {
    if (spacingInfo.length === 0) return 0;
    const fractionalIndex = getFractionalActiveIndex(spacingInfo, latestTime, renderEnd);
    const lastIdx = spacingInfo.length - 1;
    if (fractionalIndex <= lastIdx) {
        const intPart = Math.floor(fractionalIndex);
        const fracPart = fractionalIndex - intPart;
        const angleA = spacingInfo[intPart]?.nominalAngle ?? 0;
        const angleB = spacingInfo[Math.min(intPart + 1, lastIdx)]?.nominalAngle ?? 0;
        return angleA + (angleB - angleA) * fracPart;
    }

    const lastAngle = spacingInfo[lastIdx]?.nominalAngle ?? 0;
    const prevAngle = spacingInfo[Math.max(0, lastIdx - 1)]?.nominalAngle ?? 0;
    const step = lastAngle - prevAngle;
    const overshoot = fractionalIndex - lastIdx;
    return lastAngle + step * overshoot;
};

export const getLinePlaybackProgress = (
    spacingInfo: Array<{ nominalAngle: number; startTime: number; endTime: number; }>,
    latestTime: number,
    renderEnd?: number
) => {
    if (spacingInfo.length === 0) return 0;
    if (spacingInfo.length === 1) {
        const item = spacingInfo[0];
        const targetEnd = typeof renderEnd === 'number' && Number.isFinite(renderEnd) ? renderEnd : item.endTime;
        const duration = Math.max(0.001, targetEnd - item.startTime);
        return clamp((latestTime - item.startTime) / duration, 0, 1);
    }

    const fractionalIndex = getFractionalActiveIndex(spacingInfo, latestTime, renderEnd);
    return clamp(fractionalIndex / Math.max(1, spacingInfo.length - 1), 0, 1);
};

export const shouldHoldCladdaghFrameForPlaybackReset = (
    previousTime: number,
    currentTime: number,
    centerLineIndex: number,
) => centerLineIndex > 0 && currentTime <= 0.5 && currentTime < previousTime - 0.5;
