'use strict';

// Reserve a Duration in Chromium's streaming WebM header. At most 64 KiB of the
// prefix is inspected; finalization patches eight bytes without loading the video.
function element(bytes, offset, limit = bytes.length) {
  function vint(at, maximum, keepMarker) {
    if (at >= limit || !bytes[at]) return null;
    let width = 1, marker = 128;
    while (!(bytes[at] & marker)) { width++; marker >>= 1; }
    if (width > maximum || at + width > limit) return null;
    let value = BigInt(keepMarker ? bytes[at] : bytes[at] & (marker - 1));
    for (let index = 1; index < width; index++) value = (value << 8n) | BigInt(bytes[at + index]);
    return { width, value, unknown: !keepMarker && value === (1n << BigInt(width * 7)) - 1n };
  }
  const id = vint(offset, 4, true);
  const size = id && vint(offset + id.width, 8, false);
  if (!size) return null;
  const start = offset + id.width + size.width;
  const end = size.unknown ? limit : start + Number(size.value);
  return { id: Number(id.value), start, end, size, sizeAt: offset + id.width };
}

function reserveWebmDuration(bytes) {
  const limit = Math.min(bytes.length, 64 * 1024);
  const magic = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
  const incomplete = { bytes, needsMore: bytes.length < 64 * 1024 };
  if (!bytes.subarray(0, Math.min(limit, 4)).equals(magic.subarray(0, Math.min(limit, 4)))) return { bytes };
  const ebml = element(bytes, 0, limit);
  if (!ebml || ebml.end > limit) return incomplete;
  if (ebml.id !== 0x1a45dfa3) return { bytes };
  const segment = element(bytes, ebml.end, limit);
  if (!segment) return incomplete;
  if (segment.id !== 0x18538067 || !segment.size.unknown) return { bytes };
  for (let offset = segment.start; offset < limit;) {
    const entry = element(bytes, offset, limit);
    if (!entry || entry.end > limit) return incomplete;
    if (entry.size.unknown || entry.end <= offset) return { bytes };
    // A pre-existing seek table would need its positions rewritten after insertion.
    if (entry.id === 0x114d9b74 || entry.id === 0x1f43b675) return { bytes };
    if (entry.id === 0x1549a966) {
      let scale = 1_000_000;
      for (let childAt = entry.start; childAt < entry.end;) {
        const child = element(bytes, childAt, entry.end);
        if (!child || child.end > entry.end || child.end <= childAt || child.size.unknown || child.id === 0xbf) return { bytes };
        if (child.id === 0x4489) return { bytes }; // Already finalized by the browser.
        if (child.id === 0x2ad7b1) {
          const length = child.end - child.start;
          if (length < 1 || length > 6) return { bytes };
          scale = bytes.readUIntBE(child.start, length);
          if (!scale) return { bytes };
        }
        childAt = child.end;
      }
      const length = Number(entry.size.value) + 11;
      let width = entry.size.width;
      while (BigInt(length) >= (1n << BigInt(width * 7)) - 1n) width++;
      const size = Buffer.alloc(width);
      let encoded = BigInt(length) | (1n << BigInt(width * 7));
      for (let index = width - 1; index >= 0; index--) { size[index] = Number(encoded & 255n); encoded >>= 8n; }
      const duration = Buffer.from([0x44, 0x89, 0x88, 0, 0, 0, 0, 0, 0, 0, 0]);
      return { bytes: Buffer.concat([bytes.subarray(0, entry.sizeAt), size, bytes.subarray(entry.start, entry.end), duration, bytes.subarray(entry.end)]),
        durationOffset: entry.end + width - entry.size.width + 3, scale };
    }
    offset = entry.end;
  }
  return incomplete;
}

module.exports = { reserveWebmDuration };
