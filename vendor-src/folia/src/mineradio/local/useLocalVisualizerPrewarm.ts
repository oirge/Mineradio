import { useEffect } from 'react';
import { VISUALIZER_REGISTRY, getVisualizerRegistryEntry, type VisualizerRegistryEntry } from '../../components/visualizer/registry';
import { useVisualSettings } from './useVisualSettings';

// src/mineradio/local/useLocalVisualizerPrewarm.ts
// Prepare the saved effect immediately and other expensive effects during visible idle time.
const warmed = new Set<string>();
function warm(entry: VisualizerRegistryEntry) {
    if (!entry.prewarm || warmed.has(entry.mode) || document.hidden) return;
    try {
        entry.prewarm();
        warmed.add(entry.mode);
    } catch (error) {
        console.warn(`[LocalVisualizer] prewarm of ${entry.mode} failed`, error);
    }
}
export function useLocalVisualizerPrewarm(active: boolean) {
    useEffect(() => {
        if (!active) return;
        let timer = 0, idle = 0;
        const cancel = () => {
            clearTimeout(timer);
            if (idle && typeof cancelIdleCallback === 'function') cancelIdleCallback(idle);
            timer = idle = 0;
        };
        const schedule = () => {
            cancel();
            if (document.hidden) return;
            warm(getVisualizerRegistryEntry(useVisualSettings.getState().mode));
            timer = window.setTimeout(() => {
                const prepare = () => VISUALIZER_REGISTRY.filter(entry => entry.prewarmWhenIdle).forEach(warm);
                if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(prepare, { timeout: 10000 });
                else prepare();
            }, 2500);
        };
        schedule();
        document.addEventListener('visibilitychange', schedule);
        return () => { cancel(); document.removeEventListener('visibilitychange', schedule); };
    }, [active]);
}
