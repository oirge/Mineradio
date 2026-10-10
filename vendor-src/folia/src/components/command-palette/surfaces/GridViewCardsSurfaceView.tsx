import type { ComponentProps } from 'react';
import GridViewSettingsSection from '../../modal/settings/GridViewSettingsSection';

// Lazy command-surface entry hosting the options panel's own grid-card section, so the palette and
// the settings page edit these through one component rather than two drifting copies of the UI.

export default function GridViewCardsSurfaceView(
    props: ComponentProps<typeof GridViewSettingsSection>,
) {
    return (
        <div className="flex h-full justify-center overflow-y-auto px-4 py-8">
            <div className="w-full max-w-lg self-start">
                <GridViewSettingsSection {...props} />
            </div>
        </div>
    );
}
