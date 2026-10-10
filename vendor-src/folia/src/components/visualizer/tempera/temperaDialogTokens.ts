import type { CSSProperties } from 'react';

// src/components/visualizer/tempera/temperaDialogTokens.ts
// Colors for the canvas-image dialog. It is portalled to document.body, which puts it outside
// the app shell div that carries --text-primary/--text-secondary/--text-accent: inside the
// portal those vars resolve to nothing, `color: var(--text-primary)` becomes invalid and the
// text falls back to the body's near-white - invisible on the daylight panel. So the dialog
// carries its own palette, keyed to the two panel backgrounds ThemedDialog paints
// (bg-white/90 in daylight, bg-zinc-900/95 otherwise) rather than to the album theme.

export interface TemperaDialogTokens {
    textPrimary: string;
    textSecondary: string;
    accent: string;
    /** Hairlines between rows and around chips. */
    line: string;
    /** Dashed outline of the drop target. */
    lineStrong: string;
    /** The nine-grid's own cell divisions, drawn over a preview. */
    gridLine: string;
    surface: string;
    hoverSurfaceClass: string;
    /** The nine-grid placement dot, when it is not the chosen cell. */
    markerBorder: string;
    markerFill: string;
    markerHalo: string;
    /** Transparency checkerboard behind a preview. */
    checkerTint: string;
    /** Floating delete button over a preview. */
    overlayButtonClass: string;
}

const DAYLIGHT_TOKENS: TemperaDialogTokens = {
    textPrimary: '#18181b',
    textSecondary: '#52525b',
    accent: '#18181b',
    line: 'rgba(0,0,0,0.12)',
    lineStrong: 'rgba(0,0,0,0.28)',
    gridLine: 'rgba(0,0,0,0.08)',
    surface: 'rgba(0,0,0,0.04)',
    hoverSurfaceClass: 'hover:bg-black/[0.06]',
    markerBorder: 'rgba(0,0,0,0.35)',
    markerFill: 'rgba(255,255,255,0.7)',
    markerHalo: '0 0 0 3px rgba(255,255,255,0.85)',
    checkerTint: 'rgba(0,0,0,0.07)',
    overlayButtonClass: 'bg-white/75 hover:bg-white',
};

const NIGHT_TOKENS: TemperaDialogTokens = {
    textPrimary: '#fafafa',
    textSecondary: '#a1a1aa',
    accent: '#fafafa',
    line: 'rgba(255,255,255,0.12)',
    lineStrong: 'rgba(255,255,255,0.18)',
    gridLine: 'rgba(255,255,255,0.06)',
    surface: 'rgba(255,255,255,0.05)',
    hoverSurfaceClass: 'hover:bg-white/10',
    markerBorder: 'rgba(255,255,255,0.45)',
    markerFill: 'rgba(0,0,0,0.2)',
    markerHalo: '0 0 0 3px rgba(0,0,0,0.35)',
    checkerTint: 'rgba(255,255,255,0.07)',
    overlayButtonClass: 'bg-black/50 hover:bg-black/70',
};

export const temperaDialogTokens = (isDaylight: boolean): TemperaDialogTokens => (
    isDaylight ? DAYLIGHT_TOKENS : NIGHT_TOKENS
);

// Re-declares the shell's text vars inside the portal so the shared controls rendered here -
// TemperaRangeControl above all - keep styling themselves off var(--text-*) as they do in the
// settings panel.
export const temperaDialogTextVars = (tokens: TemperaDialogTokens): CSSProperties => ({
    '--text-primary': tokens.textPrimary,
    '--text-secondary': tokens.textSecondary,
    '--text-accent': tokens.accent,
    color: tokens.textPrimary,
} as CSSProperties);
