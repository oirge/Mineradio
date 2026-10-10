import type { CommandPaletteCommand } from '../../../src/components/command-palette/types';

// test/unit/command-palette/commandContractChecks.ts
// 命令契约的检查逻辑（文案覆盖、关键词规则），从 commandRegistryContract.test.ts 抽出来：同一套检查既跑真实的命令
// 列表（静态命令 + registry 里各 suite 的外观动作），也跑测试夹具里的假 suite（B2），后者证明契约确实枚举到了
// manifest 的 chromeActions。不是测试文件本身（vitest 只收 *.test.ts）。

export type CommandText = { title?: string; description?: string };
/** 只看 commandPalette.commands 这一块；真实 locale 与夹具拼出来的 locale 都满足。 */
export type CommandLocale = { commandPalette?: { commands?: Record<string, CommandText> } };
export type PinyinDictionary = Record<string, { full: string; initials: string }>;

export const readCommandText = (locale: CommandLocale, commandId: string): CommandText | undefined => (
    locale.commandPalette?.commands?.[commandId]
);

// Static commands resolve their text through commandPalette.commands.<id>. Runtime commands
// (queue songs) carry song metadata and must never be treated as translation keys; hidden
// commands (mode carriers such as execute mode) are never listed, so they need neither.
export const listStaticCommands = (commands: readonly CommandPaletteCommand[]) => commands.filter(
    command => command.textSource !== 'runtime' && !command.hidden,
);

/** 在这份 locale 里缺标题或描述的静态命令。 */
export const findUntranslatedCommands = (commands: readonly CommandPaletteCommand[], locale: CommandLocale): string[] => (
    listStaticCommands(commands)
        .filter(command => {
            const text = readCommandText(locale, command.id);
            return !text?.title || !text?.description;
        })
        .map(command => command.id)
);

/**
 * 关键词规则：不手写能由构建期生成的拼音，ASCII 关键词不照抄任何一份 locale 的标题 / 描述。
 * 旧规则是「每条命令必须写有中文关键词和拉丁关键词」，那是在检索完全依赖手写关键词的年代用形状去逼近意图。
 * 现在拼音由构建期生成、本地化标题恒定入索引，形状规则既过时又会阻止清理，所以换成直接检查**结果**的规则。
 */
export const findKeywordOffenders = (
    commands: readonly CommandPaletteCommand[],
    locales: Readonly<Record<string, CommandLocale>>,
    zhLocale: CommandLocale,
    pinyin: PinyinDictionary,
): string[] => {
    const offenders: string[] = [];

    listStaticCommands(commands).forEach(command => {
        const zh = readCommandText(zhLocale, command.id);
        const cjkSources = [
            ...command.keywords.filter(keyword => /[一-鿿]/.test(keyword)),
            zh?.title,
            zh?.description,
        ].filter((value): value is string => Boolean(value));

        const derived = new Set<string>();
        cjkSources.forEach(source => {
            const entry = pinyin[source];
            if (entry) {
                derived.add(entry.full);
                derived.add(entry.initials);
            }
        });

        const localizedText = new Set(
            Object.values(locales)
                .flatMap(locale => {
                    const text = readCommandText(locale, command.id);
                    return [text?.title, text?.description];
                })
                .filter((value): value is string => Boolean(value))
                .map(value => value.trim().toLowerCase()),
        );

        command.keywords.forEach(keyword => {
            const normalized = keyword.trim().toLowerCase();
            if (derived.has(normalized.replace(/\s+/g, ''))) {
                offenders.push(`${command.id}: "${keyword}" is generated pinyin`);
                return;
            }
            // 「照抄标题」只对纯 ASCII 关键词成立。中文关键词即使和 zh 标题逐字相同也不冗余：
            // zh 标题只在中文界面下进语料，而中文关键词在任何界面语言下都是触发词——
            // 删了它，英文界面就再也打不出 `音量条` 这种词。
            const isAsciiKeyword = /^[\x20-\x7e]+$/.test(keyword);
            if (isAsciiKeyword && localizedText.has(normalized)) {
                offenders.push(`${command.id}: "${keyword}" restates a localized title`);
            }
        });
    });

    return offenders;
};

/** 给 locale 补上（或覆盖）几条命令文案，夹具用；不改原对象。 */
export const withCommandText = (locale: CommandLocale, extra: Record<string, CommandText>): CommandLocale => ({
    ...locale,
    commandPalette: {
        ...locale.commandPalette,
        commands: { ...locale.commandPalette?.commands, ...extra },
    },
});
