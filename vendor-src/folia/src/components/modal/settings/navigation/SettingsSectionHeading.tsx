import React from 'react';
import type { LucideIcon } from 'lucide-react';
// src/components/modal/settings/navigation/SettingsSectionHeading.tsx
// The one heading style for settings sections, replacing the three variants the subviews grew.

type SettingsSectionHeadingProps = {
    icon: LucideIcon;
    label: string;
    /** Separator above the heading, for subviews that run sections together in one column. */
    divider?: boolean;
    className?: string;
    /** Control pinned to the right end of the heading row, e.g. a "check now" button. */
    action?: React.ReactNode;
};

export const SettingsSectionHeading: React.FC<SettingsSectionHeadingProps> = ({ icon: Icon, label, divider, className, action }) => {
    const heading = (
        <h3
            className={`text-sm font-bold uppercase tracking-wider opacity-50 flex items-center gap-2${action ? '' : ' mb-4'}${divider ? ' border-t border-white/10 pt-5' : ''}${className ? ` ${className}` : ''}`}
            style={{ color: 'var(--text-secondary)' }}
        >
            <Icon size={14} /> {label}
        </h3>
    );

    if (!action) {
        return heading;
    }

    // The action sits outside the h3 so it keeps full opacity instead of inheriting the heading's dimming.
    return (
        <div className="mb-4 flex items-center justify-between gap-3">
            {heading}
            {action}
        </div>
    );
};

export default SettingsSectionHeading;
