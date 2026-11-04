import type { VisualPreferences } from './useVisualSettings';
import { captureVisualPreset } from './visualPresetData';

// src/mineradio/local/localVideoExportData.ts
// Export state belongs to the host; the dialog may be closed at any point.
export interface LocalVideoExportState {
    supported: boolean;
    status: 'idle' | 'preparing' | 'recording' | 'paused' | 'saving' | 'saved' | 'cancelled' | 'error';
    progress: number;
    elapsed: number;
    transitionBehavior?: 'continue' | 'save';
    fileName?: string;
    error?: string;
}
export const LOCAL_VIDEO_PRESETS = [
    { width: 1280, height: 720 }, { width: 1920, height: 1080 },
    { width: 720, height: 1280 }, { width: 1080, height: 1920 },
] as const;
export const VIDEO_EXPORT_OPTIONS_KEY = 'mineradio-video-export-options-v1';
export type VideoExportTransitionBehavior = 'continue' | 'save';
export function readVideoExportTransition(storage?: Pick<Storage, 'getItem'>): VideoExportTransitionBehavior {
    try {
        const raw = (storage ?? globalThis.localStorage).getItem(VIDEO_EXPORT_OPTIONS_KEY);
        if (!raw || raw.length > 256) return 'continue';
        const value: unknown = JSON.parse(raw);
        return value && typeof value === 'object' && !Array.isArray(value)
            && (value as { transitionBehavior?: unknown }).transitionBehavior === 'save' ? 'save' : 'continue';
    } catch { return 'continue'; }
}
export function saveVideoExportTransition(transitionBehavior: VideoExportTransitionBehavior, storage?: Pick<Storage, 'setItem'>): void {
    try { (storage ?? globalThis.localStorage).setItem(VIDEO_EXPORT_OPTIONS_KEY, JSON.stringify({ transitionBehavior: transitionBehavior === 'save' ? 'save' : 'continue' })); }
    catch { /* Storage may be unavailable; the current selection still works for this session. */ }
}
export const isLocalVideoExportBusy = (state: LocalVideoExportState) => ['preparing', 'recording', 'paused', 'saving'].includes(state.status);
export function localVideoExportParams(preset: { width: number; height: number }, startMode: 'from-start' | 'current', visuals: VisualPreferences, transitionBehavior: 'continue' | 'save' = 'continue') {
    return { ...preset, startMode, transitionBehavior, visuals: { ...captureVisualPreset(visuals), view: 'lyrics' as const } };
}
export function videoElapsedLabel(elapsed: number) {
    const seconds = Math.floor(Math.max(0, Number.isFinite(elapsed) ? elapsed : 0));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
