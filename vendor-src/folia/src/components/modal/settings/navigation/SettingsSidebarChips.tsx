import React from 'react';
import type { SettingsNavGroup, SettingsSectionId } from './settingsNavModel';
import { flattenSettingsNavItems } from './settingsNavModel';
import { useDragToScroll } from '../../../../hooks/useDragToScroll';
// src/components/modal/settings/navigation/SettingsSidebarChips.tsx
// Narrow-layout settings navigation: one horizontal, drag-scrollable strip of section chips.
// Markup moved verbatim out of SettingsModal, so grouping never reaches the narrow layout.

type SettingsSidebarChipsProps = {
    groups: SettingsNavGroup[];
    activeSectionId: SettingsSectionId;
    onSelectSection: (sectionId: SettingsSectionId) => void;
    isDaylight: boolean;
};

export const SettingsSidebarChips: React.FC<SettingsSidebarChipsProps> = ({
    groups,
    activeSectionId,
    onSelectSection,
    isDaylight,
}) => {
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const { isDragging, hasDragged, handlers } = useDragToScroll(scrollContainerRef);
    const items = flattenSettingsNavItems(groups);

    return (
        <div
            ref={scrollContainerRef}
            {...handlers}
            className={`w-full shrink-0 overflow-x-auto mobile-hide-scrollbar custom-scrollbar pr-0 flex flex-row space-x-2 space-y-0 border-b border-white/10 pb-3 mb-2 items-center ${isDragging ? 'cursor-grabbing select-none' : 'cursor-default'}`}
        >
            {items.map((section) => {
                const Icon = section.icon;
                const isActive = activeSectionId === section.id;
                return (
                    <button
                        key={section.id}
                        type="button"
                        onClick={() => {
                            if (hasDragged()) return;
                            onSelectSection(section.id);
                        }}
                        className={`shrink-0 w-auto p-2 rounded-xl border transition-colors flex items-center justify-center gap-2 text-left ${isActive ? (isDaylight ? 'border-zinc-300/70 bg-white/80' : 'border-white/20 bg-white/10') : (isDaylight ? 'border-transparent hover:bg-white/50' : 'border-transparent hover:bg-white/5')}`}
                    >
                        <div className="flex items-center gap-2">
                            <div className="opacity-70" style={{ color: 'var(--text-primary)' }}>
                                <Icon size={18} />
                            </div>
                            <div className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                                {section.label}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default SettingsSidebarChips;
