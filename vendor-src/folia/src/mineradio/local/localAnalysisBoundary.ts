// The host owns audio. The embedded renderer uses its original FFT fallback when no offline stem/beat analysis exists.
export const getDrumHits = (_key?: unknown): DrumHits | null => null;
export const getVocalEnvelope = (_key?: unknown): VocalEnvelope | null => null;
export const DRUM_KICK = 0, DRUM_SNARE = 1, DRUM_HAT = 2;
export interface DrumHits { times: Float64Array; strengths: Float32Array; kinds: Uint8Array; until?: number }
export interface VocalEnvelope { fps: number; db: Float32Array; top: number; onsets: Uint32Array; from?: number }
export const isBeatEffectPlaying = (_id?: unknown) => false;
export const isBeatFxReady = () => false;
export const getBeatEffectStrength = (_id?: unknown) => 0;
export const getBeatFxHeard = () => ({ key: null, time: 0 });
export const getBeatFxEvents = () => [];
export const getBeatFxIntensities = () => ({ beat: 0, downbeat: 0 });
export const getBeatFxRotationSign = () => 1;
export const getBeatFxTrackScale = () => 1;
export const getBeatFxFiredCounts = () => ({ beat: 0, downbeat: 0 });
export const getBeatFxLastBeat = () => null;
export const getBeatFxLastDownbeat = () => null;

export const VOCAL_FPS = 50;
