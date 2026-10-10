import { fileTypeFromBuffer } from 'file-type/core';

// src/utils/flacPictureRepair.ts
// Repairs bounded FLAC PICTURE fields without changing the embedded image bytes.

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

/** Returns null when field boundaries or image detection cannot safely identify the cover. */
export async function repairFlacPicture(bytes: Uint8Array): Promise<Uint8Array | null> {
    if (bytes.length < 32) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const mimeLength = view.getUint32(4);
    if (mimeLength > bytes.length - 32) return null;
    const descriptionOffset = 8 + mimeLength;
    const descriptionLength = view.getUint32(descriptionOffset);
    if (descriptionLength > bytes.length - descriptionOffset - 24) return null;
    const dataLengthOffset = descriptionOffset + 4 + descriptionLength + 16;
    const availableDataLength = bytes.length - dataLengthOffset - 4;
    if (availableDataLength === 0) return null;

    const mime = textDecoder.decode(bytes.subarray(8, descriptionOffset));
    let detectedMime = mime;
    // Linked pictures contain a URL rather than image bytes; preserve that valid FLAC representation.
    if (mime !== '-->') {
        try {
            const detected = await fileTypeFromBuffer(bytes.subarray(dataLengthOffset + 4));
            if (!detected?.mime.startsWith('image/')) return null;
            detectedMime = detected.mime;
        } catch {
            // A truncated/unknown cover must not prevent decoding the surrounding audio and tags.
            return null;
        }
    }
    const invalidType = view.getUint32(0) > 20;
    const invalidLength = view.getUint32(dataLengthOffset) !== availableDataLength;
    if (!invalidType && !invalidLength && mime === detectedMime) return bytes;

    // An empty MIME lets music-metadata infer the image format from its payload.
    // Native playback also needs the populated field, inferred from bytes rather than a filename or label.
    const repairedMime = textEncoder.encode(detectedMime);
    const mimeLengthDelta = repairedMime.length - mimeLength;
    const repaired = new Uint8Array(bytes.length + mimeLengthDelta);
    repaired.set(bytes.subarray(0, 8));
    repaired.set(repairedMime, 8);
    repaired.set(bytes.subarray(descriptionOffset), 8 + repairedMime.length);
    const repairedView = new DataView(repaired.buffer);
    if (invalidType) repairedView.setUint32(0, 0); // Reserved types become "Other".
    repairedView.setUint32(4, repairedMime.length);
    repairedView.setUint32(dataLengthOffset + mimeLengthDelta, availableDataLength);
    return repaired;
}

/** Fixes picture comments individually so one bad cover cannot discard other tags. */
export async function repairFlacPictureComments(bytes: Uint8Array): Promise<Uint8Array> {
    if (bytes.length < 8) return bytes;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const vendorLength = view.getUint32(0, true);
    if (vendorLength > bytes.length - 8) return bytes;
    let offset = 8 + vendorLength;
    const count = view.getUint32(4 + vendorLength, true);
    if (count > (bytes.length - offset) / 4) return bytes;
    const comments: Uint8Array[] = [];
    let changed = false;

    for (let index = 0; index < count; index++) {
        if (offset + 4 > bytes.length) return bytes;
        const length = view.getUint32(offset, true);
        if (length > bytes.length - offset - 4) return bytes;
        const comment = bytes.subarray(offset + 4, offset + 4 + length);
        const decoded = textDecoder.decode(comment);
        const separator = decoded.indexOf('=');
        let repairedComment: Uint8Array | null = comment;
        if (separator > 0 && decoded.slice(0, separator).toUpperCase() === 'METADATA_BLOCK_PICTURE') {
            try {
                const picture = Uint8Array.from(atob(decoded.slice(separator + 1)), character => character.charCodeAt(0));
                const repaired = await repairFlacPicture(picture);
                if (repaired !== picture) {
                    changed = true;
                    let binary = '';
                    for (let offset = 0; repaired && offset < repaired.length; offset += 8192) {
                        binary += String.fromCharCode(...repaired.subarray(offset, offset + 8192));
                    }
                    repairedComment = repaired
                        ? new TextEncoder().encode(`METADATA_BLOCK_PICTURE=${btoa(binary)}`)
                        : null;
                }
            } catch {
                changed = true;
                repairedComment = null;
            }
        }
        if (repairedComment) {
            if (repairedComment === comment) {
                comments.push(bytes.subarray(offset, offset + 4 + length));
            } else {
                const record = new Uint8Array(4 + repairedComment.length);
                new DataView(record.buffer).setUint32(0, repairedComment.length, true);
                record.set(repairedComment, 4);
                comments.push(record);
            }
        }
        offset += 4 + length;
    }
    if (!changed) return bytes;
    const repaired = new Uint8Array(8 + vendorLength + comments.reduce((total, comment) => total + comment.length, 0) + bytes.length - offset);
    repaired.set(bytes.subarray(0, 8 + vendorLength));
    new DataView(repaired.buffer).setUint32(4 + vendorLength, comments.length, true);
    let writeOffset = 8 + vendorLength;
    for (const comment of comments) {
        repaired.set(comment, writeOffset);
        writeOffset += comment.length;
    }
    repaired.set(bytes.subarray(offset), writeOffset);
    return repaired;
}
