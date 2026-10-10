import React, { useCallback, useEffect, useMemo, useRef } from 'react';

// src/components/modal/settings/GlobalLyricOffsetRuler.tsx
// 全局时间偏移的刻度尺：中线固定高亮，刻度带跟着指针走，像收音机调谐盘 / 音游延迟校准那样
// 把目标刻度对到中线上。直接操作语义：向右拖 = 刻度带跟着手往右 = 中线落在更小的值上。

const PX_PER_MS = 0.6;
const MINOR_STEP_MS = 25;
const MAJOR_STEP_MS = 100;
const LABEL_STEP_MS = 200;
const KEY_STEP_MS = 1;
const KEY_COARSE_STEP_MS = 10;
/** 单次 wheel 事件最多推动的像素，避免鼠标滚轮一格就跳掉几百毫秒 */
const WHEEL_PX_CAP = 20;
const EDGE_FADE = 'linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%)';

type TickKind = 'minor' | 'major' | 'label';

type Tick = {
    ms: number;
    kind: TickKind;
};

type GlobalLyricOffsetRulerProps = {
    valueMs: number;
    limitMs: number;
    isDaylight: boolean;
    ariaLabel: string;
    onChange: (nextMs: number) => void;
};

const TICK_HEIGHT: Record<TickKind, number> = { minor: 8, major: 16, label: 22 };
/** 标签行距刻度带顶端的固定距离，跟最长的那根刻度线留出间隙 */
const LABEL_TOP_PX = TICK_HEIGHT.label + 12;

const formatTickLabel = (ms: number) => (ms > 0 ? `+${ms}` : `${ms}`);

const resolveTickKind = (ms: number): TickKind => {
    if (ms % LABEL_STEP_MS === 0) {
        return 'label';
    }

    return ms % MAJOR_STEP_MS === 0 ? 'major' : 'minor';
};

const GlobalLyricOffsetRuler: React.FC<GlobalLyricOffsetRulerProps> = ({
    valueMs,
    limitMs,
    isDaylight,
    ariaLabel,
    onChange,
}) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ pointerId: number; startX: number; startValueMs: number; } | null>(null);
    // wheel/键盘的连续调整要基于最新值，但回调本身不该让 effect 反复重绑
    const valueRef = useRef(valueMs);
    const onChangeRef = useRef(onChange);
    valueRef.current = valueMs;
    onChangeRef.current = onChange;

    const clamp = useCallback(
        (next: number) => Math.round(Math.max(-limitMs, Math.min(limitMs, next))),
        [limitMs],
    );

    const ticks = useMemo(() => {
        const result: Tick[] = [];
        for (let ms = -limitMs; ms <= limitMs; ms += MINOR_STEP_MS) {
            result.push({ ms, kind: resolveTickKind(ms) });
        }
        return result;
    }, [limitMs]);

    // wheel 必须用非 passive 的原生监听才能 preventDefault，否则会连带滚动外层设置面板
    useEffect(() => {
        const track = trackRef.current;
        if (!track) {
            return;
        }

        const handleWheel = (event: WheelEvent) => {
            const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
            if (rawDelta === 0) {
                return;
            }

            event.preventDefault();
            const cappedPx = Math.max(-WHEEL_PX_CAP, Math.min(WHEEL_PX_CAP, rawDelta));
            onChangeRef.current(Math.round(Math.max(-limitMs, Math.min(limitMs, valueRef.current + cappedPx / PX_PER_MS))));
        };

        track.addEventListener('wheel', handleWheel, { passive: false });
        return () => track.removeEventListener('wheel', handleWheel);
    }, [limitMs]);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startValueMs: valueMs };
        event.currentTarget.setPointerCapture(event.pointerId);
        trackRef.current?.focus();
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        // 刻度带跟手：手指右移 delta 像素，落在中线上的就是原来偏左 delta 像素的那个刻度
        onChange(clamp(drag.startValueMs - (event.clientX - drag.startX) / PX_PER_MS));
    };

    const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) {
            return;
        }

        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? KEY_COARSE_STEP_MS : KEY_STEP_MS;
        const keyed: Record<string, number | undefined> = {
            ArrowLeft: valueMs - step,
            ArrowDown: valueMs - step,
            ArrowRight: valueMs + step,
            ArrowUp: valueMs + step,
            PageDown: valueMs - KEY_COARSE_STEP_MS * 10,
            PageUp: valueMs + KEY_COARSE_STEP_MS * 10,
            Home: 0,
            End: 0,
        };
        const next = keyed[event.key];
        if (next === undefined) {
            return;
        }

        event.preventDefault();
        onChange(clamp(next));
    };

    const accentColor = 'var(--text-accent, #60a5fa)';
    const tickColor = (kind: TickKind, ms: number) => {
        const base = isDaylight ? '0, 0, 0' : '255, 255, 255';
        if (ms === 0) {
            return `rgba(${base}, ${isDaylight ? 0.55 : 0.6})`;
        }

        const alpha = kind === 'minor' ? 0.16 : kind === 'major' ? 0.3 : 0.42;
        return `rgba(${base}, ${alpha})`;
    };

    return (
        <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label={ariaLabel}
            aria-valuemin={-limitMs}
            aria-valuemax={limitMs}
            aria-valuenow={valueMs}
            aria-valuetext={`${formatTickLabel(valueMs)} ms`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={handleKeyDown}
            className="relative h-[68px] w-full cursor-ew-resize touch-none select-none outline-none"
        >
            {/* 中线两侧的高亮底：让「对准中线」这个动作有落点感。
                accentColor 在默认主题下就是正文色，所以这里只能给很低的透明度，否则会糊成一团 */}
            <div
                className="pointer-events-none absolute left-1/2 top-0 h-10 w-24 -translate-x-1/2 opacity-15"
                style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
            />

            <div
                className="absolute inset-0 overflow-hidden"
                style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}
            >
                {/* 刻度基线：让整条尺读起来是一把尺，而不是一排孤立的短线 */}
                <div
                    className="absolute inset-x-0 top-3 h-px"
                    style={{ backgroundColor: tickColor('minor', 1) }}
                />
                <div
                    className="absolute inset-x-0 top-3"
                    style={{ transform: `translate3d(${-valueMs * PX_PER_MS}px, 0, 0)` }}
                >
                    {ticks.map(({ ms, kind }) => (
                        <div
                            key={ms}
                            className="absolute top-0 w-0"
                            style={{ left: `calc(50% + ${ms * PX_PER_MS}px)` }}
                        >
                            <div
                                className="absolute left-0 top-0 -translate-x-1/2 rounded-full"
                                style={{
                                    width: ms === 0 ? 2 : 1,
                                    height: ms === 0 ? TICK_HEIGHT.label + 4 : TICK_HEIGHT[kind],
                                    backgroundColor: tickColor(kind, ms),
                                }}
                            />
                            {/* 标签用固定 top，不跟着刻度线高度走，否则零点那根更长的线会把「0」压低一截 */}
                            {kind === 'label' && (
                                <div
                                    className="absolute left-0 -translate-x-1/2 font-mono text-[10px] tabular-nums whitespace-nowrap"
                                    style={{ top: LABEL_TOP_PX, color: tickColor(kind, ms) }}
                                >
                                    {ms === 0 ? '0' : formatTickLabel(ms)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 固定不动的读数中线。刻意只覆盖刻度区、不压到标签行，否则中线正下方的数字永远被挡住 */}
            <div className="pointer-events-none absolute left-1/2 top-0 flex h-10 -translate-x-1/2 flex-col items-center">
                <div
                    className="h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent"
                    style={{ borderTopColor: accentColor }}
                />
                <div
                    className="w-[2px] flex-1 rounded-full"
                    style={{ backgroundColor: accentColor, boxShadow: `0 0 12px ${accentColor}` }}
                />
            </div>
        </div>
    );
};

export default GlobalLyricOffsetRuler;
