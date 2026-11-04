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
    frameRate?: VideoExportFrameRate;
    encodingProgress?: number;
    fileName?: string;
    error?: string;
}
export const LOCAL_VIDEO_PRESETS = [
    { width: 1280, height: 720 }, { width: 1920, height: 1080 },
    { width: 720, height: 1280 }, { width: 1080, height: 1920 },
] as const;
export const LOCAL_VIDEO_FRAME_RATES = [30, 60, 90, 120] as const;
export type VideoExportFrameRate = typeof LOCAL_VIDEO_FRAME_RATES[number];
export const VIDEO_EXPORT_OPTIONS_KEY = 'mineradio-video-export-options-v1';
export type VideoExportTransitionBehavior = 'continue' | 'save';
interface VideoExportOptions { transitionBehavior: VideoExportTransitionBehavior; frameRate: VideoExportFrameRate }
function readVideoExportOptions(storage?: Pick<Storage, 'getItem'>): VideoExportOptions {
    const defaults: VideoExportOptions = { transitionBehavior: 'continue', frameRate: 30 };
    try {
        const raw = (storage ?? globalThis.localStorage).getItem(VIDEO_EXPORT_OPTIONS_KEY);
        if (!raw || raw.length > 256) return defaults;
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
        const options = value as { transitionBehavior?: unknown; frameRate?: unknown };
        return { transitionBehavior: options.transitionBehavior === 'save' ? 'save' : 'continue',
            frameRate: LOCAL_VIDEO_FRAME_RATES.includes(options.frameRate as VideoExportFrameRate) ? options.frameRate as VideoExportFrameRate : 30 };
    } catch { return defaults; }
}
export function readVideoExportTransition(storage?: Pick<Storage, 'getItem'>): VideoExportTransitionBehavior {
    return readVideoExportOptions(storage).transitionBehavior;
}
export function readVideoExportFrameRate(storage?: Pick<Storage, 'getItem'>): VideoExportFrameRate {
    return readVideoExportOptions(storage).frameRate;
}
function saveVideoExportOptions(patch: Partial<VideoExportOptions>, storage?: Pick<Storage, 'getItem' | 'setItem'>): void {
    try {
        const target = storage ?? globalThis.localStorage;
        target.setItem(VIDEO_EXPORT_OPTIONS_KEY, JSON.stringify({ ...readVideoExportOptions(target), ...patch }));
    }
    catch { /* Storage may be unavailable; the current selection still works for this session. */ }
}
export function saveVideoExportTransition(transitionBehavior: VideoExportTransitionBehavior, storage?: Pick<Storage, 'getItem' | 'setItem'>): void {
    saveVideoExportOptions({ transitionBehavior: transitionBehavior === 'save' ? 'save' : 'continue' }, storage);
}
export function saveVideoExportFrameRate(frameRate: VideoExportFrameRate, storage?: Pick<Storage, 'getItem' | 'setItem'>): void {
    saveVideoExportOptions({ frameRate: LOCAL_VIDEO_FRAME_RATES.includes(frameRate) ? frameRate : 30 }, storage);
}
export const isLocalVideoExportBusy = (state: LocalVideoExportState) => ['preparing', 'recording', 'paused', 'saving'].includes(state.status);
export function localVideoExportParams(preset: { width: number; height: number }, startMode: 'from-start' | 'current', visuals: VisualPreferences, transitionBehavior: 'continue' | 'save' = 'continue', frameRate: VideoExportFrameRate = 30) {
    return { ...preset, startMode, transitionBehavior, frameRate, visuals: { ...captureVisualPreset(visuals), view: 'lyrics' as const } };
}
export function videoElapsedLabel(elapsed: number) {
    const seconds = Math.floor(Math.max(0, Number.isFinite(elapsed) ? elapsed : 0));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
