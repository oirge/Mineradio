// src/components/command-palette/search/virtualModules.d.ts
// 命令面板检索用的拼音字典由 dev/pinyin/commandPinyinPlugin.mjs 在构建期生成，
// 以 Vite 虚拟模块的形式提供，不签入仓库——所以它没有真实文件可供 TS 解析，需要这份声明。
//
// 生成来源是 zh-CN 的 commandPalette.commands 文案和命令定义里手写的中文同义词；
// 拼音库只在 devDependencies 里，运行时不携带任何字典。

declare module 'virtual:folia-command-pinyin' {
    /** 中文短语 -> 无声调全拼与拼音首字母。key 是原短语，逐字节相等才命中。 */
    export const PINYIN_BY_PHRASE: Record<string, { full: string; initials: string }>;

    /** 字典条目数，供覆盖率断言使用。 */
    export const PINYIN_PHRASE_COUNT: number;
}
