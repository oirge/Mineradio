import React from 'react';

// src/components/ponder/surfaces/PonderSurfaceStateLayer.tsx

/** 基础结构层在登记表里的名字。时间线用它找到「操作之前的那一屏」。 */
export const PONDER_SURFACE_BASE_STATE = 'base';

export type PonderSurfaceStateOptions = {
    /**
     * 这一层盖上来的时候，底下哪一层该退场。
     *
     * `false`（默认）是纯叠加：工具面板、命令面板、半透明遮罩下的展开海报都属于这一类，
     * 底下那屏要留着，否则就丢掉了「它盖在页面上」这个事实。
     * `true` 是整屏替换：重画一遍海报墙的结果层如果只是淡入，屏幕上就同时存在两面墙、
     * 还差着一点位移，看起来正是「骨架和真实元素错位」。
     * 给一个层名则是只替换那一层 —— 换源只换轨道上的卡，页头和来源动作要留在原处，
     * 用一块不透明的底去盖会连它们一起埋掉，还得去凑页面底色。
     */
    replaces?: boolean | string;
};

export type PonderSurfaceStateRegistrar = (
    state: string,
    node: HTMLElement | null,
    options?: PonderSurfaceStateOptions,
) => void;

type PonderSurfaceStateLayerProps = PonderSurfaceStateOptions & {
    state: string;
    registerStateNode?: PonderSurfaceStateRegistrar;
    children: React.ReactNode;
    className?: string;
    /** 操作之前就在屏幕上的层（基础结构、可被单独替换的子层）。 */
    visible?: boolean;
};

/** Pre-renders one operation result so the anime timeline can reveal it without React updates. */
const PonderSurfaceStateLayer: React.FC<PonderSurfaceStateLayerProps> = ({
    state,
    registerStateNode,
    children,
    className = '',
    replaces,
    visible,
}) => (
    <div
        ref={node => registerStateNode?.(state, node, { replaces })}
        data-ponder-surface-state={state}
        className={`absolute inset-0 ${visible ? '' : 'opacity-0'} ${className}`}
        style={{ transformOrigin: 'center' }}
    >
        {children}
    </div>
);

/** 操作之前的那一屏。和结果层一样登记进节点表，时间线才能在结果出现时把它淡出。 */
export const PonderSurfaceBase: React.FC<{
    registerStateNode?: PonderSurfaceStateRegistrar;
    children: React.ReactNode;
}> = ({ registerStateNode, children }) => (
    <PonderSurfaceStateLayer state={PONDER_SURFACE_BASE_STATE} registerStateNode={registerStateNode} visible>
        {children}
    </PonderSurfaceStateLayer>
);

export default PonderSurfaceStateLayer;
