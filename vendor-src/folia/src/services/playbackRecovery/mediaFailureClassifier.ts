export type MediaFailureKind = 'aborted' | 'network' | 'decode' | 'unsupported' | 'unknown';

// Classifies only the browser media-element signal; input validation remains a main-process job.

export interface MediaFailureClassification {
    kind: MediaFailureKind;
    eligibleForTranscode: boolean;
    code: number | null;
}

const MEDIA_ERR_ABORTED = 1;
const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

export const classifyMediaElementFailure = (
    error: Pick<MediaError, 'code'> | null | undefined,
    source: string | null | undefined,
): MediaFailureClassification => {
    const code = typeof error?.code === 'number' ? error.code : null;
    if (code === MEDIA_ERR_ABORTED) return { kind: 'aborted', eligibleForTranscode: false, code };
    if (code === MEDIA_ERR_NETWORK) return { kind: 'network', eligibleForTranscode: false, code };
    if (code === MEDIA_ERR_DECODE) return { kind: 'decode', eligibleForTranscode: true, code };
    if (code === MEDIA_ERR_SRC_NOT_SUPPORTED) {
        const isRecoveredOutput = typeof source === 'string' && source.startsWith('folia-transcode:');
        return { kind: 'unsupported', eligibleForTranscode: !isRecoveredOutput, code };
    }
    return { kind: 'unknown', eligibleForTranscode: false, code };
};
