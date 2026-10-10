import { describe, expect, it } from 'vitest';
import { parseGridFilterQuery } from '../../../src/components/command-palette/gridFilterQuery';

// test/unit/command-palette/gridFilterQuery.test.ts
// 过滤框把解析结果一路写进网格的 searchQuery，所以「flag 有没有从文本里摘干净」不是细节：
// 漏一个 `--play` 进去，网格会在正要播放筛选结果的那一刻把自己筛成空。

describe('grid filter query', () => {
    it('reads a leading flag and keeps the text', () => {
        expect(parseGridFilterQuery('--play midnight')).toEqual({
            action: 'play',
            actionDraft: null,
            text: 'midnight',
        });
    });

    it('reads a trailing flag, so it can be typed after the filter is already written', () => {
        expect(parseGridFilterQuery('midnight --add')).toEqual({
            action: 'add',
            actionDraft: null,
            text: 'midnight',
        });
    });

    it('resolves the short aliases', () => {
        expect(parseGridFilterQuery('--p rain').action).toBe('play');
        expect(parseGridFilterQuery('--queue rain').action).toBe('add');
        expect(parseGridFilterQuery('--a rain').action).toBe('add');
    });

    it('reports a half-typed flag as a draft rather than an action', () => {
        expect(parseGridFilterQuery('--pl')).toEqual({
            action: null,
            actionDraft: 'pl',
            text: '',
        });
    });

    it('offers both flags for a bare --', () => {
        expect(parseGridFilterQuery('--')).toEqual({
            action: null,
            actionDraft: '',
            text: '',
        });
    });

    it('passes ordinary input through untouched', () => {
        expect(parseGridFilterQuery('midnight train')).toEqual({
            action: null,
            actionDraft: null,
            text: 'midnight train',
        });
    });

    // 这条是选 filterInput 而不是 text 的理由：共享解析器在没有声明 facet 时仍会剥掉 `@` token。
    it('keeps an @ in the filter text, having declared no facets', () => {
        expect(parseGridFilterQuery('@home').text).toBe('@home');
        expect(parseGridFilterQuery('--play @home').text).toBe('@home');
    });
});
