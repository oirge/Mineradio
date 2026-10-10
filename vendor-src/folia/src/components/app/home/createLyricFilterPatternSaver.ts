import i18n from '../../../i18n/config';
import { clearCacheByCategory } from '../../../services/db';
import { invalidatePrefetchedLyrics } from '../../../services/prefetchService';
import type { LyricData, StatusMessage } from '../../../types';
import type { LyricStaffAbsorbMode, LyricStaffPolicy } from '../../../utils/lyrics/staffCreditsPolicy';
import { setStatusMessage as setStatusMsg } from '../../../stores/useStatusMessageStore';
import { setCurrentLineIndex } from '../../../stores/usePlaybackStore';

// src/components/app/home/createLyricFilterPatternSaver.ts

export interface LyricFilterSaveDraft {
    pattern: string;
    filterEnabled: boolean;
    staffPolicy: LyricStaffPolicy;
    staffMinDwellSeconds: number;
    staffAbsorbMode: LyricStaffAbsorbMode;
    staffPattern: string;
}

type CreateLyricFilterPatternSaverParams = {
    /** 保存前的逐行过滤正则，用来判断要不要动缓存。 */
    currentEffectivePattern: string;
    handleSetLyricFilterPattern: (pattern: string) => void;
    handleSetLyricFilterEnabled: (enabled: boolean) => void;
    handleSetLyricStaffPolicy: (policy: LyricStaffPolicy) => void;
    handleSetLyricStaffMinDwellSeconds: (seconds: number) => void;
    handleSetLyricStaffAbsorbMode: (mode: LyricStaffAbsorbMode) => void;
    handleSetLyricStaffPattern: (pattern: string) => void;
    loadCurrentSongLyricPreview: () => Promise<LyricData | null>;
    setLyrics: (lyrics: LyricData | null) => void;
};

// Creates the Home-facing lyric filter save action without keeping the implementation in App.tsx.
export const createLyricFilterPatternSaver = ({
    currentEffectivePattern,
    handleSetLyricFilterPattern,
    handleSetLyricFilterEnabled,
    handleSetLyricStaffPolicy,
    handleSetLyricStaffMinDwellSeconds,
    handleSetLyricStaffAbsorbMode,
    handleSetLyricStaffPattern,
    loadCurrentSongLyricPreview,
    setLyrics,
}: CreateLyricFilterPatternSaverParams) => {
    return async (draft: LyricFilterSaveDraft) => {
        handleSetLyricFilterPattern(draft.pattern);
        handleSetLyricFilterEnabled(draft.filterEnabled);
        handleSetLyricStaffPolicy(draft.staffPolicy);
        handleSetLyricStaffMinDwellSeconds(draft.staffMinDwellSeconds);
        handleSetLyricStaffAbsorbMode(draft.staffAbsorbMode);
        handleSetLyricStaffPattern(draft.staffPattern);

        // 逐行过滤会在解析阶段生效并写进缓存，改了就必须重新取。
        // staff 策略只是显示层变换，缓存里的原始歌词依然有效——清掉反而会让离线时
        // 连当前这首都恢复不出来。
        const nextEffectivePattern = draft.filterEnabled ? draft.pattern : '';
        if (nextEffectivePattern !== currentEffectivePattern) {
            await clearCacheByCategory('lyrics');
            invalidatePrefetchedLyrics();
        }

        const previewLyrics = await loadCurrentSongLyricPreview();
        setLyrics(previewLyrics);
        setCurrentLineIndex(-1);
        setStatusMsg({ type: 'success', text: i18n.t('options.lyricFilterUpdated') });
    };
};
