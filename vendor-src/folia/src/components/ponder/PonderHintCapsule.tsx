import React, { useLayoutEffect, useRef } from 'react';
import { motion, useTransform } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ponderPointerX, ponderPointerY } from '../../stores/motionSignals';
import type { Theme } from '../../types';

// src/components/ponder/PonderHintCapsule.tsx
// 跟随光标的「按 G 思索」提示。不可点击，不参与布局。
//
// 位置全程走 MotionValue → useTransform，一次 React 重渲染都不产生：光标坐标是每帧值，
// 写进 state 就等于让整棵树按指针频率重渲染（见 skills/frontend-runtime-guardrails）。
// 擦除进度由 usePonderHoldToEnter 用 WAAPI 直接驱动下面这几个 ref，同样不经过 React。

/** 胶囊相对光标的偏移，px。 */
const CURSOR_OFFSET_PX = 12;

/** 贴边时留的余量，px。 */
const VIEWPORT_MARGIN_PX = 8;

type PonderHintCapsuleProps = {
    label: string;
    /**
     * 长按之后会打开的是哪个目标。
     *
     * 只写「按 G 思索」的话，用户在屏幕上同时压着好几个目标时（封面在面板里、标签页在
     * 标签排里）没法知道松手会讲哪一个 —— 而这正是按组件划分目标之后最容易踩空的地方。
     */
    targetName?: string;
    /**
     * 'cursor' 跟着指针走，给悬停某个组件那条路；
     * 'page' 钉在屏幕底部中间 —— Ctrl+G 是纯键盘触发，指针可能从没动过，
     * 跟随会把胶囊丢在视口左上角。
     */
    placement?: 'cursor' | 'page';
    theme?: Theme;
    isDaylight: boolean;
    wipeRef: React.RefObject<HTMLDivElement | null>;
    labelRef: React.RefObject<HTMLSpanElement | null>;
    holdLabelRef: React.RefObject<HTMLSpanElement | null>;
};

const PonderHintCapsule: React.FC<PonderHintCapsuleProps> = ({
    label,
    targetName,
    placement = 'cursor',
    theme,
    isDaylight,
    wipeRef,
    labelRef,
    holdLabelRef,
}) => {
    const { t } = useTranslation();
    const rootRef = useRef<HTMLDivElement | null>(null);
    // 自身尺寸量一次存 ref。贴边钳位每帧都要用它，但它只在挂载和语言切换时变 ——
    // 每帧去量会是一次强制重排。
    const sizeRef = useRef({ width: 128, height: 28 });

    useLayoutEffect(() => {
        const node = rootRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        if (rect.width > 0) {
            sizeRef.current = { width: rect.width, height: rect.height };
        }
    }, [label, targetName]);

    const x = useTransform(ponderPointerX, value => {
        const max = window.innerWidth - sizeRef.current.width - VIEWPORT_MARGIN_PX;
        return Math.max(VIEWPORT_MARGIN_PX, Math.min(max, value + CURSOR_OFFSET_PX));
    });
    const y = useTransform(ponderPointerY, value => {
        const max = window.innerHeight - sizeRef.current.height - VIEWPORT_MARGIN_PX;
        return Math.max(VIEWPORT_MARGIN_PX, Math.min(max, value + CURSOR_OFFSET_PX));
    });

    const accent = theme?.accentColor || (isDaylight ? '#27272a' : '#fafafa');
    const surface = isDaylight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(24, 24, 27, 0.92)';
    const border = isDaylight ? 'rgba(24, 24, 27, 0.12)' : 'rgba(255, 255, 255, 0.14)';
    const text = isDaylight ? '#27272a' : '#fafafa';

    const isPinned = placement === 'page';

    return (
        <motion.div
            ref={rootRef}
            style={isPinned ? undefined : { x, y }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            // z-[205]：要压过思索导航页（195）和帮助对话框（200），否则在这些页面内
            // 悬停目标时，已经命中的「按 G 思索」会被页面本身遮住。它仍低于教程层（220）。
            className={`pointer-events-none fixed z-[205] select-none ${
                isPinned ? 'bottom-24 left-1/2 -translate-x-1/2' : 'left-0 top-0'
            }`}
            data-testid="ponder-hint-capsule"
            data-ponder-hint-placement={placement}
            aria-hidden="true"
        >
            <div
                className="relative flex items-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-1 text-xs shadow-lg backdrop-blur-sm"
                style={{ backgroundColor: surface, borderColor: border, color: text }}
            >
                {/* 长按进度：由 WAAPI 把 scaleX 从 0 推到 1，不是 React 状态。 */}
                <div
                    ref={wipeRef}
                    className="absolute inset-0 origin-left"
                    style={{ transform: 'scaleX(0)', backgroundColor: accent, opacity: 0.22 }}
                />
                <Lightbulb size={12} className="relative shrink-0" style={{ color: accent }} />
                <span className="relative flex flex-col items-start leading-tight">
                    <span className="relative whitespace-nowrap">
                        <span ref={labelRef}>{label}</span>
                        {/* 压在同一处淡入，两段文案不会互相推挤布局。 */}
                        <span
                            ref={holdLabelRef}
                            className="absolute inset-0 whitespace-nowrap"
                            style={{ opacity: 0 }}
                        >
                            {t('ponder.hintCapsuleHold')}
                        </span>
                    </span>
                    {/* 目标名留在第二行，不跟着擦除淡出 —— 按住的全程都要看得见讲的是哪一个。
                        靠强调色和字重区分，不加括号：名字本身已经够短，括号只是多两个字符的噪声。 */}
                    {targetName ? (
                        <span className="whitespace-nowrap font-medium" style={{ color: accent }}>
                            {targetName}
                        </span>
                    ) : null}
                </span>
            </div>
        </motion.div>
    );
};

export default PonderHintCapsule;
