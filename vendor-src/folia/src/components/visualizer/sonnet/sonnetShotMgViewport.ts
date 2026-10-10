// src/components/visualizer/sonnet/sonnetShotMgViewport.ts
// Resolves overscan extents so open MG paths continue beyond every viewport edge.
export const resolveSonnetShotMgBleed = (width: number, height: number, radius: number) => ({
    x: Math.max(radius * 0.92, width * 0.64),
    y: Math.max(radius * 0.92, height * 0.64),
});
