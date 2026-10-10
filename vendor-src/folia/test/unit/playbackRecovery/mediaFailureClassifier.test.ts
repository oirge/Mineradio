import { describe, expect, it } from 'vitest';
import { classifyMediaElementFailure } from '@/services/playbackRecovery/mediaFailureClassifier';

// Locks the narrow browser error boundary that is allowed to start an expensive transcode.

describe('classifyMediaElementFailure', () => {
    it.each([
        [1, 'aborted'],
        [2, 'network'],
    ] as const)('rejects media error code %s as %s', (code, kind) => {
        expect(classifyMediaElementFailure({ code }, 'blob:test')).toEqual({
            code,
            kind,
            eligibleForTranscode: false,
        });
    });

    it.each([
        [3, 'decode'],
        [4, 'unsupported'],
    ] as const)('accepts media error code %s as a candidate', (code, kind) => {
        expect(classifyMediaElementFailure({ code }, 'blob:test')).toEqual({
            code,
            kind,
            eligibleForTranscode: true,
        });
    });

    it('never recursively transcodes a recovered representation', () => {
        expect(classifyMediaElementFailure({ code: 4 }, 'folia-transcode://media/key/audio.flac'))
            .toMatchObject({ eligibleForTranscode: false });
    });

    it('does not infer decode failure without a MediaError code', () => {
        expect(classifyMediaElementFailure(null, 'blob:test')).toEqual({
            code: null,
            kind: 'unknown',
            eligibleForTranscode: false,
        });
    });
});
