import { useLayoutEffect, type RefObject } from 'react';
import { getGlowWordReach } from '../../components/visualizer/glowWordOverlap';
import type { Theme } from '../../types';

// Fit Classic against stable phone-safe bounds so revealing chrome never resizes its words.
export function useLocalMobileLyricFit(stage: RefObject<HTMLDivElement | null>, enabled: boolean,
    lineKey: number | undefined, fontScale: number, theme: Theme) {
    useLayoutEffect(() => {
        const area = stage.current;
        if (!enabled || !area || lineKey === undefined) return;
        let frame = 0;
        let fitted: HTMLElement | null = null;
        const measured = new WeakSet<HTMLElement>();
        const clear = () => {
            for (const name of ['scale', 'x', 'y']) fitted?.style.removeProperty(`--local-mobile-lyric-${name}`);
        };
        const fit = () => {
            frame = 0;
            clear();
            const line = area.querySelector<HTMLElement>(`[data-overlap-fit-line="${lineKey}"]`);
            const words = line?.querySelectorAll<HTMLElement>('.inline-block.whitespace-nowrap');
            if (!line || !words?.length || !line.offsetWidth) return;
            fitted = line;
            if (!measured.has(line)) { measured.add(line); resize.observe(line); }
            const chaotic = theme.animationIntensity === 'chaotic';
            const offset = theme.animationIntensity === 'calm' ? 0 : chaotic ? 60 : 20;
            const rotation = theme.animationIntensity === 'calm' ? 0 : chaotic ? 30 : 5;
            const scale = chaotic ? 1.4 : 1.3;
            let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
            words.forEach(word => {
                if (!measured.has(word)) { measured.add(word); resize.observe(word); }
                const size = parseFloat(getComputedStyle(word).fontSize);
                const pose = { scale, rotate: rotation, passedRotate: 22.5 };
                const reach = getGlowWordReach(word.offsetWidth, size, pose);
                const straight = getGlowWordReach(word.offsetWidth, size, { ...pose, rotate: 0 });
                const halfWidth = Math.max(reach.halfWidth, straight.halfWidth) + offset;
                const halfHeight = Math.max(reach.halfHeight, straight.halfHeight) + offset;
                const x = word.offsetLeft + word.offsetWidth / 2;
                const y = word.offsetTop + word.offsetHeight / 2;
                left = Math.min(left, x - halfWidth); right = Math.max(right, x + halfWidth);
                top = Math.min(top, y - halfHeight); bottom = Math.max(bottom, y + halfHeight);
            });
            const bounds = area.getBoundingClientRect(), original = line.getBoundingClientRect();
            const factor = Math.min(1, Math.max(1, bounds.width - 24) / (right - left),
                Math.max(1, bounds.height - 40) / (bottom - top));
            const x = bounds.left + bounds.width / 2 - (original.left + original.width / 2)
                - ((left + right) / 2 - line.offsetWidth / 2) * factor;
            const y = bounds.top + bounds.height / 2 - (original.top + original.height / 2)
                - ((top + bottom) / 2 - line.offsetHeight / 2) * factor;
            line.style.setProperty('--local-mobile-lyric-scale', String(factor));
            line.style.setProperty('--local-mobile-lyric-x', `${x}px`);
            line.style.setProperty('--local-mobile-lyric-y', `${y}px`);
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(fit); };
        const resize = new ResizeObserver(schedule);
        const children = new MutationObserver(schedule);
        resize.observe(area);
        children.observe(area, { childList: true, subtree: true });
        document.fonts?.addEventListener('loadingdone', schedule);
        fit();
        return () => {
            if (frame) cancelAnimationFrame(frame);
            resize.disconnect(); children.disconnect();
            document.fonts?.removeEventListener('loadingdone', schedule);
            clear();
        };
    }, [stage, enabled, lineKey, fontScale, theme]);
}
