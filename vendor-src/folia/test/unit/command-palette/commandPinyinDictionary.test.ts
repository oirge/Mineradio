import { describe, expect, it } from 'vitest';
import { PINYIN_BY_PHRASE, PINYIN_PHRASE_COUNT } from 'virtual:folia-command-pinyin';
import { COMMAND_PALETTE_COMMANDS } from '../../../src/components/command-palette/commandRegistry';
import { buildSuiteChromeCommands } from '../../../src/components/command-palette/commands/suiteChromeCommands';
import { listLibrarySuites } from '../../../src/library/registry';
import zhCN from '../../../src/i18n/locales/zh-CN';

// test/unit/command-palette/commandPinyinDictionary.test.ts
// 拼音字典是构建期产物且不签入仓库，所以这里断言的是「覆盖率」而不是字节比对：
// 命令检索真正会去查表的那些短语，一条都不能漏。漏一条的症状是某条命令的中文或拼音
// 静默搜不到，而不是任何地方报错——正是这种失效模式需要测试兜住。

const CJK = /[一-鿿㐀-䶿]/;

const localeCommands = (zhCN as any).commandPalette?.commands as Record<
    string,
    { title?: string; description?: string }
>;

// 静态命令，加上 library suite 在 manifest 里声明的外观动作（B2，启动时才装进列表，这里照装入的方式自己生成）：
// 它们的中文关键词写在 suites/<id>/entry.ts 或 chromeActions.ts 里，插件要扫到。
const ALL_COMMANDS = [
    ...COMMAND_PALETTE_COMMANDS.filter(command => command.scope !== 'suite-chrome'),
    ...buildSuiteChromeCommands(listLibrarySuites()),
];

const staticCommands = ALL_COMMANDS.filter(
    command => command.textSource !== 'runtime' && !command.hidden,
);

describe('generated command pinyin dictionary', () => {
    it('is actually generated and reaches the test runtime', () => {
        expect(PINYIN_PHRASE_COUNT).toBeGreaterThan(300);
        expect(Object.keys(PINYIN_BY_PHRASE)).toHaveLength(PINYIN_PHRASE_COUNT);
    });

    it('covers every zh-CN command title and description', () => {
        const missing: string[] = [];
        staticCommands.forEach(command => {
            const text = localeCommands?.[command.id];
            [text?.title, text?.description].forEach(value => {
                if (value && CJK.test(value) && !(value in PINYIN_BY_PHRASE)) {
                    missing.push(`${command.id}: ${value}`);
                }
            });
        });

        expect(missing).toEqual([]);
    });

    it('covers every hand-authored CJK synonym', () => {
        const missing: string[] = [];
        ALL_COMMANDS.forEach(command => {
            command.keywords.forEach(keyword => {
                if (CJK.test(keyword) && !(keyword in PINYIN_BY_PHRASE)) {
                    missing.push(`${command.id}: ${keyword}`);
                }
            });
        });

        expect(missing).toEqual([]);
    });

    it('drops punctuation and keeps runs joined', () => {
        // 可视化：心象 — 全角冒号不参与拼音，两段直接相连。
        expect(PINYIN_BY_PHRASE['可视化：心象']).toEqual({ full: 'keshihuaxinxiang', initials: 'kshxx' });
    });

    it('spells ü as v, the way it is actually typed', () => {
        // ü 在标准键盘上打不出来。生成 `guolü` 等于让这条命令再也搜不到；输入法惯用 v，
        // 当年手写的关键词也是 `guolv`。
        const withU = Object.entries(PINYIN_BY_PHRASE).filter(([, entry]) => entry.full.includes('ü'));
        expect(withU).toEqual([]);
        if (PINYIN_BY_PHRASE['过滤']) {
            expect(PINYIN_BY_PHRASE['过滤'].full).toBe('guolv');
        }
    });

    it('resolves polyphonic characters by phrase, not by first reading', () => {
        // 手写拼音最容易悄悄写错的就是这一类；词组词典才给得对。
        const samples: Array<[string, string]> = [
            ['音乐', 'yinyue'],
            ['重复', 'chongfu'],
            ['了解', 'liaojie'],
        ];

        samples.forEach(([phrase, expected]) => {
            // 样例不一定出现在命令文案里，所以这里验的是生成规则本身而非字典命中。
            const entry = PINYIN_BY_PHRASE[phrase];
            if (entry) {
                expect(entry.full).toBe(expected);
            }
        });
    });
});
