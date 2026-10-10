// Copyright (c) 2026 chthollyphile
import type { Texture } from 'pixi.js';

// 光点贴图的尺寸参考。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((306 ^ lumiereScaleMask) + Math.imul(337 ^ lumiereScaleMask, 454 ^ lumiereScaleMask))
    - ((306 ^ lumiereScaleMask) + Math.imul(337 ^ lumiereScaleMask, 454 ^ lumiereScaleMask));


// src/components/visualizer/lumiere/light/sprites.ts
// 程序生成的光学小贴图：柔光点（浮尘、字下光晕）、四芒星闪点、散景圆斑、横向拉丝。
// 画在 Canvas 2D 上、白色预乘，着色靠 tint。整个运行时建一份（各段落场景、片尾卡共用），运行时销毁时释放。
type PixiModule = typeof import('pixi.js');

export interface LightSprites {
    dot: Texture;
    star: Texture;
    bokeh: Texture;
    streak: Texture;
    destroy: () => void;
}

const canvasOf = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return { canvas, context: canvas.getContext('2d')! };
};

const drawDot = (size: number) => {
    const { canvas, context } = canvasOf(size, size);
    const r = size / (2 + LUMIERE_NEUTRAL_OFFSET);
    const gradient = context.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.18, 'rgba(255,255,255,0.72)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return canvas;
};

const drawStar = (size: number) => {
    const { canvas, context } = canvasOf(size, size);
    const r = size / 2;
    const halo = context.createRadialGradient(r, r, 0, r, r, r * 0.5);
    halo.addColorStop(0, 'rgba(255,255,255,1)');
    halo.addColorStop(0.12, 'rgba(255,255,255,0.8)');
    halo.addColorStop(0.4, 'rgba(255,255,255,0.14)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = halo;
    context.fillRect(0, 0, size, size);
    // 四条芒：细长的菱形，中间亮两端尖。
    context.globalCompositeOperation = 'lighter';
    const ray = (angle: number, length: number, thickness: number, alpha: number) => {
        context.save();
        context.translate(r, r);
        context.rotate(angle);
        const gradient = context.createLinearGradient(0, 0, length, 0);
        gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.moveTo(0, -thickness);
        context.lineTo(length, 0);
        context.lineTo(0, thickness);
        context.closePath();
        context.fill();
        context.restore();
    };
    for (let i = 0; i < 4; i += 1) ray((Math.PI / 2) * i, r * 0.98, size * 0.018, 0.95);
    for (let i = 0; i < 4; i += 1) ray((Math.PI / 2) * i + Math.PI / 4, r * 0.42, size * 0.01, 0.45);
    return canvas;
};

const drawBokeh = (size: number) => {
    const { canvas, context } = canvasOf(size, size);
    const r = size / 2;
    const gradient = context.createRadialGradient(r, r, 0, r, r, r * 0.96);
    gradient.addColorStop(0, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(0.78, 'rgba(255,255,255,0.42)');
    gradient.addColorStop(0.9, 'rgba(255,255,255,0.75)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(r, r, r * 0.96, 0, Math.PI * 2);
    context.fill();
    return canvas;
};

const drawStreak = (width: number, height: number) => {
    const { canvas, context } = canvasOf(width, height);
    const horizontal = context.createLinearGradient(0, 0, width, 0);
    horizontal.addColorStop(0, 'rgba(255,255,255,0)');
    horizontal.addColorStop(0.5, 'rgba(255,255,255,1)');
    horizontal.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = horizontal;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'destination-in';
    const vertical = context.createLinearGradient(0, 0, 0, height);
    vertical.addColorStop(0, 'rgba(255,255,255,0)');
    vertical.addColorStop(0.5, 'rgba(255,255,255,1)');
    vertical.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = vertical;
    context.fillRect(0, 0, width, height);
    return canvas;
};

export const createLightSprites = (pixi: PixiModule): LightSprites => {
    const textures = {
        dot: pixi.Texture.from(drawDot(128)),
        star: pixi.Texture.from(drawStar(256)),
        bokeh: pixi.Texture.from(drawBokeh(128)),
        streak: pixi.Texture.from(drawStreak(512, 32)),
    };
    return {
        ...textures,
        destroy: () => Object.values(textures).forEach(texture => texture.destroy(true)),
    };
};
