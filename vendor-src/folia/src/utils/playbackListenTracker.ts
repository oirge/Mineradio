// src/utils/playbackListenTracker.ts
// Measures how many seconds of a track were REALLY rendered, for provider listening reports.
//
// The position on the progress bar is not an answer to that question: dragging to the end of a
// five-minute song and skipping produces a full-length `currentTime` after two seconds of audio.
// Everything here exists so that a reported number can only ever come from audio that was played.

/** A media-time step larger than this is a seek, a stall, or a resume - never continuous playback. */
export const MAX_PROGRESS_STEP_SECONDS = 2;

/** Below this much real playback a track is a skip, not a listen, and is never reported. */
export const MIN_LISTEN_SECONDS = 30;

/** How far back into a track a rewind has to land before it counts as starting it over. */
const RESTART_POSITION_SECONDS = 2;

/**
 * Allowance over wall-clock time. Playback rate is 1x here, so the accumulator can never legitimately
 * outrun the clock; the margin only absorbs timer jitter and a wrongly-timestamped first sample.
 */
const WALL_CLOCK_TOLERANCE = 1.25;
const WALL_CLOCK_GRACE_SECONDS = 2;

export type PlaybackListenSession = {
    songKey: string;
    mediaId: string;
    totalSeconds: number;
    listenedSeconds: number;
    lastMediaTime: number;
    startedAtMs: number;
    settled: boolean;
};

export type PlaybackListenReport = {
    mediaId: string;
    songKey: string;
    playedSeconds: number;
    totalSeconds: number;
};

export type PlaybackListenProgress = {
    /** The track was rewound to its start after a real listen - loop-one, or a replay by hand. */
    restarted: boolean;
};

export type PlaybackListenSessionInput = {
    songKey: string;
    mediaId: string;
    totalSeconds: number;
};

export class PlaybackListenTracker {
    private session: PlaybackListenSession | null = null;

    start({ songKey, mediaId, totalSeconds }: PlaybackListenSessionInput, nowMs = Date.now()): void {
        this.session = {
            songKey,
            mediaId,
            totalSeconds: Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0,
            listenedSeconds: 0,
            lastMediaTime: Number.NaN,
            startedAtMs: nowMs,
            settled: false,
        };
    }

    clear(): void {
        this.session = null;
    }

    getSongKey(): string | null {
        return this.session?.songKey ?? null;
    }

    getListenedSeconds(): number {
        return this.session?.listenedSeconds ?? 0;
    }

    /**
     * Folds one `timeupdate` into the accumulator.
     *
     * Only a small forward step counts. That single rule is what makes a seek, a rewind, a pause and
     * a stall all uncountable without needing to hear about any of those events: each of them shows
     * up here as a step that is negative, or larger than continuous playback could produce, and the
     * marker is simply re-anchored without crediting anything.
     */
    handleProgress(mediaTimeSeconds: number, nowMs = Date.now()): PlaybackListenProgress {
        const session = this.session;
        if (!session || !Number.isFinite(mediaTimeSeconds) || mediaTimeSeconds < 0) {
            return { restarted: false };
        }

        const previous = session.lastMediaTime;
        session.lastMediaTime = mediaTimeSeconds;
        if (!Number.isFinite(previous)) {
            return { restarted: false };
        }

        const delta = mediaTimeSeconds - previous;
        if (delta > 0 && delta <= MAX_PROGRESS_STEP_SECONDS) {
            session.listenedSeconds += delta;
            return { restarted: false };
        }

        // A rewind to the top of a track that has already been listened to is a second play of it,
        // not a correction to the first. The caller settles the old session and opens a new one.
        const restarted = delta < 0
            && mediaTimeSeconds <= RESTART_POSITION_SECONDS
            && this.qualifies(session, nowMs);
        return { restarted };
    }

    /**
     * Closes the session and returns the report it earned, or null if it earned none.
     *
     * Settling is idempotent per session: a track that ends and is then replaced by the next one
     * runs through here twice, and only the first pass may produce a report.
     */
    settle(nowMs = Date.now()): PlaybackListenReport | null {
        const session = this.session;
        if (!session || session.settled || !this.qualifies(session, nowMs)) {
            return null;
        }

        session.settled = true;
        const capped = session.totalSeconds > 0
            ? Math.min(session.listenedSeconds, session.totalSeconds)
            : session.listenedSeconds;
        return {
            mediaId: session.mediaId,
            songKey: session.songKey,
            playedSeconds: Math.round(capped),
            totalSeconds: Math.round(session.totalSeconds),
        };
    }

    /**
     * Whether this session has earned a report: enough real playback, and an amount of it that the
     * wall clock agrees was even possible. The second half is the backstop - it cannot be satisfied
     * by any accumulator bug, because it is measured against a clock the accumulator never touches.
     */
    private qualifies(session: PlaybackListenSession, nowMs: number): boolean {
        if (session.listenedSeconds < MIN_LISTEN_SECONDS) return false;
        const elapsedSeconds = (nowMs - session.startedAtMs) / 1000;
        return session.listenedSeconds <= elapsedSeconds * WALL_CLOCK_TOLERANCE + WALL_CLOCK_GRACE_SECONDS;
    }
}
