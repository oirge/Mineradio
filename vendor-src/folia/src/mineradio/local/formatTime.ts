// src/mineradio/local/formatTime.ts
// Host transport formatting stays dependency-free; appPlaybackHelpers also imports online playback state.
export const formatTime = (time: number) => {
    const seconds = Number.isFinite(time) ? Math.max(0, Math.floor(time)) : 0;
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};
