// src/components/command-palette/search/normalize.ts
// 命令面板检索的唯一文本规范化入口。
//
// 这个函数原本在 commandMatching.ts 和 queueSearchIndex.ts 各有一份一模一样的实现。两处规范化
// 一旦漂移，命令检索和队列检索会对同一段输入给出不同的匹配结果，而且不会有任何报错。

export const normalizeSearchText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** 按空白切词，用于逐词处理已规范化的文本。空串返回空数组，而不是 ['']。 */
export const splitWords = (value: string): string[] => (value ? value.split(' ').filter(Boolean) : []);
