// src/types/videoExport.ts
// Shared video recording presets and status payloads for the Electron player.
export type VideoExportStatus =
    | 'idle'
    | 'preparing'
    | 'countdown'
    | 'recording'
    | 'finalizing'
    | 'done'
    | 'error';

export interface VideoExportPreset {
    id: string;
    label: string;
    width: number;
    height: number;
    orientation: 'landscape' | 'portrait';
}

export interface VideoExportPresetPair {
    width: number;
    height: number;
}

export type VideoExportPresetValues = [VideoExportPresetPair, VideoExportPresetPair, VideoExportPresetPair];

export interface VideoExportState {
    status: VideoExportStatus;
    presetId: string | null;
    progress: number;
    elapsed: number;
    duration: number;
    countdown: number | null;
    filePath: string | null;
    error: string | null;
}

export type VideoExportStartMode = 'from-start' | 'current';

export const DEFAULT_VIDEO_EXPORT_PRESET_VALUES: VideoExportPresetValues = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 1080, height: 1920 },
];
export const VIDEO_EXPORT_PRESET_MIN = 240;
export const VIDEO_EXPORT_PRESET_MAX = 4320;

const VIDEO_EXPORT_PRESET_IDS = [
    'landscape-preset-1',
    'landscape-preset-2',
    'landscape-preset-3',
] as const;

const clampVideoExportPresetValue = (value: number, fallback = 720) => {
    const integerValue = Math.round(value);
    const safeValue = Number.isFinite(integerValue) ? integerValue : fallback;
    const clampedValue = Math.min(VIDEO_EXPORT_PRESET_MAX, Math.max(VIDEO_EXPORT_PRESET_MIN, safeValue));
    return clampedValue % 2 === 0 ? clampedValue : clampedValue + 1;
};

const buildVideoExportPreset = (id: string, width: number, height: number): VideoExportPreset => {
    const safeWidth = clampVideoExportPresetValue(width, 1280);
    const safeHeight = clampVideoExportPresetValue(height, 720);
    const orientation = safeWidth >= safeHeight ? 'landscape' : 'portrait';

    return {
        id,
        label: `${safeWidth} x ${safeHeight}`,
        width: safeWidth,
        height: safeHeight,
        orientation,
    };
};

export const sanitizeVideoExportPresetValues = (values: readonly any[]): VideoExportPresetValues => {
    const fallbackValues = DEFAULT_VIDEO_EXPORT_PRESET_VALUES;

    return VIDEO_EXPORT_PRESET_IDS.map((_, index) => {
        const item = values[index];
        const w = (item && typeof item === 'object') ? Number(item.width) : fallbackValues[index].width;
        const h = (item && typeof item === 'object') ? Number(item.height) : fallbackValues[index].height;
        return {
            width: clampVideoExportPresetValue(w, fallbackValues[index].width),
            height: clampVideoExportPresetValue(h, fallbackValues[index].height),
        };
    }) as VideoExportPresetValues;
};

export const createVideoExportPresets = (values: readonly any[]): VideoExportPreset[] => {
    const safeValues = sanitizeVideoExportPresetValues(values);
    return safeValues.map((pair, index) => buildVideoExportPreset(VIDEO_EXPORT_PRESET_IDS[index], pair.width, pair.height));
};

export const VIDEO_EXPORT_PRESETS: VideoExportPreset[] = createVideoExportPresets(DEFAULT_VIDEO_EXPORT_PRESET_VALUES);

export const DEFAULT_VIDEO_EXPORT_PRESET_ID = 'landscape-preset-2';

export const idleVideoExportState = (): VideoExportState => ({
    status: 'idle',
    presetId: null,
    progress: 0,
    elapsed: 0,
    duration: 0,
    countdown: null,
    filePath: null,
    error: null,
});
