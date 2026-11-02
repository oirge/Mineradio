import { NEBBIA_FIXED } from './nebbiaConstants';
import type { NebbiaUniforms } from './nebbiaGlUtils';
import type { NebbiaSpot } from './nebbiaSpot';
import type { NebbiaTuning } from './types';

// src/components/visualizer/nebbia/nebbiaFrameUniforms.ts
// 主着色器这一帧的 uniform（从 createNebbiaRuntime.ts 拆出）：tuning、车身颠簸的位移、聚光灯，W、H 是 CSS 像素。

export const nebbiaFrameUniforms = (
    t: NebbiaTuning, [sx, sy]: [number, number], spot: NebbiaSpot, W: number, H: number, time: number,
): NebbiaUniforms => {
    const asp = W / H;
    return {
        time,
        mist: t.mist, edge: NEBBIA_FIXED.edge, refract: NEBBIA_FIXED.refract, bus: t.busSpeed, glint: NEBBIA_FIXED.glint, neon: t.neon,
        glassShift: [-sx * 0.35 / W, -sy * 0.35 / H], sceneShift: [-sx / W, -sy / H],
        spotSrc: [t.spotX * asp, 0.595], spotSrc2: [(1 - t.spotX) * asp, 0.595],
        spotTgt: [spot.x / W * asp, spot.y / H],
        spotR: Math.max(0.02, spot.r / H * 0.75), spotI: spot.i * t.spot,
    };
};
