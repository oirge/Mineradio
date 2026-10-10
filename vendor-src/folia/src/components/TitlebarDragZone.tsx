import React from 'react';

export default function TitlebarDragZone({
    active,
}: {
    active: boolean;
}) {
    if (!active) return null;

    return (
        <div
            className="absolute inset-0 pointer-events-auto"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />
    );
}
