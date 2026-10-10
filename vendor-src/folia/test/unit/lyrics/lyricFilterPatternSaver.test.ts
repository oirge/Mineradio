import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCacheByCategory } from '@/services/db';
import { invalidatePrefetchedLyrics } from '@/services/prefetchService';
import { createLyricFilterPatternSaver } from '@/components/app/home/createLyricFilterPatternSaver';

// test/unit/lyrics/lyricFilterPatternSaver.test.ts

vi.mock('@/services/db', () => ({
    clearCacheByCategory: vi.fn(async () => undefined),
}));

vi.mock('@/services/prefetchService', () => ({
    invalidatePrefetchedLyrics: vi.fn(),
}));

describe('lyric filter pattern saver', () => {
    const clearCacheMock = vi.mocked(clearCacheByCategory);
    const invalidateMock = vi.mocked(invalidatePrefetchedLyrics);

    const build = (currentEffectivePattern: string) => {
        const setLyrics = vi.fn();
        const saver = createLyricFilterPatternSaver({
            currentEffectivePattern,
            handleSetLyricFilterPattern: vi.fn(),
            handleSetLyricFilterEnabled: vi.fn(),
            handleSetLyricStaffPolicy: vi.fn(),
            handleSetLyricStaffMinDwellSeconds: vi.fn(),
            handleSetLyricStaffAbsorbMode: vi.fn(),
            handleSetLyricStaffPattern: vi.fn(),
            loadCurrentSongLyricPreview: vi.fn(async () => null),
            setLyrics,
        });

        return { saver, setLyrics };
    };

    beforeEach(() => {
        clearCacheMock.mockClear();
        invalidateMock.mockClear();
    });

    it('keeps the lyric cache when only the staff settings change', async () => {
        const { saver, setLyrics } = build('^赞助');

        await saver({
            pattern: '^赞助',
            filterEnabled: true,
            staffPolicy: 'hide',
            staffMinDwellSeconds: 2,
            staffAbsorbMode: 'both',
            staffPattern: '',
        });

        expect(clearCacheMock).not.toHaveBeenCalled();
        expect(invalidateMock).not.toHaveBeenCalled();
        // 缓存没动，但当前歌词仍要用新策略重铺一次。
        expect(setLyrics).toHaveBeenCalledTimes(1);
    });

    it('clears the lyric cache when the line filter pattern changes', async () => {
        const { saver } = build('^赞助');

        await saver({
            pattern: '^广告',
            filterEnabled: true,
            staffPolicy: 'smart',
            staffMinDwellSeconds: 1.5,
            staffAbsorbMode: 'off',
            staffPattern: '',
        });

        expect(clearCacheMock).toHaveBeenCalledWith('lyrics');
        expect(invalidateMock).toHaveBeenCalledTimes(1);
    });

    it('keeps the entered pattern while disabling the line filter', async () => {
        const setPattern = vi.fn();
        const setEnabled = vi.fn();
        const saver = createLyricFilterPatternSaver({
            currentEffectivePattern: '^赞助',
            handleSetLyricFilterPattern: setPattern,
            handleSetLyricFilterEnabled: setEnabled,
            handleSetLyricStaffPolicy: vi.fn(),
            handleSetLyricStaffMinDwellSeconds: vi.fn(),
            handleSetLyricStaffAbsorbMode: vi.fn(),
            handleSetLyricStaffPattern: vi.fn(),
            loadCurrentSongLyricPreview: vi.fn(async () => null),
            setLyrics: vi.fn(),
        });

        await saver({
            pattern: '^赞助',
            filterEnabled: false,
            staffPolicy: 'keep',
            staffMinDwellSeconds: 2,
            staffAbsorbMode: 'off',
            staffPattern: '^作词',
        });

        expect(setPattern).toHaveBeenCalledWith('^赞助');
        expect(setEnabled).toHaveBeenCalledWith(false);
    });
});
