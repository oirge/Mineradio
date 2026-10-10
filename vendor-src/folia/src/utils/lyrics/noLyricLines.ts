import type { Line } from '../../types';

// src/utils/lyrics/noLyricLines.ts
// The one "no lyrics" value to hand a visualizer. A fresh `[]` per render reads as new lyric data
// every time the host re-renders (opening a panel, showing the progress bar): a mod visualizer's
// context is rebuilt and the mod is remounted, and memoized renderers recompute. Frozen so an
// accidental push throws instead of leaking lines into every lyric-less song.

export const NO_LYRIC_LINES: Line[] = Object.freeze([]) as unknown as Line[];
