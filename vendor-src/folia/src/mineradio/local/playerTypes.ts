import type { MotionValue } from 'framer-motion';
import type { AudioBands, Line } from '../../types';
import type { HostState } from '../client';

// src/mineradio/local/playerTypes.ts
// Local playback surface contract; continuous values never enter React state.
export interface LocalPlayer {
    state: HostState | null;
    lines: Line[];
    currentLineIndex: number;
    currentTime: MotionValue<number>;
    audioPower: MotionValue<number>;
    audioBands: AudioBands;
    active: boolean;
    error: string;
    command: <T = any>(method: string, params?: Record<string, unknown>) => Promise<T>;
    clearError: () => void;
}
