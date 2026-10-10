// The top-down entrance the grid filter box has always used. The box itself is the command
// palette's inline presentation now, so the palette is what plays this — but it stays here rather
// than inside the palette, because it describes how a filter box arrives on a grid, not how the
// palette behaves.
export const gridSearchPanelMotion = {
    initial: {
        opacity: 0,
        y: -64,
    },
    animate: {
        opacity: 1,
        y: 0,
    },
    exit: {
        opacity: 0,
        y: -32,
    },
    transition: {
        duration: 0.34,
        ease: [0.16, 1, 0.3, 1] as const,
    },
};
