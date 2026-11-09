import '../../../../public/mobile-motion-tokens.js';
import type { Transition } from 'framer-motion';

// src/utils/mobileMotion.ts
// Both embedded interfaces consume the same tokens without another animation library.
export type MobileMotionKind = 'micro' | 'component' | 'page' | 'dialog' | 'sheet' | 'menu' | 'status';
type MotionTokens = Readonly<Record<MobileMotionKind, number> & {
    distance: number;
    scale: number;
    stagger: number;
    maxStagger: number;
    listLimit: number;
    ease: readonly [number, number, number, number];
    pageEase: readonly [number, number, number, number];
}>;
export const mobileMotionTokens = (globalThis as typeof globalThis & {
    MineradioMotionTokens: MotionTokens;
}).MineradioMotionTokens;

export function mobileMotionTransition(kind: MobileMotionKind, reducedMotion: boolean): Transition {
    return {
        type: 'tween',
        duration: reducedMotion ? 0 : mobileMotionTokens[kind] / 1000,
        ease: [...(kind === 'page' ? mobileMotionTokens.pageEase : mobileMotionTokens.ease)] as [number, number, number, number],
    };
}

/** Small, reversible motion; reduced motion also removes delayed presence exits. */
export function mobileMotionProps(kind: MobileMotionKind, reducedMotion: boolean, direction = 1) {
    const distance = reducedMotion ? 0 : mobileMotionTokens.distance;
    const page = kind === 'page';
    const scaled = kind === 'dialog' || kind === 'menu';
    const offset = kind === 'sheet' ? distance * 2 : distance;
    return {
        initial: { opacity: reducedMotion ? 1 : 0, x: page ? direction * distance : 0, y: page ? 0 : offset, scale: scaled && !reducedMotion ? mobileMotionTokens.scale : 1 },
        animate: { opacity: 1, x: 0, y: 0, scale: 1 },
        exit: { opacity: 0, x: page ? -direction * distance : 0, y: page ? 0 : offset, scale: scaled && !reducedMotion ? mobileMotionTokens.scale : 1 },
        transition: mobileMotionTransition(kind, reducedMotion),
    };
}
