import type { CommandPaletteCommand, CommandPaletteContext, CommandPaletteMatch } from '../types';
import type { CommandPaletteSurface } from './types';

// src/components/command-palette/surfaces/librarySuitePickerSurface.ts
// 资料库界面（Library UI suite）的 picker：输入框筛选，方向键移动，Enter 或点击切换。选项与「当前」都来自
// settings 命名空间（registry 里可用的 suite、实际生效的那套），这里不 import registry，命令注册表保持纯 TS。

const PICK_ID_PREFIX = 'library-suite-pick-';

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** 行的 suite id（从命令 id 读回，视图用它标记当前项）。 */
export const readLibrarySuitePick = (commandId: string): string => (
    commandId.startsWith(PICK_ID_PREFIX) ? commandId.slice(PICK_ID_PREFIX.length) : ''
);

const toCommand = (option: { id: string; label: string }, isActive: boolean, t: CommandPaletteContext['shared']['t']): CommandPaletteCommand => ({
    id: `${PICK_ID_PREFIX}${option.id}`,
    group: 'settings',
    title: option.label,
    // 名字来自 suite 清单的 labelKey，不是 commandPalette.commands.<id>。
    textSource: 'runtime',
    description: isActive
        ? t('commandPalette.librarySuitePicker.active', 'In use')
        : t('commandPalette.librarySuitePicker.switch', 'Switch the library to this interface'),
    keywords: [option.id],
    execute: (_input, context) => {
        context.settings.chooseLibrarySuite(option.id);
        return true;
    },
});

/** 按名字或 id 里命中的位置排序；空查询保持 registry 顺序（默认 suite 在最前）。 */
const buildLibrarySuiteMatches = (context: CommandPaletteContext, query: string): CommandPaletteMatch[] => {
    const normalizedQuery = normalize(query);
    const active = context.settings.activeLibrarySuite();
    return context.settings.librarySuiteOptions()
        .map((option, index) => {
            const label = context.shared.t(option.labelKey, option.id);
            if (!normalizedQuery) return { option: { id: option.id, label }, score: 100 - index };
            const best = [normalize(label), normalize(option.id)]
                .map(haystack => haystack.indexOf(normalizedQuery))
                .filter(position => position >= 0)
                .sort((left, right) => left - right)[0];
            return best === undefined ? null : { option: { id: option.id, label }, score: 100 - best };
        })
        .filter((entry): entry is { option: { id: string; label: string }; score: number } => entry !== null)
        .map(entry => ({ command: toCommand(entry.option, entry.option.id === active, context.shared.t), score: entry.score, input: '' }));
};

export const librarySuitePickerSurface: CommandPaletteSurface = {
    load: () => import('./LibrarySuitePickerSurfaceView'),
    useLiveQuery: true,
    buildMatches: ({ context, query }) => buildLibrarySuiteMatches(context, query),
    mapProps: ({ context, matches, activeIndex, setActiveIndex, executeMatch, isDaylight, theme, isExecuting }) => ({
        matches,
        activeIndex,
        setActiveIndex,
        executeMatch,
        isDaylight,
        theme,
        isExecuting,
        activeSuiteId: context.settings.activeLibrarySuite(),
        activeSuiteLabel: (() => {
            const active = context.settings.activeLibrarySuite();
            const option = context.settings.librarySuiteOptions().find(candidate => candidate.id === active);
            return option ? context.shared.t(option.labelKey, option.id) : active;
        })(),
    }),
};
