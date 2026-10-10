// .github/scripts/triage/lib/sanitize.mjs
// 文本清洗：送进 LLM 之前的压缩与凭据擦除，以及 LLM 输出写回 GitHub 之前的无害化。
// 按项目约定 IP、设备信息、错误原文都不脱敏，只擦凭据的值。

const CREDENTIAL_PLACEHOLDER = '[已移除凭据]';

const CREDENTIAL_PATTERNS = [
    // Cookie / Set-Cookie / Authorization 整行都可能带会话，整行擦掉。
    [/^(\s*(?:set-)?cookie\s*[:=]).*$/gim, `$1 ${CREDENTIAL_PLACEHOLDER}`],
    [/^(\s*authorization\s*[:=]).*$/gim, `$1 ${CREDENTIAL_PLACEHOLDER}`],
    [/\b(bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${CREDENTIAL_PLACEHOLDER}`],
    // 网易云 / QQ 音乐的会话键：只擦 `键=值` 里的值，`hasMusicU: false` 这类布尔字段不受影响。
    [/\b(MUSIC_[UA]|__csrf|NMTID|qm_keyst|qqmusic_key|psrf_[a-z_]+|p_skey|skey|uin)=([^;\s&"']+)/gi, `$1=${CREDENTIAL_PLACEHOLDER}`],
    [/\bsk-[A-Za-z0-9]{20,}\b/g, CREDENTIAL_PLACEHOLDER],
    [/\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{20,}\b/g, CREDENTIAL_PLACEHOLDER],
    [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, CREDENTIAL_PLACEHOLDER],
    // 长随机串（十六进制 ≥32 或 base64 ≥40）大概率是 token；完整 git sha 也会被擦，代价可以接受。
    [/\b[0-9a-f]{32,}\b/gi, CREDENTIAL_PLACEHOLDER],
    // base64 段不含 `/`，否则长文件路径会被误伤；还要求大小写和数字混排，排除长英文单词串。
    [/[A-Za-z0-9+_-]{40,}={0,2}/g, match => (/[A-Z]/.test(match) && /[a-z]/.test(match) && /\d/.test(match) ? CREDENTIAL_PLACEHOLDER : match)],
];

export function scrubCredentials(text) {
    let out = String(text ?? '');
    for (const [pattern, replacement] of CREDENTIAL_PATTERNS) out = out.replace(pattern, replacement);
    return out;
}

export const stripHtmlComments = text => String(text ?? '').replace(/<!--[\s\S]*?(?:-->|$)/g, '');

export const replaceImages = text => String(text ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[图片]')
    .replace(/<img\b[^>]*>/gi, '[图片]');

// 超长代码块只保留头尾：报错栈的关键信息通常在开头几行和最后几行。
export function trimCodeBlocks(text, maxLines) {
    return String(text ?? '').replace(/```([^\n]*)\n([\s\S]*?)```/g, (whole, lang, inner) => {
        const lines = inner.replace(/\n$/, '').split('\n');
        if (lines.length <= maxLines) return whole;
        const head = lines.slice(0, Math.max(1, maxLines - 10));
        const tail = lines.slice(-5);
        return `\`\`\`${lang}\n${head.join('\n')}\n…（省略 ${lines.length - head.length - tail.length} 行）…\n${tail.join('\n')}\n\`\`\``;
    });
}

// 按头尾截断：模板的环境信息在末尾，只截头部会丢掉版本号。
export function truncateHeadTail(text, headChars, tailChars) {
    const value = String(text ?? '');
    if (value.length <= headChars + tailChars) return value;
    return `${value.slice(0, headChars)}\n…（中间省略 ${value.length - headChars - tailChars} 字）…\n${value.slice(-tailChars)}`;
}

// 送进 LLM 的正文：去隐藏注释、图片换占位、擦凭据、压缩代码块、头尾截断。
export function prepareBodyForLlm(body, { headChars, tailChars, codeBlockMaxLines }) {
    const cleaned = trimCodeBlocks(scrubCredentials(replaceImages(stripHtmlComments(body))), codeBlockMaxLines).trim();
    return truncateHeadTail(cleaned, headChars, tailChars);
}

// LLM 生成的文字写进评论前的无害化：不留链接、HTML、@提及和 #引用，防止被操纵去通知别人或贴钓鱼链接。
export function neutralizeLlmText(text, maxChars) {
    let out = String(text ?? '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]*>/g, '')
        .replace(/\b(?:https?|ftp|file|javascript|data):\/*\S*/gi, '[链接已移除]')
        .replace(/\bwww\.\S+/gi, '[链接已移除]')
        .replace(/@/g, '@​')
        .replace(/#(?=\d)/g, '#​')
        .replace(/[`*_~|>]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (out.length > maxChars) out = `${out.slice(0, maxChars - 1)}…`;
    return out;
}
