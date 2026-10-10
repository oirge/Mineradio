// .github/scripts/triage/lib/version.mjs
// Folia 版本号解析与比较，用于判断 QR 诊断是否还该并入旧的汇总 issue。

export function parseVersion(value) {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?/.exec(String(value ?? '').trim());
    if (!match) return null;
    return { major: +match[1], minor: +match[2], patch: +match[3], pre: match[4] ?? null };
}

// 返回 -1/0/1；预发布版本按 semver 规则低于同号正式版。无法解析时返回 null。
export function compareVersions(a, b) {
    const left = parseVersion(a);
    const right = parseVersion(b);
    if (!left || !right) return null;
    for (const key of ['major', 'minor', 'patch']) {
        if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
    }
    if (left.pre === right.pre) return 0;
    if (left.pre === null) return 1;
    if (right.pre === null) return -1;
    return left.pre < right.pre ? -1 : 1;
}
