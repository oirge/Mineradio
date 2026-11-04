import { createLocalActiveLineLookup, localLyricLines } from './localPlayerData';
import type { VideoExportInitial, VideoExportUpdate } from './videoExportBridge';

// src/mineradio/local/videoExportTimeline.ts
// Continuous recordings replace track-scoped lyrics without accepting late responses for an old song.
export function createVideoExportTimeline(initial: VideoExportInitial) {
    let state = initial.state;
    let lyrics = initial.lyrics.trackId === state.currentTrack?.id ? initial.lyrics : { trackId: state.currentTrack?.id ?? null, lines: [] };
    let lines = localLyricLines(lyrics, state.duration);
    let lookup = createLocalActiveLineLookup(lines);
    return {
        get state() { return state; },
        get lines() { return lines; },
        at: (time: number) => lookup(time),
        apply(value: VideoExportUpdate) {
            if (value.id !== initial.id) return { accepted: false, trackChanged: false, lyricsChanged: false };
            const trackChanged = value.state.currentTrack?.id !== state.currentTrack?.id;
            const durationChanged = value.state.duration !== state.duration;
            state = value.state;
            if (trackChanged) lyrics = { trackId: state.currentTrack?.id ?? null, lines: [] };
            const suppliedLyrics = value.lyrics && value.lyrics.trackId === (state.currentTrack?.id ?? null);
            if (suppliedLyrics) lyrics = value.lyrics!;
            const lyricsChanged = trackChanged || durationChanged || !!suppliedLyrics;
            if (lyricsChanged) { lines = localLyricLines(lyrics, state.duration); lookup = createLocalActiveLineLookup(lines); }
            return { accepted: true, trackChanged, lyricsChanged };
        },
    };
}
