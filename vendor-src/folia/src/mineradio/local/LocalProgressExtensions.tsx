import type { MotionValue } from 'framer-motion';

// src/mineradio/local/LocalProgressExtensions.tsx
// Preserve the upstream ProgressBar while leaving its optional extension slots empty.
type ProgressContext = {
    currentTime: MotionValue<number>;
    duration: number;
    onSeek: (seconds: number) => void;
    disabled: boolean;
    colors: { fill: string; track: string; text: string };
};
export const useFoliumProgressContext = (context: ProgressContext): ProgressContext => context;
export const FoliumControlButtonSlot = (_props: { slot: string; ctx: ProgressContext; collapsed?: boolean }) => null;
export const FoliumProgressLayers = (_props: { ctx: ProgressContext }) => null;
