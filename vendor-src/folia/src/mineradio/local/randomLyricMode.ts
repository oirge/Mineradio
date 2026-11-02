import { BUILTIN_VISUALIZER_MODES, isBuiltinVisualizerMode } from '../../types/visualizerModes';
import type { VisualizerMode } from '../../types';
export function normalizeRandomPool(value: unknown): VisualizerMode[] {
    const pool = Array.isArray(value) ? [...new Set(value.filter(isBuiltinVisualizerMode))] : [];
    return pool.length ? pool : [...BUILTIN_VISUALIZER_MODES];
}
export function randomLyricMode(pool: unknown, current: VisualizerMode, random = Math.random): VisualizerMode {
    const valid = normalizeRandomPool(pool);
    const candidates = valid.length > 1 ? valid.filter(mode => mode !== current) : valid;
    return candidates[Math.min(candidates.length - 1, Math.floor(Math.max(0, random()) * candidates.length))];
}
