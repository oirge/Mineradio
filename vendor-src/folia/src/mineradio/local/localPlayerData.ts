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
            fullText: line.text, translation: line.translation, romanization: line.romanization, backgroundVocals: line.backgroundVocals,
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

/** Index an immutable lyric snapshot; rebuild on replacement, and fall back for unordered timing. */
export function createLocalActiveLineLookup(lines: Line[]): (time: number) => number {
    let previousStart = Number.NEGATIVE_INFINITY;
    for (const line of lines) {
        if (!Number.isFinite(line.startTime) || line.startTime < previousStart) {
            return time => localActiveLineIndex(lines, time);
        }
        previousStart = line.startTime;
    }

    // End-time maxima let overlapping voices fall back to the latest live row
    // without revisiting every expired row during a seek or a silent gap.
    let leafCount = 1;
    while (leafCount < lines.length) leafCount *= 2;
    const endTree = new Float64Array(leafCount * 2).fill(Number.NEGATIVE_INFINITY);
    for (let index = 0; index < lines.length; index++) {
        const end = Number(lines[index].renderHints?.renderEndTime ?? lines[index].endTime);
        endTree[leafCount + index] = Number.isNaN(end) ? Number.NEGATIVE_INFINITY : end;
    }
    for (let node = leafCount - 1; node > 0; node--) {
        endTree[node] = Math.max(endTree[node * 2], endTree[node * 2 + 1]);
    }
    const latestLiveRow = (upperIndex: number, time: number, node = 1, left = 0, right = leafCount - 1): number => {
        if (left > upperIndex || endTree[node] < time) return -1;
        if (left === right) return left;
        const middle = Math.floor((left + right) / 2);
        const latest = latestLiveRow(upperIndex, time, node * 2 + 1, middle + 1, right);
        return latest >= 0 ? latest : latestLiveRow(upperIndex, time, node * 2, left, middle);
    };

    let highestStartIndex = -1;
    let previousTime = Number.NEGATIVE_INFINITY;

    return time => {
        if (!Number.isFinite(time)) return localActiveLineIndex(lines, time);
        // Host clock corrections can move backwards by only a few milliseconds.
        // Binary search also bounds the work for initial and distant forward seeks.
        if (highestStartIndex < 0 || time < previousTime || time - previousTime > 0.5) {
            let low = 0, high = lines.length;
            while (low < high) {
                const middle = Math.floor((low + high) / 2);
                if (lines[middle].startTime <= time) low = middle + 1;
                else high = middle;
            }
            highestStartIndex = low - 1;
        } else {
            while (highestStartIndex + 1 < lines.length && lines[highestStartIndex + 1].startTime <= time) {
                highestStartIndex++;
            }
        }
        previousTime = time;
        if (highestStartIndex < 0) return -1;
        if (time <= endTree[leafCount + highestStartIndex]) return highestStartIndex;
        return latestLiveRow(highestStartIndex, time);
    };
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
        state.lyricsRevision, state.interface, state.playbackPlaylistId, state.playbackPlaylistName, state.uiLanguage,
        state.sleepTimer, state.replayGain, state.gapless, state.audioChain, state.outputDevice,
    ]);
}

/** Folia's response curves, applied to Mineradio's existing analyser without creating audio nodes. */
export function applyLocalAudio(frame: HostAudio, bands: AudioBands, power: MotionValue<number>): void {
    // Host postMessage delivers an ordinary ArrayBuffer-backed view; keep it by
    // identity so each 33ms audio tick does not allocate another full FFT copy.
    const data = frame.frequency instanceof Uint8Array
        ? frame.frequency as Uint8Array<ArrayBuffer>
        : Uint8Array.from(frame.frequency);
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
