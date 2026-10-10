import { describe, expect, it, vi } from 'vitest';
import type { SongResult } from '@/types';
import type { NavidromeGridViewCollectionDescriptor } from '@/library/core/contracts/collection';
import { createNavidromeCollectionResource } from '@/library/core/services/navidromeCollectionResource';
import { createStaticCollectionResource } from '@/library/core/services/staticCollectionResource';
import { getPlaybackSongKey } from '@/utils/appPlaybackGuards';

// test/unit/library/core/navidromeCollectionResource.test.ts
// Navidrome 资源一次取完、出错当作空集合（与原先一致），同一版本不重复请求，作废的结果不提交。
// 静态资源（本地曲库、探针）直接就绪。

const album = (overrides: Partial<NavidromeGridViewCollectionDescriptor> = {}): NavidromeGridViewCollectionDescriptor => ({
    source: 'navidrome',
    id: 'al-1',
    name: 'Album',
    type: 'album',
    trackCount: 2,
    ...overrides,
});

const song = (id: string): SongResult => ({
    id,
    name: id,
    artists: [],
    album: { id: 0, name: '' },
    durationMs: 1,
    sourceRef: { kind: 'navidrome', mediaId: id },
} as SongResult);

const settle = async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

describe('navidrome collection resource', () => {
    it('loads once per version and reports loading first', async () => {
        const load = vi.fn(async () => [song('a'), song('b')]);
        const resource = createNavidromeCollectionResource('k', load);
        resource.ensure(album(), {});
        expect(resource.getSnapshot().status).toBe('loading');
        resource.ensure(album(), {});
        await settle();

        expect(load).toHaveBeenCalledTimes(1);
        expect(resource.getSnapshot()).toMatchObject({ status: 'ready', kind: 'navidrome' });
        expect(resource.getSnapshot().tracks.map(track => track.id)).toEqual(['a', 'b']);
    });

    it('treats a failed load as an empty, ready collection', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const resource = createNavidromeCollectionResource('k', vi.fn(async () => { throw new Error('down'); }));
        resource.ensure(album(), {});
        await settle();
        expect(resource.getSnapshot()).toMatchObject({ status: 'ready', tracks: [] });
        error.mockRestore();
    });

    it('drops a result that arrives after dispose', async () => {
        let resolve!: (tracks: SongResult[]) => void;
        const resource = createNavidromeCollectionResource('k', () => new Promise(res => { resolve = res; }));
        const listener = vi.fn();
        resource.subscribe(listener);
        resource.ensure(album(), {});
        listener.mockClear();
        resource.dispose();
        resolve([song('late')]);
        await settle();
        expect(listener).not.toHaveBeenCalled();
    });

    it('is never reused, so random songs are drawn again on every open', () => {
        expect(createNavidromeCollectionResource('k', vi.fn(async () => [])).canReuse(album())).toBe(false);
    });
});

describe('static collection resource', () => {
    it('is ready immediately and applies edits in place', async () => {
        const resource = createStaticCollectionResource('local', [song('a'), song('b')]);
        expect(resource.getSnapshot()).toMatchObject({ status: 'ready', kind: 'static' });
        expect(resource.replaceTrackAt(0, getPlaybackSongKey(song('a')), song('c'))).toBe(true);
        await resource.removeTracks(track => track.id === 'b');
        expect(resource.getSnapshot().tracks.map(track => track.id)).toEqual(['c']);
    });
});
