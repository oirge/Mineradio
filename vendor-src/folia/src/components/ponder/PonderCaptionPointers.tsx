import React from 'react';
import { anchorPointToPx } from '../../utils/ponder/resolvePonderAnchors';
import type { PonderRect, PonderTimelinePlan } from '../../types/ponder';
import type { PonderStageNodes } from './ponderStageNodes';

// src/components/ponder/PonderCaptionPointers.tsx
// 字幕到它所讲的那个框之间的指向线。
//
// 这是原版 Ponder 里说明文字的核心形态：文字永远连着它在讲的东西。没有这条线，
// 一段居中的字幕和画面上五个框之间就没有任何对应关系，用户得自己猜在说谁。
//
// 线是静态几何（字幕盒和目标点都在进入时就定死了），会动的只有整组的透明度，
// 由时间线挂在和对应字幕同一段时间上。

type PonderCaptionPointersProps = {
    plan: PonderTimelinePlan;
    rects: Record<string, PonderRect>;
    /** 字幕盒子量出来的位置，键是 step.id。 */
    captionBoxes: Record<string, PonderRect>;
    nodes: PonderStageNodes;
    accent: string;
};

/**
 * 从字幕盒最靠近目标的那条边上引出起点。
 * 直接用盒心会让线从文字底下穿出来。
 */
const edgePoint = (box: PonderRect, target: { x: number; y: number }) => {
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    if (target.y < box.top) {
        return { x: Math.min(Math.max(target.x, box.left + 12), box.left + box.width - 12), y: box.top };
    }
    if (target.y > box.top + box.height) {
        return { x: Math.min(Math.max(target.x, box.left + 12), box.left + box.width - 12), y: box.top + box.height };
    }
    return target.x < centerX ? { x: box.left, y: centerY } : { x: box.left + box.width, y: centerY };
};

const PonderCaptionPointers: React.FC<PonderCaptionPointersProps> = ({
    plan,
    rects,
    captionBoxes,
    nodes,
    accent,
}) => (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {plan.entries.map(({ step }) => {
            if (step.kind !== 'caption' || !step.pointTo) return null;
            const target = anchorPointToPx(step.pointTo, rects);
            const box = captionBoxes[step.id];
            if (!target || !box) return null;

            const start = edgePoint(box, target);
            // 一个折角，而不是直连：正交的一段让线读起来是「标注」而不是「连线图」。
            const elbow = { x: start.x, y: start.y + (target.y - start.y) * 0.55 };

            return (
                <g
                    key={step.id}
                    ref={node => {
                        if (node) nodes.pointers.set(step.id, node);
                        else nodes.pointers.delete(step.id);
                    }}
                    style={{ opacity: 0 }}
                >
                    <path
                        d={`M ${start.x} ${start.y} L ${elbow.x} ${elbow.y} L ${target.x} ${target.y}`}
                        fill="none"
                        stroke={accent}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.75"
                    />
                    <circle cx={target.x} cy={target.y} r="6" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.75" />
                    <circle cx={target.x} cy={target.y} r="2" fill={accent} />
                </g>
            );
        })}
    </svg>
);

export default PonderCaptionPointers;
