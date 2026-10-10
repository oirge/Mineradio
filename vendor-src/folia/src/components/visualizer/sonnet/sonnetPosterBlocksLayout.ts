// src/components/visualizer/sonnet/sonnetPosterBlocksLayout.ts
// PV-style zone flow: emphasis words (hero / semi-hero) own fixed zones, and the
// remaining supports fill the space between zones in strict reading order, so the
// composition looks chaotic in size but never folds the reader's eye back.
export interface SonnetPosterBlockBox {
    isHero: boolean;
    isSemiHero: boolean;
    displayText: string;
    verticalDisplayText?: string;
    verticalMeasuredWidth?: number;
    verticalMeasuredHeight?: number;
    verticalFontScale?: number;
    fontScale: number;
    measuredWidth: number;
    measuredHeight: number;
    x: number;
    y: number;
    rotation: number;
    vertical: boolean;
    layoutDirection: 'horizontal' | 'vertical';
    enterX: number;
    enterY: number;
}

export interface SonnetPosterBlocksPlan<T extends SonnetPosterBlockBox> {
    placements: T[];
    width: number;
    height: number;
    gap: number;
}

type FlowOrientation = 'horizontal' | 'vertical';

interface FlowItem<T extends SonnetPosterBlockBox> {
    kind: 'zone' | 'group';
    zone?: T;
    group?: T[];
}

interface FlowRect {
    u: number;
    v: number;
    uSize: number;
    vSize: number;
}

interface FlowPlacement<T extends SonnetPosterBlockBox> {
    box: T;
    rect: FlowRect;
    scale: number;
    vertical: boolean;
}

// A zone followed by a support group reserves the flow-start side of the lines it
// spans, so following supports wrap beside it while keeping scan order.
interface ZoneFloat {
    extent: number;
    vBottom: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Splits the reading sequence into emphasis zones and runs of supports.
const partitionFlowItems = <T extends SonnetPosterBlockBox>(boxes: T[]): FlowItem<T>[] => {
    const items: FlowItem<T>[] = [];
    let group: T[] = [];
    boxes.forEach(box => {
        if (box.isHero || box.isSemiHero) {
            if (group.length > 0) items.push({ kind: 'group', group });
            group = [];
            items.push({ kind: 'zone', zone: box });
        } else {
            group.push(box);
        }
    });
    if (group.length > 0) items.push({ kind: 'group', group });
    return items;
};

interface FlowSpace {
    orientation: FlowOrientation;
    u: number;
    v: number;
}

// Maps a flow-space rect to screen coordinates. In the vertical variant columns
// progress right-to-left, matching traditional Japanese typesetting.
const flowToScreen = (
    space: FlowSpace,
    rect: FlowRect,
    canvas: { x: number; y: number; width: number; height: number },
) => {
    if (space.orientation === 'horizontal') {
        return {
            x: canvas.x + rect.u,
            y: canvas.y + rect.v,
            width: rect.uSize,
            height: rect.vSize,
        };
    }
    return {
        x: canvas.x + canvas.width - rect.v - rect.vSize,
        y: canvas.y + rect.u,
        width: rect.vSize,
        height: rect.uSize,
    };
};

interface FlowAttempt<T extends SonnetPosterBlockBox> {
    placements: FlowPlacement<T>[];
    vTotal: number;
}

// Lays out the whole shot once at a given global scale. Always returns the
// attempt (even when the stack overflows the canvas) so the caller can pick the
// first fitting scale or emergency-fit the last one — boxes must never be left
// unplaced at the origin.
const attemptFlowLayout = <T extends SonnetPosterBlockBox>(
    boxes: T[],
    space: FlowSpace,
    globalScale: number,
    chipGap: number,
    lineGap: number,
    seed: number,
): FlowAttempt<T> => {
    const items = partitionFlowItems(boxes);
    const placements: FlowPlacement<T>[] = [];
    const floats: ZoneFloat[] = [];
    let vCursor = 0;
    let ownBandOnEndSide = ((seed >> 1) & 1) === 1;

    // Screen dims at the current scale, choosing the vertical column orientation
    // only when the shot is vertical and precise column measurements exist.
    const measure = (box: T) => {
        const useVertical = space.orientation === 'vertical'
            && typeof box.verticalMeasuredWidth === 'number'
            && typeof box.verticalMeasuredHeight === 'number'
            && typeof box.verticalFontScale === 'number';
        const baseScale = useVertical ? box.verticalFontScale! : box.fontScale;
        const width = (useVertical ? box.verticalMeasuredWidth! : box.measuredWidth) * globalScale;
        const height = (useVertical ? box.verticalMeasuredHeight! : box.measuredHeight) * globalScale;
        return { useVertical, baseScale, width, height };
    };
    const toFlowSize = (width: number, height: number) => (
        space.orientation === 'horizontal'
            ? { uSize: width, vSize: height }
            : { uSize: height, vSize: width }
    );

    const pruneFloats = () => {
        for (let index = floats.length - 1; index >= 0; index--) {
            if (floats[index].vBottom <= vCursor) floats.splice(index, 1);
        }
    };

    items.forEach((item, itemIndex) => {
        pruneFloats();
        if (item.kind === 'group') {
            const reservedU = floats.reduce((sum, entry) => sum + entry.extent, 0);
            const capacity = Math.max(chipGap * 2, space.u - reservedU);
            const uStart = reservedU;
            const chips = item.group!.map(box => {
                const dims = measure(box);
                const flow = toFlowSize(dims.width, dims.height);
                return { box, dims, uSize: flow.uSize, vSize: flow.vSize, shrink: 1 };
            });

            // Greedy wrap in reading order, then justify each line so supports
            // spread across the band instead of clustering on one side.
            let line: typeof chips = [];
            let lineUsedU = 0;
            const flushLine = () => {
                if (line.length === 0) return;
                const lineV = Math.max(...line.map(chip => chip.vSize * chip.shrink));
                const leftover = capacity - lineUsedU;
                const spread = line.length > 1 && leftover > 0
                    ? Math.min(leftover / (line.length - 1), chipGap * 2.5)
                    : 0;
                let uCursor = uStart;
                line.forEach(chip => {
                    const finalScale = chip.dims.baseScale * globalScale * chip.shrink;
                    placements.push({
                        box: chip.box,
                        rect: {
                            u: uCursor,
                            v: vCursor,
                            uSize: chip.uSize * chip.shrink,
                            vSize: chip.vSize * chip.shrink,
                        },
                        scale: finalScale,
                        vertical: chip.dims.useVertical,
                    });
                    uCursor += chip.uSize * chip.shrink + chipGap + spread;
                });
                vCursor += lineV + lineGap;
                pruneFloats();
                line = [];
                lineUsedU = 0;
            };

            chips.forEach(chip => {
                const needed = lineUsedU + (line.length > 0 ? chipGap : 0) + chip.uSize;
                if (needed > capacity && line.length > 0) flushLine();
                if (chip.uSize > capacity) {
                    // A lone oversized chip shrinks into the band instead of wrapping.
                    chip.shrink = Math.max(0.5, capacity / chip.uSize);
                    lineUsedU = 0;
                    line.push(chip);
                    flushLine();
                    return;
                }
                lineUsedU += (line.length > 0 ? chipGap : 0) + chip.uSize;
                line.push(chip);
            });
            flushLine();
            return;
        }

        // Zone placement: never overlap a previous zone's float span.
        const zone = item.zone!;
        vCursor = Math.max(vCursor, ...floats.map(entry => entry.vBottom), 0);
        floats.length = 0;

        const dims = measure(zone);
        const flow = toFlowSize(dims.width, dims.height);
        const followedByGroup = items[itemIndex + 1]?.kind === 'group';
        const zoneShrink = Math.min(
            1,
            (space.u * (followedByGroup ? 0.62 : 0.9)) / flow.uSize,
            (space.v * 0.66) / flow.vSize,
        );
        const uSize = flow.uSize * zoneShrink;
        const vSize = flow.vSize * zoneShrink;
        const onlyZone = items.length === 1;
        const u = onlyZone
            ? (space.u - uSize) / 2
            : followedByGroup
                ? 0
                : ownBandOnEndSide
                    ? space.u - uSize
                    : 0;
        placements.push({
            box: zone,
            rect: { u, v: vCursor, uSize, vSize },
            scale: dims.baseScale * globalScale * zoneShrink,
            vertical: dims.useVertical,
        });
        if (followedByGroup) {
            floats.push({ extent: uSize + chipGap, vBottom: vCursor + vSize + lineGap });
        } else {
            vCursor += vSize + lineGap;
            ownBandOnEndSide = !ownBandOnEndSide;
        }
    });

    const vTotal = placements.reduce((max, placement) => (
        Math.max(max, placement.rect.v + placement.rect.vSize)
    ), 0);
    return { placements, vTotal };
};

export const layoutSonnetPosterBlocks = <T extends SonnetPosterBlockBox>(
    boxes: T[],
    width: number,
    height: number,
    baseFontSize: number,
    seed = 0,
): SonnetPosterBlocksPlan<T> => {
    if (boxes.length === 0) return { placements: [], width: 0, height: 0, gap: 0 };
    const gap = clamp(baseFontSize * 0.35, 16, 40);
    const chipGap = gap;
    const lineGap = gap * 1.15;
    // Canvas stays inside the stage even at the poster camera's max zoom (~1.18),
    // but is large enough that fallback compositions keep a readable font size.
    const canvas = {
        x: -width * 0.42,
        y: -height * 0.40,
        width: width * 0.84,
        height: height * 0.80,
    };
    const orientation: FlowOrientation = (seed % 2 === 0) ? 'horizontal' : 'vertical';
    // Flow u is the reading direction (screen x for rows, screen y for columns),
    // flow v the stacking direction — swap the capacities for the vertical variant.
    const space: FlowSpace = orientation === 'horizontal'
        ? { orientation, u: canvas.width, v: canvas.height }
        : { orientation, u: canvas.height, v: canvas.width };

    // Supports are never upscaled beyond their role size; global retries only shrink.
    let attempt = attemptFlowLayout(boxes, space, 1, chipGap, lineGap, seed);
    for (const globalScale of [0.92, 0.84, 0.76, 0.68, 0.6, 0.52]) {
        if (attempt.vTotal <= space.v + 0.5) break;
        attempt = attemptFlowLayout(boxes, space, globalScale, chipGap, lineGap, seed);
    }
    // Emergency uniform fit: even when every ladder rung overflows, shrink the
    // whole composition into the canvas instead of leaving boxes at the origin.
    if (attempt.vTotal > space.v) {
        const fitScale = space.v / attempt.vTotal;
        attempt.placements.forEach(placement => {
            placement.rect.u *= fitScale;
            placement.rect.v *= fitScale;
            placement.rect.uSize *= fitScale;
            placement.rect.vSize *= fitScale;
            placement.scale *= fitScale;
        });
        attempt.vTotal = space.v;
    }

    const vShift = Math.max(0, (space.v - attempt.vTotal) / 2);
    attempt.placements.forEach(placement => {
        const { box } = placement;
        const rect = { ...placement.rect, v: placement.rect.v + vShift };
        const screen = flowToScreen(space, rect, canvas);
        box.fontScale = placement.scale;
        box.measuredWidth = screen.width;
        box.measuredHeight = screen.height;
        box.x = screen.x + screen.width / 2;
        box.y = screen.y + screen.height / 2;
        box.rotation = 0;
        box.vertical = placement.vertical;
        if (placement.vertical && box.verticalDisplayText) box.displayText = box.verticalDisplayText;
        box.layoutDirection = orientation === 'vertical' ? 'vertical' : 'horizontal';
        if (orientation === 'horizontal') {
            box.enterX = (screen.x + screen.width / 2 < 0 ? -1 : 1) * Math.min(28, baseFontSize * 0.45);
            box.enterY = Math.min(18, baseFontSize * 0.25);
        } else {
            box.enterX = Math.min(18, baseFontSize * 0.25);
            box.enterY = (screen.y + screen.height / 2 < 0 ? -1 : 1) * Math.min(28, baseFontSize * 0.45);
        }
    });
    return { placements: boxes, width: canvas.width, height: canvas.height, gap };
};
