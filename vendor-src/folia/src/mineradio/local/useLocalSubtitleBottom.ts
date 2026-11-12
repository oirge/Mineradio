import { useLayoutEffect, type RefObject } from 'react';
import { useMotionValue } from 'framer-motion';

// src/mineradio/local/useLocalSubtitleBottom.ts
// Follow the embedded transport's actual height, including the host's idle collapse animation.
export function useLocalSubtitleBottom(root: RefObject<HTMLElement | null>, hasControls: boolean) {
    const bottom = useMotionValue(32);
    useLayoutEffect(() => {
        const player = root.current;
        const controls = hasControls ? player?.querySelector<HTMLElement>('.local-controls') : null;
        if (!player || !controls) { bottom.set(32); return; }
        const measure = () => {
            const next = Math.max(32, player.clientHeight - controls.offsetTop + 16);
            if (bottom.get() !== next) bottom.set(next);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(player);
        observer.observe(controls);
        return () => observer.disconnect();
    }, [root, bottom, hasControls]);
    return bottom;
}
