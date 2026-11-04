// src/mineradio/local/videoExportOpus.ts
// RFC 6716 sections 3.1/3.2: derive duration from the packet, including a final
// WebM SimpleBlock whose container supplies no duration or following timestamp.
export function opusPacketDuration(packet: Uint8Array): number {
    if (!packet.length) throw new Error('The recording contains an empty Opus packet.');
    const config = packet[0] >> 3, code = packet[0] & 3;
    const frameMilliseconds = config < 12 ? [10, 20, 40, 60][config & 3]
        : config < 16 ? [10, 20][config & 1] : [2.5, 5, 10, 20][config & 3];
    if (code === 3 && packet.length < 2) throw new Error('The Opus frame count is missing.');
    const count = code === 0 ? 1 : code === 3 ? packet[1] & 63 : 2;
    const milliseconds = frameMilliseconds * count;
    if (!count || count > 48 || milliseconds > 120) throw new Error('The Opus packet duration is invalid.');
    return milliseconds / 1000;
}
