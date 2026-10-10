// src/components/remote/remoteTitlebarReveal.ts
// Pure rule for whether the remote window's top floating control bar should be shown.
export const REMOTE_TITLEBAR_REVEAL_THRESHOLD = 44;

export interface RemoteWindowPresentation {
    hideTitlebar: boolean;
    clickThrough: boolean;
}

export const DEFAULT_REMOTE_WINDOW_PRESENTATION: RemoteWindowPresentation = {
    hideTitlebar: false,
    clickThrough: false,
};

/** The bar shows only when the cursor is near the top and neither "hide bar" nor click-through is on. */
export const shouldRevealRemoteTitlebar = (
    clientY: number,
    presentation: RemoteWindowPresentation,
): boolean => {
    if (presentation.hideTitlebar || presentation.clickThrough) {
        return false;
    }
    return clientY <= REMOTE_TITLEBAR_REVEAL_THRESHOLD;
};
