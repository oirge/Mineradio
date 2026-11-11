package com.mineradio.oirge.mobile;

/** Shelf selection clicks mixed into the existing service AudioTrack, without requesting focus. */
final class NativeUiSound {
    private static final int RATE = 48000;
    private static final int LENGTH = RATE * 80 / 1000;
    private static final int LEAD = RATE * 2 / 1000;
    private static final double FLOOR = .0001;
    private volatile Clip clip;
    private int noiseSeed = 0x5348454c;

    /** Replaces the previous click. Rendering happens before publication, outside the PCM hot path. */
    void start(int direction, boolean row, float userVolume) {
        double volume = Float.isFinite(userVolume) ? Math.max(0, Math.min(1, userVolume)) : .65;
        double pitch = direction < 0 ? .965 : 1.035;
        double peak = .058 * (row ? .74 : 1) * (.38 + volume * .62);
        float[] samples = new float[LENGTH];
        addNoise(samples, pitch);
        addTone(samples, false, 720 * pitch, .000, .030, .18, .70);
        addTone(samples, true, 2180 * pitch, .004, .022, .30, .86);
        addTone(samples, false, 4200 * pitch, .011, .018, .18, .94);
        addTone(samples, true, 7100 * pitch, .018, .012, .070, .98);
        for (int i = LEAD; i < samples.length; i++) {
            double out = samples[i] * envelope((i - LEAD) / (double) RATE, .082, peak);
            // Valid PCM synthesis stays well below this bound; discard nonfinite data defensively.
            samples[i] = Double.isFinite(out) ? (float) Math.max(-.12, Math.min(.12, out)) : 0;
        }
        clip = new Clip(samples);
    }

    boolean active() {
        Clip current = clip;
        return current != null && current.cursor < current.samples.length;
    }

    /** Adds the click equally to L/R. The engine applies its final output clipping afterward. */
    void mix(float[] interleaved, int frames) {
        if (interleaved == null || frames < 0 || frames > interleaved.length / 2)
            throw new IllegalArgumentException("INVALID_UI_SOUND_PCM_BLOCK");
        Clip current = clip;
        if (current == null) return;
        int count = Math.min(frames, current.samples.length - current.cursor);
        for (int i = 0; i < count; i++) {
            float sample = current.samples[current.cursor + i];
            interleaved[i * 2] += sample;
            interleaved[i * 2 + 1] += sample;
        }
        current.cursor += count;
        if (current.cursor >= current.samples.length && clip == current) clip = null;
    }

    private void addNoise(float[] samples, double pitch) {
        Filter highpass = Filter.highpass(4200 * pitch);
        Filter bandpass = Filter.bandpass(8400 * pitch, 7.2);
        int noiseFrames = (int) (RATE * .034);
        for (int i = 0; LEAD + i < samples.length; i++) {
            double noise = 0;
            if (i < noiseFrames) {
                noiseSeed = noiseSeed * 1664525 + 1013904223;
                noise = ((noiseSeed >>> 8) / 16777216.0 * 2 - 1) * Math.pow(1 - i / (double) noiseFrames, 4.2);
            }
            samples[LEAD + i] += (float) (bandpass.sample(highpass.sample(noise)) * .56);
        }
    }

    private static void addTone(float[] samples, boolean square, double frequency, double delay,
                                double duration, double peak, double bend) {
        int start = LEAD + (int) (delay * RATE);
        int count = (int) ((duration + .004) * RATE);
        double phase = 0, logBend = Math.log(bend);
        for (int i = 0; i < count && start + i < samples.length; i++) {
            double time = i / (double) RATE;
            double currentFrequency = frequency * Math.exp(logBend * Math.min(1, time / duration));
            double wave = bandLimitedWave(phase, currentFrequency, square);
            double gain = time <= duration ? envelope(time, duration, peak) : FLOOR;
            samples[start + i] += (float) (wave * gain);
            phase += 2 * Math.PI * currentFrequency / RATE;
            if (phase >= 2 * Math.PI) phase -= 2 * Math.PI;
        }
    }

    private static double envelope(double time, double duration, double peak) {
        if (time < 0 || time > duration) return 0;
        if (time < .002) return FLOOR + (peak - FLOOR) * time / .002;
        double progress = Math.max(0, Math.min(1, (time - .002) / Math.max(.00001, duration - .002)));
        return peak * Math.pow(FLOOR / peak, progress);
    }

    /** Odd harmonics stay below Nyquist; avoid aliasing from naive high-frequency square waves. */
    private static double bandLimitedWave(double phase, double frequency, boolean square) {
        int harmonics = Math.max(1, (int) ((RATE * .5 - 1) / frequency));
        double sine = Math.sin(phase), cosine = Math.cos(phase);
        double sine2 = 2 * sine * cosine, cosine2 = cosine * cosine - sine * sine;
        double harmonicSine = sine, harmonicCosine = cosine, sum = 0;
        int sign = 1;
        for (int harmonic = 1; harmonic <= harmonics; harmonic += 2) {
            sum += harmonicSine * (square ? 1.0 / harmonic : sign / ((double) harmonic * harmonic));
            double nextSine = harmonicSine * cosine2 + harmonicCosine * sine2;
            harmonicCosine = harmonicCosine * cosine2 - harmonicSine * sine2;
            harmonicSine = nextSine; sign = -sign;
        }
        return sum * (square ? 4 / Math.PI : 8 / (Math.PI * Math.PI));
    }

    private static final class Clip {
        final float[] samples;
        volatile int cursor;
        Clip(float[] samples) { this.samples = samples; }
    }

    private static final class Filter {
        final double b0, b1, b2, a1, a2;
        double z1, z2;
        Filter(double b0, double b1, double b2, double a0, double a1, double a2) {
            this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
            this.a1 = a1 / a0; this.a2 = a2 / a0;
        }
        static Filter highpass(double frequency) {
            double omega = 2 * Math.PI * frequency / RATE, cosine = Math.cos(omega);
            // WebAudio low/highpass Q defaults to1dB, equivalent to linear resonance10^(1/20).
            double alpha = Math.sin(omega) / (2 * Math.pow(10, 1.0 / 20));
            return new Filter((1 + cosine) / 2, -(1 + cosine), (1 + cosine) / 2,
                1 + alpha, -2 * cosine, 1 - alpha);
        }
        static Filter bandpass(double frequency, double q) {
            double omega = 2 * Math.PI * frequency / RATE;
            double alpha = Math.sin(omega) / (2 * q);
            return new Filter(alpha, 0, -alpha, 1 + alpha, -2 * Math.cos(omega), 1 - alpha);
        }
        double sample(double input) {
            double output = b0 * input + z1;
            z1 = b1 * input - a1 * output + z2;
            z2 = b2 * input - a2 * output;
            return output;
        }
    }
}
