// .github/scripts/triage/lib/schema.mjs
// LLM 输出的手写校验器。枚举、类型、取值范围任何一项不对就整份作废，退回确定性路径；
// 不引入 ajv，是为了让 workflow 保持零依赖。

import { neutralizeLlmText } from './sanitize.mjs';

export const ISSUE_TYPES = ['bug', 'feature', 'provider_request', 'question', 'support', 'spam', 'other'];
export const CLOSE_SUGGESTIONS = ['none', 'invalid', 'out_of_scope'];

const isConfidence = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

function optionalConfidence(raw, key, errors) {
    if (raw[key] === undefined || raw[key] === null) return 0;
    if (!isConfidence(raw[key])) errors.push(`${key} 不是 0..1 的数字`);
    return raw[key];
}

// 校验分类结果；返回 { ok, value, errors }。value 只包含已知字段，文本字段已经无害化。
export function validateClassification(raw, config) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, value: null, errors: ['输出不是 JSON 对象'] };

    if (!ISSUE_TYPES.includes(raw.type)) errors.push(`type 非法: ${raw.type}`);
    if (!CLOSE_SUGGESTIONS.includes(raw.close_suggestion ?? 'none')) errors.push(`close_suggestion 非法: ${raw.close_suggestion}`);

    const duplicateOf = raw.duplicate_of ?? null;
    if (duplicateOf !== null && !(Number.isInteger(duplicateOf) && duplicateOf > 0)) errors.push('duplicate_of 必须是正整数或 null');

    const topic = raw.out_of_scope_topic ?? null;
    if (topic !== null && typeof topic !== 'string') errors.push('out_of_scope_topic 必须是字符串或 null');

    if (raw.needs_error_log !== undefined && typeof raw.needs_error_log !== 'boolean') errors.push('needs_error_log 必须是布尔值');
    if (raw.module !== undefined && typeof raw.module !== 'string') errors.push('module 必须是字符串');
    if (raw.reason !== undefined && typeof raw.reason !== 'string') errors.push('reason 必须是字符串');

    let tldr = raw.tldr ?? null;
    if (typeof tldr === 'string') tldr = tldr.split(/\n+/);
    if (tldr !== null && !(Array.isArray(tldr) && tldr.every(item => typeof item === 'string'))) errors.push('tldr 必须是字符串数组');

    const duplicateConfidence = optionalConfidence(raw, 'duplicate_confidence', errors);
    const closeConfidence = optionalConfidence(raw, 'close_confidence', errors);
    if (errors.length > 0) return { ok: false, value: null, errors };

    const tldrLines = (tldr ?? [])
        .map(line => neutralizeLlmText(line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ''), 120))
        .filter(Boolean)
        .slice(0, 5);
    let total = 0;
    const boundedTldr = tldrLines.filter(line => (total += line.length) <= 400);

    return {
        ok: true,
        errors: [],
        value: {
            type: raw.type,
            module: Object.hasOwn(config.modules, raw.module) ? raw.module : 'general',
            duplicateOf,
            duplicateConfidence,
            closeSuggestion: raw.close_suggestion ?? 'none',
            closeConfidence,
            outOfScopeTopic: config.outOfScope.some(item => item.id === topic) ? topic : null,
            needsErrorLog: raw.needs_error_log ?? null,
            tldr: boundedTldr.length > 0 ? boundedTldr : null,
            reason: neutralizeLlmText(raw.reason ?? '', 200),
        },
    };
}

export function validateDuplicateConfirm(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.same !== 'boolean' || !isConfidence(raw.confidence)) {
        return { ok: false, value: null, errors: ['重复确认输出不合法'] };
    }
    return { ok: true, errors: [], value: { same: raw.same, confidence: raw.confidence, reason: neutralizeLlmText(raw.reason ?? '', 200) } };
}
