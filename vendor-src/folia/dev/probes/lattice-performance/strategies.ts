import { fitTitle, fitTitleToWidth, type TitleMetrics } from '../../../src/utils/fitSettledTitle';

// dev/probes/lattice-performance/strategies.ts — identical scheduling, different cache-miss fitters.
export type Strategy = 'original' | 'current' | 'dom';
export type Counters = { calls: number; reads: number; ms: number };
export const emptyCounters = (): Counters => ({ calls: 0, reads: 0, ms: 0 });

/**
 * A null fitter leaves the CSS-only baseline in place. `current` is the production path: a fit
 * predicted from the target width, which touches no element and so reports no reads. `dom` keeps
 * the older measure-in-the-document fitter around as the comparison that makes those zeroes mean
 * something - it is also what corrects a prediction the browser disagrees with.
 */
export function makeFitter(strategy: Strategy, counters: Counters) {
    if (strategy === 'original') return null;
    return (node: HTMLElement, text: string, metrics: TitleMetrics) => {
        const start = performance.now();
        const value = strategy === 'dom'
            ? fitTitle(node, text, { width: `${metrics.width}px`, onRead: () => counters.reads++ })
            : fitTitleToWidth(text, metrics);
        counters.calls++;
        counters.ms += performance.now() - start;
        return value;
    };
}
