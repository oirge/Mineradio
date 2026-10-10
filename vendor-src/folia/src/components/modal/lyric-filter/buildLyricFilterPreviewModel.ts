import type { Line, LyricData } from '../../../types';
import { compileLyricFilterPattern, getLyricFilterError } from '../../../utils/lyrics/filtering';
import { isInterludeLine } from '../../../utils/lyrics/parserCore';
import { buildLyricStaffPreview } from '../../../utils/lyrics/staffCreditsPolicy';
import type { LyricStaffDecision, LyricStaffPolicyOptions } from '../../../utils/lyrics/staffCreditsPolicy';

// src/components/modal/lyric-filter/buildLyricFilterPreviewModel.ts
// 把两套机制合成一份预览：通用逐行过滤先跑，staff 策略只看它没删掉的行，
// 顺序与 createLyricsSetter 保持一致，预览才不会骗人。

export interface LyricFilterPreviewRow {
    line: Line;
    index: number;
    removedByFilter: boolean;
    isStaff: boolean;
    removedByStaff: boolean;
}

export interface LyricFilterPreviewModel {
    rows: LyricFilterPreviewRow[];
    totalCount: number;
    removedCount: number;
    filterError: string | null;
    staff: LyricStaffDecision;
}

export const buildLyricFilterPreviewModel = (
    lyrics: LyricData | null | undefined,
    filterPattern: string,
    staffOptions: LyricStaffPolicyOptions
): LyricFilterPreviewModel => {
    const baseLines = lyrics ? lyrics.lines.filter(line => !isInterludeLine(line)) : [];
    const filterError = getLyricFilterError(filterPattern);
    const regex = filterError ? null : compileLyricFilterPattern(filterPattern);

    const removedByFilter = baseLines.map(line => Boolean(regex?.test(line.fullText)));
    const survivors = baseLines.filter((_, index) => !removedByFilter[index]);
    const staffPreview = buildLyricStaffPreview(
        lyrics ? { ...lyrics, lines: survivors } : null,
        staffOptions
    );

    let survivorCursor = 0;
    const rows = baseLines.map((line, index) => {
        if (removedByFilter[index]) {
            return { line, index, removedByFilter: true, isStaff: false, removedByStaff: false };
        }

        const staffRow = staffPreview.lines[survivorCursor];
        survivorCursor += 1;

        return {
            line,
            index,
            removedByFilter: false,
            isStaff: Boolean(staffRow?.isStaff),
            removedByStaff: Boolean(staffRow?.removed),
        };
    });

    return {
        rows,
        totalCount: rows.length,
        removedCount: rows.filter(row => row.removedByFilter || row.removedByStaff).length,
        filterError,
        staff: staffPreview.decision,
    };
};
