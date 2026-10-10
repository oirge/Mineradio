import { describe, expect, it } from 'vitest';
import { parsePonderSeen, serializePonderSeen, withPonderSeen } from '@/utils/ponder/ponderSeenRecord';

// test/unit/ponder/ponderSeenRecord.test.ts
// 这个键是用户手动能改到的，所以解析必须对垃圾输入免疫，且只能往「没看过」方向出错。

describe('parsePonderSeen', () => {
    it('空值与空串解析成空集', () => {
        expect(parsePonderSeen(null).size).toBe(0);
        expect(parsePonderSeen(undefined).size).toBe(0);
        expect(parsePonderSeen('').size).toBe(0);
    });

    it('忽略空白项与多余分隔符', () => {
        expect([...parsePonderSeen(' panel-slide , ,player-bar,')]).toEqual(['panel-slide', 'player-bar']);
    });

    it('去重', () => {
        expect(parsePonderSeen('player-bar,player-bar').size).toBe(1);
    });

    it('截断异常长的输入', () => {
        const raw = Array.from({ length: 200 }, (_, i) => `t${i}`).join(',');
        expect(parsePonderSeen(raw).size).toBe(64);
    });
});

describe('serializePonderSeen', () => {
    it('与解析互为逆运算', () => {
        const seen = parsePonderSeen('panel-slide,player-bar');
        expect(parsePonderSeen(serializePonderSeen(seen))).toEqual(seen);
    });

    it('空集序列化成空串', () => {
        expect(serializePonderSeen(new Set())).toBe('');
    });
});

describe('withPonderSeen', () => {
    it('新增时返回新集合', () => {
        const next = withPonderSeen(new Set(['panel-slide']), 'player-bar');
        expect(next && [...next]).toEqual(['panel-slide', 'player-bar']);
    });

    it('已存在时返回 null，好让调用方跳过写盘', () => {
        expect(withPonderSeen(new Set(['player-bar']), 'player-bar')).toBeNull();
    });
});
