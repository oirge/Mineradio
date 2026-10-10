// src/mineradio/local/builtinExtensions.ts
// The embedded build supports builtin effects only. Keep their extension points inert
// so rendering does not pull in Folium's application stores, loaders, or audio graph.
const builtinTunings: Readonly<Record<string, number>> = Object.freeze({});
export const FoliumStageLayerSlot = () => null;
export const useFoliumTunings = (_mode: string) => builtinTunings;
