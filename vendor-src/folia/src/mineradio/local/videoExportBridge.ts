import type { HostAnalysis, HostAudio, HostLyrics, HostState } from '../client';
import type { VisualPreferences } from './useVisualSettings';
import type { VideoExportFrameRate } from './localVideoExportData';

// src/mineradio/local/videoExportBridge.ts
// The isolated export preload can only deliver display data and acknowledge readiness.
export interface VideoExportInitial {
    id: string; width: number; height: number; frameRate: VideoExportFrameRate; visuals: VisualPreferences;
    state: HostState; lyrics: HostLyrics; analysis: HostAnalysis;
}
export interface VideoExportUpdate { id: string; state: HostState; audio?: HostAudio; analysis?: HostAnalysis; lyrics?: HostLyrics }
export interface VideoExportFinalize { id: string; size: number; width: number; height: number; frameRate: VideoExportFrameRate }
export interface VideoExportBridge {
    getInitial: () => Promise<VideoExportInitial>;
    onUpdate: (callback: (value: VideoExportUpdate) => void) => () => void;
    ready: () => Promise<void>;
    onFinalize: (callback: (value: VideoExportFinalize) => void) => () => void;
    readRecording: (value: { id: string; position: number; length: number }) => Promise<Uint8Array>;
    writeFinalized: (value: { id: string; position: number; sequence: number; bytes: Uint8Array }) => Promise<void>;
    finalized: (id: string) => Promise<void>;
    encodingProgress: (id: string, progress: number) => void;
    failed: (message: string) => void;
}
export const videoExportBridge = () => (window as Window & { mineradioVideoExport?: VideoExportBridge }).mineradioVideoExport;
