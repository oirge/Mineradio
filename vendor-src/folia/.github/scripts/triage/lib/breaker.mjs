// .github/scripts/triage/lib/breaker.mjs
// LLM 额度熔断判定。每个 issue 是独立的 workflow 运行，单次运行内的预算挡不住 spam，
// 所以判定依据是跨运行的仓库实时计数（由 io 层通过 search API 查好再传进来）。

const DAY_MS = 24 * 60 * 60 * 1000;

// 计数都包含当前这条 issue。返回 { tripped, scope: 'global'|'author'|'manual'|null, reasons, windowKey }。
export function evaluateBreaker({ counts, authorCreatedAt, manualRunsLastDay = 0, isManual = false, now }, config) {
    const limits = config.breaker;
    const reasons = [];
    let scope = null;
    let windowKey = null;
    const iso = new Date(now).toISOString();

    if (counts.globalHour > limits.globalPerHour) {
        reasons.push(`过去 1 小时新建 ${counts.globalHour} 个 issue，超过 ${limits.globalPerHour}`);
        scope = 'global';
        windowKey = `global-hour:${iso.slice(0, 13)}`;
    }
    if (counts.globalDay > limits.globalPerDay) {
        reasons.push(`过去 24 小时新建 ${counts.globalDay} 个 issue，超过 ${limits.globalPerDay}`);
        scope = 'global';
        windowKey = `global-day:${iso.slice(0, 10)}`;
    }
    if (counts.authorDay > limits.perAuthorPerDay) {
        reasons.push(`同一作者 24 小时内开了 ${counts.authorDay} 个 issue，超过 ${limits.perAuthorPerDay}`);
        scope ??= 'author';
    }
    const accountAgeMs = authorCreatedAt ? now - Date.parse(authorCreatedAt) : Infinity;
    if (accountAgeMs < limits.newAccountDays * DAY_MS && counts.authorDay > limits.newAccountPerDay) {
        reasons.push(`注册不足 ${limits.newAccountDays} 天的账号 24 小时内开了 ${counts.authorDay} 个 issue`);
        scope ??= 'author';
    }
    if (isManual && manualRunsLastDay >= limits.manualRerunsPerDay) {
        reasons.push(`该 issue 24 小时内已手动重跑 ${manualRunsLastDay} 次`);
        scope ??= 'manual';
    }
    return { tripped: reasons.length > 0, scope, reasons, windowKey };
}

export const countRecent = (isoDates, now, windowMs = DAY_MS) => isoDates.filter(date => now - Date.parse(date) < windowMs).length;
