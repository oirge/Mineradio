import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalActiveLineLookup, localActiveLineIndex, localLyricLines } from '../vendor-src/folia/src/mineradio/local/localPlayerData.ts';

// tests/folia-lyric-lookup.test.mjs
// Replay the local player's frame lookup with real host lyric projection, including seeks and overlaps.
const project = source => localLyricLines({ trackId: 'local:lookup', lines: source }, 4000);
const sourceLine = (time, endTime, text = 'line') => ({ time, endTime, text });

test('indexed lyrics preserve exact starts, inclusive ends, overlaps, ties and silent gaps', () => {
    const lines = project([
        sourceLine(1, 7, 'long voice'), sourceLine(2, 3, 'brief voice'),
        sourceLine(2, 2.5, 'same-time latest voice'), sourceLine(9, 10, 'after gap'),
    ]);
    const at = createLocalActiveLineLookup(lines);
    for (const [time, expected] of [[0, -1], [1, 0], [2, 2], [2.5, 2], [2.501, 1], [3, 1],
        [3.001, 0], [7, 0], [7.001, -1], [9, 3], [10, 3], [10.001, -1], [2, 2], [1, 0]]) {
        assert.equal(at(time), expected, `playhead ${time}`);
    }
});

test('render extensions, empty snapshots and out-of-range clocks retain existing behavior', () => {
    const lines = project([sourceLine(1, 2), sourceLine(3, 4)]);
    lines[0].renderHints = { renderEndTime: 5 };
    const at = createLocalActiveLineLookup(lines);
    for (const time of [-Infinity, -1, 0, 1, 2, 2.5, 3, 4, 4.5, 5, 5.01, Infinity, NaN]) {
        assert.equal(at(time), localActiveLineIndex(lines, time), `playhead ${time}`);
    }
    assert.equal(createLocalActiveLineLookup([])(20), -1);
});

test('out-of-order host snapshots preserve source-index precedence without sorting input', () => {
    const lines = project([sourceLine(10, 20), sourceLine(1, 12), sourceLine(4, 5)]);
    const before = JSON.stringify(lines);
    const at = createLocalActiveLineLookup(lines);
    for (const time of [0, 1, 4, 5, 6, 10, 11, 12, 12.1, 15, 20, 21, 3]) {
        assert.equal(at(time), localActiveLineIndex(lines, time), `playhead ${time}`);
    }
    assert.equal(JSON.stringify(lines), before);
});

test('host lyric replacement gets an independent index and does not retain stale timing', () => {
    const first = project([sourceLine(1, 2), sourceLine(4, 5)]);
    const old = createLocalActiveLineLookup(first);
    const replacement = project([sourceLine(2, 3), sourceLine(7, 8)]);
    const current = createLocalActiveLineLookup(replacement);
    assert.equal(old(4.5), 1);
    assert.equal(current(4.5), -1);
    assert.equal(current(7.5), 1);
    assert.equal(old(7.5), -1);
    assert.equal(createLocalActiveLineLookup([])(7.5), -1);
});

test('fixed-seed seek replay matches the original resolver for dense and overlapping lyrics', () => {
    let seed = 0x5eeda11;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let sample = 0; sample < 20; sample++) {
        let start = 0;
        const source = Array.from({ length: 150 }, () => {
            start += Math.floor(random() * 4) / 2;
            return sourceLine(start, start + Math.floor(random() * 20) / 2);
        });
        const lines = project(source), at = createLocalActiveLineLookup(lines);
        for (let seek = 0; seek < 200; seek++) {
            const time = random() * (start + 10);
            assert.equal(at(time), localActiveLineIndex(lines, time), `sample ${sample}, playhead ${time}`);
        }
        for (const line of lines) {
            assert.equal(at(line.startTime), localActiveLineIndex(lines, line.startTime));
            assert.equal(at(line.endTime), localActiveLineIndex(lines, line.endTime));
        }
    }
});

test('600 playback frames do not revisit the future 1,000-line lyric tail', t => {
    const values = project(Array.from({ length: 1000 }, (_, index) => sourceLine(index * 2, index * 2 + 1.8)));
    let reads = 0;
    let descriptorReads = 0;
    const lines = new Proxy(values, {
        get(target, property, receiver) {
            if (/^\d+$/.test(String(property))) reads++;
            return Reflect.get(target, property, receiver);
        },
        getOwnPropertyDescriptor(target, property) {
            if (/^\d+$/.test(String(property))) descriptorReads++;
            return Reflect.getOwnPropertyDescriptor(target, property);
        },
    });
    const at = createLocalActiveLineLookup(lines);
    let checksum = 0;
    for (let frame = 0; frame < 600; frame++) checksum += at(frame / 60);
    assert.equal(checksum, 1035);
    t.diagnostic(`1,000 lines / 600 frames: ${reads} value reads and ${descriptorReads} property reads`);
    assert.ok(reads + descriptorReads < 5000, `future lyrics should be indexed once, observed ${reads + descriptorReads} reads`);
});
