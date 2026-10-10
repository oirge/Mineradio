import type { PlaybackFadeGraph } from '@/services/playbackFade';

// test/unit/services/fakeFadeGraph.ts
// A fake AudioContext + GainNode whose AudioParam models linear ramps and cancelAndHoldAtTime, so
// tests can read the gain at any point of a fade and assert there is no step. `.value` answers the
// automation value at ctx.currentTime, the way a browser does while a ramp is running.

type ParamEvent = { type: 'set' | 'ramp'; value: number; time: number };

export const createFakeParam = (getTime: () => number, initial = 1) => {
    let events: ParamEvent[] = [];

    const valueAt = (t: number): number => {
        let prev = { value: initial, time: 0 };
        const sorted = [...events].sort((a, b) => a.time - b.time);
        for (const event of sorted) {
            if (event.time <= t) {
                prev = event;
                continue;
            }
            if (event.type === 'ramp') {
                const span = event.time - prev.time;
                return span <= 0 ? event.value : prev.value + (event.value - prev.value) * ((t - prev.time) / span);
            }
            return prev.value;
        }
        return prev.value;
    };

    return {
        get value() { return valueAt(getTime()); },
        valueAt,
        setValueAtTime: (value: number, time: number) => { events.push({ type: 'set', value, time }); },
        linearRampToValueAtTime: (value: number, time: number) => { events.push({ type: 'ramp', value, time }); },
        cancelAndHoldAtTime: (time: number) => {
            const held = valueAt(time);
            events = events.filter(event => event.time <= time);
            events.push({ type: 'set', value: held, time });
        },
        cancelScheduledValues: (time: number) => { events = events.filter(event => event.time < time); },
    };
};

export type FakeFadeGraph = PlaybackFadeGraph & {
    clock: { now: number };
    param: ReturnType<typeof createFakeParam>;
    setState: (state: AudioContextState) => void;
};

export const createFakeFadeGraph = (): FakeFadeGraph => {
    const clock = { now: 0 };
    const context = { currentTime: 0, state: 'running' as AudioContextState };
    Object.defineProperty(context, 'currentTime', { get: () => clock.now });
    const param = createFakeParam(() => clock.now);
    const gain = { gain: param } as unknown as GainNode;
    return {
        context: context as unknown as AudioContext,
        gain,
        clock,
        param,
        setState: (state) => { context.state = state; },
    };
};
