import { emptyCounters, type Counters, type Strategy } from './strategies';

// dev/probes/lattice-performance/run.ts — time-based trajectories and phase-separated RAF/fit metrics.
export type Scenario = 'scale' | 'reflow' | 'pan';
export type Job = { strategy: Strategy; scenario: Scenario; count: number; seconds: number; repeat: number };
export type Phase = { frames: number; mean: number; p95: number; max: number; over33: number; fits: Counters };
export type Result = Job & { motion: Phase; settle: Phase; mountedPeak: number; userAgent: string; viewport: string };
const summarize = (frames: number[], fits: Counters): Phase => {
    const sorted = [...frames].sort((a, b) => a - b);
    return { frames: frames.length, mean: frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length),
        p95: sorted[Math.floor((sorted.length - 1) * .95)] || 0, max: sorted.at(-1) || 0,
        over33: frames.filter(value => value > 33.3).length, fits: { ...fits } };
};

/** Warm a fresh wall, drive real pan events or layout changes, then include the deferred fitting tail. */
export function runWorkload(host: HTMLElement, job: Job, counters: Counters, signal: AbortSignal,
    onPhase: (phase: string) => void): Promise<Result> {
    return new Promise((resolve, reject) => {
        let raf = 0;
        let start = performance.now();
        let last = start;
        let phase = 'warmup';
        let frames: number[] = [];
        let motion: Phase;
        let mountedPeak = 0;
        let expanded = false;
        let selectionStep = -1;
        let previousX = 0;
        let previousY = 0;
        const field = host.querySelector<HTMLElement>('.lattice-field');
        if (!field) { reject(new Error('Lattice field did not mount')); return; }
        const abort = () => { cancelAnimationFrame(raf); reject(new DOMException('Stopped', 'AbortError')); };
        signal.addEventListener('abort', abort, { once: true });
        onPhase(phase);
        const tick = (now: number) => {
            if (signal.aborted) return;
            const elapsed = now - start;
            if (phase !== 'warmup') frames.push(now - last);
            last = now;
            const posters = [...host.querySelectorAll<HTMLElement>('.lattice-poster')];
            mountedPeak = Math.max(mountedPeak, posters.length);
            if (phase === 'warmup' && !expanded && elapsed > 600 && posters.length) {
                posters[0].click(); expanded = true;
            }
            if (phase === 'warmup' && elapsed >= 2200) {
                phase = 'motion'; start = now; frames = []; Object.assign(counters, emptyCounters()); onPhase(phase);
            } else if (phase === 'motion') {
                const progress = Math.min(1, elapsed / (job.seconds * 1000));
                const wave = Math.sin(progress * Math.PI * 8);
                if (job.scenario === 'scale') {
                    posters.forEach((poster, index) => { poster.style.scale = String(1 + .18 * Math.sin(progress * Math.PI * 8 + index % 3)); });
                } else if (job.scenario === 'reflow') {
                    const step = Math.floor(elapsed / 1200);
                    if (step !== selectionStep && posters.length) {
                        posters[(step * 3) % posters.length].click(); selectionStep = step;
                    }
                    host.style.width = `${80 + 15 * wave}%`;
                    // Exercise title line wrapping as well as the wall's viewport/culling resize path.
                    host.querySelectorAll<HTMLElement>('.lattice-poster-copy').forEach(copy => {
                        copy.style.width = `${180 + 100 * (wave + 1)}px`;
                    });
                } else {
                    const x = 5000 * Math.sin(progress * Math.PI * 2);
                    const y = 3500 * Math.sin(progress * Math.PI * 4);
                    field.dispatchEvent(new WheelEvent('wheel', { deltaX: x - previousX, deltaY: y - previousY,
                        bubbles: true, cancelable: true }));
                    previousX = x; previousY = y;
                }
                if (progress === 1) {
                    motion = summarize(frames, counters);
                    phase = 'settle'; start = now; frames = []; Object.assign(counters, emptyCounters()); onPhase(phase);
                }
            } else if (phase === 'settle' && elapsed >= 1400) {
                signal.removeEventListener('abort', abort);
                resolve({ ...job, motion, settle: summarize(frames, counters), mountedPeak,
                    userAgent: navigator.userAgent, viewport: `${innerWidth}×${innerHeight}@${devicePixelRatio}` });
                return;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
    });
}
