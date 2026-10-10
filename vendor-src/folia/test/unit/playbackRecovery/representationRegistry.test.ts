import { beforeEach, describe, expect, it } from 'vitest';
import type { SongResult } from '@/types';
import { clearPlaybackRepresentationsForTests, getPlaybackAnalysisKey, getPlaybackRepresentation, getPlaybackRepresentationForRevision, registerPlaybackRepresentation } from '@/services/playbackRecovery/representationRegistry';

// Ensures analysis invalidates original decode failures when playback adopts a new representation.

const song: SongResult = {
    id: 'local-id',
    name: 'Unsupported track',
    artists: [],
    album: { id: 0, name: '' },
    durationMs: 10_000,
    sourceRef: { kind: 'local', mediaId: 'local-id' },
    playbackSourceRevision: 'size:mtime',
};

describe('playback representation registry', () => {
    beforeEach(clearPlaybackRepresentationsForTests);

    it('keeps the original analysis key until a fallback is registered', () => {
        expect(getPlaybackAnalysisKey(song)).toBe('local:local-id');
        expect(getPlaybackRepresentation(song)).toBeNull();
    });

    it('versions profile and stem keys with the representation id', () => {
        registerPlaybackRepresentation({
            songKey: 'local:local-id',
            sourceRevision: 'size:mtime',
            representationId: 'transcode:abc',
            kind: 'transcoded',
            url: 'folia-transcode://media/key/audio.flac',
            mimeType: 'audio/flac',
            timelineOffsetSec: 0,
        });
        expect(getPlaybackAnalysisKey(song)).toBe('local:local-id@transcode:abc');
        expect(getPlaybackRepresentation(song)?.url).toContain('folia-transcode:');
        expect(getPlaybackRepresentationForRevision('local:local-id', 'size:mtime')).not.toBeNull();
        expect(getPlaybackRepresentationForRevision('local:local-id', 'changed')).toBeNull();
        expect(getPlaybackRepresentationForRevision('local:local-id', 'size:mtime')).toBeNull();
    });

    it('never exposes a stale representation to analysis', () => {
        registerPlaybackRepresentation({
            songKey: 'local:local-id',
            sourceRevision: 'old',
            representationId: 'transcode:old',
            kind: 'transcoded',
            url: 'folia-transcode://media/old/audio.flac',
            mimeType: 'audio/flac',
            timelineOffsetSec: 0,
        });

        expect(getPlaybackRepresentation(song)).toBeNull();
        expect(getPlaybackAnalysisKey(song)).toBe('local:local-id');
    });
});
