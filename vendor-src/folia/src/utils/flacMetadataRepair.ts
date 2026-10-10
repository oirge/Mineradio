import { repairFlacPicture, repairFlacPictureComments } from './flacPictureRepair';

// src/utils/flacMetadataRepair.ts
// Creates a repaired parsing input for local FLAC files, preserving the original media.
// The same metadata-only Blob is used for native playback so malformed pictures cannot break demuxing.

/** Reads metadata only; unchanged files and all audio data stay in their original Blob. */
export async function repairFlacMetadata(source: Blob, includeCover: boolean): Promise<Blob> {
    // skipCovers already bypasses both native and Vorbis-comment picture payloads.
    if (!includeCover) return source;
    let flacOffset = 0;
    let preamble = new Uint8Array(await source.slice(0, 10).arrayBuffer());
    // Match music-metadata's support for one or more leading ID3v2 tags.
    while (preamble.length === 10 && String.fromCharCode(...preamble.subarray(0, 3)) === 'ID3') {
        if (preamble[3] < 2 || preamble[3] > 4 || preamble.subarray(6).some(byte => byte & 0x80)) return source;
        const tagLength = preamble[6] * 2097152 + preamble[7] * 16384 + preamble[8] * 128 + preamble[9];
        flacOffset += 10 + tagLength;
        if (flacOffset > source.size - 8) return source;
        preamble = new Uint8Array(await source.slice(flacOffset, flacOffset + 10).arrayBuffer());
    }
    if (preamble.length < 8 || String.fromCharCode(...preamble.subarray(0, 4)) !== 'fLaC'
        || (preamble[4] & 0x7f) !== 0 || preamble[5] !== 0 || preamble[6] !== 0 || preamble[7] !== 34) return source;

    const parts: BlobPart[] = [];
    let offset = flacOffset + 4;
    let copiedUntil = 0;
    while (offset + 4 <= source.size) {
        const header = new Uint8Array(await source.slice(offset, offset + 4).arrayBuffer());
        const type = header[0] & 0x7f;
        const length = header[1] * 65536 + header[2] * 256 + header[3];
        const end = offset + 4 + length;
        // A broken outer length gives no reliable next-block/audio boundary.
        if (end > source.size || type === 127) return source;
        if (type === 6 || type === 4) {
            const bytes = new Uint8Array(await source.slice(offset + 4, end).arrayBuffer());
            const repaired = type === 6 ? await repairFlacPicture(bytes) : await repairFlacPictureComments(bytes);
            if (repaired !== bytes) {
                parts.push(source.slice(copiedUntil, offset));
                const repairedLength = repaired?.length ?? length;
                if (repairedLength > 0xffffff) return source;
                const repairedHeader = new Uint8Array(header);
                repairedHeader[0] = (header[0] & 0x80) | (repaired ? type : 1);
                repairedHeader[1] = repairedLength >>> 16;
                repairedHeader[2] = repairedLength >>> 8;
                repairedHeader[3] = repairedLength;
                parts.push(repairedHeader, repaired ? new Blob([repaired as Uint8Array<ArrayBuffer>]) : source.slice(offset + 4, end));
                copiedUntil = end;
            }
        }
        offset = end;
        if (header[0] & 0x80) {
            if (!parts.length) return source;
            parts.push(source.slice(copiedUntil));
            return new Blob(parts, { type: 'audio/flac' });
        }
    }
    return source;
}
