import { isMineradioEmbedded, requestHost, subscribeHost } from './client';

// src/mineradio/lifecycle.ts
// Pause the embedded surface's animation work while the other interface is visible.
export function installMineradioSurfaceLifecycle(): void {
    if (!isMineradioEmbedded()) return;
    const nativeRequest = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const queued = new Map<number, FrameRequestCallback>();
    const handles = new Map<number, number>();
    let nextId = 0;
    let active = true;

    const schedule = (id: number, callback: FrameRequestCallback) => {
        handles.set(id, nativeRequest((time) => {
            handles.delete(id);
            if (!active) queued.set(id, callback);
            else callback(time);
        }));
    };
    window.requestAnimationFrame = (callback) => {
        const id = ++nextId;
        if (active) schedule(id, callback);
        else queued.set(id, callback);
        return id;
    };
    window.cancelAnimationFrame = (id) => {
        queued.delete(id);
        const handle = handles.get(id);
        if (handle !== undefined) nativeCancel(handle);
        handles.delete(id);
    };
    subscribeHost('visibility', (data: { active: boolean }) => {
        if (active === !!data.active) return;
        active = !!data.active;
        document.documentElement.dataset.mineradioActive = String(active);
        if (active) {
            for (const [id, callback] of queued) schedule(id, callback);
            queued.clear();
            window.dispatchEvent(new Event('resize'));
        }
    });
    window.addEventListener('keydown', (event) => {
        if (event.altKey && event.key.toLowerCase() === 'm') {
            event.preventDefault();
            void requestHost('switchInterface', { mode: 'mineradio' });
        }
    });
}
