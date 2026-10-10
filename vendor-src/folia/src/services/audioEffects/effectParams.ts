// src/services/audioEffects/effectParams.ts
// Shared AudioParam helpers so effect updates never step values discontinuously.

export const EFFECT_RAMP_SECONDS = 0.03;

export const rampParam = (
    context: AudioContext,
    param: AudioParam,
    value: number,
    ramp = EFFECT_RAMP_SECONDS,
) => {
    param.cancelScheduledValues(context.currentTime);
    param.setTargetAtTime(value, context.currentTime, ramp);
};

export const dbToLinear = (db: number) => 10 ** (db / 20);
