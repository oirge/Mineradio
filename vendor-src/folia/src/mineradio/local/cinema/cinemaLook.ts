// A drag rotates the seated camera. A tap still reaches the lyrics on the screen.
export function bindCinemaLook(root: HTMLElement, turn: (yaw: number, pitch: number) => void) {
    let gesture: { id: number; x: number; y: number; dragging: boolean } | null = null;
    let suppressClick = false;
    const down = (event: PointerEvent) => {
        if (!event.isPrimary || event.button !== 0 || gesture) return;
        suppressClick = false;
        if (event.target instanceof Element && event.target.closest('button, input, select, textarea, a, [data-scene-no-look]')) return;
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
    };
    const move = (event: PointerEvent) => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const x = event.clientX - gesture.x, y = event.clientY - gesture.y;
        if (!gesture.dragging) {
            if (Math.hypot(x, y) < 5) return;
            gesture.dragging = true;
            root.setPointerCapture(event.pointerId);
            root.dataset.looking = 'true';
        }
        gesture.x = event.clientX;
        gesture.y = event.clientY;
        turn(x * 0.005, y * 0.005);
    };
    const end = (event: PointerEvent) => {
        if (!gesture || gesture.id !== event.pointerId) return;
        suppressClick = gesture.dragging && event.type === 'pointerup';
        gesture = null;
        delete root.dataset.looking;
    };
    const click = (event: MouseEvent) => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
    };
    root.addEventListener('pointerdown', down, true);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerleave', end);
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    root.addEventListener('lostpointercapture', end);
    root.addEventListener('click', click, true);
    return () => {
        root.removeEventListener('pointerdown', down, true);
        root.removeEventListener('pointermove', move);
        root.removeEventListener('pointerleave', end);
        root.removeEventListener('pointerup', end);
        root.removeEventListener('pointercancel', end);
        root.removeEventListener('lostpointercapture', end);
        root.removeEventListener('click', click, true);
        delete root.dataset.looking;
    };
}
