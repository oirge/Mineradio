import type { AudioBands, Line } from '../../types';
import type { MotionValue } from 'framer-motion';
import type { HostAudio, HostLyrics, HostState } from '../client';

// src/mineradio/local/localPlayerData.ts
// Pure host projection shared by the isolated local player and its tests.
const finite = (value: number | undefined, fallback = 0): number => Number.isFinite(value) ? value! : fallback;

/** Keep source words and absolute second timing; line-only lyrics remain one display unit. */
export function localLyricLines(value: HostLyrics, duration: number): Line[] {
    return value.lines.map((line, index) => {
        const startTime = Math.max(0, finite(line.time));
        const words = line.words?.map(word => {
            const start = Math.max(0, finite(word.time, startTime));
            return { text: word.text, startTime: start, endTime: start + Math.max(0, finite(word.duration)) };
        }) ?? [];
        const fallbackEnd = finite(value.lines[index + 1]?.time, finite(duration, startTime));
        const endTime = Math.max(startTime, finite(line.endTime, fallbackEnd), ...words.map(word => word.endTime));
        return {
            id: `${value.trackId}:${index}`, startTime, endTime,
            fullText: line.text, translation: line.translation,
            words: words.length ? words : [{ text: line.text, startTime, endTime }],
        };
    });
}

/** Last active line wins for overlapping voices; lyric gaps have no current line. */
export function localActiveLineIndex(lines: Line[], time: number): number {
    for (let index = lines.length - 1; index >= 0; index--) {
        const line = lines[index];
        if (time >= line.startTime && time <= (line.renderHints?.renderEndTime ?? line.endTime)) return index;
    }
    return -1;
}

/** Snapshots are authoritative; extrapolation only fills their short delivery gap. */
export function interpolatedLocalTime(state: HostState, elapsedSeconds: number): number {
    const elapsed = state.playing ? Math.min(0.5, Math.max(0, finite(elapsedSeconds))) : 0;
    const position = Math.max(0, finite(state.position)) + elapsed * Math.max(0, finite(state.playbackRate, 1));
    return state.duration > 0 ? Math.min(position, state.duration) : position;
}

export function localStateSignature(state: HostState): string {
    // Position is deliberately excluded: the host publishes it five times per second.
    return JSON.stringify([
        state.currentTrack, state.currentIndex, state.duration, state.playing, state.playbackRate,
        state.volume, state.muted, state.playMode, state.queueRevision, state.libraryRevision,
        state.lyricsRevision, state.interface,
    ]);
}

/** Folia's response curves, applied to Mineradio's existing analyser without creating audio nodes. */
export function applyLocalAudio(frame: HostAudio, bands: AudioBands, power: MotionValue<number>): void {
    const data = Uint8Array.from(frame.frequency);
    const binHz = frame.sampleRate / frame.fftSize;
    const energy = (min: number, max: number) => {
        if (!data.length || !Number.isFinite(binHz) || binHz <= 0) return 0;
        const start = Math.min(data.length - 1, Math.max(0, Math.floor(min / binHz)));
        const end = Math.min(data.length - 1, Math.max(start, Math.floor(max / binHz)));
        let sum = 0;
        for (let index = start; index <= end; index++) sum += data[index];
        return sum / (end - start + 1);
    };
    const process = (value: number, boost: number) => Math.pow(value / 255, boost) * 255;
    const bass = energy(20, 150), lowMid = energy(150, 400);
    bands.spectrum?.set(data);
    power.set(process((bass + lowMid) / 2, 3));
    bands.bass.set(process(bass, 1.8));
    bands.lowMid.set(process(lowMid, 2));
    bands.mid.set(process(energy(400, 1200), 2));
    bands.vocal.set(process(energy(1000, 3500), 1.5));
    bands.treble.set(process(energy(3500, 12000), 2));
}

export function clearLocalAudio(bands: AudioBands, power: MotionValue<number>): void {
    power.set(0);
    for (const band of [bands.bass, bands.lowMid, bands.mid, bands.vocal, bands.treble]) band.set(0);
    bands.spectrum?.set(new Uint8Array(0));
}
