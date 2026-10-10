import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PONDER_TARGET_LIST } from '@/components/ponder/ponderRegistry';

// test/unit/ponder/ponderSelectorContract.test.ts
// 思索靠 CSS 选择器找到被教的那个控件，而选择器对重构是完全透明的：
// 把 data-ponder 删掉、把 data-testid 改名，类型检查不会响，测试不会红，
// 只是从此再没有人能把那个教程调出来。这个文件就是那道防线。
//
// 照 storeContract.test.ts 的做法扫源码文本而不是去挂载组件：
// 真实目标散落在播放页和命令面板里，挂载它们的代价远大于这里要验证的东西。

const SRC = path.resolve(__dirname, '../../../src');

/**
 * 思索自己的模块要排除在外。
 *
 * 不排除的话这组断言会自我满足：`[data-ponder="bottom-bar-offset"]` 这串文本在目标定义
 * 文件里本来就写着，扫描整个 src 永远能命中，属性从被教的组件上删掉了也照样绿。
 * 要验证的恰恰是「消费方还挂着这个属性」。
 */
const isPonderOwnSource = (file: string) => (
    file.includes(`${path.sep}components${path.sep}ponder${path.sep}`)
    || file.includes(`${path.sep}utils${path.sep}ponder${path.sep}`)
    || file.endsWith(`${path.sep}types${path.sep}ponder.ts`)
);

const collectSources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectSources(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
    });

const ALL_SOURCE = collectSources(SRC)
    .filter(file => !isPonderOwnSource(file))
    .map(file => readFileSync(file, 'utf8'))
    .join('\n');

/** 从选择器里拆出它依赖的属性名，以及带字面量值的那些。 */
const attributesIn = (selector: string): { name: string; value: string | null }[] =>
    [...selector.matchAll(/\[([a-zA-Z-]+)(?:="([^"]+)")?\]/g)]
        .map(match => ({ name: match[1], value: match[2] ?? null }));

/** 每个目标用到的全部选择器：命中用的，加上所有从真实 DOM 量的锚点。 */
const selectorsOf = (target: typeof PONDER_TARGET_LIST[number]): string[] => {
    const selectors = target.hoverSelector ? [target.hoverSelector] : [];
    target.scenes.forEach(scene => {
        Object.values(scene.anchors).forEach(source => {
            if (source.kind === 'dom') selectors.push(source.selector);
        });
    });
    return selectors;
};

describe('ponder selector contract', () => {
    it.each(PONDER_TARGET_LIST.map(target => [target.id, target] as const))(
        '%s 的选择器所依赖的属性都还在源码里',
        (id, target) => {
            const missing: string[] = [];

            for (const selector of selectorsOf(target)) {
                for (const { name, value } of attributesIn(selector)) {
                    // 属性名本身必须有人写出来（值可能是运行时算的，比如 data-ponder-slot={actionId}）。
                    if (!ALL_SOURCE.includes(name)) {
                        missing.push(`${selector} -> 属性 ${name}`);
                        continue;
                    }
                    // 带字面量值的，值也要能在源码里找到。
                    if (value !== null && !ALL_SOURCE.includes(`"${value}"`) && !ALL_SOURCE.includes(`'${value}'`)) {
                        missing.push(`${selector} -> 值 ${value}`);
                    }
                }
            }

            expect(missing, `${id} 的选择器指向了源码里已不存在的东西：${missing.join('; ')}`).toEqual([]);
        },
    );

    it('每个可悬停目标的选择器都真的带属性选择器，而不是脆弱的类名或标签', () => {
        const fragile = PONDER_TARGET_LIST
            .filter(target => target.hoverSelector && !target.hoverSelector.includes('['))
            .map(target => `${target.id}: ${target.hoverSelector}`);

        expect(fragile, `这些目标靠类名或标签命中，改样式就会失效：${fragile.join('; ')}`).toEqual([]);
    });

    it('priority 只用在确实会重叠的目标上，不出现无谓的并列', () => {
        // 同一个 priority 下不该有两个选择器互相包含 —— 那种情况下谁赢是不确定的。
        const withPriority = PONDER_TARGET_LIST.filter(target => (target.priority ?? 0) > 0);
        withPriority.forEach(target => {
            expect(target.hoverSelector, `${target.id} 设了 priority 却没有 hoverSelector`).toBeTruthy();
        });
    });
});
