// Copyright (c) 2026 chthollyphile
import type { MotionValue } from 'framer-motion';
import type { AudioBands } from '../../../types';
import type { LumiereAudioFrame } from './lumiereKernel';

// src/components/visualizer/lumiere/lumiereAudio.ts
// folia 的音频 MotionValue → 绘光场景要的 audioAt 帧（bass / treble / power，0..1）。
//
// 量纲：主播放器（usePlaybackVisualizerBridge）写的是 0..255（getByteFrequencyData 的均值再做 pow 压缩），
// 没在出声时是 0..40 的「呼吸」；VisPlayground / ThemePark 的预览时钟与 OBS 的音频桥写的是 0..1。
// 同一个源不会混用两种量纲，所以和 claddagh 一样按「见过 > 1 的值就认定是 0..255」粘住判断——
// 单看当前值会把 0..255 源里安静段的 0.3 当成 0.3 而不是 0.001。
//
// 平滑：原始频段值逐帧抖动，直接推光束亮度会闪。起音快（~60ms）、释放慢（~250ms），跟得上鼓点又不闪。
// 暂停时整帧归零（场景当作安静），不读呼吸值。

export interface LumiereAudioSources {
    audioPower: MotionValue<number>;
    audioBands: AudioBands;
}

export interface LumiereAudioSampler {
    /** 每帧调一次：读 MotionValue、归一化、平滑，结果写进 frame。 */
    sample: (nowMs: number, paused: boolean) => void;
    /** 最近一次 sample 的结果（同一个对象，场景的 audioAt 直接返回它）。 */
    readonly frame: LumiereAudioFrame;
    setSources: (sources: LumiereAudioSources) => void;
}

const ATTACK_SECONDS = 0.06;
const RELEASE_SECONDS = 0.25;

/** 单个值归一化到 0..1；rawScale 为 true 时按 0..255 换算。 */
export const normalizeLumiereAudioValue = (value: number, rawScale: boolean) => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(1, rawScale ? value / 255 : value);
};

/** 一阶低通，起音与释放各自的时间常数；dt 秒。 */
export const smoothLumiereAudioValue = (current: number, target: number, dt: number) => {
    const tau = target > current ? ATTACK_SECONDS : RELEASE_SECONDS;
    const k = 1 - Math.exp(-Math.max(0, dt) / tau);
    return current + (target - current) * k;
};

export const createLumiereAudioSampler = (initial: LumiereAudioSources): LumiereAudioSampler => {
    let sources = initial;
    let rawScale = false;
    let lastMs = 0;
    const frame: LumiereAudioFrame = { bass: 0, treble: 0, power: 0 };

    const read = (value: MotionValue<number> | undefined) => {
        const raw = value?.get() ?? 0;
        if (raw > 1) rawScale = true;
        return raw;
    };

    return {
        frame,
        setSources: next => {
            if (next.audioPower === sources.audioPower && next.audioBands === sources.audioBands) return;
            sources = next;
            rawScale = false;
        },
        sample: (nowMs, paused) => {
            const dt = lastMs > 0 ? Math.min(0.1, (nowMs - lastMs) / 1000) : 1;
            lastMs = nowMs;
            if (paused) {
                frame.bass = 0;
                frame.treble = 0;
                frame.power = 0;
                return;
            }
            // 三个都先读一遍，量纲判断对三者一致。
            const bass = read(sources.audioBands.bass);
            const treble = read(sources.audioBands.treble);
            const power = read(sources.audioPower);
            frame.bass = smoothLumiereAudioValue(frame.bass, normalizeLumiereAudioValue(bass, rawScale), dt);
            frame.treble = smoothLumiereAudioValue(frame.treble, normalizeLumiereAudioValue(treble, rawScale), dt);
            frame.power = smoothLumiereAudioValue(frame.power, normalizeLumiereAudioValue(power, rawScale), dt);
        },
    };
};
