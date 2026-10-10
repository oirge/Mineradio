import type { PonderRect } from '../../types/ponder';

// src/utils/ponder/captionPlacement.ts
// 字幕该摆在哪：贴着它所讲的目标，但不许压住任何骨架框，也不许压住上下两条外框。
//
// 「贴着目标」和「不挡住目标」是一对矛盾 —— 固定放在目标下方，目标一旦靠近别的框
// 或靠近屏幕底部，字幕就骑在界面上了（这正是截图里那种情况）。所以改成在目标周围
// 试一圈位置，挑一个真正空出来的。
//
// 纯函数，不碰 DOM：候选位置的取舍是这套 UX 里少数几处值得被穷举验证的逻辑之一。

export type PonderBox = { left: number; top: number; width: number; height: number };

/** 字幕与目标之间留的间隙。 */
const GAP_PX = 28;

/** 贴视口边缘时的余量。 */
const MARGIN_PX = 16;

/**
 * 外框和浮层卡的重叠在评分里放大多少倍。
 *
 * 骨架框是画出来的示意图，被压住一角还读得懂；标题栏、进度条和「可单独思索的组件」那张卡
 * 上面是另一段文字，字幕压上去就是两段字叠在一起。两者不该同权。
 */
const RESERVED_PENALTY = 40;

/** 判定重叠时把障碍物向外放一圈，免得字幕和骨架框贴边贴到一起。 */
const OBSTACLE_PADDING_X_PX = 12;

/**
 * 纵向留得更多：骨架框的名字标签画在框的上沿或下沿之外，不在框的矩形里。
 * 只按框本身避让，字幕就会正好压在标签上。
 */
const OBSTACLE_PADDING_Y_PX = 26;

const inflate = (box: PonderRect): PonderBox => ({
    left: box.left - OBSTACLE_PADDING_X_PX,
    top: box.top - OBSTACLE_PADDING_Y_PX,
    width: box.width + OBSTACLE_PADDING_X_PX * 2,
    height: box.height + OBSTACLE_PADDING_Y_PX * 2,
});

const overlapArea = (a: PonderBox, b: PonderBox): number => {
    const x = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
    return x * y;
};

type PickCaptionSpotInput = {
    target: { x: number; y: number };
    /** 字幕盒的估计尺寸。宁可估大一点，估小了会贴上去。 */
    size: { width: number; height: number };
    /** 要避开的骨架框。 */
    obstacles: PonderRect[];
    viewport: { width: number; height: number };
    /** 上下外框占掉的横条，字幕不能压到它们。 */
    reserved: PonderBox[];
};

/**
 * 在目标四周试一圈位置，挑压得最少的那个。
 *
 * 候选顺序就是优先级：下、上、右、左，再是四个斜角。前面的连线更短更好读，
 * 所以同分时取靠前的。
 */
export const pickCaptionSpot = ({
    target,
    size,
    obstacles,
    viewport,
    reserved,
}: PickCaptionSpotInput): { left: number; top: number } => {
    const { width, height } = size;

    // 间隙要从「目标所在的那个框」的边缘算，而不是从目标点算。
    // 点通常落在框中心，框却向四周各伸出上百像素 —— 按点留 28px，字幕必然骑在框上。
    const host = obstacles.filter(box => (
        target.x >= box.left && target.x <= box.left + box.width
        && target.y >= box.top && target.y <= box.top + box.height
    ));
    const anchor = host.length > 0
        ? {
            left: Math.min(...host.map(box => box.left)),
            top: Math.min(...host.map(box => box.top)),
            right: Math.max(...host.map(box => box.left + box.width)),
            bottom: Math.max(...host.map(box => box.top + box.height)),
        }
        : { left: target.x, top: target.y, right: target.x, bottom: target.y };

    const below = anchor.bottom + GAP_PX;
    const above = anchor.top - GAP_PX - height;
    const toRight = anchor.right + GAP_PX;
    const toLeft = anchor.left - GAP_PX - width;

    const candidates: { left: number; top: number }[] = [
        { left: target.x - width / 2, top: below },
        { left: target.x - width / 2, top: above },
        { left: toRight, top: target.y - height / 2 },
        { left: toLeft, top: target.y - height / 2 },
        { left: toRight, top: below },
        { left: toLeft, top: below },
        { left: toRight, top: above },
        { left: toLeft, top: above },
    ];

    const maxLeft = Math.max(MARGIN_PX, viewport.width - width - MARGIN_PX);
    const maxTop = Math.max(MARGIN_PX, viewport.height - height - MARGIN_PX);
    const inflated = obstacles.map(inflate);

    let best: { left: number; top: number } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
        // 先钳进视口再评分：钳位会挪动位置，挪完才知道真实的遮挡情况。
        const box: PonderBox = {
            left: Math.min(Math.max(candidate.left, MARGIN_PX), maxLeft),
            top: Math.min(Math.max(candidate.top, MARGIN_PX), maxTop),
            width,
            height,
        };
        const onSkeleton = inflated.reduce((total, blocker) => total + overlapArea(box, blocker), 0);
        const onReserved = reserved.reduce((total, blocker) => total + overlapArea(box, blocker), 0);
        // 压住骨架框只是挡住一幅示意图，压住外框和浮层卡却是压在另一段文字上 ——
        // 后者要重得多，否则「少盖住一点骨架」会把字幕留在标题栏上。
        const score = onSkeleton + onReserved * RESERVED_PENALTY;
        if (score === 0) {
            return { left: box.left, top: box.top };
        }
        if (score < bestScore) {
            bestScore = score;
            best = { left: box.left, top: box.top };
        }
    }

    return best ?? { left: MARGIN_PX, top: MARGIN_PX };
};
