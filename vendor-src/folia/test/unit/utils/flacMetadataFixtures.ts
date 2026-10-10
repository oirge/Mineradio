// test/unit/utils/flacMetadataFixtures.ts
// Builds bounded local FLAC metadata fixtures with real PNG, JPEG, and WebP images.

const decode = (base64: string) => Uint8Array.from(atob(base64), character => character.charCodeAt(0));
export const png = decode('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAADklEQVR4nGP4DwYMEAoAU7oL9ZisIGcAAAAASUVORK5CYII=');
export const jpeg = decode('/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzU5LjM3LjEwMAD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABLAAEBAAAAAAAAAAAAAAAAAAAABwEBAAAAAAAAAAAAAAAAAAAAABABAAAAAAAAAAAAAAAAAAAAABEBAAAAAAAAAAAAAAAAAAAAAP/AABEIAAIAAgMBIgACEQADEQD/2gAMAwEAAhEDEQA/AL+AD//Z');
export const webp = decode('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAIAAgA0JaQAA3AA/vuUAAA=');
export const audio = new Uint8Array([0xff, 0xf8, 0x69, 0x18, 0x00, 0x00, 0x23, 0x42]);
const encoder = new TextEncoder();

export function block(type: number, data: Uint8Array, last = false): Blob {
    return new Blob([new Uint8Array([(last ? 128 : 0) | type, data.length >>> 16, data.length >>> 8, data.length]), data as Uint8Array<ArrayBuffer>]);
}

export function picture(options: { type?: number; mime?: string; dataLength?: number; image?: Uint8Array } = {}): Uint8Array {
    const mime = encoder.encode(options.mime ?? 'image/png');
    const image = options.image ?? png;
    const bytes = new Uint8Array(32 + mime.length + image.length);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, options.type ?? 3);
    view.setUint32(4, mime.length);
    bytes.set(mime, 8);
    view.setUint32(12 + mime.length, 2);
    view.setUint32(16 + mime.length, 2);
    view.setUint32(20 + mime.length, 24);
    view.setUint32(28 + mime.length, options.dataLength ?? image.length);
    bytes.set(image, 32 + mime.length);
    return bytes;
}

export function comments(entries: string[]): Uint8Array {
    const encoded = entries.map(entry => encoder.encode(entry));
    const bytes = new Uint8Array(8 + encoded.reduce((total, entry) => total + 4 + entry.length, 0));
    const view = new DataView(bytes.buffer);
    view.setUint32(4, entries.length, true);
    let offset = 8;
    for (const entry of encoded) {
        view.setUint32(offset, entry.length, true);
        bytes.set(entry, offset + 4);
        offset += 4 + entry.length;
    }
    return bytes;
}

/** Builds STREAMINFO with a ten-second duration while keeping the audio suffix identifiable. */
export function flac(metadata: Blob[]): Blob {
    const streamInfo = new Uint8Array(34);
    const view = new DataView(streamInfo.buffer);
    view.setUint16(0, 4096);
    view.setUint16(2, 4096);
    view.setBigUint64(10, (44100n << 44n) | (1n << 41n) | (15n << 36n) | 441000n);
    return new Blob([encoder.encode('fLaC'), block(0, streamInfo, metadata.length === 0), ...metadata, audio], { type: 'audio/flac' });
}
