import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PonderAnchorRole, PonderAnchorSource, PonderRect } from '../../types/ponder';
import type { PonderStageNodes } from './ponderStageNodes';
import PonderSurfaceContents from './PonderSurfaceContents';

// src/components/ponder/PonderSkeletonLayer.tsx
// 骨架：每个解析出来的锚点画一个框。
//
// 框本身是静态的 —— 位置在进入瞬间量一次就定了。会动的只有每个框里那层高亮填充，
// 由时间线的 highlight 步骤驱动，所以它要把自己登记进节点表。
//
// 按角色分别画，而不是清一色的圆角矩形：一块纯色方块读起来是「一块色」，
// 而带标题栏和几行占位内容的面才读得出是「一个面板」。这是骨架能不能替代真实界面的关键。
//
// 入场按声明顺序错开落位（CSS 里的 ponder-skeleton-in）。声明 startsHidden 的框不参与 ——
// 它们是某个动作的结果，要等时间线的 reveal 步骤才出现，一进场就摆着的话，
// 「按 S 打开命令面板」就成了旁白。

type PonderSkeletonLayerProps = {
    rects: Record<string, PonderRect>;
    anchors: Record<string, PonderAnchorSource>;
    /**
     * 本章真正讲到的锚点。
     *
     * anchors 是整个目标共用的一张表，一章只用得上其中两三个。不筛就会把全表的标签
     * 一次性糊在页面上 —— 七个名字互相压着，反而读不出界面长什么样。
     */
    activeAnchors: ReadonlySet<string>;
    nodes: PonderStageNodes;
    theme?: { accentColor?: string };
    isDaylight: boolean;
};

const PonderSkeletonLayer: React.FC<PonderSkeletonLayerProps> = ({
    rects,
    anchors,
    activeAnchors,
    nodes,
    theme,
    isDaylight,
}) => {
    const { t } = useTranslation();
    const accent = theme?.accentColor || (isDaylight ? '#27272a' : '#fafafa');
    const outline = isDaylight ? 'rgba(24, 24, 27, 0.22)' : 'rgba(255, 255, 255, 0.24)';
    const face = isDaylight ? 'rgba(24, 24, 27, 0.04)' : 'rgba(255, 255, 255, 0.05)';
    const line = isDaylight ? 'rgba(24, 24, 27, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    const labelColor = isDaylight ? 'rgba(24, 24, 27, 0.5)' : 'rgba(255, 255, 255, 0.5)';

    const shapeFor = (role: PonderAnchorRole) => {
        // region 只是一块几何：它身处的 synthetic surface 已经把真实控件画出来了，
        // 再套一层描边就是同一个东西画两遍，两层边框互相压着。
        if (role === 'region') {
            return { className: 'absolute overflow-hidden rounded-lg', style: {} as React.CSSProperties };
        }
        if (role === 'marker') {
            return { className: 'absolute', style: { backgroundColor: accent, opacity: 0.35 } };
        }
        if (role === 'rail') {
            return {
                className: 'absolute rounded-full border border-dashed',
                style: { borderColor: outline, backgroundColor: face },
            };
        }
        if (role === 'surface') {
            // 描边走 inset box-shadow 而不是 border：surface 里的合成界面全按百分比定位，
            // 1px 的 border 会把内容盒缩掉 1px，里面每个元素都和自己的锚点差这 1px。
            return {
                className: 'absolute overflow-hidden rounded-xl',
                style: { boxShadow: `inset 0 0 0 1px ${outline}`, backgroundColor: face },
            };
        }
        return { className: 'absolute overflow-hidden rounded-lg border', style: { borderColor: outline, backgroundColor: face } };
    };

    return (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {Object.entries(rects).map(([name, rect], index) => {
                const source = anchors[name];
                const role: PonderAnchorRole = source?.role ?? 'control';
                const shape = shapeFor(role);
                // 量到了真实圆角就照搬，角色自带的那套圆角只是没量到时的兜底。
                const radiusStyle = rect.radius ? { borderRadius: rect.radius } : {};
                const startsHidden = Boolean(source?.startsHidden);
                // 错开的上限压在 0.32s：锚点多的页面不该让最后一个框姗姗来迟。
                const entranceDelay = `${Math.min(index * 45, 320)}ms`;

                return (
                    <div key={name}>
                        <div
                            ref={node => {
                                if (node) nodes.boxes.set(name, node);
                                else nodes.boxes.delete(name);
                            }}
                            data-ponder-anchor={name}
                            data-ponder-anchor-role={role}
                            data-ponder-anchor-hidden={startsHidden || undefined}
                            className={`${shape.className}${startsHidden ? '' : ' ponder-skeleton-in'}`}
                            style={{
                                ...shape.style,
                                ...radiusStyle,
                                left: rect.left,
                                top: rect.top,
                                width: rect.width,
                                height: rect.height,
                                ...(startsHidden ? { opacity: 0 } : { animationDelay: entranceDelay }),
                            }}
                        >
                            {role === 'surface' && (
                                <PonderSurfaceContents
                                    kind={source?.surfaceKind}
                                    accent={accent}
                                    line={line}
                                    outline={outline}
                                    registerStateNode={(state, node, options) => {
                                        let stateNodes = nodes.surfaceStates.get(name);
                                        if (!stateNodes) {
                                            stateNodes = new Map();
                                            nodes.surfaceStates.set(name, stateNodes);
                                        }
                                        if (node) stateNodes.set(state, { node, replaces: options?.replaces ?? false });
                                        else stateNodes.delete(state);
                                    }}
                                />
                            )}
                            <div
                                ref={node => {
                                    if (node) {
                                        nodes.highlights.set(name, node);
                                    } else {
                                        nodes.highlights.delete(name);
                                    }
                                }}
                                className="absolute inset-0"
                                style={{ backgroundColor: accent, opacity: 0, ...radiusStyle }}
                            />
                        </div>

                        {/* 标签画在框外，不进 overflow-hidden 的框里，短框也不会被裁掉。
                            嵌套的框要靠 labelPlacement 显式错开，否则两个标签会叠成一团。

                            region 的标签由时间线控制显隐，只在讲到它的那段字幕期间露出来 ——
                            整章挂着的话，命令面板这类整页浮层上会留一串讲底下那屏的名字。
                            其余角色的骨架框本身就是插图，标签是常驻图例，按本章讲没讲到来筛。 */}
                        {source?.labelKey && (role === 'region' || activeAnchors.has(name)) && (() => {
                            const placement = source.labelPlacement
                                ?? (role === 'surface' ? 'inside' : 'above');
                            const top = placement === 'below' ? rect.top + rect.height + 6
                                : placement === 'inside' ? rect.top - 20
                                : rect.top - 18;
                            // region 的名字跟着讲到它的那段字幕走；startsHidden 的跟着它自己那次 reveal 走。
                            const isTimed = role === 'region' || startsHidden;
                            return (
                                <div
                                    ref={isTimed ? (node => {
                                        if (node) nodes.labels.set(name, node);
                                        else nodes.labels.delete(name);
                                    }) : undefined}
                                    className={`absolute whitespace-nowrap text-[11px] tracking-wide${
                                        isTimed ? '' : ' ponder-skeleton-label-in'
                                    }`}
                                    style={{
                                        left: rect.left,
                                        top,
                                        color: labelColor,
                                        ...(isTimed ? { opacity: 0 } : { animationDelay: entranceDelay }),
                                    }}
                                >
                                    {t(source.labelKey)}
                                </div>
                            );
                        })()}
                    </div>
                );
            })}
        </div>
    );
};

export default PonderSkeletonLayer;
