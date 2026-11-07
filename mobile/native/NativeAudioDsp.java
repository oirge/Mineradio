package com.mineradio.oirge.mobile;

import org.json.JSONArray;
import org.json.JSONObject;

/** Stereo PCM effects used by the service's single AudioTrack, on its audio thread. */
final class NativeAudioDsp {
    static final int SAMPLE_RATE = 48000;
    static final int FFT_SIZE = 2048;
    private static final int RAMP_FRAMES = SAMPLE_RATE * 80 / 1000;
    private static final int ANALYSIS_INTERVAL_FRAMES = SAMPLE_RATE / 30;
    private static final double[] FREQUENCIES = {31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000};
    private static final double ATTACK = Math.exp(-1.0 / (SAMPLE_RATE * .003));
    private static final double RELEASE = Math.exp(-1.0 / (SAMPLE_RATE * .25));
    private final Filter[] filters = new Filter[10];
    // replayGain, preamp, limiter threshold, ratio, stereo width, master, limiter bypass mix.
    private final double[] values = {1, 1, 1, 1, 1, 1, 0};
    private final double[] targets = {1, 1, 1, 1, 1, 1, 0};
    private final double[] increments = new double[7];
    private final Object snapshotLock = new Object();
    private final float[] rawRing = new float[FFT_SIZE];
    private final float[] publishedRaw = new float[FFT_SIZE];
    private final double[] fftReal = new double[FFT_SIZE], fftImag = new double[FFT_SIZE];
    private final double[] visualSpectrum = new double[FFT_SIZE / 2], beatSpectrum = new double[FFT_SIZE / 2];
    private volatile Configuration pending = new Configuration(null);
    private Configuration applied;
    private int rampRemaining, rawCursor, rawSincePublish;
    private long capturedFrames, publishedFrames, processedFrames, invalidSamples, clippedSamples;
    private double limiterGain = 1, inputRms, outputRms, inputSideRms, outputSideRms, inputPeak, outputPeak;
    private double blockInputSquares, blockInputSideSquares, blockInputPeak;
    private JSONObject cachedAnalysis;
    private long lastAnalysisNanos, lastAnalysisFrames = -1;

    NativeAudioDsp() {
        for (int i = 0; i < filters.length; i++) filters[i] = new Filter();
    }

    /** Accepts resolveAudioChainState(), plus independent replayGain and master linear gains. */
    void configure(JSONObject resolved) { pending = new Configuration(resolved); }

    /** Capture before per-deck ReplayGain when the mixer overlaps two tracks. */
    void captureRaw(float[] stereo, int frames) {
        checkBuffer(stereo, frames);
        double squares = 0, sideSquares = 0, peak = 0;
        for (int i = 0; i < frames; i++) {
            float left = finiteSample(stereo[i * 2]), right = finiteSample(stereo[i * 2 + 1]);
            double side = (left - right) * .5;
            squares += (double) left * left + (double) right * right;
            sideSquares += side * side;
            peak = Math.max(peak, Math.max(Math.abs(left), Math.abs(right)));
            rawRing[rawCursor] = (left + right) * .5f;
            rawCursor = (rawCursor + 1) & (FFT_SIZE - 1);
        }
        blockInputSquares = squares; blockInputSideSquares = sideSquares; blockInputPeak = peak;
        capturedFrames += frames; rawSincePublish += frames;
        // Publish a bounded snapshot, without doing FFT or allocating on the audio thread.
        if (rawSincePublish >= ANALYSIS_INTERVAL_FRAMES) {
            rawSincePublish %= ANALYSIS_INTERVAL_FRAMES;
            synchronized (snapshotLock) {
                int tail = FFT_SIZE - rawCursor;
                System.arraycopy(rawRing, rawCursor, publishedRaw, 0, tail);
                System.arraycopy(rawRing, 0, publishedRaw, tail, rawCursor);
                publishedFrames = capturedFrames;
            }
        }
    }

    /** Process a normal block, recording its pre-effects waveform first. */
    void process(float[] stereo, int frames) {
        captureRaw(stereo, frames);
        processEffects(stereo, frames);
    }

    /** Use after captureRaw() when the mixer applies each track's ReplayGain separately. */
    void processEffects(float[] stereo, int frames) {
        checkBuffer(stereo, frames);
        if (frames == 0) return;
        applyPending();
        double squares = 0, sideSquares = 0, peak = 0;
        for (int i = 0; i < frames; i++) {
            if (rampRemaining > 0) {
                for (int p = 0; p < values.length; p++) values[p] += increments[p];
                for (Filter filter : filters) filter.advance();
                if (--rampRemaining == 0) {
                    System.arraycopy(targets, 0, values, 0, values.length);
                    for (Filter filter : filters) filter.finish();
                }
            }
            double left = finiteSample(stereo[i * 2]), right = finiteSample(stereo[i * 2 + 1]);
            if (values[0] != 1) { left *= values[0]; right *= values[0]; }
            for (Filter filter : filters) {
                if (!filter.neutral) {
                    left = filter.sample(left, 0); right = filter.sample(right, 1);
                }
            }
            if (values[1] != 1) { left *= values[1]; right *= values[1]; }
            if (values[3] > 1.00000001) {
                // Preserve the existing hard-knee/ratio/attack/release controls. This linked
                // stereo detector intentionally has no browser-specific compressor makeup gain.
                double level = Math.max(Math.abs(left), Math.abs(right));
                double desired = level > values[2]
                    ? Math.pow(values[2] / level, 1 - 1 / values[3]) : 1;
                double smoothing = desired < limiterGain ? ATTACK : RELEASE;
                limiterGain = desired + smoothing * (limiterGain - desired);
                // Fade the reduction out before ratio1 bypass resets detector history.
                // A releasing detector alone would otherwise jump back to unity at80ms.
                double appliedGain = 1 + (limiterGain - 1) * values[6];
                left *= appliedGain; right *= appliedGain;
            } else limiterGain = 1;
            if (values[4] != 1) {
                double mid = (left + right) * .5, side = (left - right) * .5 * values[4];
                left = mid + side; right = mid - side;
            }
            if (values[5] != 1) { left *= values[5]; right *= values[5]; }
            if (!Double.isFinite(left) || !Double.isFinite(right)) {
                left = right = 0; invalidSamples++;
                for (Filter filter : filters) filter.reset();
                limiterGain = 1;
            }
            // AudioTrack handles final clipping. Do not insert a second, always-on limiter.
            if (Math.abs(left) > 1 || Math.abs(right) > 1) clippedSamples++;
            float outLeft = (float) left, outRight = (float) right;
            stereo[i * 2] = outLeft; stereo[i * 2 + 1] = outRight;
            double side = (outLeft - outRight) * .5;
            squares += (double) outLeft * outLeft + (double) outRight * outRight;
            sideSquares += side * side;
            peak = Math.max(peak, Math.max(Math.abs(outLeft), Math.abs(outRight)));
        }
        synchronized (snapshotLock) {
            processedFrames += frames;
            inputRms = Math.sqrt(blockInputSquares / (frames * 2.0));
            inputSideRms = Math.sqrt(blockInputSideSquares / frames); inputPeak = blockInputPeak;
            outputRms = Math.sqrt(squares / (frames * 2.0));
            outputSideRms = Math.sqrt(sideSquares / frames); outputPeak = peak;
        }
    }

    float[] rawSamples() {
        synchronized (snapshotLock) { return publishedRaw.clone(); }
    }

    /** Browser-compatible analyser lengths/ranges, capped at 30 FFT updates per second. */
    synchronized JSONObject analysis() {
        long now = System.nanoTime(), frames;
        synchronized (snapshotLock) { frames = publishedFrames; }
        if (cachedAnalysis != null && (frames == lastAnalysisFrames || now - lastAnalysisNanos < 1_000_000_000L / 30))
            return cachedAnalysis;
        float[] samples = rawSamples();
        JSONArray time = new JSONArray();
        for (int i = 0; i < FFT_SIZE; i++) {
            double window = .42 - .5 * Math.cos(2 * Math.PI * i / FFT_SIZE) + .08 * Math.cos(4 * Math.PI * i / FFT_SIZE);
            fftReal[i] = samples[i] * window; fftImag[i] = 0;
            time.put(Math.max(0, Math.min(255, (int) Math.floor(128 * (1 + samples[i])))));
        }
        fft(fftReal, fftImag);
        JSONArray frequency = new JSONArray(), beatFrequency = new JSONArray();
        for (int i = 0; i < FFT_SIZE / 2; i++) {
            double magnitude = Math.hypot(fftReal[i], fftImag[i]) / FFT_SIZE;
            visualSpectrum[i] = .58 * visualSpectrum[i] + .42 * magnitude;
            beatSpectrum[i] = .10 * beatSpectrum[i] + .90 * magnitude;
            frequency.put(spectrumByte(visualSpectrum[i])); beatFrequency.put(spectrumByte(beatSpectrum[i]));
        }
        cachedAnalysis = json().put("sampleRate", SAMPLE_RATE).put("fftSize", FFT_SIZE)
            .put("frequency", frequency).put("beatFrequency", beatFrequency).put("timeDomain", time).put("sampleFrames", frames);
        lastAnalysisFrames = frames; lastAnalysisNanos = now;
        return cachedAnalysis;
    }

    JSONObject diagnostics() {
        Configuration config = pending;
        synchronized (snapshotLock) {
            return json().put("sampleRate", SAMPLE_RATE).put("processedFrames", processedFrames)
                .put("inputRms", inputRms).put("outputRms", outputRms)
                .put("inputSideRms", inputSideRms).put("outputSideRms", outputSideRms)
                .put("inputPeak", inputPeak).put("outputPeak", outputPeak)
                .put("reductionDb", -20 * Math.log10(Math.max(1e-12, limiterGain)))
                .put("gains", gainArray(config.gains)).put("preampLinear", config.parameters[1])
                .put("replayGain", config.parameters[0]).put("master", config.parameters[5])
                .put("width", config.parameters[4]).put("thresholdDb", config.thresholdDb)
                .put("ratio", config.parameters[3]).put("invalidSamples", invalidSamples).put("clippedSamples", clippedSamples);
        }
    }

    /** Deterministic production-processor checks; expose only from a debuggable build. */
    static JSONObject selfTest() {
        JSONArray checks = new JSONArray();
        NativeAudioDsp neutral = new NativeAudioDsp();
        float[] noise = testNoise(4096), original = noise.clone();
        noise[0] = original[0] = -0.0f; noise[1] = original[1] = 0.0f;
        neutral.process(noise, noise.length / 2);
        boolean identical = true;
        for (int i = 0; i < noise.length; i++) identical &= Float.floatToRawIntBits(noise[i]) == Float.floatToRawIntBits(original[i]);
        checks.put(json().put("name", "neutralFloatBits").put("passed", identical).put("samples", noise.length));

        NativeAudioDsp mono = new NativeAudioDsp();
        mono.configure(testSettings().put("width", 0));
        float[] stereo = testTones(8192, 250, 1000, .4f);
        mono.process(stereo, stereo.length / 2);
        JSONObject monoStats = mono.diagnostics();
        boolean monoEqual = true;
        for (int i = 0; i < stereo.length; i += 2) monoEqual &= Float.floatToRawIntBits(stereo[i]) == Float.floatToRawIntBits(stereo[i + 1]);
        checks.put(json().put("name", "stereoWidthZero").put("passed", monoEqual && monoStats.optDouble("inputSideRms") > .01
            && monoStats.optDouble("outputSideRms") == 0).put("inputSideRms", monoStats.optDouble("inputSideRms"))
            .put("outputSideRms", monoStats.optDouble("outputSideRms")));

        NativeAudioDsp equalizer = new NativeAudioDsp();
        JSONArray gains = gainArray(new double[] {0, 0, 0, 6, 0, 0, 0, 0, 0, 0});
        equalizer.configure(testSettings().put("gains", gains));
        float[] tone = testTones(SAMPLE_RATE, 250, 250, .05f), toneOriginal = tone.clone();
        equalizer.process(tone, tone.length / 2);
        // Measure the settled last100ms, so filter startup cannot dilute centre-frequency gain.
        double eqRatio = testRms(tone, (SAMPLE_RATE - 4800) * 2) / testRms(toneOriginal, (SAMPLE_RATE - 4800) * 2);
        double expected = Math.pow(10, 6.0 / 20);
        checks.put(json().put("name", "eq250Hz").put("passed", Double.isFinite(eqRatio) && Math.abs(eqRatio - expected) < .03)
            .put("measuredRatio", eqRatio).put("expectedRatio", expected));

        NativeAudioDsp replay = new NativeAudioDsp();
        replay.configure(testSettings().put("replayGain", .5));
        float[] half = testNoise(4096), full = half.clone(); replay.process(half, half.length / 2);
        boolean halfExact = true;
        for (int i = 0; i < half.length; i++) halfExact &= half[i] == full[i] * .5f;
        double replayRatio = testRms(half, 0) / testRms(full, 0);
        checks.put(json().put("name", "replayGainHalf").put("passed", halfExact && Math.abs(replayRatio - .5) < 1e-9)
            .put("measuredRatio", replayRatio));

        NativeAudioDsp limiter = new NativeAudioDsp();
        limiter.configure(testSettings().put("limiter", json().put("enabled", true).put("thresholdDb", -12).put("ratio", 20)));
        float[] loud = testTones(SAMPLE_RATE, 250, 1000, .95f), uncompressed = loud.clone();
        limiter.process(loud, loud.length / 2);
        JSONObject limitedStats = limiter.diagnostics();
        double limiterRatio = testRms(loud, SAMPLE_RATE) / testRms(uncompressed, SAMPLE_RATE);
        checks.put(json().put("name", "linkedLimiterFinite").put("passed", Double.isFinite(limiterRatio)
            && limiterRatio > .05 && limiterRatio < .75 && limitedStats.optDouble("reductionDb") > 3
            && limitedStats.optLong("invalidSamples") == 0).put("measuredRatio", limiterRatio)
            .put("reductionDb", limitedStats.optDouble("reductionDb")));

        limiter.configure(testSettings().put("immediate", false));
        float[] bypass = new float[(RAMP_FRAMES + 1024) * 2];
        java.util.Arrays.fill(bypass, .8f); limiter.process(bypass, bypass.length / 2);
        double bypassStep = Math.abs(bypass[RAMP_FRAMES * 2] - bypass[(RAMP_FRAMES - 1) * 2]);
        boolean bypassTail = true;
        for (int i = RAMP_FRAMES * 2; i < bypass.length; i++) bypassTail &= Float.floatToRawIntBits(bypass[i]) == Float.floatToRawIntBits(.8f);
        checks.put(json().put("name", "smoothLimiterBypass").put("passed", bypassTail && bypassStep < .001)
            .put("boundaryStep", bypassStep));

        JSONObject analysis = equalizer.analysis();
        JSONArray frequency = analysis.optJSONArray("frequency"), beat = analysis.optJSONArray("beatFrequency"), time = analysis.optJSONArray("timeDomain");
        int maxSpectrum = 0;
        if (frequency != null) for (int i = 0; i < frequency.length(); i++) maxSpectrum = Math.max(maxSpectrum, frequency.optInt(i));
        checks.put(json().put("name", "boundedAnalysisLengths").put("passed", frequency != null && frequency.length() == FFT_SIZE / 2
            && beat != null && beat.length() == FFT_SIZE / 2 && time != null && time.length() == FFT_SIZE && maxSpectrum > 0)
            .put("maxSpectrum", maxSpectrum).put("sampleFrames", analysis.optLong("sampleFrames")));

        equalizer.configure(json().put("enabled", false));
        float[] ramp = testTones(RAMP_FRAMES + 1024, 250, 1000, .2f), rampOriginal = ramp.clone();
        equalizer.process(ramp, ramp.length / 2);
        boolean rampFinite = true, neutralTail = true;
        for (float sample : ramp) rampFinite &= Float.isFinite(sample);
        for (int i = RAMP_FRAMES * 2; i < ramp.length; i++) neutralTail &= Float.floatToRawIntBits(ramp[i]) == Float.floatToRawIntBits(rampOriginal[i]);
        checks.put(json().put("name", "settingsRampReturnsNeutral").put("passed", rampFinite && neutralTail)
            .put("rampFrames", RAMP_FRAMES));
        boolean passed = true;
        for (int i = 0; i < checks.length(); i++) passed &= checks.optJSONObject(i).optBoolean("passed");
        return json().put("passed", passed).put("checks", checks).put("sampleRate", SAMPLE_RATE).put("fftSize", FFT_SIZE);
    }

    private static Json testSettings() {
        return json().put("enabled", true).put("immediate", true).put("gains", gainArray(new double[10]))
            .put("preampLinear", 1).put("width", 1).put("limiter", json().put("enabled", false).put("ratio", 1));
    }
    private static float[] testNoise(int frames) {
        float[] samples = new float[frames * 2];
        int state = 0x4d696e65;
        for (int i = 0; i < samples.length; i++) {
            state = state * 1664525 + 1013904223;
            samples[i] = ((state >>> 8) / 16777216f * 2 - 1) * .8f;
        }
        return samples;
    }
    private static float[] testTones(int frames, double leftHz, double rightHz, float amplitude) {
        float[] samples = new float[frames * 2];
        for (int i = 0; i < frames; i++) {
            samples[i * 2] = (float) (amplitude * Math.sin(2 * Math.PI * leftHz * i / SAMPLE_RATE));
            samples[i * 2 + 1] = (float) (amplitude * Math.sin(2 * Math.PI * rightHz * i / SAMPLE_RATE));
        }
        return samples;
    }
    private static double testRms(float[] samples, int start) {
        double squares = 0;
        for (int i = start; i < samples.length; i++) squares += (double) samples[i] * samples[i];
        return Math.sqrt(squares / Math.max(1, samples.length - start));
    }

    private void applyPending() {
        Configuration next = pending;
        if (next == applied) return;
        if (applied != null && applied.sameValues(next)) { applied = next; return; }
        applied = next;
        System.arraycopy(next.parameters, 0, targets, 0, values.length);
        rampRemaining = next.immediate ? 0 : RAMP_FRAMES;
        for (int i = 0; i < filters.length; i++) filters[i].target(i, next.gains[i], rampRemaining);
        for (int i = 0; i < values.length; i++) {
            increments[i] = rampRemaining == 0 ? 0 : (targets[i] - values[i]) / rampRemaining;
            if (rampRemaining == 0) values[i] = targets[i];
        }
    }

    private float finiteSample(float value) {
        if (Float.isFinite(value)) return value;
        invalidSamples++; return 0;
    }
    private static void checkBuffer(float[] stereo, int frames) {
        if (stereo == null || frames < 0 || frames > stereo.length / 2) throw new IllegalArgumentException("INVALID_STEREO_PCM_BLOCK");
    }
    private static double bounded(JSONObject value, String key, double fallback, double min, double max) {
        double number = value == null ? fallback : value.optDouble(key, fallback);
        return Double.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
    }
    private static int spectrumByte(double magnitude) {
        double db = 20 * Math.log10(Math.max(1e-12, magnitude));
        return Math.max(0, Math.min(255, (int) Math.floor((db + 100) * 255 / 70)));
    }
    private static JSONArray gainArray(double[] gains) {
        JSONArray array = new JSONArray();
        for (double gain : gains) array.put(Double.valueOf(gain));
        return array;
    }
    // JSONObject.put() is checked in Android's org.json. Keep exception handling outside the hot path.
    private static Json json() { return new Json(); }
    private static final class Json extends JSONObject {
        @Override public Json put(String name, Object value) {
            try { super.put(name, value); return this; }
            catch (org.json.JSONException problem) { throw new IllegalArgumentException(problem); }
        }
        @Override public Json put(String name, double value) { return put(name, Double.valueOf(value)); }
        @Override public Json put(String name, long value) { return put(name, Long.valueOf(value)); }
        @Override public Json put(String name, int value) { return put(name, Integer.valueOf(value)); }
        @Override public Json put(String name, boolean value) { return put(name, Boolean.valueOf(value)); }
    }
    private static final class Configuration {
        final double[] gains = new double[10], parameters = {1, 1, 1, 1, 1, 1, 0};
        final double thresholdDb;
        final boolean immediate;
        boolean sameValues(Configuration other) {
            if (immediate != other.immediate) return false;
            for (int i = 0; i < gains.length; i++) if (gains[i] != other.gains[i]) return false;
            for (int i = 0; i < parameters.length; i++) if (parameters[i] != other.parameters[i]) return false;
            return true;
        }
        Configuration(JSONObject value) {
            JSONObject chain = value == null ? null : value.optJSONObject("audioChain");
            if (chain == null) chain = value;
            boolean enabled = chain != null && chain.optBoolean("enabled", true);
            JSONArray list = chain == null ? null : chain.optJSONArray("gains");
            for (int i = 0; i < gains.length; i++) {
                double gain = !enabled || list == null ? 0 : list.optDouble(i, 0);
                gains[i] = Double.isFinite(gain) ? Math.max(-12, Math.min(12, gain)) : 0;
            }
            JSONObject limiter = chain == null ? null : chain.optJSONObject("limiter");
            boolean limited = enabled && limiter != null && limiter.optBoolean("enabled", true);
            parameters[0] = bounded(value, "replayGain", 1, .05, 4);
            parameters[1] = enabled ? bounded(chain, "preampLinear", 1, Math.pow(10, -24.0 / 20), Math.pow(10, 12.0 / 20)) : 1;
            thresholdDb = limited ? bounded(limiter, "thresholdDb", 0, -12, 0) : 0;
            parameters[2] = Math.pow(10, thresholdDb / 20);
            parameters[3] = limited ? bounded(limiter, "ratio", 1, 1, 20) : 1;
            parameters[4] = enabled ? bounded(chain, "width", 1, 0, 2) : 1;
            parameters[5] = bounded(value, "master", 1, 0, 1);
            parameters[6] = parameters[3] > 1 ? 1 : 0;
            immediate = value != null && value.optBoolean("immediate", false);
        }
    }
    private static final class Filter {
        final double[] coefficients = {1, 0, 0, 0, 0}, goal = {1, 0, 0, 0, 0}, step = new double[5];
        final double[] z1 = new double[2], z2 = new double[2];
        boolean neutral = true, targetNeutral = true;
        void target(int band, double gain, int frames) {
            targetNeutral = gain == 0;
            if (targetNeutral) { goal[0] = 1; for (int j = 1; j < goal.length; j++) goal[j] = 0; }
            else {
                double a = Math.pow(10, gain / 40), omega = 2 * Math.PI * FREQUENCIES[band] / SAMPLE_RATE;
                double cosine = Math.cos(omega), sine = Math.sin(omega), alpha = sine / 2, a0;
                if (band == 0 || band == 9) {
                    alpha = sine * Math.sqrt(2) / 2;
                    double beta = 2 * Math.sqrt(a) * alpha;
                    if (band == 0) {
                        goal[0] = a * ((a + 1) - (a - 1) * cosine + beta);
                        goal[1] = 2 * a * ((a - 1) - (a + 1) * cosine);
                        goal[2] = a * ((a + 1) - (a - 1) * cosine - beta);
                        a0 = (a + 1) + (a - 1) * cosine + beta;
                        goal[3] = -2 * ((a - 1) + (a + 1) * cosine);
                        goal[4] = (a + 1) + (a - 1) * cosine - beta;
                    } else {
                        goal[0] = a * ((a + 1) + (a - 1) * cosine + beta);
                        goal[1] = -2 * a * ((a - 1) + (a + 1) * cosine);
                        goal[2] = a * ((a + 1) + (a - 1) * cosine - beta);
                        a0 = (a + 1) - (a - 1) * cosine + beta;
                        goal[3] = 2 * ((a - 1) - (a + 1) * cosine);
                        goal[4] = (a + 1) - (a - 1) * cosine - beta;
                    }
                } else {
                    goal[0] = 1 + alpha * a; goal[1] = -2 * cosine; goal[2] = 1 - alpha * a;
                    a0 = 1 + alpha / a; goal[3] = -2 * cosine; goal[4] = 1 - alpha / a;
                }
                for (int j = 0; j < goal.length; j++) goal[j] /= a0;
            }
            for (int j = 0; j < goal.length; j++) step[j] = frames == 0 ? 0 : (goal[j] - coefficients[j]) / frames;
            if (frames == 0) finish();
            else if (!targetNeutral) neutral = false;
        }
        void advance() { for (int j = 0; j < goal.length; j++) coefficients[j] += step[j]; }
        void finish() {
            System.arraycopy(goal, 0, coefficients, 0, goal.length);
            neutral = targetNeutral;
            if (neutral) reset();
        }
        double sample(double input, int channel) {
            double output = coefficients[0] * input + z1[channel];
            z1[channel] = coefficients[1] * input - coefficients[3] * output + z2[channel];
            z2[channel] = coefficients[2] * input - coefficients[4] * output;
            return output;
        }
        void reset() { z1[0] = z1[1] = z2[0] = z2[1] = 0; }
    }
    private static void fft(double[] real, double[] imaginary) {
        int size = real.length;
        for (int i = 1, j = 0; i < size; i++) {
            int bit = size >> 1;
            for (; (j & bit) != 0; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                double temporary = real[i]; real[i] = real[j]; real[j] = temporary;
                temporary = imaginary[i]; imaginary[i] = imaginary[j]; imaginary[j] = temporary;
            }
        }
        for (int length = 2; length <= size; length <<= 1) {
            double angle = -2 * Math.PI / length, cosine = Math.cos(angle), sine = Math.sin(angle);
            for (int start = 0; start < size; start += length) {
                double wr = 1, wi = 0;
                for (int j = 0; j < length / 2; j++) {
                    int even = start + j, odd = even + length / 2;
                    double tr = wr * real[odd] - wi * imaginary[odd], ti = wr * imaginary[odd] + wi * real[odd];
                    real[odd] = real[even] - tr; imaginary[odd] = imaginary[even] - ti;
                    real[even] += tr; imaginary[even] += ti;
                    double next = wr * cosine - wi * sine; wi = wr * sine + wi * cosine; wr = next;
                }
            }
        }
    }
}
