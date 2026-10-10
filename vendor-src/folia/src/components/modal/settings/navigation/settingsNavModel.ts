import { Boxes, Command, Database, FlaskConical, Gauge, Keyboard, Languages, PlayCircle, Server, Sparkles, Terminal, type LucideIcon } from 'lucide-react';
import { SETTINGS_ANCHOR_DEFINITIONS, type SettingsAnchorId } from './settingsAnchorModel';
// src/components/modal/settings/navigation/settingsNavModel.ts
// Single source of truth for the options-tab sections: sidebar order, grouping, titles and descriptions.

export type SettingsSectionId =
    | 'appearance'
    | 'general'
    | 'playback'
    | 'interaction'
    | 'integration'
    | 'storage'
    | 'desktop'
    | 'graphics'
    | 'mods'
    | 'lab'
    | 'developer';

export interface SettingsNavItem {
    id: SettingsSectionId;
    icon: LucideIcon;
    label: string;
    description: string;
    anchors: SettingsNavAnchor[];
}

export interface SettingsNavAnchor {
    id: SettingsAnchorId;
    label: string;
}

export interface SettingsNavGroup {
    id: string;
    label: string;
    items: SettingsNavItem[];
}

type Translate = (key: string) => string;

interface SectionSpec {
    id: SettingsSectionId;
    icon: LucideIcon;
    labelKey: string;
    descriptionKey: string;
    /** Sections that only exist on the desktop build. */
    electronOnly?: boolean;
}

interface GroupSpec {
    id: string;
    labelKey: string;
    sections: SectionSpec[];
}

/**
 * Sidebar grouping. Section order matches the flat list this replaced, so the desktop grouping is
 * purely additive and the narrow chip strip keeps its existing sequence.
 */
export const SETTINGS_NAV_GROUP_SPECS: GroupSpec[] = [
    {
        id: 'appearance',
        labelKey: 'options.settingsGroupAppearance',
        sections: [
            { id: 'appearance', icon: Sparkles, labelKey: 'options.visualSettings', descriptionKey: 'options.visualSettingsPanelDesc' },
            { id: 'general', icon: Languages, labelKey: 'options.generalSettings', descriptionKey: 'options.generalSettingsDesc' },
        ],
    },
    {
        // Named for what the group is about rather than for its first section: it now holds how the
        // listener drives the app as well as how the app plays.
        id: 'controls',
        labelKey: 'options.settingsGroupControls',
        sections: [
            { id: 'playback', icon: PlayCircle, labelKey: 'options.playbackSettings', descriptionKey: 'options.playbackSettingsPanelDesc' },
            { id: 'interaction', icon: Keyboard, labelKey: 'options.interactionSettings', descriptionKey: 'options.interactionSettingsPanelDesc' },
        ],
    },
    {
        id: 'connections',
        labelKey: 'options.settingsGroupConnections',
        sections: [
            { id: 'integration', icon: Server, labelKey: 'options.integrationSettings', descriptionKey: 'options.integrationSettingsDesc' },
            { id: 'storage', icon: Database, labelKey: 'options.storageSettings', descriptionKey: 'options.storageSettingsPanelDesc' },
        ],
    },
    {
        id: 'system',
        labelKey: 'options.settingsGroupSystem',
        sections: [
            { id: 'desktop', icon: Command, labelKey: 'options.desktopSettings', descriptionKey: 'options.desktopSettingsPanelDesc', electronOnly: true },
            { id: 'graphics', icon: Gauge, labelKey: 'options.graphicsSettings', descriptionKey: 'options.graphicsSettingsDesc' },
            // The loader only exists in the desktop main process; on web there is nothing to switch on.
            { id: 'mods', icon: Boxes, labelKey: 'options.modSettings', descriptionKey: 'options.modSettingsDesc', electronOnly: true },
            { id: 'lab', icon: FlaskConical, labelKey: 'options.labSettings', descriptionKey: 'options.labSettingsDesc' },
            { id: 'developer', icon: Terminal, labelKey: 'options.developerSettings', descriptionKey: 'options.developerSettingsDesc' },
        ],
    },
];

/**
 * Resolves the grouping into translated nav items, dropping desktop-only sections (and groups left empty) on web.
 * An anchor that marks itself `requiresLibrarySuiteChoice` is listed only when `hasLibrarySuiteChoice` is set,
 * because its section renders nothing while a single library suite is available.
 */
export const buildSettingsNavGroups = (
    t: Translate,
    options: { isElectron: boolean; hasLibrarySuiteChoice?: boolean },
): SettingsNavGroup[] => (
    SETTINGS_NAV_GROUP_SPECS
        .map(group => ({
            id: group.id,
            label: t(group.labelKey),
            items: group.sections
                .filter(section => !section.electronOnly || options.isElectron)
                .map(section => ({
                    id: section.id,
                    icon: section.icon,
                    label: t(section.labelKey),
                    description: t(section.descriptionKey),
                    anchors: (Object.entries(SETTINGS_ANCHOR_DEFINITIONS) as [SettingsAnchorId, typeof SETTINGS_ANCHOR_DEFINITIONS[SettingsAnchorId]][])
                        .filter(([, definition]) => (
                            definition.section === section.id
                            && (!('electronOnly' in definition) || !definition.electronOnly || options.isElectron)
                            && (!('requiresLibrarySuiteChoice' in definition) || !definition.requiresLibrarySuiteChoice || Boolean(options.hasLibrarySuiteChoice))
                        ))
                        .map(([id, definition]) => ({ id, label: t(definition.labelKey) })),
                })),
        }))
        .filter(group => group.items.length > 0)
);

export const flattenSettingsNavItems = (groups: SettingsNavGroup[]): SettingsNavItem[] => (
    groups.flatMap(group => group.items)
);

export const findSettingsNavItem = (groups: SettingsNavGroup[], id: SettingsSectionId): SettingsNavItem | undefined => (
    flattenSettingsNavItems(groups).find(item => item.id === id)
);
