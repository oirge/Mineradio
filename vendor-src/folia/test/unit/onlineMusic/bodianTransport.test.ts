import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestBodian } from '@/services/onlineMusic/bodianTransport';

// test/unit/onlineMusic/bodianTransport.test.ts

afterEach(() => vi.unstubAllGlobals());

describe('Bodian page-size adaptation', () => {
    it.each([150, 1000])('bounds the GridView batch of %s while preserving its physical cursor', async limit => {
        const data = { list: [{ id: 1 }], bodianPagination: { nextOffset: 200, hasMore: true } };
        const bodianRequest = vi.fn().mockResolvedValue({ ok: true, data });
        vi.stubGlobal('window', { electron: { bodianRequest } });
        expect(await requestBodian('playlist_tracks', { id: '123', limit, offset: 100, source: 5 })).toEqual(data);
        expect(bodianRequest).toHaveBeenCalledWith('playlist_tracks', { id: '123', limit: 100, offset: 100, source: 5 });
    });
});
