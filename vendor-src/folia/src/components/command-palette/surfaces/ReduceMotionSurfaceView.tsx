import type { ComponentProps } from 'react';
import MotionReductionSettingsSection from '../../modal/settings/MotionReductionSettingsSection';

// Lazy command-surface entry hosting the lab panel's own motion-reduction section, so the palette
// and the settings page edit these through one component rather than two drifting copies of the UI.

export default function ReduceMotionSurfaceView(
    props: ComponentProps<typeof MotionReductionSettingsSection>,
) {
    return (
        <div className="flex h-full justify-center overflow-y-auto px-4 py-8">
            <div className="w-full max-w-lg self-start">
                <MotionReductionSettingsSection {...props} />
            </div>
        </div>
    );
}
