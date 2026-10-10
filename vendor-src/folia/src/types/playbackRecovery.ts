import type { SongResult } from '../types';

// Shared contracts for Electron-only playback transcoding and renderer recovery ownership.

export type PlaybackRepresentationKind = 'original' | 'transcoded';

export interface PlaybackRepresentation {
    songKey: string;
    sourceRevision: string;
    representationId: string;
    kind: PlaybackRepresentationKind;
    url: string;
    mimeType: string;
    timelineOffsetSec: number;
}

export type TranscodeFallbackSource =
    | {
        kind: 'local';
        songKey: string;
        sourceRevision: string;
        fileName: string;
        filePath?: string;
        data?: ArrayBuffer;
    }
    | {
        kind: 'navidrome';
        songKey: string;
        sourceRevision: string;
        url?: string;
        data?: ArrayBuffer;
        fileName?: string;
    };

export interface TranscodeFallbackRequest {
    requestId: string;
    priority: 'playback' | 'warm';
    source: TranscodeFallbackSource;
    /** Shared media-cache ceiling. Zero means no ceiling. */
    limitBytes?: number;
}

export interface TranscodeFallbackResult {
    ok: boolean;
    representation?: PlaybackRepresentation;
    errorCode?: string;
    message?: string;
}

export type PlaybackRecoveryDeckRole = 'active' | 'warm' | 'tail';

export interface PlaybackRecoveryTarget {
    deck: 'A' | 'B';
    role: PlaybackRecoveryDeckRole;
    song: SongResult | null;
    source: string | null;
}
