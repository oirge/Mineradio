import React from 'react';

// src/components/modal/playback-entry-view/playbackEntryViewArt.tsx
// The two diagrams the entry-view prompt and the settings section share.
//
// Inline SVG rather than an asset: both are a handful of rectangles, they have to pick up the
// current theme's accent colour, and shipping them as files would put a network fetch in front of
// a modal that opens exactly once.

type ArtProps = {
    /** The playing/selected element's colour; everything else is drawn in `currentColor`. */
    accentColor: string;
    className?: string;
};

const FRAME_PROPS = {
    x: 1,
    y: 1,
    width: 158,
    height: 98,
    rx: 10,
    fill: 'none',
    stroke: 'currentColor',
    strokeOpacity: 0.18,
    strokeWidth: 2,
} as const;

/** Player view: one big cover, the lyric column beside it, and the level meter underneath. */
export const PlayerViewArt: React.FC<ArtProps> = ({ accentColor, className }) => (
    <svg viewBox="0 0 160 100" className={className} role="presentation" aria-hidden="true">
        <rect {...FRAME_PROPS} />
        <rect x="16" y="20" width="44" height="44" rx="7" fill={accentColor} fillOpacity="0.85" />
        <rect x="72" y="24" width="62" height="6" rx="3" fill="currentColor" fillOpacity="0.25" />
        <rect x="72" y="38" width="52" height="7" rx="3.5" fill={accentColor} fillOpacity="0.9" />
        <rect x="72" y="53" width="58" height="6" rx="3" fill="currentColor" fillOpacity="0.25" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => {
            // Capped so the tallest bar still clears the cover art above it.
            const height = [6, 12, 8, 16, 10, 17, 9, 14, 7, 13, 10, 5][index];
            return (
                <rect
                    key={index}
                    x={16 + index * 11}
                    y={84 - height}
                    width="5"
                    height={height}
                    rx="2.5"
                    fill="currentColor"
                    fillOpacity={0.3}
                />
            );
        })}
    </svg>
);

const LATTICE_COLUMNS = 4;
const LATTICE_ROWS = 3;
const TILE_WIDTH = 30;
const TILE_HEIGHT = 22;
const TILE_GAP = 6;
const FOCUSED_COLUMN = 1;
const FOCUSED_ROW = 1;

/** Lattice view: the whole queue as a poster wall, with the playing poster lifted out of it. */
export const LatticeViewArt: React.FC<ArtProps> = ({ accentColor, className }) => (
    <svg viewBox="0 0 160 100" className={className} role="presentation" aria-hidden="true">
        <rect {...FRAME_PROPS} />
        {Array.from({ length: LATTICE_ROWS }).flatMap((_, row) => (
            Array.from({ length: LATTICE_COLUMNS }).map((__, column) => {
                const isFocused = row === FOCUSED_ROW && column === FOCUSED_COLUMN;
                const x = 11 + column * (TILE_WIDTH + TILE_GAP);
                const y = 11 + row * (TILE_HEIGHT + TILE_GAP);
                if (isFocused) {
                    // Drawn oversized and centred on its own cell, which is how the wall marks the
                    // song that is actually sounding.
                    return (
                        <rect
                            key={`${row}-${column}`}
                            x={x - 4}
                            y={y - 4}
                            width={TILE_WIDTH + 8}
                            height={TILE_HEIGHT + 8}
                            rx="5"
                            fill={accentColor}
                            fillOpacity="0.9"
                        />
                    );
                }
                return (
                    <rect
                        key={`${row}-${column}`}
                        x={x}
                        y={y}
                        width={TILE_WIDTH}
                        height={TILE_HEIGHT}
                        rx="4"
                        fill="currentColor"
                        fillOpacity={0.16}
                    />
                );
            })
        ))}
    </svg>
);
