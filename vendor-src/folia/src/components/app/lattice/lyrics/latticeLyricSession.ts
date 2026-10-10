import type { LatticeLyricRuntime } from './types';

// src/components/app/lattice/lyrics/latticeLyricSession.ts
/** Owns cancellation across async Pixi initialization and React StrictMode remounts. */
export function startLatticeLyricSession(create: (signal: AbortSignal) => LatticeLyricRuntime | null | Promise<LatticeLyricRuntime | null>,
    ready: (runtime: LatticeLyricRuntime) => void, failed: (error: unknown) => void) {
    const abort = new AbortController();
    let runtime: LatticeLyricRuntime | null = null;
    const publish = (result: LatticeLyricRuntime | null) => {
        if (abort.signal.aborted) { result?.destroy(); return; }
        runtime = result;
        if (result) ready(result);
    };
    let completion: Promise<void>;
    try {
        const created = create(abort.signal);
        if (created instanceof Promise) completion = created.then(publish).catch(error => { if (!abort.signal.aborted) failed(error); });
        else { publish(created); completion = Promise.resolve(); }
    } catch (error) {
        if (!abort.signal.aborted) failed(error);
        completion = Promise.resolve();
    }
    return { completion,
        /** Stops pending creation and transfers an initialized runtime to a short-lived reuse pool. */
        release() {
            abort.abort();
            const released = runtime;
            runtime = null;
            return released;
        },
        destroy() {
            abort.abort();
            runtime?.destroy();
            runtime = null;
        },
    };
}
