import { describe, expect, it } from 'vitest';
import { opusPacketDuration } from '../../../src/mineradio/local/videoExportOpus';

// RFC 6716 duration cases cover SILK, hybrid, CELT and multi-frame packets.
describe('Opus recording packet duration', () => {
    it.each([
        [0, 10], [1, 20], [2, 40], [3, 60], [12, 10], [13, 20],
        [16, 2.5], [17, 5], [18, 10], [19, 20], [31, 20],
    ])('reads configuration %i as %i ms per frame', (config, milliseconds) => {
        expect(opusPacketDuration(new Uint8Array([config << 3]))).toBe(milliseconds / 1000);
    });
    it('counts both fixed and explicit frame counts, including the 60 ms MediaRecorder tail', () => {
        expect(opusPacketDuration(new Uint8Array([(19 << 3) | 1]))).toBe(0.04);
        expect(opusPacketDuration(new Uint8Array([(19 << 3) | 2, 1]))).toBe(0.04);
        expect(opusPacketDuration(new Uint8Array([(19 << 3) | 3, 3]))).toBe(0.06);
        expect(opusPacketDuration(new Uint8Array([(16 << 3) | 3, 48]))).toBe(0.12);
    });
    it.each([[], [3], [3, 0], [3, 49], [(19 << 3) | 3, 7], [(3 << 3) | 3, 3]].map(bytes => ({ bytes })))('rejects invalid duration data $bytes', ({ bytes }) => {
        expect(() => opusPacketDuration(new Uint8Array(bytes))).toThrow(/Opus/);
    });
});
