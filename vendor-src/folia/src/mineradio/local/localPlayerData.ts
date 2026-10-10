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
interface ActiveLineLookup {
    boundaries: number[];
    exact: number[];
    after: number[];
}

const activeLineLookupCache = new WeakMap<Line[], ActiveLineLookup>();

const buildActiveLineLookup = (lines: Line[]): ActiveLineLookup => {
    const starts = new Map<number, number[]>();
    const ends = new Map<number, number[]>();
    const boundarySet = new Set<number>();

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const start = line.startTime;
        const end = line.renderHints?.renderEndTime ?? line.endTime;
        // Comparisons against NaN are always false in the original scan, so such a
        // malformed line must not become searchable just because it was indexed.
        if (Number.isNaN(start) || Number.isNaN(end) || start > end) continue;
        const startEntries = starts.get(start);
        if (startEntries) startEntries.push(index);
        else starts.set(start, [index]);
        const endEntries = ends.get(end);
        if (endEntries) endEntries.push(index);
        else ends.set(end, [index]);
        boundarySet.add(start);
        boundarySet.add(end);
    }

    const boundaries = [...boundarySet].sort((a, b) => a - b);
    const exact: number[] = [];
    const after: number[] = [];
    const active = new Uint8Array(lines.length);
    const heap: number[] = [];

    const push = (value: number) => {
        heap.push(value);
        let child = heap.length - 1;
        while (child > 0) {
            const parent = (child - 1) >>> 1;
            if (heap[parent] >= value) break;
            heap[child] = heap[parent];
            child = parent;
        }
        heap[child] = value;
    };
    const discardInactive = () => {
        while (heap.length > 0 && active[heap[0]] === 0) {
            const last = heap.pop()!;
            if (heap.length === 0) break;
            let parent = 0;
            while (true) {
                const left = parent * 2 + 1;
                if (left >= heap.length) break;
                const right = left + 1;
                const child = right < heap.length && heap[right] > heap[left] ? right : left;
                if (heap[child] <= last) break;
                heap[parent] = heap[child];
                parent = child;
            }
            heap[parent] = last;
        }
    };
    const peek = () => {
        discardInactive();
        return heap.length > 0 ? heap[0] : -1;
    };

    for (const boundary of boundaries) {
        // Endpoints are inclusive. Add starts before reading the exact-boundary
        // result, then remove endings for the open interval after this boundary.
        for (const index of starts.get(boundary) ?? []) {
            active[index] = 1;
            push(index);
        }
        exact.push(peek());
        for (const index of ends.get(boundary) ?? []) active[index] = 0;
        after.push(peek());
    }

    return { boundaries, exact, after };
};

const lookupFor = (lines: Line[]): ActiveLineLookup => {
    const cached = activeLineLookupCache.get(lines);
    if (cached) return cached;
    const lookup = buildActiveLineLookup(lines);
    activeLineLookupCache.set(lines, lookup);
    return lookup;
};

const lowerBound = (values: number[], target: number): number => {
    let low = 0;
    let high = values.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (values[middle] < target) low = middle + 1;
        else high = middle;
    }
    return low;
};

export function localActiveLineIndex(lines: Line[], time: number): number {
    if (!lines.length || Number.isNaN(time)) return -1;
    const lookup = lookupFor(lines);
    if (!lookup.boundaries.length) return -1;
    const index = lowerBound(lookup.boundaries, time);
    if (index < lookup.boundaries.length && lookup.boundaries[index] === time) return lookup.exact[index];
    return index > 0 ? lookup.after[index - 1] : -1;
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

const sameHostTrack = (left: HostState['currentTrack'], right: HostState['currentTrack']): boolean => {
    if (left === right) return true;
    if (!left || !right) return false;
    return left.id === right.id
        && left.title === right.title
        && left.artist === right.artist
        && left.album === right.album
        && left.duration === right.duration
        && left.cover === right.cover
        && left.liked === right.liked
        && left.filePath === right.filePath
        && left.format === right.format;
};

/** Compare the discrete host snapshot fields without serializing the track payload. */
export function localStateChanged(previous: HostState | null, next: HostState): boolean {
    if (!previous) return true;
    return !sameHostTrack(previous.currentTrack, next.currentTrack)
        || previous.currentIndex !== next.currentIndex
        || previous.duration !== next.duration
        || previous.playing !== next.playing
        || previous.playbackRate !== next.playbackRate
        || previous.volume !== next.volume
        || previous.muted !== next.muted
        || previous.playMode !== next.playMode
        || previous.queueRevision !== next.queueRevision
        || previous.libraryRevision !== next.libraryRevision
        || previous.lyricsRevision !== next.lyricsRevision
        || previous.interface !== next.interface;
}

/** Folia's response curves, applied to Mineradio's existing analyser without creating audio nodes. */
export function applyLocalAudio(frame: HostAudio, bands: AudioBands, power: MotionValue<number>): void {
    const data: Uint8Array<ArrayBuffer> = frame.frequency instanceof Uint8Array
        ? (frame.frequency as Uint8Array<ArrayBuffer>)
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
