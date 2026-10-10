// src/dev/renderCount.ts
// Counts component body executions so a refactor's effect on re-renders can be measured instead of
// argued about. React DevTools' profiler is not reachable from a headless Playwright run, and the
// Performance panel measures frames rather than which subtree committed.
//
// Armed by the harness (`window.__renderCounts = {}`), never by the app: an unarmed probe is a
// single property read, and the whole module folds away in a production build.

type CountedWindow = Window & { __renderCounts?: Record<string, number> };

/** Records one execution of the named component's body. No-op unless a harness armed the probe. */
export const countRender: (name: string) => void = import.meta.env.DEV
    ? (name) => {
        const counts = (window as CountedWindow).__renderCounts;
        if (!counts) {
            return;
        }
        counts[name] = (counts[name] ?? 0) + 1;
    }
    : () => { };
