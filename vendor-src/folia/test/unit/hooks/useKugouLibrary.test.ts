import { describe, expect, it } from 'vitest';
import { mergeLikedStateMutations, resolveRefreshedLikedState } from '@/hooks/useKugouLibrary';

// test/unit/hooks/useKugouLibrary.test.ts
// 收藏列表读取失败时写回什么。分页改造之后一次刷新要发多次请求，失败不能被写成"没有收藏"。

const fetched = {
    likedSongIds: ['HASH-A', 'HASH-B'],
    likedSongFileIds: { 'HASH-A': 11, 'HASH-B': 22 },
};
const previousState = {
    likedSongIds: ['HASH-OLD'],
    likedSongFileIds: { 'HASH-OLD': 99 },
};

describe('kugou liked state after refresh', () => {
    it('takes the fetched list when the read succeeded', () => {
        const result = resolveRefreshedLikedState(true, fetched, { userId: 'user', state: previousState }, 'user');

        expect(result).toEqual(fetched);
    });

    it('keeps the previous list when the read failed for the same user', () => {
        const result = resolveRefreshedLikedState(
            false,
            { likedSongIds: [], likedSongFileIds: {} },
            { userId: 'user', state: previousState },
            'user',
        );

        expect(result).toEqual(previousState);
    });

    it('drops the previous list when the account changed', () => {
        const result = resolveRefreshedLikedState(
            false,
            { likedSongIds: [], likedSongFileIds: {} },
            { userId: 'other-user', state: previousState },
            'user',
        );

        expect(result).toEqual({ likedSongIds: [], likedSongFileIds: {} });
    });

    it('starts empty when there is nothing cached at all', () => {
        const result = resolveRefreshedLikedState(false, { likedSongIds: [], likedSongFileIds: {} }, null, 'user');

        expect(result).toEqual({ likedSongIds: [], likedSongFileIds: {} });
    });
});

describe('kugou liked state merge during a refresh', () => {
    const refreshed = {
        likedSongIds: ['HASH-A', 'HASH-B'],
        likedSongFileIds: { 'HASH-A': 11, 'HASH-B': 22 },
    };

    it('returns the refreshed list untouched when nothing changed meanwhile', () => {
        expect(mergeLikedStateMutations(refreshed, ['HASH-A', 'HASH-B'], ['HASH-A', 'HASH-B'])).toBe(refreshed);
    });

    it('keeps a song favorited while the refresh was in flight', () => {
        const result = mergeLikedStateMutations(refreshed, ['HASH-A'], ['HASH-A', 'HASH-NEW']);

        expect(result.likedSongIds).toEqual(['HASH-A', 'HASH-B', 'HASH-NEW']);
    });

    it('keeps a song unfavorited while the refresh was in flight', () => {
        const result = mergeLikedStateMutations(refreshed, ['HASH-A', 'HASH-B'], ['HASH-A']);

        expect(result.likedSongIds).toEqual(['HASH-A']);
        expect(result.likedSongFileIds).toEqual({ 'HASH-A': 11 });
    });

    it('drops the row id of every song touched during the refresh', () => {
        const result = mergeLikedStateMutations(
            { likedSongIds: ['HASH-A', 'HASH-B'], likedSongFileIds: { 'HASH-A': 11, 'HASH-B': 22 } },
            ['HASH-A'],
            ['HASH-A', 'HASH-B'],
        );

        expect(result.likedSongIds).toEqual(['HASH-A', 'HASH-B']);
        expect(result.likedSongFileIds).toEqual({ 'HASH-A': 11 });
    });
});
