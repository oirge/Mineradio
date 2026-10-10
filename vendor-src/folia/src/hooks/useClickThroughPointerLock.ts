import { useEffect } from 'react';

// src/hooks/useClickThroughPointerLock.ts
// While the main window ignores mouse events it is still created with `{ forward: true }`, so
// Electron keeps delivering mouse-move into the renderer to drive the unlock hotspot. That also
// keeps :hover alive on a window nothing can click, so mark the document and let `index.css` drop
// pointer input for every element except the unlock control (`.click-through-interactive`).
const CLICK_THROUGH_DOCUMENT_STATE = 'active';

export const useClickThroughPointerLock = (active: boolean) => {
    useEffect(() => {
        const root = document.documentElement;
        if (!active) {
            delete root.dataset.clickThrough;
            return;
        }

        root.dataset.clickThrough = CLICK_THROUGH_DOCUMENT_STATE;
        return () => {
            delete root.dataset.clickThrough;
        };
    }, [active]);
};

export default useClickThroughPointerLock;
