import LatticePosterTintControls from '../../shared/LatticePosterTintControls';
import type { ComponentProps } from 'react';

// Lazy command-surface entry; the registry remains free of React and color-picker imports.

export default function LatticePosterTintSurfaceView(
    props: ComponentProps<typeof LatticePosterTintControls>,
) {
    return (
        <div className="flex h-full justify-center overflow-y-auto px-4 py-8">
            <div className="w-full max-w-lg self-start rounded-2xl border border-current/10 p-6">
                <LatticePosterTintControls {...props} />
            </div>
        </div>
    );
}
