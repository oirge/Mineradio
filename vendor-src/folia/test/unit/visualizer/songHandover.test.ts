import { describe, expect, it } from 'vitest';
import {
    DEFAULT_INSTRUMENTAL_COMMIT_SECONDS,
    DEFAULT_READY_GRACE_MS,
    decideSongCommit,
    getLyricsSignature,
    isInstrumentalConfirmed,
} from '../../../src/components/visualizer/songHandover';
import type { Line } from '../../../src/types';

// test/unit/visualizer/songHandover.test.ts
// Covers the pure half of the visualizer song gate: which song may take the stage, and how a
// lyric-less song is told apart from one whose lyrics have not landed yet.

const line = (fullText: string, startTime = 0): Line => ({
    id: `line-${fullText}-${startTime}`,
    startTime,
    endTime: startTime + 4,
    fullText,
    words: [],
    isChorus: false,
});

/** The shape a saved segmentation reaches the gate in: same line, `wordSegments` baked on. */
const split = (source: Line, wordSegments: string[]): Line => ({ ...source, wordSegments });

const LIMITS = {
    instrumentalCommitSeconds: DEFAULT_INSTRUMENTAL_COMMIT_SECONDS,
    readyGraceMs: DEFAULT_READY_GRACE_MS,
};

describe('getLyricsSignature', () => {
    it('reports no words as an empty signature', () => {
        expect(getLyricsSignature([])).toBe('');
    });

    it('is stable across a fresh array with the same content', () => {
        expect(getLyricsSignature([line('a'), line('b')]))
            .toBe(getLyricsSignature([line('a'), line('b')]));
    });

    it('separates same-length lyric sets with different opening lines', () => {
        expect(getLyricsSignature([line('a'), line('b')]))
            .not.toBe(getLyricsSignature([line('c'), line('b')]));
    });

    it('separates different-length lyric sets', () => {
        expect(getLyricsSignature([line('a')]))
            .not.toBe(getLyricsSignature([line('a'), line('b')]));
    });

    // Saving a segmentation rewrites the lines in place - same count, same text - so a signature
    // blind to it left tempera and sonnet rendering the old split until the song changed.
    it('separates a saved word segmentation from the default split', () => {
        const plain = [line('把回忆拼好给你'), line('b')];
        const segmented = [split(line('把回忆拼好给你'), ['把', '回忆', '拼好', '给', '你']), line('b')];

        expect(getLyricsSignature(segmented)).not.toBe(getLyricsSignature(plain));
    });

    it('separates two segmentations that cover the same lines differently', () => {
        // Re-running the AI, or moving one boundary by hand, leaves the coverage count untouched.
        const first = [split(line('把回忆拼好给你'), ['把', '回忆', '拼好', '给', '你'])];
        const second = [split(line('把回忆拼好给你'), ['把回忆', '拼好', '给你'])];
        const moved = [split(line('把回忆拼好给你'), ['把', '回忆拼', '好', '给', '你'])];

        expect(getLyricsSignature(second)).not.toBe(getLyricsSignature(first));
        // Same segment count, one boundary shifted.
        expect(getLyricsSignature(moved)).not.toBe(getLyricsSignature(first));
    });

    it('separates the same segmentation applied to a different line', () => {
        const onFirst = [split(line('aa'), ['a', 'a']), line('bb')];
        const onSecond = [line('aa'), split(line('bb'), ['b', 'b'])];

        expect(getLyricsSignature(onSecond)).not.toBe(getLyricsSignature(onFirst));
    });

    it('is stable across a fresh array carrying the same segmentation', () => {
        const build = () => [split(line('把回忆'), ['把', '回忆']), line('b')];
        expect(getLyricsSignature(build())).toBe(getLyricsSignature(build()));
    });
});

describe('decideSongCommit', () => {
    it('holds a new song until its lyrics land', () => {
        expect(decideSongCommit({
            seed: 'next',
            committedSeed: 'current',
            lyricsSignature: '',
            committedSignature: '2|hello',
            isCommittedInstrumental: false,
        })).toEqual({ action: 'watch' });
    });

    it('commits a new song the instant its lyrics land', () => {
        expect(decideSongCommit({
            seed: 'next',
            committedSeed: 'current',
            lyricsSignature: '3|world',
            committedSignature: '2|hello',
            isCommittedInstrumental: false,
        })).toEqual({ action: 'commit', isInstrumental: false });
    });

    it('stays idle once the committed song has its words', () => {
        expect(decideSongCommit({
            seed: 'current',
            committedSeed: 'current',
            lyricsSignature: '2|hello',
            committedSignature: '2|hello',
            isCommittedInstrumental: false,
        })).toEqual({ action: 'idle' });
    });

    it('takes a re-segmentation of the song already on screen in place', () => {
        // End to end for the gate: the same lines, re-saved with a word segmentation, have to
        // reach the stage now rather than waiting for the next track.
        const plain = [line('把回忆拼好给你'), line('b')];
        const segmented = [split(line('把回忆拼好给你'), ['把', '回忆', '拼好', '给', '你']), line('b')];

        expect(decideSongCommit({
            seed: 'current',
            committedSeed: 'current',
            lyricsSignature: getLyricsSignature(segmented),
            committedSignature: getLyricsSignature(plain),
            isCommittedInstrumental: false,
        })).toEqual({ action: 'commit', isInstrumental: false });
    });

    it('keeps the words up but watches when lyrics are cleared for the song already on screen', () => {
        // `seed` reaches the visualizer a render before the new lyrics do, so the parent hands
        // down an empty set in between. Committing it blanked the scene and flashed the
        // "waiting for music" placeholder over a song whose lyrics were already cached. The
        // commit has to wait, but it must not be abandoned: a lyric filter that removes every
        // line leaves the same empty set behind for good, and that has to end up instrumental.
        expect(decideSongCommit({
            seed: 'current',
            committedSeed: 'current',
            lyricsSignature: '',
            committedSignature: '2|hello',
            isCommittedInstrumental: false,
        })).toEqual({ action: 'watch' });
    });

    it('commits the filtered-down song once the watch finds no words returning', () => {
        // Filter removes the only line mid-song: the empty set is watched, and the watch settles
        // it as instrumental through the wall-clock cap (playback never reset for the same song).
        expect(isInstrumentalConfirmed(
            { sawPlaybackReset: false, playbackTime: 95, elapsedMs: 3000 },
            { instrumentalCommitSeconds: 2, readyGraceMs: 3000 },
        )).toBe(true);
    });

    it('keeps holding when a new song still carries the outgoing lyrics', () => {
        // Same render sequence from the other side: the seed already names the incoming track
        // while `lines` is still the outgoing one's.
        expect(decideSongCommit({
            seed: 'next',
            committedSeed: 'current',
            lyricsSignature: '2|hello',
            committedSignature: '2|hello',
            isCommittedInstrumental: false,
        })).toEqual({ action: 'watch' });
    });

    it('walks a manual skip through hold, hold, commit', () => {
        const held = { committedSeed: 'a', committedSignature: '2|hello', isCommittedInstrumental: false };
        // 1. seed flipped, lines still the outgoing song's.
        expect(decideSongCommit({ ...held, seed: 'b', lyricsSignature: '2|hello' })).toEqual({ action: 'watch' });
        // 2. lines cleared.
        expect(decideSongCommit({ ...held, seed: 'b', lyricsSignature: '' })).toEqual({ action: 'watch' });
        // 3. the incoming song's own lyrics land.
        expect(decideSongCommit({ ...held, seed: 'b', lyricsSignature: '4|world' }))
            .toEqual({ action: 'commit', isInstrumental: false });
    });

    it('takes a late lyric load for the song already on screen', () => {
        expect(decideSongCommit({
            seed: 'current',
            committedSeed: 'current',
            lyricsSignature: '2|hello',
            committedSignature: '',
            isCommittedInstrumental: true,
        })).toEqual({ action: 'commit', isInstrumental: false });
    });

    it('watches playback for a committed song that still has no words', () => {
        expect(decideSongCommit({
            seed: 'current',
            committedSeed: 'current',
            lyricsSignature: '',
            committedSignature: '',
            isCommittedInstrumental: false,
        })).toEqual({ action: 'watch' });
    });

    it('stops watching once the committed song is settled as instrumental', () => {
        expect(decideSongCommit({
            seed: 'current',
            committedSeed: 'current',
            lyricsSignature: '',
            committedSignature: '',
            isCommittedInstrumental: true,
        })).toEqual({ action: 'idle' });
    });

    it('holds through a skip chain: the pending song changes, the committed one does not', () => {
        const held = { committedSeed: 'a', committedSignature: '2|hello', isCommittedInstrumental: false };
        expect(decideSongCommit({ ...held, seed: 'b', lyricsSignature: '' })).toEqual({ action: 'watch' });
        expect(decideSongCommit({ ...held, seed: 'c', lyricsSignature: '' })).toEqual({ action: 'watch' });
        expect(decideSongCommit({ ...held, seed: 'c', lyricsSignature: '1|hi' }))
            .toEqual({ action: 'commit', isInstrumental: false });
    });
});

describe('isInstrumentalConfirmed', () => {
    it('waits while the song is merely loading and playback has not advanced', () => {
        expect(isInstrumentalConfirmed(
            { sawPlaybackReset: false, playbackTime: 0, elapsedMs: 500 },
            LIMITS,
        )).toBe(false);
    });

    it('waits while playback has advanced but the reset was never seen', () => {
        // Still the outgoing song's clock: committing here would fly on a stale read-head.
        expect(isInstrumentalConfirmed(
            { sawPlaybackReset: false, playbackTime: 120, elapsedMs: 500 },
            LIMITS,
        )).toBe(false);
    });

    it('waits until the new song has actually played far enough', () => {
        expect(isInstrumentalConfirmed(
            { sawPlaybackReset: true, playbackTime: 1.9, elapsedMs: 2000 },
            LIMITS,
        )).toBe(false);
    });

    it('confirms once the new song has played that far with no words', () => {
        expect(isInstrumentalConfirmed(
            { sawPlaybackReset: true, playbackTime: 2, elapsedMs: 2100 },
            LIMITS,
        )).toBe(true);
    });

    it('falls back to the wall-clock cap when playback never advances', () => {
        expect(isInstrumentalConfirmed(
            { sawPlaybackReset: false, playbackTime: 0, elapsedMs: DEFAULT_READY_GRACE_MS },
            LIMITS,
        )).toBe(true);
    });

    it('honours a per-mode cap shorter than the default', () => {
        expect(isInstrumentalConfirmed(
            { sawPlaybackReset: false, playbackTime: 0, elapsedMs: 3000 },
            { instrumentalCommitSeconds: 2, readyGraceMs: 3000 },
        )).toBe(true);
    });
});
