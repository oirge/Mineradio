package com.mineradio.oirge.mobile;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.media.PlaybackParams;
import android.os.Handler;
import android.os.Looper;
import android.os.Process;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.locks.ReentrantLock;

/** One service-owned PCM mixer and AudioTrack for every visible and hidden playback state. */
final class NativeAudioEngine {
    interface Listener { void changed(); void completed(); }
    private static final int RATE = 48000, BLOCK = 512;
    private final Context context;
    private final Listener listener;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ReentrantLock mutex = new ReentrantLock(true);
    private final NativeAudioDsp dsp = new NativeAudioDsp();
    private final NativeUiSound ui = new NativeUiSound();
    private boolean uiDraining;
    private final Thread worker;
    private volatile boolean closed;
    private AudioTrack sink;
    private NativePcmDecoder active, upcoming, retiring;
    private JSONArray queue = new JSONArray();
    private JSONObject effects = new JSONObject();
    private int index, nextIndex = -1, retiringFrames, crossfadeFrames, upcomingFailures;
    private int trackFadeFrames, trackFadeTotal;
    private boolean wanted, started, preparing, stopAfterTrack, gaplessEnabled = true, draining, upcomingUnavailable;
    private double startPosition, duration, rate = 1, crossfadeSeconds;
    private String mode = "loop", error = "", upcomingError = "";
    private long submittedFrames, outputFrames, originFrames, trackGeneration, sinkCreations, completions;
    private long lastRawHead, headWrapOffset, crossfadeCount, overlapFrames;
    private long crossfadeWrittenOverlap, crossfadeProofOverlap, crossfadeProofHead;
    private long witnessGeneration = -1, witnessCount, witnessOverlap, witnessSubmitted, witnessHead;
    private long witnessOutput, witnessAt, witnessSinkCreations;
    private int witnessIndex, witnessSession, witnessRetiringFrames;
    private float master = 1, gainStart = 1, gainTarget = 1;
    private long gainAt, gainDuration;
    private float replayLinear = 1;
    private final float[] mixed = new float[BLOCK * 2], other = new float[BLOCK * 2];
    private final float[] output = new float[BLOCK * 2];

    NativeAudioEngine(Context context, Listener listener) {
        this.context = context.getApplicationContext(); this.listener = listener;
        worker = new Thread(this::run, "Mineradio-PCM"); worker.start();
    }
    private JSONObject item(int at) { JSONObject result = queue.optJSONObject(at); return result == null ? new JSONObject() : result; }
    private void notifyChanged() { main.post(listener::changed); }
    private void release(NativePcmDecoder decoder) { if (decoder != null) decoder.close(); }
    private void configureTrackGain() {
        replayLinear = (float) item(index).optDouble("replayGain", 1);
        try { effects.put("replayGain", replayLinear).put("master", 1); } catch (Exception ignored) {}
        dsp.configure(effects);
    }
    void start(JSONObject state) {
        mutex.lock();
        try {
            JSONArray incoming = state.optJSONArray("queue");
            if (incoming == null || incoming.length() == 0) throw new IllegalArgumentException("EMPTY_NATIVE_QUEUE");
            queue = incoming;
            index = Math.max(0, Math.min(queue.length() - 1, state.optInt("index", 0)));
            configure(state);
            gain((float) state.optDouble("initialGain", state.optDouble("volume", 1)), 0);
            wanted = state.optBoolean("resumePlaying", state.optBoolean("playing", false));
            load(state.optDouble("position", 0), true, false);
        } finally { mutex.unlock(); }
        notifyChanged();
    }
    void configure(JSONObject state) {
        mutex.lock();
        try {
            JSONObject incoming = state.optJSONObject("audioEffects");
            if (incoming == null) incoming = state.optJSONObject("effects");
            if (incoming != null) effects = incoming;
            mode = state.optString("playMode", mode);
            stopAfterTrack = state.optBoolean("stopAfterTrack", stopAfterTrack);
            JSONObject gapless = state.optJSONObject("gapless");
            if (gapless != null) {
                crossfadeSeconds = Math.max(0, Math.min(10, gapless.optDouble("crossfadeSeconds", 0)));
                gaplessEnabled = gapless.optBoolean("enabled", true);
                if (!gaplessEnabled && crossfadeSeconds == 0) {
                    release(upcoming); upcoming = null; nextIndex = -1;
                }
            }
            double nextRate = Math.max(.5, Math.min(2, state.optDouble("rate", rate)));
            if (rate != nextRate) {
                rate = nextRate;
                if (sink != null) {
                    boolean wasPlaying = sink.getPlayState() == AudioTrack.PLAYSTATE_PLAYING;
                    sink.setPlaybackParams(new PlaybackParams().setSpeed((float) rate).setPitch(1));
                    if (!wasPlaying || !wanted) sink.pause();
                }
            }
            configureTrackGain();
        } finally { mutex.unlock(); }
    }
    void updateQueue(JSONArray value) {
        mutex.lock();
        try {
            String uri = item(index).optString("uri");
            int at = value.optJSONObject(index) != null && uri.equals(value.optJSONObject(index).optString("uri")) ? index : -1;
            for (int i = 0; at < 0 && i < value.length(); i++) {
                JSONObject song = value.optJSONObject(i);
                if (song != null && uri.equals(song.optString("uri"))) { at = i; break; }
            }
            if (at < 0) return;
            if (at != index) resetCrossfadeWitness();
            queue = value; index = at; configureTrackGain();
            release(upcoming); upcoming = null; nextIndex = -1; upcomingUnavailable = false; upcomingFailures = 0;
        } finally { mutex.unlock(); }
    }
    private void load(double seconds, boolean flush, boolean fade) {
        release(active); release(upcoming); release(retiring);
        upcoming = retiring = null; nextIndex = -1; retiringFrames = 0;
        resetCrossfadeWitness();
        draining = upcomingUnavailable = false; upcomingFailures = 0; upcomingError = "";
        startPosition = Math.max(0, seconds); duration = item(index).optDouble("duration", 0);
        if (flush && sink != null) {
            sink.pause(); sink.flush(); submittedFrames = 0;
            lastRawHead = headWrapOffset = 0;
        }
        originFrames = submittedFrames;
        active = new NativePcmDecoder(context, item(index).optString("uri"), startPosition); active.start();
        preparing = true; started = false; error = ""; trackGeneration++;
        trackFadeFrames = trackFadeTotal = fade ? (int) (.460 * RATE) : 0;
    }
    void play() { play(null); }
    void play(Float initialGain) {
        mutex.lock();
        try {
            if (initialGain != null) gain(initialGain, 0);
            wanted = true;
            if (active == null || (active.ended() && head() >= submittedFrames)) load(0, true, true);
        } finally { mutex.unlock(); }
    }
    void pause() {
        mutex.lock();
        try { wanted = false; if (sink != null) sink.pause(); }
        finally { mutex.unlock(); }
        notifyChanged();
    }
    void seek(double seconds) {
        mutex.lock();
        try { load(Math.max(0, Math.min(seconds, Math.max(0, duration - .001))), true, false); }
        finally { mutex.unlock(); }
        notifyChanged();
    }
    void advance(int delta) {
        mutex.lock();
        try {
            if (queue.length() == 0) return;
            index = Math.floorMod(index + delta, queue.length()); wanted = true; load(0, true, true); configureTrackGain();
        } finally { mutex.unlock(); }
        notifyChanged();
    }
    void uiSound(int direction, boolean row, float userVolume) {
        mutex.lock();
        try {
            if (!wanted && active != null) {
                // A click-only write must not resume the music retained in the paused sink.
                double frozen = position(); load(frozen, true, false);
            }
            ui.start(direction, row, userVolume); uiDraining = false;
        } finally { mutex.unlock(); }
    }
    void gain(float value, long milliseconds) {
        mutex.lock();
        try {
            long now = System.nanoTime(); master = gain(now);
            gainStart = master; gainTarget = Math.max(0, Math.min(1, value));
            gainAt = now; gainDuration = Math.max(0, milliseconds) * 1000000L;
            if (gainDuration == 0) master = gainTarget;
        } finally { mutex.unlock(); }
    }
    private float gain(long now) {
        if (gainDuration <= 0) return gainTarget;
        double t = Math.min(1, Math.max(0, (now - gainAt) / (double) gainDuration));
        return (float) (gainStart + (gainTarget - gainStart) * t);
    }
    private long head() {
        if (sink == null) return 0;
        long raw = Integer.toUnsignedLong(sink.getPlaybackHeadPosition());
        if (raw < lastRawHead && lastRawHead - raw > 0x7fffffffL) headWrapOffset += 0x100000000L;
        lastRawHead = raw;
        return Math.min(submittedFrames, headWrapOffset + raw);
    }
    private void resetCrossfadeWitness() {
        crossfadeWrittenOverlap = crossfadeProofOverlap = crossfadeProofHead = 0;
        witnessGeneration = -1;
    }
    /** Lock-held primitive bookkeeping; JSON is assembled only when a caller requests a snapshot. */
    private void recordCrossfadeWrite(int acceptedOverlap) {
        if (acceptedOverlap <= 0) return;
        crossfadeWrittenOverlap += acceptedOverlap;
        if (crossfadeProofOverlap == 0 && crossfadeWrittenOverlap > 4800) {
            // Freeze the same count and sink boundary. Later accepted samples may still
            // be queued, so they cannot increase the number proven to have played.
            crossfadeProofOverlap = crossfadeWrittenOverlap;
            crossfadeProofHead = submittedFrames;
        }
        if (witnessGeneration >= 0 || crossfadeProofOverlap == 0 || retiring == null
            || retiringFrames <= 0 || !wanted || !started || closed
            || sink.getPlayState() != AudioTrack.PLAYSTATE_PLAYING) return;
        long played = head();
        if (played < crossfadeProofHead) return;
        witnessGeneration = trackGeneration; witnessCount = crossfadeCount;
        witnessOverlap = crossfadeProofOverlap; witnessSubmitted = crossfadeProofHead;
        witnessHead = played; witnessOutput = outputFrames; witnessAt = System.currentTimeMillis();
        witnessIndex = index; witnessSession = sink.getAudioSessionId(); witnessSinkCreations = sinkCreations;
        witnessRetiringFrames = retiringFrames;
    }
    private double position() { return startPosition + Math.max(0, head() - originFrames) / (double) RATE; }
    private void ensureSink() {
        if (sink != null) return;
        int minimum = AudioTrack.getMinBufferSize(RATE, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_FLOAT);
        sink = new AudioTrack.Builder().setAudioAttributes(new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setAudioFormat(new AudioFormat.Builder().setSampleRate(RATE).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                .setEncoding(AudioFormat.ENCODING_PCM_FLOAT).build())
            // Local music can reserve half a second of PCM to absorb scheduler
            // stalls during lock-screen/UI transitions. Pause and seek still
            // stop/flush this same sink immediately, one 512-frame write at a time.
            .setBufferSizeInBytes(Math.max(minimum, RATE * 2 * 4 / 2)).setTransferMode(AudioTrack.MODE_STREAM).build();
        if (sink.getState() != AudioTrack.STATE_INITIALIZED) throw new IllegalStateException("AUDIO_TRACK_INIT_FAILED");
        sinkCreations++;
        if (rate != 1) sink.setPlaybackParams(new PlaybackParams().setSpeed((float) rate).setPitch(1));
        sink.pause();
    }
    private int previewIndex() { return "single".equals(mode) ? index : (index + 1) % queue.length(); }
    private void prefetch(double decodedPosition, boolean atEnd) {
        if (stopAfterTrack || upcoming != null || upcomingUnavailable || queue.length() == 0) return;
        if (!atEnd && ((!gaplessEnabled && crossfadeSeconds == 0) || duration <= 0
            || duration - decodedPosition > Math.max(20, crossfadeSeconds + 6))) return;
        if (nextIndex < 0) nextIndex = previewIndex();
        upcoming = new NativePcmDecoder(context, item(nextIndex).optString("uri"), 0); upcoming.start();
    }
    private void checkUpcoming() {
        if (upcoming == null || upcoming.error().isEmpty()) return;
        upcomingError = upcoming.error(); release(upcoming); upcoming = null;
        if (++upcomingFailures >= Math.min(queue.length(), 8)) { upcomingUnavailable = true; nextIndex = -1; }
        else nextIndex = (nextIndex + 1) % queue.length();
    }
    private void transition(boolean fading) {
        if (upcoming == null || !upcoming.ready()) return;
        if (fading) {
            resetCrossfadeWitness();
            retiring = active; retiringFrames = crossfadeFrames = Math.max(1, (int) (Math.min(crossfadeSeconds, (duration - .35) / 2) * RATE));
            crossfadeCount++; trackFadeFrames = trackFadeTotal = 0;
        }
        else {
            release(active); release(retiring); retiring = null; retiringFrames = 0;
        }
        active = upcoming; upcoming = null; index = nextIndex; nextIndex = -1;
        startPosition = 0; originFrames = submittedFrames; duration = active.durationSeconds();
        if (!fading) trackFadeFrames = trackFadeTotal = (int) ((gaplessEnabled ? .012 : .460) * RATE);
        draining = upcomingUnavailable = false; upcomingFailures = 0; upcomingError = "";
        configureTrackGain(); trackGeneration++; completions++;
        main.post(listener::completed); notifyChanged();
    }
    private void run() {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);
        try {
            while (!closed) {
                int frames = 0;
                mutex.lock();
                try {
                    if (wanted && active != null) {
                        if (started && sink != null && sink.getPlayState() != AudioTrack.PLAYSTATE_PLAYING) sink.play();
                        if (draining) {
                            // The decoder may be empty while the sink still has its final 200 ms.
                            // Keep the session playing until those samples have reached the head.
                            if (head() >= submittedFrames) {
                                if (sink != null) sink.pause();
                                wanted = started = preparing = draining = false; stopAfterTrack = false;
                                completions++; main.post(listener::completed); notifyChanged();
                            }
                        }
                        else if (!active.error().isEmpty()) {
                            error = active.error(); wanted = false; preparing = false;
                            if (sink != null) sink.pause();
                            notifyChanged();
                        }
                        else if (active.ready()) {
                            ensureSink();
                            if (preparing) { preparing = false; duration = active.durationSeconds(); notifyChanged(); }
                            double decodedPosition = startPosition + (submittedFrames - originFrames) / (double) RATE;
                            checkUpcoming(); prefetch(decodedPosition, false);
                            double cross = Math.max(0, Math.min(crossfadeSeconds, (duration - .35) / 2));
                            if (retiring == null && !stopAfterTrack && nextIndex != index && cross > 0 && duration - decodedPosition <= cross) transition(true);
                            // Fill the stopped sink before its first play. Never issue a
                            // blocking write beyond its capacity while the head is stopped.
                            int capacity = sink.getBufferSizeInFrames();
                            int primeFrames = Math.max(1, capacity * 3 / 4);
                            int blockFrames = started ? BLOCK : Math.min(BLOCK, Math.max(0,
                                primeFrames - (int) (submittedFrames - head())));
                            frames = active.read(mixed, 0, blockFrames);
                            if (frames == 0 && active.ended()) {
                                if (stopAfterTrack || upcomingUnavailable) {
                                    draining = true;
                                    if (upcomingUnavailable) error = upcomingError;
                                } else {
                                    prefetch(duration, true); checkUpcoming();
                                    if (upcomingUnavailable) { draining = true; error = upcomingError; }
                                    else { transition(false); frames = active.read(mixed, 0, blockFrames); }
                                }
                            }
                            if (frames > 0) {
                                int blockOverlap = 0;
                                if (retiring != null) {
                                    int oldFrames = retiring.read(other, 0, frames);
                                    blockOverlap = Math.min(oldFrames, Math.min(frames, Math.max(0, retiringFrames)));
                                    overlapFrames += blockOverlap;
                                    for (int f = 0; f < frames; f++) {
                                        double t = Math.min(1, Math.max(0, 1 - retiringFrames / (double) crossfadeFrames));
                                        float in = (float) Math.sin(t * Math.PI / 2), out = (float) Math.cos(t * Math.PI / 2);
                                        for (int c = 0; c < 2; c++) mixed[f * 2 + c] = mixed[f * 2 + c] * in + (f < oldFrames ? other[f * 2 + c] : 0) * out;
                                        retiringFrames--;
                                    }
                                    if (retiringFrames <= 0) { release(retiring); retiring = null; }
                                }
                                dsp.process(mixed, frames);
                                long now = System.nanoTime();
                                for (int f = 0; f < frames; f++) {
                                    master = gain(now + (long) (f * 1000000000.0 / (RATE * rate)));
                                    float fade = trackFadeFrames > 0 && trackFadeTotal > 0
                                        ? Math.max(0, 1 - trackFadeFrames / (float) trackFadeTotal) : 1;
                                    if (trackFadeFrames > 0) trackFadeFrames--;
                                    output[f * 2] = Math.max(-1, Math.min(1, mixed[f * 2] * master * fade));
                                    output[f * 2 + 1] = Math.max(-1, Math.min(1, mixed[f * 2 + 1] * master * fade));
                                }
                                ui.mix(output, frames);
                                for (int n = 0; n < frames * 2; n++) output[n] = Math.max(-1, Math.min(1, output[n]));
                                // Writes and stream counters share the lifecycle lock. A pause or
                                // seek cannot flush a block and then have its old writer refill it.
                                int offset = 0;
                                while (offset < frames * 2 && wanted && !closed) {
                                    int written = sink.write(output, offset, frames * 2 - offset, AudioTrack.WRITE_BLOCKING);
                                    if (written <= 0 || (written & 1) != 0) {
                                        error = "AUDIO_TRACK_WRITE_" + written; wanted = false; sink.pause(); notifyChanged(); break;
                                    }
                                    int writeStart = offset / 2;
                                    int acceptedOverlap = Math.max(0, Math.min(blockOverlap, writeStart + written / 2)
                                        - Math.min(blockOverlap, writeStart));
                                    submittedFrames += written / 2; outputFrames += written / 2; offset += written;
                                    if (!started && (sink.getPlayState() == AudioTrack.PLAYSTATE_PLAYING
                                        || submittedFrames - head() >= primeFrames || active.ended())) {
                                        sink.play(); started = true; notifyChanged();
                                    }
                                    recordCrossfadeWrite(acceptedOverlap);
                                }
                            }
                        }
                    }
                    if (!wanted && ui.active()) {
                        ensureSink(); frames = BLOCK;
                        java.util.Arrays.fill(output, 0); ui.mix(output, frames);
                        // No decoder frames are consumed; the song remains at its frozen position.
                        sink.play();
                        int written = sink.write(output, 0, frames * 2, AudioTrack.WRITE_BLOCKING);
                        if (written > 0) { submittedFrames += written / 2; outputFrames += written / 2; originFrames = submittedFrames; }
                        uiDraining = !ui.active();
                    } else if (!wanted && uiDraining && head() >= submittedFrames) {
                        sink.pause(); uiDraining = false; notifyChanged();
                    }
                } finally { mutex.unlock(); }
                // AudioTrack's blocking write already paces productive output. Sleeping
                // after every 512 frames repeatedly drains the reserve under CPU load.
                if (frames == 0) try { Thread.sleep(5); } catch (InterruptedException ignored) {}
            }
        } catch (Exception problem) {
            mutex.lock();
            try { error = problem.toString(); wanted = false; preparing = false; }
            finally { mutex.unlock(); }
            notifyChanged();
        } finally {
            mutex.lock();
            try { release(active); release(upcoming); release(retiring); if (sink != null) { sink.release(); sink = null; } }
            finally { mutex.unlock(); }
        }
    }
    JSObject snapshot(boolean includeQueue) {
        JSObject value;
        mutex.lock();
        try {
            JSONObject song = item(index);
            value = new JSObject().put("nativeActive", active != null).put("backend", "native").put("engine", "pcm")
                .put("playing", wanted && started && !preparing).put("resumePlaying", wanted).put("preparing", wanted && (preparing || !started))
                .put("index", index).put("uri", song.optString("uri")).put("title", song.optString("title")).put("artist", song.optString("artist"))
                .put("position", Math.min(duration > 0 ? duration : Double.MAX_VALUE, position())).put("duration", duration).put("rate", rate)
                .put("masterLevel", master).put("volume", gainTarget).put("playMode", mode).put("stopAfterTrack", stopAfterTrack)
                .put("snapshotAt", System.currentTimeMillis()).put("error", error)
                .put("audioSessionId", sink == null ? 0 : sink.getAudioSessionId()).put("outputFrames", outputFrames)
                .put("playbackHeadFrames", head()).put("underruns", sink == null ? 0 : sink.getUnderrunCount())
                .put("sinkBufferFrames", sink == null ? 0 : sink.getBufferSizeInFrames())
                .put("queuedFrames", Math.max(0, submittedFrames - head()))
                .put("decoderBufferedFrames", active == null ? 0 : active.bufferedFrames())
                .put("sinkCreations", sinkCreations).put("trackGeneration", trackGeneration).put("completions", completions)
                .put("crossfadeActive", retiring != null).put("crossfadeCount", crossfadeCount).put("overlapFrames", overlapFrames)
                .put("gapless", new JSObject().put("enabled", gaplessEnabled).put("crossfadeSeconds", crossfadeSeconds))
                .put("effects", dsp.diagnostics()).put("audioEffects", effects);
            if (witnessGeneration == trackGeneration) value.put("crossfadeWitness", new JSObject()
                .put("active", true).put("count", witnessCount).put("trackGeneration", witnessGeneration)
                .put("audioSessionId", witnessSession).put("sinkCreations", witnessSinkCreations)
                .put("index", witnessIndex).put("retiringFrames", witnessRetiringFrames)
                .put("overlapFrames", witnessOverlap).put("submittedFrames", witnessSubmitted)
                .put("playbackHeadFrames", witnessHead).put("outputFrames", witnessOutput).put("snapshotAt", witnessAt));
            if (includeQueue) value.put("queue", queue);
        } finally { mutex.unlock(); }
        if (includeQueue) value.put("analysis", dsp.analysis());
        return value;
    }
    void close() {
        closed = true; worker.interrupt();
        mutex.lock();
        try { if (sink != null) sink.pause(); release(active); release(upcoming); release(retiring); resetCrossfadeWitness(); }
        finally { mutex.unlock(); }
    }
}
