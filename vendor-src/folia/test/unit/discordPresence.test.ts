import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// test/unit/discordPresence.test.ts
// Verifies Discord Rich Presence payload mapping without requiring Discord.

const require = createRequire(import.meta.url);
const {
  buildDiscordActivity,
  DEFAULT_DISCORD_APPLICATION_ID,
  normalizeDiscordApplicationId,
  normalizeDiscordImageUrl,
} = require('../../electron/discordPresence.cjs') as {
  buildDiscordActivity: (snapshot: any) => any;
  DEFAULT_DISCORD_APPLICATION_ID: string;
  normalizeDiscordApplicationId: (value: unknown) => string;
  normalizeDiscordImageUrl: (value: unknown) => string;
};

describe('discordPresence', () => {
  it('normalizes Discord application IDs', () => {
    expect(DEFAULT_DISCORD_APPLICATION_ID).toBe('1518508445483925645');
    expect(normalizeDiscordApplicationId(' 123456789012345678 ')).toBe('123456789012345678');
    expect(normalizeDiscordApplicationId('not-a-snowflake')).toBe('');
  });

  it('normalizes externally reachable Discord cover image URLs', () => {
    expect(normalizeDiscordImageUrl(' https://example.com/cover.jpg ')).toBe('https://example.com/cover.jpg');
    expect(normalizeDiscordImageUrl('http://example.com/cover.jpg')).toBe('https://example.com/cover.jpg');
    expect(normalizeDiscordImageUrl('blob:https://example.com/id')).toBe('');
    expect(normalizeDiscordImageUrl('http://127.0.0.1:3000/cover.jpg')).toBe('');
    expect(normalizeDiscordImageUrl('file:///tmp/cover.jpg')).toBe('');
  });

  it('returns null when there is no active track', () => {
    expect(buildDiscordActivity({ hasTrack: false })).toBeNull();
    expect(buildDiscordActivity({ hasTrack: true, title: '' })).toBeNull();
  });

  it('builds a listening activity with progress timestamps while playing', () => {
    const activity = buildDiscordActivity({
      hasTrack: true,
      title: 'Song',
      artist: 'Artist',
      playerState: 'PLAYING',
      currentTime: 30,
      duration: 120,
      updatedAt: 10_000,
      coverUrl: 'https://example.com/cover.jpg',
    });

    expect(activity).toMatchObject({
      name: 'Folia',
      type: 2,
      details: 'Song',
      state: 'Artist',
      largeImageKey: 'https://example.com/cover.jpg',
      largeImageText: 'Song',
      smallImageText: 'Playing',
    });
    expect(activity.startTimestamp).toBe(0);
    expect(activity.endTimestamp).toBe(100_000);
  });

  it('marks paused playback without progress timestamps', () => {
    const activity = buildDiscordActivity({
      hasTrack: true,
      title: 'Song',
      artist: 'Artist',
      playerState: 'PAUSED',
      currentTime: 30,
      duration: 120,
      updatedAt: 10_000,
    });

    expect(activity).toMatchObject({
      details: 'Song',
      state: 'Paused - Artist',
      smallImageText: 'Paused',
    });
    expect(activity.startTimestamp).toBeUndefined();
    expect(activity.endTimestamp).toBeUndefined();
  });
});
