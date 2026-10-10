import { describe, expect, it } from 'vitest';
import { buildHomeModel } from '@/components/app/home/buildHomeModel';

// test/unit/onlineMusic/homeProviderIsolation.test.ts

describe('home provider account isolation', () => {
    it('does not display the NetEase account when the selected Bodian account is anonymous', () => {
        const params = {
            user: { id: 'netease-user', nickname: 'NetEase' }, playlists: [{ id: 'netease-list' }],
            activeProvider: { providerId: 'bodian', user: null, collections: [] },
        } as unknown as Parameters<typeof buildHomeModel>[0];
        const home = buildHomeModel(params);
        expect(home.surfaceProps.user).toBeNull();
        expect(home.surfaceProps.playlists).toEqual([]);
    });
});
