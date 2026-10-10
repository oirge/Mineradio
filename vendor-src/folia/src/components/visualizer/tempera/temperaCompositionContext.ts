import type { TemperaDecorSpec, TemperaShotKind } from './types';
import type { TemperaPalette } from './temperaPalette';
import type { TemperaGradientFill } from './temperaShapes';

// src/components/visualizer/tempera/temperaCompositionContext.ts
// The drawing contract shared by every composition family. Compositions only add finished,
// static Graphics; all timing and motion state stays in temperaBlocks.
type PixiModule = typeof import('pixi.js');
type Graphics = import('pixi.js').Graphics;
type Container = import('pixi.js').Container;

export interface TemperaBlockOptions {
    alpha?: number;
    enterDX?: number;
    enterDY?: number;
    /** Fractions of the shot duration, resolved to seconds by temperaBlocks. */
    delay?: number;
    span?: number;
    /** Slow deterministic float once the item has landed; replaces the old audio pulse. */
    drift?: boolean;
    /** Opens the node horizontally from its pivot, used for hatch density reveals. */
    grow?: boolean;
}

export interface TemperaCompositionContext {
    pixi: PixiModule;
    kind: TemperaShotKind;
    palette: TemperaPalette;
    decor: TemperaDecorSpec;
    width: number;
    height: number;
    seed: number;
    showDecor: boolean;
    /**
     * Extra margin every full-bleed shape must extend past the viewport. Compositions travel
     * along the flow vector for the whole shot, so a shape drawn exactly to the frame edge
     * would expose the background as it slides.
     */
    bleed: number;
    /**
     * Direction the whole shot travels in, shared with the camera and the hand-off. Cutout
     * families align their channels to it: a slot parallel to the flow stays a slot while the
     * shot slides, so two neighbouring shots read as one continuous corridor instead of a cut.
     */
    flowAngle: number;
    /** Non-null only in gradient colour mode; tone fills become four-colour ramps. */
    gradient: TemperaGradientFill | null;
    add: (node: Graphics, options?: TemperaBlockOptions, parent?: Container) => void;
    createGroup: (rotation: number, x: number, y: number) => Container;
}

export type TemperaCompositionDrawer = (ctx: TemperaCompositionContext) => void;
