import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OnlineMusicProvider, ProviderCapabilities } from '@/types/onlineMusic';
import {
    canPlayOnlineMusicSong,
    getOnlineMusicProvider,
    getOnlineMusicProviderRegistryVersion,
    providerSupports,
    registerOnlineMusicProvider,
    requireOnlineMusicProvider,
    subscribeOnlineMusicProviderRegistry,
    unregisterOnlineMusicProvider,
} from '@/services/onlineMusic/providerRegistry';
import { OnlineProviderError } from '@/types/onlineMusic';
import { getSongResourceCacheKey } from '@/services/onlineMusic/resourceKeys';
import { getSongAvailability, getSongReplacement, isSongUnavailable } from '@/services/onlineMusic/songAvailability';
import { getPlaybackSongKey, normalizePlaybackSongSource } from '@/utils/appPlaybackGuards';

// test/unit/onlineMusic/providerRegistry.test.ts

const capabilities = (patch: Partial<ProviderCapabilities> = {}): ProviderCapabilities => ({
    search: false,
    playback: false,
    lyrics: false,
    auth: false,
    userLibrary: false,
    playlists: false,
    albums: false,
    artists: false,
    recommendations: false,
    mutations: false,
    wordByWordLyrics: false,
    ...patch,
});

const partialProvider: OnlineMusicProvider = {
    id: 'partial-test',
    displayName: 'Partial Test',
    capabilities: capabilities({ search: true }),
    normalizeSong: raw => ({
        id: String((raw as { id?: string }).id || ''),
        name: 'Partial',
        artists: [],
        album: { id: '', name: '' },
        durationMs: 0,
        sourceRef: { kind: 'online', providerId: 'partial-test', mediaId: String((raw as { id?: string }).id || '') },
    }),
    search: {
        async searchSongs() { return { items: [], hasMore: false, nextOffset: 0 }; },
    },
};

const availabilitySong = (blocked = false) => ({
    id: blocked ? 'blocked' : 'replacement',
    name: blocked ? 'Blocked' : 'Replacement',
    artists: [],
    album: { id: '', name: '' },
    durationMs: 1000,
    sourceRef: {
        kind: 'online' as const,
        providerId: 'availability-test',
        mediaId: blocked ? 'blocked' : 'replacement',
        providerData: { blocked },
    },
});

const availabilityProvider: OnlineMusicProvider = {
    id: 'availability-test',
    displayName: 'Availability Test',
    capabilities: capabilities({ playback: true }),
    normalizeSong: () => availabilitySong(),
    playback: {
        async getSongDetail() { return availabilitySong(); },
        async getAudioSource() { return null; },
        getAvailability(song) {
            return song.sourceRef?.kind === 'online' && song.sourceRef.providerData?.blocked === true
                ? { state: 'unavailable', label: 'Blocked by provider' }
                : { state: 'playable' };
        },
        async getReplacement() {
            return { song: availabilitySong(), label: 'Provider replacement' };
        },
    },
};

afterEach(() => {
    unregisterOnlineMusicProvider('partial-test');
    unregisterOnlineMusicProvider('availability-test');
});

describe('online music provider registry', () => {
    it('accepts providers that implement only declared capabilities', () => {
        registerOnlineMusicProvider(partialProvider);
        expect(getOnlineMusicProvider('partial-test')).toBe(partialProvider);
        expect(providerSupports(partialProvider, 'search')).toBe(true);
        expect(providerSupports(partialProvider, 'playback')).toBe(false);
        expect(canPlayOnlineMusicSong(partialProvider.normalizeSong({ id: 'HASH' }))).toBe(false);
    });

    it('announces registrations and removals to subscribers until they unsubscribe', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeOnlineMusicProviderRegistry(listener);
        const before = getOnlineMusicProviderRegistryVersion();

        registerOnlineMusicProvider(partialProvider);
        unregisterOnlineMusicProvider('partial-test');
        expect(getOnlineMusicProviderRegistryVersion()).toBe(before + 2);
        expect(listener).toHaveBeenCalledTimes(2);

        // Removing an id that is not registered changes nothing, so nobody is told.
        unregisterOnlineMusicProvider('partial-test');
        expect(getOnlineMusicProviderRegistryVersion()).toBe(before + 2);
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        registerOnlineMusicProvider(partialProvider);
        expect(getOnlineMusicProviderRegistryVersion()).toBe(before + 3);
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('uses a standardized unavailable error for an unregistered provider', () => {
        expect(() => requireOnlineMusicProvider('missing-test')).toThrow(OnlineProviderError);
        try {
            requireOnlineMusicProvider('missing-test');
        } catch (error) {
            expect(error).toMatchObject({ code: 'unavailable', providerId: 'missing-test' });
        }
    });

    it('keeps source-aware keys distinct and migrates legacy online songs to NetEase', () => {
        const kugouSong = partialProvider.normalizeSong({ id: 'ABC123' });
        const legacySong = normalizePlaybackSongSource({
            id: 123,
            name: 'Legacy',
            artists: [],
            album: { id: 1, name: 'Album' },
            durationMs: 1000,
        });
        expect(getPlaybackSongKey(kugouSong)).toBe('online:partial-test:ABC123');
        expect(getPlaybackSongKey(legacySong)).toBe('online:netease:123');
        expect(getSongResourceCacheKey('audio', kugouSong)).toBe('audio_online:partial-test:ABC123');

        const canonicalKugouSong = {
            ...kugouSong,
            sourceRef: { ...kugouSong.sourceRef, providerId: 'kugou' },
        };
        expect(getSongResourceCacheKey('cover', canonicalKugouSong)).toBe('cover_v2_online:kugou:ABC123');
        expect(getSongResourceCacheKey('audio', canonicalKugouSong)).toBe('audio_online:kugou:ABC123');
    });

    it('preserves the cloud variant when migrating legacy NetEase cloud songs', () => {
        const sourceTypeCloudSong = normalizePlaybackSongSource({
            id: 456,
            name: 'Cloud by source type',
            artists: [],
            album: { id: 1, name: 'Album' },
            durationMs: 1000,
            sourceType: 'cloud',
        });
        const legacyTypeCloudSong = normalizePlaybackSongSource({
            id: 789,
            name: 'Cloud by legacy type',
            artists: [],
            album: { id: 1, name: 'Album' },
            durationMs: 1000,
            t: 2,
        });

        expect(sourceTypeCloudSong.sourceRef).toEqual({
            kind: 'online',
            providerId: 'netease',
            mediaId: '456',
            variant: 'cloud',
        });
        expect(legacyTypeCloudSong.sourceRef).toEqual({
            kind: 'online',
            providerId: 'netease',
            mediaId: '789',
            variant: 'cloud',
        });
    });

    it('resolves availability and replacements through the owning provider', async () => {
        registerOnlineMusicProvider(availabilityProvider);
        const blockedSong = availabilitySong(true);

        expect(getSongAvailability(blockedSong)).toEqual({
            state: 'unavailable',
            label: 'Blocked by provider',
        });
        expect(isSongUnavailable(blockedSong)).toBe(true);
        await expect(getSongReplacement(blockedSong)).resolves.toMatchObject({
            label: 'Provider replacement',
            song: { sourceRef: { providerId: 'availability-test', mediaId: 'replacement' } },
        });
    });
});
