import type { VisualizerBackgroundMode } from '../../types';
import type { VisualizerBackgroundRegistryEntry } from '../../components/visualizer/backgrounds/definition';
import common from '../../components/visualizer/backgrounds/common/entry';
import latent from '../../components/visualizer/backgrounds/latent/entry';
import monet from '../../components/visualizer/backgrounds/monet/entry';
import nomand from '../../components/visualizer/backgrounds/nomand/entry';
import sora from '../../components/visualizer/backgrounds/sora/entry';

// src/mineradio/local/localBackgroundRegistry.ts
// Embedded build registry: the original five procedural/image backgrounds, without URL or extension entries.
export const DEFAULT_VISUALIZER_BACKGROUND_MODE: VisualizerBackgroundMode = 'latent';
export const VISUALIZER_BACKGROUND_REGISTRY: VisualizerBackgroundRegistryEntry[] = [common, latent, monet, nomand, sora]
    .sort((left, right) => left.order - right.order);
const byMode = new Map(VISUALIZER_BACKGROUND_REGISTRY.map((entry) => [entry.mode, entry]));
export const hasVisualizerBackgroundMode = (mode: unknown): mode is VisualizerBackgroundMode => typeof mode === 'string' && byMode.has(mode as VisualizerBackgroundMode);
export const getVisualizerBackgroundRegistryEntry = (mode: VisualizerBackgroundMode) => byMode.get(mode) ?? latent;
export const getVisualizerBackgroundModeLabel = (mode: VisualizerBackgroundMode, t: (key: string) => string) => {
    const entry = getVisualizerBackgroundRegistryEntry(mode);
    const translated = t(entry.labelKey);
    return !translated || translated === entry.labelKey ? entry.labelFallback : translated;
};
