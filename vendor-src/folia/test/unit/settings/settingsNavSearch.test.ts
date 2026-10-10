import { describe, expect, it } from 'vitest';
import { buildSettingsNavGroups, flattenSettingsNavItems } from '../../../src/components/modal/settings/navigation/settingsNavModel';
import { searchSettingsNav } from '../../../src/components/modal/settings/navigation/settingsNavSearch';
import zhCN from '../../../src/i18n/locales/zh-CN';

// test/unit/settings/settingsNavSearch.test.ts
// The sidebar search matches its own labels and borrows the settings commands' synonyms and pinyin.

const translate = (key: string): string => {
    const value = key.split('.').reduce<unknown>((node, part) => (
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined
    ), zhCN);
    return typeof value === 'string' ? value : key;
};

const desktopGroups = buildSettingsNavGroups(translate, { isElectron: true });
const webGroups = buildSettingsNavGroups(translate, { isElectron: false });

const sectionIds = (groups: ReturnType<typeof buildSettingsNavGroups>) => flattenSettingsNavItems(groups).map(item => item.id);

describe('searchSettingsNav', () => {
    it('returns the sidebar unchanged for an empty query', () => {
        const result = searchSettingsNav(desktopGroups, '   ', 'zh-CN');
        expect(result.groups).toBe(desktopGroups);
        expect(result.firstHit).toBeNull();
    });

    it('finds a setting through a command synonym the sidebar never spells out', () => {
        const result = searchSettingsNav(desktopGroups, 'fps', 'zh-CN');
        expect(sectionIds(result.groups)).toContain('graphics');
    });

    it('finds a setting through generated pinyin', () => {
        const result = searchSettingsNav(desktopGroups, 'tuxing', 'zh-CN');
        expect(sectionIds(result.groups)).toContain('graphics');
    });

    it('keeps only the matching anchors when an anchor label matches', () => {
        const result = searchSettingsNav(desktopGroups, '思索', 'zh-CN');
        const general = flattenSettingsNavItems(result.groups).find(item => item.id === 'general');

        expect(general?.anchors.map(anchor => anchor.id)).toEqual(['ponderHints']);
        expect(result.firstHit).toEqual({ sectionId: 'general', anchorId: 'ponderHints' });
    });

    it('keeps every anchor of a section whose own title matches', () => {
        const result = searchSettingsNav(desktopGroups, '图形', 'zh-CN');
        const graphics = flattenSettingsNavItems(result.groups).find(item => item.id === 'graphics');

        expect(graphics?.anchors.map(anchor => anchor.id)).toEqual(['graphicsPerformance', 'graphicsMotion']);
    });

    it('never surfaces a section the platform does not show', () => {
        expect(sectionIds(searchSettingsNav(desktopGroups, '模组', 'zh-CN').groups)).toContain('mods');
        expect(sectionIds(searchSettingsNav(webGroups, '模组', 'zh-CN').groups)).not.toContain('mods');
    });

    it('returns nothing for a query nothing matches', () => {
        const result = searchSettingsNav(desktopGroups, 'qqqxxxzzz', 'zh-CN');
        expect(result.groups).toEqual([]);
        expect(result.firstHit).toBeNull();
    });
});
