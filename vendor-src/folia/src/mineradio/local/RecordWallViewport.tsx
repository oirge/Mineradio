import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Disc } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../types';
import { PolaroidCard, type GridItem } from '../../library/suites/grid/shared/PolaroidCard';
import { recordWallLayout } from './recordWallLayout';
import { useRecordWallMotion } from './useRecordWallMotion';

// src/mineradio/local/RecordWallViewport.tsx
// The original Polaroid material and entrance animation, virtualized by Folia's hex-grid runtime.
const CARD_FRAME_BASE_STYLE: CSSProperties = {
    transformOrigin: 'center center',
    contain: 'layout style',
    backfaceVisibility: 'hidden',
    perspective: '1200px',
};

function RecordWallViewport({ items, theme, isDaylight, onPlay, onAddQueue }: {
    items: GridItem[]; theme: Theme; isDaylight: boolean;
    onPlay: (id: string) => void; onAddQueue: (id: string) => void;
}) {
    const { t } = useTranslation();
    const container = useRef<HTMLDivElement>(null);
    const entered = useRef(new Set<string | number>());
    const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const layout = useMemo(() => recordWallLayout(size.width, size.height), [size]);
    const wall = useRecordWallMotion(items.length, container, layout);
    useEffect(() => {
        const element = container.current;
        if (!element) return;
        let raf: number | null = null;
        const observer = new ResizeObserver(([entry]) => {
            if (!entry) return;
            if (raf !== null) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                raf = null;
                const width = Math.round(entry.contentRect.width), height = Math.round(entry.contentRect.height);
                if (width > 0 && height > 0) setSize(old => old.width === width && old.height === height ? old : { width, height });
            });
        });
        observer.observe(element);
        return () => { observer.disconnect(); if (raf !== null) cancelAnimationFrame(raf); };
    }, []);

    return <div ref={container} className="local-record-viewport" tabIndex={0} data-testid="local-record-viewport"
        aria-label={t('localPlayer:recordWall', { defaultValue: '唱片墙' })}
        onKeyDown={event => {
            const target = event.target as HTMLElement;
            if (target.isContentEditable || target.closest('button,input,textarea,select,a')) return;
            if (event.key === 'Enter' && !event.repeat && items[wall.focusedIndex]) {
                event.preventDefault(); onPlay(String(items[wall.focusedIndex].id));
            } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                event.preventDefault(); wall.moveFocus(event.key);
            }
        }}
        onPointerDown={event => {
            if (event.button !== 0) return;
            const target = event.target as HTMLElement;
            if (target.closest('button,input,a,textarea,.theme-glass-panel')) return;
            let current: HTMLElement | null = target;
            while (current && !current.classList.contains('theme-polaroid-card')) {
                if (current.classList.contains('cursor-pointer')) return;
                current = current.parentElement;
            }
            container.current?.focus({ preventScroll: true });
            wall.controls.start(event);
        }}>
        <motion.div drag dragListener={false} dragControls={wall.controls} dragConstraints={wall.bounds}
            dragElastic={0.05} dragTransition={{ power: 0.16, timeConstant: 220 }}
            onDragStart={wall.onDragStart} onDragEnd={wall.onDragEnd}
            style={{ x: wall.x, y: wall.y, touchAction: 'none', background: 'rgba(0,0,0,0)' }}
            className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing">
            {wall.renderedIndexes.map(index => {
                const item = items[index];
                if (!item || !wall.coords[index]) return null;
                const animateEntrance = !entered.current.has(item.id);
                return <div key={item.id} ref={node => { wall.bindCard(index, node); }}
                    data-record-id={item.id} data-focused={index === wall.focusedIndex}
                    className="absolute select-none pointer-events-auto folia-grid-card-frame"
                    style={CARD_FRAME_BASE_STYLE}>
                    <motion.div initial={animateEntrance ? { opacity: 0, scale: 0.98, rotateY: -90 } : false}
                        animate={{ opacity: 1, scale: 1, rotateY: 0, x: 0, y: 0 }}
                        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                        onAnimationComplete={() => entered.current.add(item.id)}
                        style={{ position: 'relative', transformStyle: 'preserve-3d', transformOrigin: 'center center', willChange: 'transform, opacity' }}>
                        <div style={{ backfaceVisibility: 'hidden' }}>
                            <PolaroidCard item={item} theme={theme} isDaylight={isDaylight} mode="tracks" t={t}
                                cardWidth={layout.cardWidth} cardHeight={layout.cardHeight}
                                isFocused={index === wall.focusedIndex}
                                onCenter={() => { if (!wall.dragging.current) wall.centerOnIndex(index); }}
                                onSelect={() => { if (!wall.dragging.current) onPlay(String(item.id)); }}
                                onAddQueue={() => onAddQueue(String(item.id))} />
                        </div>
                        <div aria-hidden="true" className="absolute inset-0 rounded-xl border shadow-lg theme-polaroid-card flex items-center justify-center"
                            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                            <div className="w-[58%] aspect-square rounded-full border border-current flex items-center justify-center opacity-30"><Disc className="w-1/2 h-1/2" /></div>
                        </div>
                    </motion.div>
                </div>;
            })}
        </motion.div>
    </div>;
}

export default memo(RecordWallViewport);
