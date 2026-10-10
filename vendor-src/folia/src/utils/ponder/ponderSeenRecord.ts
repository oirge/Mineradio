import { type PonderTargetId } from '../../types/ponder';

// src/utils/ponder/ponderSeenRecord.ts
// 「已看过哪些思索」的序列化。纯字符串 ↔ Set，localStorage 的调用留在 store 里。
//
// 容错方向是刻意选的：读坏了当作「没看过」而不是「已看过」。过度提示只是啰嗦，
// 而错误地认定已看过会让这个功能对那个用户彻底消失。

const SEPARATOR = ',';

/** 防止异常写入把这个键撑爆；首批只有 6 个 target，留足余量。 */
const MAX_ENTRIES = 64;

export const parsePonderSeen = (raw: string | null | undefined): Set<string> => {
    if (!raw) {
        return new Set();
    }
    return new Set(
        raw.split(SEPARATOR)
            .map(entry => entry.trim())
            .filter(Boolean)
            .slice(0, MAX_ENTRIES),
    );
};

export const serializePonderSeen = (seen: ReadonlySet<string>): string =>
    [...seen].slice(0, MAX_ENTRIES).join(SEPARATOR);

/** 加一个并返回新集合；已存在时返回原集合，省掉一次无意义的写入。 */
export const withPonderSeen = (seen: ReadonlySet<string>, targetId: PonderTargetId): Set<string> | null => {
    if (seen.has(targetId)) {
        return null;
    }
    const next = new Set(seen);
    next.add(targetId);
    return next;
};
