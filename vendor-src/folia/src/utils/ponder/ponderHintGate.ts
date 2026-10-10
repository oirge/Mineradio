import type { PonderHintVisibility, PonderTargetId } from '../../types/ponder';

// src/utils/ponder/ponderHintGate.ts
// 三档可见性设置、「已看过」记录和运行时环境在这里汇合，决定要不要弹「按 G 思索」。
//
// 单独成文件是因为这是整套 UX 里唯一一处策略判断，其余都是机械动作；纯函数也让三档
// 设置的行为矩阵可以被完整单测，不必去驱动真实指针。

type PonderHintGateInput = {
    visibility: PonderHintVisibility;
    targetId: PonderTargetId;
    seenIds: ReadonlySet<string>;
    hasBlockingWindow: boolean;
    /** 该 target 是否就在那个 blocking window 内部；是的话模态不构成阻断。 */
    isInsideBlockingWindow?: boolean;
    /** 粗指针（触屏）下跟随光标的胶囊没有意义。 */
    supportsFinePointer: boolean;
};

/**
 * 此刻该不该给这个 target 提示。
 *
 * 模态那条例外很窄：只有当被悬停的 target 本身就在接管键盘的那个窗口内部时才放行 ——
 * 首批里唯一落进这种情况的是命令面板那个问号按钮。
 */
export const shouldOfferPonderHint = ({
    visibility,
    targetId,
    seenIds,
    hasBlockingWindow,
    isInsideBlockingWindow = false,
    supportsFinePointer,
}: PonderHintGateInput): boolean => {
    if (visibility === 'off' || !supportsFinePointer) {
        return false;
    }
    if (hasBlockingWindow && !isInsideBlockingWindow) {
        return false;
    }
    if (visibility === 'unseen' && seenIds.has(targetId)) {
        return false;
    }
    return true;
};
