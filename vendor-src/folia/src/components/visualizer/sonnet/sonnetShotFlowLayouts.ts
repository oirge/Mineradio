// src/components/visualizer/sonnet/sonnetShotFlowLayouts.ts
// Flow-based placement passes for the non-poster shot kinds. Each variant keeps
// its own composition identity (ribbon, cross, orbit, badge...), but all of them
// share the poster-blocks principles: exact measured boxes, gaps in the
// clamp(baseFontSize * 0.35, 16, 40) range, a scan order that equals the timeline
// order, and uniform global-scale retries instead of per-word shrink loops.

export interface SonnetFlowLayoutBox {
    index: number;
    isHero: boolean;
    isSemiHero: boolean;
    displayText: string;
    fontScale: number;
    measuredWidth: number;
    measuredHeight: number;
    vertical: boolean;
    layoutDirection: 'horizontal' | 'vertical';
    rotation: number;
    x: number;
    y: number;
    enterX: number;
    enterY: number;
}

export interface SonnetFlowLayoutContext<T extends SonnetFlowLayoutBox> {
    boxes: T[];
    heroIndex: number;
    width: number;
    height: number;
    flowGap: number;
    stackGap: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Word-to-word gap (flowGap) and line/column gap (stackGap) shared by all branches.
export const resolveSonnetFlowGaps = (baseFontSize: number) => {
    const flowGap = clamp(baseFontSize * 0.35, 16, 40);
    return { flowGap, stackGap: Math.max(24, flowGap * 1.35) };
};

// Runs a placement pass at shrinking global scales until every measured box sits
// inside the stage safe area. All roles shrink together, so the hero > semi-hero >
// support hierarchy and the "supports never upscale" rule survive every retry.
export const placeWithGlobalFit = <T extends SonnetFlowLayoutBox>(
    ctx: SonnetFlowLayoutContext<T>,
    place: (globalScale: number) => void,
) => {
    const snapshot = ctx.boxes.map(box => ({
        fontScale: box.fontScale,
        measuredWidth: box.measuredWidth,
        measuredHeight: box.measuredHeight,
    }));
    const safeHalfW = ctx.width * 0.48;
    const safeHalfH = ctx.height * 0.46;
    for (const globalScale of [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52]) {
        ctx.boxes.forEach((box, index) => {
            box.fontScale = snapshot[index].fontScale * globalScale;
            box.measuredWidth = snapshot[index].measuredWidth * globalScale;
            box.measuredHeight = snapshot[index].measuredHeight * globalScale;
        });
        place(globalScale);
        const fits = ctx.boxes.every(box => (
            Math.abs(box.x) + box.measuredWidth / 2 <= safeHalfW + 0.5
            && Math.abs(box.y) + box.measuredHeight / 2 <= safeHalfH + 0.5
        ));
        if (fits) return;
    }
};

// Quiet tableau: one calm stack, earlier words above the hero and later words
// below it, so the column reads top-to-bottom in exact timeline order. When a
// run outgrows the safe height it wraps into side columns instead of shrinking:
// earlier words continue in columns marching right, later words in columns
// marching left — columns always read right-to-left in timeline order.
export const layoutQuietTableau = <T extends SonnetFlowLayoutBox>(
    ctx: SonnetFlowLayoutContext<T>,
    variant: number,
) => {
    const { boxes, heroIndex, height, stackGap } = ctx;
    const heroBox = boxes[heroIndex];
    const horizontalCard = variant === 2 || variant === 3;
    boxes.forEach(box => { box.layoutDirection = horizontalCard ? 'horizontal' : 'vertical'; });
    const safeHalfH = height * 0.46;
    placeWithGlobalFit(ctx, () => {
        heroBox.x = 0;
        heroBox.y = horizontalCard ? 0 : -height * 0.1;
        const stagger = variant === 3 ? 70 : 0;
        const columnStep = Math.max(...boxes.map(box => box.measuredWidth)) + stackGap + stagger;
        const xFor = (box: T, index: number) => {
            if (variant === 1) return heroBox.x - heroBox.measuredWidth / 2 + box.measuredWidth / 2;
            if (variant === 3) return heroBox.x + ((index % 2 === 0) ? 1 : -1) * 35;
            return heroBox.x;
        };
        // Before run: upward from the hero; overflow wraps into columns to the right.
        let column = 0;
        let currentY = heroBox.y - heroBox.measuredHeight / 2 - stackGap;
        for (let i = heroIndex - 1; i >= 0; i--) {
            const box = boxes[i];
            if (currentY - box.measuredHeight < -safeHalfH) {
                column += 1;
                currentY = safeHalfH;
            }
            box.x = xFor(box, i) + column * columnStep;
            box.y = currentY - box.measuredHeight / 2;
            currentY -= box.measuredHeight + stackGap;
            if (variant === 1) { box.enterX = 20; box.enterY = 0; }
            else if (variant === 3) { box.enterX = box.x > heroBox.x ? 30 : -30; box.enterY = 0; }
            else { box.enterX = 0; box.enterY = 20; }
        }
        // After run: downward from the hero; overflow wraps into columns to the left.
        column = 0;
        currentY = heroBox.y + heroBox.measuredHeight / 2 + stackGap;
        for (let i = heroIndex + 1; i < boxes.length; i++) {
            const box = boxes[i];
            if (currentY + box.measuredHeight > safeHalfH) {
                column += 1;
                currentY = -safeHalfH;
            }
            box.x = xFor(box, i) - column * columnStep;
            box.y = currentY + box.measuredHeight / 2;
            currentY += box.measuredHeight + stackGap;
            if (variant === 1) { box.enterX = -20; box.enterY = 0; }
            else if (variant === 3) { box.enterX = box.x > heroBox.x ? 30 : -30; box.enterY = 0; }
            else { box.enterX = 0; box.enterY = -20; }
        }
    });
};

// Tracking ribbon: one horizontal line; words before the hero extend left (the
// earliest ends up leftmost), words after extend right — strict reading order.
export const layoutTrackingRibbon = <T extends SonnetFlowLayoutBox>(
    ctx: SonnetFlowLayoutContext<T>,
    variant: number,
) => {
    const { boxes, heroIndex, flowGap } = ctx;
    const heroBox = boxes[heroIndex];
    boxes.forEach(box => { box.layoutDirection = 'horizontal'; });
    placeWithGlobalFit(ctx, () => {
        heroBox.x = 0;
        heroBox.y = 0;
        const alignY = (box: T, index: number) => (
            variant === 1
                ? heroBox.y + heroBox.measuredHeight / 2 - box.measuredHeight / 2
                : variant === 2
                    ? heroBox.y - heroBox.measuredHeight / 2 + box.measuredHeight / 2
                    : heroBox.y + (index % 2 === 0 ? 10 : -10)
        );
        const enter = variant === 2 ? 20 : 30;
        let currentX = heroBox.x - heroBox.measuredWidth / 2 - flowGap;
        for (let i = heroIndex - 1; i >= 0; i--) {
            const box = boxes[i];
            box.x = currentX - box.measuredWidth / 2;
            box.y = alignY(box, i);
            currentX -= box.measuredWidth + flowGap;
            box.enterX = enter; box.enterY = 0;
        }
        currentX = heroBox.x + heroBox.measuredWidth / 2 + flowGap;
        for (let i = heroIndex + 1; i < boxes.length; i++) {
            const box = boxes[i];
            box.x = currentX + box.measuredWidth / 2;
            box.y = alignY(box, i);
            currentX += box.measuredWidth + flowGap;
            box.enterX = -enter; box.enterY = 0;
        }
    });
};

// Editorial column family: five magazine compositions rebuilt around measured
// flow so columns never reverse the timeline and lines never collide.
export const layoutEditorialColumn = <T extends SonnetFlowLayoutBox>(
    ctx: SonnetFlowLayoutContext<T>,
    variant: number,
    secondaryHeroIndex: number,
) => {
    const { boxes, heroIndex, width, height, flowGap, stackGap } = ctx;
    const heroBox = boxes[heroIndex];

    if (variant === 0) {
        boxes.forEach(box => { box.layoutDirection = 'vertical'; });
        // Traditional vertical reading: the column RIGHT of the hero pillar holds
        // earlier words, the column on its left the later ones (columns read
        // right-to-left, words inside a column top-to-bottom).
        placeWithGlobalFit(ctx, () => {
            heroBox.x = -width * 0.15;
            heroBox.y = 0;
            let currentY = heroBox.y - heroBox.measuredHeight / 2 + stackGap * 0.5;
            for (let i = 0; i < heroIndex; i++) {
                const box = boxes[i];
                box.x = heroBox.x + heroBox.measuredWidth / 2 + flowGap + box.measuredWidth / 2;
                box.y = currentY + box.measuredHeight / 2;
                currentY += box.measuredHeight + stackGap;
                box.enterX = -20; box.enterY = 0;
            }
            currentY = heroBox.y - heroBox.measuredHeight / 2 + stackGap * 0.5;
            for (let i = heroIndex + 1; i < boxes.length; i++) {
                const box = boxes[i];
                box.x = heroBox.x - heroBox.measuredWidth / 2 - flowGap - box.measuredWidth / 2;
                box.y = currentY + box.measuredHeight / 2;
                currentY += box.measuredHeight + stackGap;
                box.enterX = 20; box.enterY = 0;
            }
        });
    } else if (variant === 1) {
        boxes.forEach(box => { box.layoutDirection = 'vertical'; });
        // Flush-right magazine rail reading top-to-bottom in timeline order. When
        // one rail outgrows the safe height it continues in rails marching left
        // (columns read right-to-left) instead of shrinking.
        placeWithGlobalFit(ctx, () => {
            const rightEdge = width * 0.28;
            const safeHalfH = height * 0.46;
            const railStep = Math.max(...boxes.map(box => box.measuredWidth)) + stackGap;
            const totalHeight = boxes.reduce((sum, box) => sum + box.measuredHeight, 0)
                + stackGap * (boxes.length - 1);
            // Prefer the single centered rail as long as it could fit at the
            // ladder's minimum scale; only genuinely long shots wrap.
            const fitsSingleRail = boxes.reduce((sum, box) => sum + box.measuredHeight, 0) * 0.52
                + stackGap * (boxes.length - 1) <= safeHalfH * 2;
            if (fitsSingleRail) {
                let currentY = -totalHeight / 2;
                boxes.forEach(box => {
                    box.x = rightEdge - box.measuredWidth / 2;
                    box.y = currentY + box.measuredHeight / 2;
                    currentY += box.measuredHeight + stackGap;
                    box.enterX = 20; box.enterY = 0;
                });
                return;
            }
            let rail = 0;
            let currentY = -safeHalfH;
            boxes.forEach(box => {
                if (currentY + box.measuredHeight > safeHalfH) {
                    rail += 1;
                    currentY = -safeHalfH;
                }
                box.x = (rightEdge - rail * railStep) - box.measuredWidth / 2;
                box.y = currentY + box.measuredHeight / 2;
                currentY += box.measuredHeight + stackGap;
                box.enterX = 20; box.enterY = 0;
            });
        });
    } else if (variant === 2) {
        boxes.forEach(box => { box.layoutDirection = 'horizontal'; });
        // Magazine header: earlier words form a kicker row above the hero, later
        // words pair up row-by-row in two columns hugging the header below it.
        placeWithGlobalFit(ctx, () => {
            heroBox.x = 0;
            heroBox.y = -height * 0.25;
            const before = boxes.slice(0, heroIndex);
            const after = boxes.slice(heroIndex + 1);
            if (before.length > 0) {
                const kickerHeight = Math.max(...before.map(box => box.measuredHeight));
                const kickerWidth = before.reduce((sum, box) => sum + box.measuredWidth, 0)
                    + flowGap * (before.length - 1);
                const kickerY = heroBox.y - heroBox.measuredHeight / 2 - stackGap - kickerHeight / 2;
                let currentX = heroBox.x - kickerWidth / 2;
                before.forEach(box => {
                    box.x = currentX + box.measuredWidth / 2;
                    box.y = kickerY;
                    currentX += box.measuredWidth + flowGap;
                    box.enterX = 0; box.enterY = -20;
                });
            }
            const leftAnchor = heroBox.x - heroBox.measuredWidth * 0.25 - flowGap;
            const rightAnchor = heroBox.x + heroBox.measuredWidth * 0.25 + flowGap;
            let currentY = heroBox.y + heroBox.measuredHeight / 2 + stackGap;
            for (let pair = 0; pair < after.length; pair += 2) {
                const left = after[pair];
                const right = after[pair + 1];
                const rowHeight = Math.max(left.measuredHeight, right?.measuredHeight ?? 0);
                left.x = leftAnchor - left.measuredWidth / 2;
                left.y = currentY + left.measuredHeight / 2;
                left.enterX = -20; left.enterY = 0;
                if (right) {
                    right.x = rightAnchor + right.measuredWidth / 2;
                    right.y = currentY + right.measuredHeight / 2;
                    right.enterX = 20; right.enterY = 0;
                }
                currentY += rowHeight + stackGap;
            }
        });
    } else if (variant === 3) {
        boxes.forEach(box => { box.layoutDirection = 'horizontal'; });
        // Double hero lines: two offset lines, each laid left-to-right in timeline
        // order, spaced by the real line heights instead of a fixed nudge.
        placeWithGlobalFit(ctx, () => {
            heroBox.x = 0;
            heroBox.y = 0;
            const firstHero = Math.min(heroIndex, secondaryHeroIndex);
            const line1 = boxes.slice(0, firstHero + 1);
            const line2 = boxes.slice(firstHero + 1);
            const line1Height = Math.max(...line1.map(box => box.measuredHeight));
            const line2Height = Math.max(...line2.map(box => box.measuredHeight));
            const totalHeight = line1Height + stackGap + line2Height;
            const line1Y = heroBox.y - totalHeight / 2 + line1Height / 2;
            const line2Y = line1Y + line1Height / 2 + stackGap + line2Height / 2;
            const layLine = (line: T[], lineY: number, enterX: number) => {
                const lineWidth = line.reduce((sum, box) => sum + box.measuredWidth, 0)
                    + flowGap * (line.length - 1);
                let currentX = -lineWidth / 2;
                line.forEach(box => {
                    box.x = currentX + box.measuredWidth / 2;
                    box.y = lineY;
                    currentX += box.measuredWidth + flowGap;
                    box.enterX = enterX; box.enterY = 0;
                });
                return lineWidth;
            };
            const line1Width = layLine(line1, line1Y, 30);
            const line2Width = layLine(line2, line2Y, -30);
            // Staggered-stairs offset between the two lines.
            const offsetAmount = Math.max(line1Width, line2Width) * 0.12;
            line1.forEach(box => { box.x -= offsetAmount; });
            line2.forEach(box => { box.x += offsetAmount; });
        });
    } else if (variant === 4) {
        boxes.forEach((box, index) => {
            box.layoutDirection = index === heroIndex ? 'vertical' : 'horizontal';
        });
        // Logo badge: the hero pillar floats on the flow-start side. Earlier words
        // take full-width rows above it, later words wrap beside it, then continue
        // full-width below — the zone-float rule from the poster flow.
        placeWithGlobalFit(ctx, () => {
            const heroOnRight = heroIndex === boxes.length - 1;
            const blockLeft = -width * 0.40;
            const blockRight = width * 0.40;
            let currentY = -height * 0.34;

            // Packs indices left-to-right into rows; the row region can shrink
            // beside the pillar and widen again below it.
            const flowWords = (indices: number[], regionFor: (rowTop: number) => [number, number]) => {
                let [left, right] = regionFor(currentY);
                let currentX = left;
                let rowHeight = 0;
                indices.forEach(index => {
                    const box = boxes[index];
                    if (currentX > left && currentX + box.measuredWidth > right) {
                        currentY += rowHeight + stackGap;
                        [left, right] = regionFor(currentY);
                        currentX = left;
                        rowHeight = 0;
                    }
                    box.x = currentX + box.measuredWidth / 2;
                    box.y = currentY + box.measuredHeight / 2;
                    box.enterX = heroOnRight ? -25 : 25;
                    box.enterY = 0;
                    currentX += box.measuredWidth + flowGap;
                    rowHeight = Math.max(rowHeight, box.measuredHeight);
                });
                if (indices.length > 0) currentY += rowHeight;
            };

            const beforeIndices = boxes.slice(0, heroIndex).map(box => box.index);
            const afterIndices = boxes.slice(heroIndex + 1).map(box => box.index);
            flowWords(beforeIndices, () => [blockLeft, blockRight]);
            currentY += stackGap;

            const pillarLeft = heroOnRight ? blockRight - heroBox.measuredWidth : blockLeft;
            heroBox.x = pillarLeft + heroBox.measuredWidth / 2;
            heroBox.y = currentY + heroBox.measuredHeight / 2;
            const pillarBottom = currentY + heroBox.measuredHeight + stackGap;
            const besideLeft = heroOnRight ? blockLeft : pillarLeft + heroBox.measuredWidth + flowGap;
            const besideRight = heroOnRight ? pillarLeft - flowGap : blockRight;
            flowWords(afterIndices, rowTop => (
                rowTop < pillarBottom - 0.5 ? [besideLeft, besideRight] : [blockLeft, blockRight]
            ));
        });
    }
};

// Fragment collage: polar orbit in strict clockwise timeline order. Each support
// advances its angle until its measured rect clears every rect already placed
// (hero included), so the ring keeps its chaotic look without any actual overlap.
export const layoutFragmentCollage = <T extends SonnetFlowLayoutBox>(
    ctx: SonnetFlowLayoutContext<T>,
    variant: number,
) => {
    const { boxes, heroIndex, flowGap, stackGap } = ctx;
    const heroBox = boxes[heroIndex];
    interface PlacedRect { left: number; right: number; top: number; bottom: number }
    // Negative when the rects overlap, otherwise the distance between them.
    const rectSeparation = (a: PlacedRect, b: PlacedRect) => Math.max(
        Math.max(a.left - b.right, b.left - a.right),
        Math.max(a.top - b.bottom, b.top - a.bottom),
    );
    // Rotated non-CJK blocks were measured in their tall rotated orientation; the
    // collage flattens them back to horizontal. Flatten once, before the global-fit
    // retries snapshot the boxes, so every rung packs the horizontal footprint and
    // the frame decor never wraps a vertical box around horizontal text.
    boxes.forEach((box, index) => {
        if (index === heroIndex) return;
        if (Math.abs(Math.round(box.rotation / (Math.PI / 2)) % 2) === 1) {
            const rotatedWidth = box.measuredHeight;
            box.measuredHeight = box.measuredWidth;
            box.measuredWidth = rotatedWidth;
        }
        box.rotation = 0;
    });
    placeWithGlobalFit(ctx, (globalScale) => {
        heroBox.x = 0;
        heroBox.y = 0;
        const baseRadius = Math.hypot(heroBox.measuredWidth, heroBox.measuredHeight) / 2 + stackGap;
        const count = Math.max(1, boxes.length - 1);
        const squash = 0.65;
        const placed: PlacedRect[] = [{
            left: heroBox.x - heroBox.measuredWidth / 2,
            right: heroBox.x + heroBox.measuredWidth / 2,
            top: heroBox.y - heroBox.measuredHeight / 2,
            bottom: heroBox.y + heroBox.measuredHeight / 2,
        }];
        let angle = Math.PI / 4;
        let supportIndex = 0;
        for (let i = 0; i < boxes.length; i++) {
            if (i === heroIndex) continue;
            const box = boxes[i];
            let radius = baseRadius;
            if (variant === 1) {
                // Archimedean spiral drifting outward with the timeline.
                radius += (35 + (supportIndex / count) * 150) * globalScale;
            } else if (variant === 2) {
                // Staggered double ring.
                radius += ((supportIndex % 2 === 1) ? 140 : 50) * globalScale;
            } else {
                // Classic ring with deterministic radial jitter.
                radius += (45 + ((supportIndex * 23) % 90)) * globalScale;
            }
            supportIndex += 1;
            let candidate = angle;
            let rect: PlacedRect = { left: 0, right: 0, top: 0, bottom: 0 };
            // Sweep the ring for a free slot; when a full sweep finds none, step
            // the radius outward and sweep again so crowded shots never drop a
            // box onto an occupied spot.
            let resolvedRadius = radius;
            let placedClear = false;
            for (let ring = 0; ring < 14 && !placedClear; ring += 1) {
                for (let attempt = 0; attempt < 400; attempt++) {
                    rect = {
                        left: Math.cos(candidate) * resolvedRadius - box.measuredWidth / 2,
                        right: Math.cos(candidate) * resolvedRadius + box.measuredWidth / 2,
                        top: Math.sin(candidate) * resolvedRadius * squash - box.measuredHeight / 2,
                        bottom: Math.sin(candidate) * resolvedRadius * squash + box.measuredHeight / 2,
                    };
                    if (placed.every(entry => rectSeparation(entry, rect) >= flowGap)) {
                        placedClear = true;
                        break;
                    }
                    candidate += 0.07;
                }
                if (!placedClear) resolvedRadius += (36 + ring * 12) * globalScale;
            }
            angle = candidate + 0.02;
            placed.push(rect);
            box.x = heroBox.x + Math.cos(candidate) * resolvedRadius;
            box.y = heroBox.y + Math.sin(candidate) * resolvedRadius * squash;
            box.layoutDirection = Math.abs(Math.cos(candidate)) >= Math.abs(Math.sin(candidate))
                ? 'vertical'
                : 'horizontal';
            box.enterX = Math.cos(candidate) * -60;
            box.enterY = Math.sin(candidate) * -60;
        }
    });
};

// Dynamic cross (type-impact / mask-reveal): top column -> left row -> hero ->
// right row -> bottom column. The band split keeps the scan order equal to the
// timeline order by construction.
export const layoutCrossStack = <T extends SonnetFlowLayoutBox>(
    ctx: SonnetFlowLayoutContext<T>,
) => {
    const { boxes, heroIndex, height, flowGap, stackGap } = ctx;
    const heroBox = boxes[heroIndex];
    const beforeCount = heroIndex;
    const topCount = Math.floor(beforeCount / 2);
    const afterCount = boxes.length - 1 - heroIndex;
    const rightCount = Math.ceil(afterCount / 2);

    // Column bands used to stack support-scale words tightly against the hero, so
    // a short column left most of its vertical band empty. Grow undersized column
    // words (capped below the hero hierarchy) and justify the column across the
    // available span. Runs inside the fit callback because only the current rung's
    // (possibly shrunk) hero height tells us how much band is actually free.
    const fillColumn = (column: T[]) => {
        if (column.length === 0) return 0;
        const available = Math.max(0, height * 0.46 - heroBox.measuredHeight / 2 - stackGap);
        if (available <= 0) return 0;
        const gaps = stackGap * (column.length - 1);
        const contentHeight = column.reduce((sum, box) => sum + box.measuredHeight, 0);
        const target = available * 0.72;
        if (contentHeight + gaps < target) {
            const boost = Math.min(2.2, (target - gaps) / Math.max(1, contentHeight));
            column.forEach(box => {
                // Never let a boosted word outscale the hero hierarchy.
                const capped = Math.min(boost, (heroBox.fontScale * 0.6) / box.fontScale);
                if (capped > 1.05) {
                    box.fontScale *= capped;
                    box.measuredWidth *= capped;
                    box.measuredHeight *= capped;
                }
            });
        }
        if (column.length < 2) return 0;
        const grown = column.reduce((sum, box) => sum + box.measuredHeight, 0);
        const pitch = (available * 0.95 - grown) / (column.length - 1);
        return Math.max(0, Math.min(stackGap * 2, pitch - stackGap));
    };

    placeWithGlobalFit(ctx, () => {
        heroBox.x = 0;
        heroBox.y = 0;
        const topStretch = fillColumn(boxes.slice(0, topCount));
        const bottomStretch = fillColumn(boxes.slice(heroIndex + rightCount + 1));

        // Left row: indices topCount..heroIndex-1, earliest ends up leftmost.
        let currentX = heroBox.x - heroBox.measuredWidth / 2 - stackGap;
        for (let i = heroIndex - 1; i >= topCount; i--) {
            const box = boxes[i];
            box.layoutDirection = 'horizontal';
            box.x = currentX - box.measuredWidth / 2;
            box.y = heroBox.y + (i % 2 === 0 ? 10 : -10);
            currentX -= box.measuredWidth + flowGap;
            box.enterX = -30; box.enterY = 0;
        }

        // Top column: indices 0..topCount-1, earliest ends up topmost.
        let currentY = heroBox.y - heroBox.measuredHeight / 2 - stackGap;
        for (let i = topCount - 1; i >= 0; i--) {
            const box = boxes[i];
            box.layoutDirection = 'vertical';
            box.x = heroBox.x + (i % 2 === 0 ? 15 : -15);
            box.y = currentY - box.measuredHeight / 2;
            currentY -= box.measuredHeight + stackGap + topStretch;
            box.enterX = 0; box.enterY = -30;
        }

        // Right row: the words right after the hero, left-to-right.
        currentX = heroBox.x + heroBox.measuredWidth / 2 + stackGap;
        for (let i = heroIndex + 1; i <= heroIndex + rightCount; i++) {
            const box = boxes[i];
            box.layoutDirection = 'horizontal';
            box.x = currentX + box.measuredWidth / 2;
            box.y = heroBox.y + (i % 2 === 0 ? 10 : -10);
            currentX += box.measuredWidth + flowGap;
            box.enterX = 30; box.enterY = 0;
        }

        // Bottom column: the remaining words, top-to-bottom.
        currentY = heroBox.y + heroBox.measuredHeight / 2 + stackGap;
        for (let i = heroIndex + rightCount + 1; i < boxes.length; i++) {
            const box = boxes[i];
            box.layoutDirection = 'vertical';
            box.x = heroBox.x + (i % 2 === 0 ? 15 : -15);
            box.y = currentY + box.measuredHeight / 2;
            currentY += box.measuredHeight + stackGap + bottomStretch;
            box.enterX = 0; box.enterY = 30;
        }
    });
};
