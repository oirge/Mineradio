import { CustomSource, EncodedAudioPacketSource, EncodedPacketSink, Input, Output, Quality,
    StreamTarget, VideoSampleSink, VideoSampleSource, WEBM, WebMOutputFormat } from 'mediabunny';
import type { VideoExportBridge, VideoExportFinalize } from './videoExportBridge';
import { opusPacketDuration } from './videoExportOpus';

// Recorded tab frames are variable-rate. Encode an actual frame at n / FPS,
// holding the preceding picture across a capture gap. This is CFR resampling,
// not motion interpolation. The original Opus packets pass through unchanged.
// Reads, decoder samples, encoder queues and writes are all bounded/backpressured.
export async function finalizeVideoFrameRate(job: VideoExportFinalize, bridge: VideoExportBridge) {
    const chunkSize = 1024 * 1024;
    const input = new Input({ formats: [WEBM], source: new CustomSource({
        getSize: () => job.size, maxCacheSize: 8 * chunkSize,
        read: (start, end) => new ReadableStream<Uint8Array<ArrayBuffer>>({
            async pull(controller) {
                try {
                    if (start >= end) { controller.close(); return; }
                    const length = Math.min(chunkSize, end - start);
                    const bytes = await bridge.readRecording({ id: job.id, position: start, length });
                    controller.enqueue(new Uint8Array(bytes)); start += length;
                } catch (error) { controller.error(error); }
            },
        }),
    }) });
    let sequence = 0;
    const output = new Output({ format: new WebMOutputFormat(), target: new StreamTarget(new WritableStream({
        async write({ data, position }) {
            for (let offset = 0; offset < data.length; offset += chunkSize) {
                await bridge.writeFinalized({ id: job.id, sequence: sequence++, position: position + offset,
                    bytes: data.subarray(offset, Math.min(data.length, offset + chunkSize)) });
            }
        },
    }), { chunked: true, chunkSize }) });
    const [videoTrack] = await input.getVideoTracks(), [audioTrack] = await input.getAudioTracks();
    if (!videoTrack || !audioTrack || audioTrack.codec !== 'opus') {
        input.dispose(); throw new Error('The recording is missing its video or original Opus audio.');
    }
    const video = new VideoSampleSource({ codec: 'vp8', latencyMode: 'quality',
        quality: new Quality({ bitrate: (job.width * job.height > 1_000_000 ? 14_000_000 : 8_000_000) * job.frameRate / 30 }) });
    const audio = new EncodedAudioPacketSource('opus');
    output.addVideoTrack(video, { frameRate: job.frameRate });
    output.addAudioTrack(audio);
    const videoSamples = new VideoSampleSink(videoTrack).samples();
    const audioSink = new EncodedPacketSink(audioTrack);
    const audioPackets = audioSink.packets();
    let current: Awaited<ReturnType<typeof videoSamples.next>> | undefined;
    let next: Awaited<ReturnType<typeof videoSamples.next>> | undefined;
    let complete = false;
    try {
        // MediaRecorder's final SimpleBlock can have container duration zero.
        // Its Opus TOC supplies the actual tail; keep the original presentation
        // timestamps, including the initial offset, to preserve picture sync.
        const lastAudioPacket = await audioSink.getPacket(Infinity);
        const duration = lastAudioPacket ? lastAudioPacket.timestamp + opusPacketDuration(lastAudioPacket.data) : 0;
        if (!(duration > 0) || !Number.isFinite(duration)) throw new Error('The recording has no finite audio duration.');
        const audioConfig = await audioTrack.getDecoderConfig();
        if (!audioConfig) throw new Error('The original audio configuration is missing.');
        await output.start();
        current = await videoSamples.next();
        if (current.done) throw new Error('The recording has no video frames.');
        next = await videoSamples.next();
        let packet = await audioPackets.next(), audioStarted = false, lastProgressAt = 0;
        const count = Math.ceil(duration * job.frameRate);
        for (let index = 0; index < count; index++) {
            const timestamp = index / job.frameRate;
            while (!next.done && next.value.timestamp <= timestamp + 1e-6) {
                current.value.close(); current = next; next = await videoSamples.next();
            }
            const sample = current.value.clone();
            sample.setTimestamp(timestamp); sample.setDuration(1 / job.frameRate);
            try { await video.add(sample); } finally { sample.close(); }
            // Interleave tracks so the muxer never buffers an entire song.
            while (!packet.done && packet.value.timestamp <= (index + 1) / job.frameRate) {
                await audio.add(packet.value.clone({ duration: opusPacketDuration(packet.value.data) }), audioStarted ? undefined : { decoderConfig: audioConfig });
                audioStarted = true; packet = await audioPackets.next();
            }
            if (performance.now() - lastProgressAt >= 250) {
                lastProgressAt = performance.now(); bridge.encodingProgress(job.id, (index + 1) / count);
            }
            if (index % 8 === 7) await new Promise(resolve => setTimeout(resolve, 0));
        }
        video.close();
        while (!packet.done) {
            await audio.add(packet.value.clone({ duration: opusPacketDuration(packet.value.data) }), audioStarted ? undefined : { decoderConfig: audioConfig });
            audioStarted = true; packet = await audioPackets.next();
        }
        audio.close();
        await output.finalize(); complete = true;
        bridge.encodingProgress(job.id, 1);
        await bridge.finalized(job.id);
    } finally {
        if (current && !current.done) current.value.close();
        if (next && !next.done) next.value.close();
        await videoSamples.return(); await audioPackets.return();
        if (!complete) await output.cancel().catch(() => {});
        input.dispose();
    }
}
