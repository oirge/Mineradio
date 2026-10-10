'use strict';

const fs = require('fs');
const { Readable } = require('stream');

// Serves only cache entries resolved by opaque keys, including media-element Range requests.

const TRANSCODE_PROTOCOL_SCHEME = 'folia-transcode';
const CACHE_KEY_PATTERN = /^[a-f0-9]{64}$/;

const parseRangeHeader = (value, size) => {
    if (!value) return null;
    const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
    if (!match) return { invalid: true };
    let start = match[1] ? Number(match[1]) : null;
    let end = match[2] ? Number(match[2]) : null;
    if (start === null) {
        if (end === null || end <= 0) return { invalid: true };
        start = Math.max(size - end, 0);
        end = size - 1;
    } else {
        end = end === null ? size - 1 : Math.min(end, size - 1);
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
        return { invalid: true };
    }
    return { start, end };
};

const parseTranscodeUrl = value => {
    try {
        const url = new URL(value);
        if (url.protocol !== `${TRANSCODE_PROTOCOL_SCHEME}:` || url.hostname !== 'media') return null;
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length !== 2 || !CACHE_KEY_PATTERN.test(parts[0])) return null;
        if (parts[1] !== 'audio.flac' && parts[1] !== 'audio.wav') return null;
        return { cacheKey: parts[0], format: parts[1].endsWith('.flac') ? 'flac' : 'wav' };
    } catch {
        return null;
    }
};

const createProtocolResponse = async (request, resolveEntry) => {
    const parsed = parseTranscodeUrl(request.url);
    if (!parsed) return new Response('Not found', { status: 404 });
    const entry = await resolveEntry(parsed.cacheKey, parsed.format);
    if (!entry) return new Response('Not found', { status: 404 });
    // A prune or a cache clear can remove the entry between resolution and this read. That is a
    // 404 for the media element, not a rejected protocol handler.
    let stat;
    try {
        stat = await fs.promises.stat(entry.audioPath);
    } catch {
        return new Response('Not found', { status: 404 });
    }
    const range = parseRangeHeader(request.headers.get('range'), stat.size);
    if (range?.invalid) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
    }

    const headers = {
        'Accept-Ranges': 'bytes',
        'Content-Type': entry.mimeType,
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Length': String(range ? range.end - range.start + 1 : stat.size),
    };
    if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${stat.size}`;
    if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });

    try {
        const nodeStream = fs.createReadStream(entry.audioPath, range ? { start: range.start, end: range.end } : undefined);
        return new Response(Readable.toWeb(nodeStream), { status: range ? 206 : 200, headers });
    } catch {
        return new Response('Not found', { status: 404 });
    }
};

const registerTranscodeProtocol = ({ protocol, resolveEntry }) => {
    protocol.handle(TRANSCODE_PROTOCOL_SCHEME, request => createProtocolResponse(request, resolveEntry));
};

module.exports = {
    TRANSCODE_PROTOCOL_SCHEME,
    createProtocolResponse,
    parseRangeHeader,
    parseTranscodeUrl,
    registerTranscodeProtocol,
};
