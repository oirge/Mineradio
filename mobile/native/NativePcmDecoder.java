package com.mineradio.oirge.mobile;

import android.content.Context;
import android.media.AudioFormat;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.net.Uri;
import android.os.Process;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/** A cancellable, bounded decoder. Only the worker owns the extractor and codec. */
final class NativePcmDecoder implements AutoCloseable {
    static final int SAMPLE_RATE = 48000;
    private static final int CAPACITY_FRAMES = SAMPLE_RATE * 2;
    private static final int CHUNK_FRAMES = 1024;
    private static final int RESAMPLE_PHASES = 512;
    private static final int HISTORY_FRAMES = 512;
    private final Context context;
    private final String uri;
    private final long startUs;
    private final Object lock = new Object();
    private final float[] ring = new float[CAPACITY_FRAMES * 2];
    private final float[] chunk = new float[CHUNK_FRAMES * 2];
    private final float[] history = new float[HISTORY_FRAMES * 2];
    private Thread worker;
    private int readFrame, writeFrame, bufferedFrames, chunkFrames;
    private int sourceRate, channels, encoding = AudioFormat.ENCODING_PCM_16BIT;
    private int encoderDelay, encoderPadding, delayRemaining, reservedTailFrames;
    private long sourceFrame, resampleOutputFrames;
    private double nextOutputFrame;
    private float firstLeft, firstRight, previousLeft, previousRight;
    private float[][] resampleCoefficients;
    private int resampleRadius;
    private boolean hasPrevious;
    private volatile boolean started, cancelled, ready, decodedEnd;
    private volatile String error = "";
    private volatile double duration;

    NativePcmDecoder(Context context, String uri, double startSeconds) {
        if (uri == null || !uri.startsWith("content://")) throw new IllegalArgumentException("UNAUTHORIZED_AUDIO_URI");
        this.context = context.getApplicationContext();
        this.uri = uri;
        this.startUs = Double.isFinite(startSeconds) ? Math.max(0L, (long) (startSeconds * 1000000.0)) : 0L;
    }

    synchronized void start() {
        if (started || cancelled) return;
        started = true;
        worker = new Thread(this::decode, "MineradioPcmDecoder");
        worker.start();
    }

    /** Reads interleaved stereo frames without waiting for the decoder or allocating. */
    int read(float[] destination, int frameOffset, int maxFrames) {
        if (destination == null || frameOffset < 0 || maxFrames < 0
            || frameOffset > destination.length / 2 || maxFrames > destination.length / 2 - frameOffset)
            throw new IllegalArgumentException("INVALID_PCM_READ");
        synchronized (lock) {
            // Keep encoder padding out of the audible queue until EOS identifies the tail.
            int available = Math.max(0, bufferedFrames - (decodedEnd ? 0 : reservedTailFrames));
            int count = Math.min(maxFrames, available);
            int first = Math.min(count, CAPACITY_FRAMES - readFrame);
            System.arraycopy(ring, readFrame * 2, destination, frameOffset * 2, first * 2);
            if (first < count) System.arraycopy(ring, 0, destination, (frameOffset + first) * 2, (count - first) * 2);
            readFrame = (readFrame + count) % CAPACITY_FRAMES;
            bufferedFrames -= count;
            if (count > 0) lock.notifyAll();
            return count;
        }
    }

    boolean ready() { return ready; }
    boolean ended() { synchronized (lock) { return (decodedEnd || cancelled) && bufferedFrames == 0; } }
    String error() { return error; }
    double durationSeconds() { return duration; }

    @Override public void close() {
        cancelled = true;
        synchronized (lock) { bufferedFrames = 0; lock.notifyAll(); }
        Thread active = worker;
        if (active != null) active.interrupt();
    }

    private void decode() {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);
        MediaExtractor extractor = new MediaExtractor();
        MediaCodec codec = null;
        boolean codecStarted = false;
        try {
            extractor.setDataSource(context, Uri.parse(uri), null);
            MediaFormat input = null;
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat candidate = extractor.getTrackFormat(i);
                String mime = candidate.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("audio/")) {
                    extractor.selectTrack(i); input = candidate; break;
                }
            }
            if (input == null) throw new IllegalArgumentException("NO_AUDIO_TRACK");
            duration = input.containsKey(MediaFormat.KEY_DURATION) ? Math.max(0, input.getLong(MediaFormat.KEY_DURATION) / 1000000.0) : 0;
            sourceRate = input.getInteger(MediaFormat.KEY_SAMPLE_RATE);
            channels = input.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
            encoderDelay = integer(input, MediaFormat.KEY_ENCODER_DELAY, 0);
            encoderPadding = integer(input, MediaFormat.KEY_ENCODER_PADDING, 0);
            delayRemaining = startUs == 0 ? Math.max(0, encoderDelay) : 0;
            checkFormat();
            if (startUs > 0) extractor.seekTo(startUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC);
            if ("audio/raw".equals(input.getString(MediaFormat.KEY_MIME))) {
                encoding = integer(input, MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT);
                checkFormat();
                ByteBuffer data = ByteBuffer.allocateDirect(1024 * 1024).order(ByteOrder.LITTLE_ENDIAN);
                while (!cancelled) {
                    data.clear();
                    int bytes = extractor.readSampleData(data, 0);
                    if (bytes < 0) { finishDecoded(); return; }
                    data.position(0); data.limit(bytes);
                    consume(data, extractor.getSampleTime());
                    extractor.advance();
                }
                return;
            }
            codec = MediaCodec.createDecoderByType(input.getString(MediaFormat.KEY_MIME));
            codec.configure(input, null, null, 0);
            codec.start(); codecStarted = true;
            boolean inputEnded = false;
            long progressedAt = System.nanoTime();
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            while (!cancelled) {
                if (!inputEnded) {
                    int id = codec.dequeueInputBuffer(10000);
                    if (id >= 0) {
                        ByteBuffer data = codec.getInputBuffer(id);
                        if (data == null) throw new IllegalStateException("MISSING_CODEC_INPUT");
                        data.clear();
                        int bytes = extractor.readSampleData(data, 0);
                        if (bytes < 0) {
                            codec.queueInputBuffer(id, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputEnded = true;
                        } else {
                            codec.queueInputBuffer(id, 0, bytes, extractor.getSampleTime(), 0);
                            extractor.advance();
                        }
                        progressedAt = System.nanoTime();
                    }
                }
                int id = codec.dequeueOutputBuffer(info, 10000);
                if (id == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    MediaFormat output = codec.getOutputFormat();
                    int nextRate = output.getInteger(MediaFormat.KEY_SAMPLE_RATE);
                    if (hasPrevious && nextRate != sourceRate) throw new IllegalArgumentException("CHANGING_PCM_SAMPLE_RATE");
                    sourceRate = nextRate;
                    channels = output.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
                    encoding = integer(output, MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT);
                    checkFormat();
                    progressedAt = System.nanoTime();
                } else if (id >= 0) {
                    try {
                        if (info.size > 0 && (info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                            ByteBuffer data = codec.getOutputBuffer(id);
                            if (data == null) throw new IllegalStateException("MISSING_CODEC_OUTPUT");
                            data.position(info.offset); data.limit(info.offset + info.size);
                            data.order(ByteOrder.LITTLE_ENDIAN);
                            consume(data, info.presentationTimeUs);
                        }
                    } finally { codec.releaseOutputBuffer(id, false); }
                    progressedAt = System.nanoTime();
                    if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        finishDecoded();
                        break;
                    }
                }
                if (System.nanoTime() - progressedAt > 20000000000L) throw new IllegalStateException("PCM_DECODE_TIMEOUT");
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            if (!cancelled) error = "PCM_DECODER_INTERRUPTED";
        } catch (Exception problem) {
            if (!cancelled) error = problem.getClass().getSimpleName() + ":" + String.valueOf(problem.getMessage());
        } finally {
            if (codec != null) {
                if (codecStarted) { try { codec.stop(); } catch (Exception ignored) {} }
                try { codec.release(); } catch (Exception ignored) {}
            }
            extractor.release();
            synchronized (lock) { decodedEnd = true; lock.notifyAll(); }
        }
    }

    private static int integer(MediaFormat format, String key, int fallback) {
        return format.containsKey(key) ? format.getInteger(key) : fallback;
    }

    private void finishDecoded() throws InterruptedException {
        flushResampler(); flushChunk();
        synchronized (lock) {
            int tail = Math.min(bufferedFrames, reservedTailFrames);
            writeFrame = (writeFrame - tail + CAPACITY_FRAMES) % CAPACITY_FRAMES;
            bufferedFrames -= tail;
            decodedEnd = true; ready = true; lock.notifyAll();
        }
    }

    private void checkFormat() {
        if (sourceRate < 8000 || sourceRate > 384000 || channels < 1 || channels > 8)
            throw new IllegalArgumentException("UNSUPPORTED_PCM_FORMAT");
        int sampleBytes = sampleBytes();
        if (sampleBytes == 0) throw new IllegalArgumentException("UNSUPPORTED_PCM_ENCODING_" + encoding);
        // Malformed metadata must not reserve the entire ring and deadlock playback.
        reservedTailFrames = (int) Math.min(CAPACITY_FRAMES / 4,
            Math.ceil(Math.max(0, encoderPadding) * (double) SAMPLE_RATE / sourceRate));
        if (!hasPrevious) configureResampler();
    }

    private int sampleBytes() {
        if (encoding == AudioFormat.ENCODING_PCM_8BIT) return 1;
        if (encoding == AudioFormat.ENCODING_PCM_16BIT) return 2;
        if (encoding == AudioFormat.ENCODING_PCM_FLOAT || encoding == AudioFormat.ENCODING_PCM_32BIT) return 4;
        if (encoding == AudioFormat.ENCODING_PCM_24BIT_PACKED) return 3;
        return 0;
    }

    private float sample(ByteBuffer data) {
        if (encoding == AudioFormat.ENCODING_PCM_FLOAT) {
            float value = data.getFloat(); return Float.isFinite(value) ? value : 0;
        }
        if (encoding == AudioFormat.ENCODING_PCM_8BIT) return ((data.get() & 255) - 128) / 128f;
        if (encoding == AudioFormat.ENCODING_PCM_16BIT) return data.getShort() / 32768f;
        if (encoding == AudioFormat.ENCODING_PCM_32BIT) return (float) (data.getInt() / 2147483648.0);
        int value = (data.get() & 255) | ((data.get() & 255) << 8) | (data.get() << 16);
        return value / 8388608f;
    }

    private void consume(ByteBuffer data, long timestampUs) throws InterruptedException {
        int frameBytes = sampleBytes() * channels;
        int frames = data.remaining() / frameBytes;
        long delta = Math.max(0, startUs - timestampUs);
        int seekSkip = (int) Math.min(frames, Math.ceil(delta * (double) sourceRate / 1000000.0));
        int skip = (int) Math.min(frames, seekSkip + (long) delayRemaining);
        delayRemaining -= Math.min(delayRemaining, Math.max(0, frames - seekSkip));
        data.position(data.position() + skip * frameBytes);
        for (int i = skip; i < frames && !cancelled; i++) {
            float left = sample(data), right = channels > 1 ? sample(data) : left;
            if (channels > 2) {
                float leftWeight = 1, rightWeight = 1;
                for (int channel = 2; channel < channels; channel++) {
                    float value = sample(data);
                    if (channel == 2) { left += value * .70710678f; right += value * .70710678f; leftWeight += .70710678f; rightWeight += .70710678f; }
                    else if (channel == 3) { left += value * .5f; right += value * .5f; leftWeight += .5f; rightWeight += .5f; }
                    else if ((channel & 1) == 0) { left += value * .70710678f; leftWeight += .70710678f; }
                    else { right += value * .70710678f; rightWeight += .70710678f; }
                }
                left /= leftWeight; right /= rightWeight;
            }
            resample(left, right);
        }
    }

    /** Band-limited conversion avoids folding high-resolution input into the audible band. */
    private void configureResampler() {
        if (sourceRate == SAMPLE_RATE) { resampleCoefficients = null; return; }
        double cutoff = .94 * Math.min(1, SAMPLE_RATE / (double) sourceRate);
        resampleRadius = Math.min(128, Math.max(16, (int) Math.ceil(16 / cutoff)));
        int taps = resampleRadius * 2;
        resampleCoefficients = new float[RESAMPLE_PHASES][taps];
        for (int phase = 0; phase < RESAMPLE_PHASES; phase++) {
            double fraction = phase / (double) RESAMPLE_PHASES, sum = 0;
            for (int tap = 0; tap < taps; tap++) {
                double distance = fraction - (tap - resampleRadius + 1);
                double window = Math.abs(distance) >= resampleRadius ? 0 :
                    .42 + .5 * Math.cos(Math.PI * distance / resampleRadius)
                    + .08 * Math.cos(2 * Math.PI * distance / resampleRadius);
                double value = Math.abs(distance) < 1e-12 ? cutoff :
                    Math.sin(Math.PI * cutoff * distance) / (Math.PI * distance);
                value *= window;
                resampleCoefficients[phase][tap] = (float) value;
                sum += value;
            }
            for (int tap = 0; tap < taps; tap++) resampleCoefficients[phase][tap] /= sum;
        }
    }

    /** Lookahead belongs to decode buffering; output frame positions have no filter delay. */
    private void resample(float left, float right) throws InterruptedException {
        if (!hasPrevious) {
            firstLeft = left; firstRight = right; hasPrevious = true; sourceFrame = 0;
        }
        int slot = (int) (sourceFrame % HISTORY_FRAMES) * 2;
        history[slot] = left; history[slot + 1] = right;
        previousLeft = left; previousRight = right; sourceFrame++;
        if (resampleCoefficients == null) { emit(left, right); return; }
        while ((long) nextOutputFrame + resampleRadius < sourceFrame) renderResampledFrame();
    }

    private void flushResampler() throws InterruptedException {
        if (!hasPrevious || resampleCoefficients == null) return;
        while (nextOutputFrame < sourceFrame) renderResampledFrame();
    }

    private void renderResampledFrame() throws InterruptedException {
        long base = (long) nextOutputFrame;
        int phase = Math.min(RESAMPLE_PHASES - 1, (int) ((nextOutputFrame - base) * RESAMPLE_PHASES));
        float[] coefficients = resampleCoefficients[phase];
        double left = 0, right = 0;
        for (int tap = 0; tap < coefficients.length; tap++) {
            long at = base + tap - resampleRadius + 1;
            float l, r;
            if (at < 0) { l = firstLeft; r = firstRight; }
            else if (at >= sourceFrame) { l = previousLeft; r = previousRight; }
            else {
                int slot = (int) (at % HISTORY_FRAMES) * 2;
                l = history[slot]; r = history[slot + 1];
            }
            left += l * coefficients[tap]; right += r * coefficients[tap];
        }
        emit((float) left, (float) right);
        nextOutputFrame = ++resampleOutputFrames * (double) sourceRate / SAMPLE_RATE;
    }

    private void emit(float left, float right) throws InterruptedException {
        chunk[chunkFrames * 2] = left; chunk[chunkFrames * 2 + 1] = right;
        if (++chunkFrames == CHUNK_FRAMES) flushChunk();
    }

    private void flushChunk() throws InterruptedException {
        if (chunkFrames == 0 || cancelled) return;
        synchronized (lock) {
            while (!cancelled && CAPACITY_FRAMES - bufferedFrames < chunkFrames) lock.wait();
            if (cancelled) return;
            int first = Math.min(chunkFrames, CAPACITY_FRAMES - writeFrame);
            System.arraycopy(chunk, 0, ring, writeFrame * 2, first * 2);
            if (first < chunkFrames) System.arraycopy(chunk, first * 2, ring, 0, (chunkFrames - first) * 2);
            writeFrame = (writeFrame + chunkFrames) % CAPACITY_FRAMES;
            bufferedFrames += chunkFrames;
            if (bufferedFrames - reservedTailFrames >= CHUNK_FRAMES * 2) ready = true;
            chunkFrames = 0;
            lock.notifyAll();
        }
    }
}
