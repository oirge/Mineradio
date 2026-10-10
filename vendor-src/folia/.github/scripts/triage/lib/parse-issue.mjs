// .github/scripts/triage/lib/parse-issue.mjs
// 从 issue 标题和正文里提取确定性事实：模板类型、版本号、部署类型、报错、QR 诊断、是否为空、平台请求等。
// 这些事实决定追问和关闭，不依赖 LLM。

import { stripHtmlComments } from './sanitize.mjs';

const QR_TITLE = /^\s*\[QR login\]\s*(\w+)\s+login failed/i;
const QR_HEADING = '### Folia QR login diagnostics';

// 从模板文件内容里取出可比对的行（去掉 front matter 和空行），用于识别「没改过的模板文字」。
export function templateLinesFrom(templateSources) {
    const lines = new Set();
    for (const source of templateSources) {
        const body = String(source).replace(/^---\n[\s\S]*?\n---\n/, '');
        for (const line of body.split('\n')) {
            const trimmed = line.trim();
            if (trimmed) lines.add(trimmed);
        }
    }
    return lines;
}

export function detectKind(title, labels) {
    const prefix = /^\s*\[(bug|feature|qr login)\]/i.exec(title ?? '');
    if (prefix) {
        const value = prefix[1].toLowerCase();
        return value === 'qr login' ? 'qr' : value;
    }
    if (labels.includes('bug')) return 'bug';
    if (labels.includes('enhancement')) return 'feature';
    return 'none';
}

export function parseQr(title, body) {
    const titleMatch = QR_TITLE.exec(title ?? '');
    const text = String(body ?? '');
    const hasDiagnostics = text.includes(QR_HEADING);
    if (!titleMatch && !hasDiagnostics) return null;
    const line = key => new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(text)?.[1].trim() ?? null;
    const appVersion = line('app');
    return {
        provider: (line('provider')?.split(/\s/)[0] ?? titleMatch?.[1] ?? '').toLowerCase() || null,
        appVersion: appVersion && appVersion !== 'unknown' ? appVersion : null,
        failure: line('failure'),
        hasDiagnostics,
    };
}

// 去掉模板原文、示例、标题行、隐藏注释和 QR 诊断块后剩下的「用户真正写的内容」。
export function effectiveText(body, templateLines) {
    const withoutQr = stripHtmlComments(body).replace(/### Folia QR login diagnostics\s*```[\s\S]*?```/g, '');
    return withoutQr
        .split('\n')
        .filter(line => {
            const trimmed = line.trim();
            if (!trimmed || templateLines.has(trimmed)) return false;
            return !/^\*\*[^*]+\*\*$/.test(trimmed);
        })
        .map(line => line
            .replace(/\[例如[:：][^\]]*\]/g, '')
            .replace(/例如[:：]\s*`[^`]*`/g, ''))
        .join('\n');
}

const VERSION_PATTERNS = [
    /folia-major\s+v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/i,
    /\bFolia\/(\d+\.\d+\.\d+(?:-[\w.]+)?)/,
    /^app:\s*(\d+\.\d+\.\d+(?:-[\w.]+)?)/m,
    /版本[号]?\s*[:：]?\s*v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/,
    /\bv(\d+\.\d+\.\d+(?:-[\w.]+)?)\b/,
    // Folia 仍是 0.x：裸写的 `0.7.13beta` 也算；前后不能再接 `.数字`，避免把 IP 当成版本号。
    /(?<![\w./])(0\.\d{1,2}\.\d{1,3})(?!\.?\d)/,
];

export function extractVersion(text) {
    for (const pattern of VERSION_PATTERNS) {
        const match = pattern.exec(text);
        if (match) return match[1];
    }
    return null;
}

const DEPLOYMENT_PATTERNS = [
    ['electron', /electron|桌面版|桌面端|客户端|desktop|\.exe\b|\.dmg\b|appimage|安装包/i],
    ['docker', /docker|compose|自部署/i],
    ['vercel', /vercel/i],
    ['web', /网页版|在线部署|浏览器访问|web\s*版/i],
];

export function extractDeployment(text) {
    for (const [kind, pattern] of DEPLOYMENT_PATTERNS) {
        if (pattern.test(text)) return kind;
    }
    return null;
}

export const hasImage = text => /!\[[^\]]*\]\([^)]*\)|<img\b|user-attachments\//i.test(text);

export function hasErrorLog(text) {
    return /```/.test(text)
        || hasImage(text)
        || /\b\w*(?:Error|Exception)\b/.test(text)
        || /\bUncaught\b/.test(text)
        || /^\s*at\s+\S+.*:\d+/m.test(text);
}

// 去掉代码块、图片后的正文长度，用来判断是否值得生成 TL;DR。
export function proseLength(text) {
    return String(text ?? '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>/gi, '')
        .replace(/\s+/g, '')
        .length;
}

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const REQUEST_VERBS = /支持|接入|添加|加个|加入|增加|适配|对接|能不能|可以.*吗|support|add\b|integrat/i;

// 平台请求的确定性兜底：提到受支持列表之外的平台名，并带有「支持 / 接入」一类的动词。
export function detectProviderRequest(title, text, kind, providerConfig) {
    if (kind === 'bug' || kind === 'qr') return { isRequest: false, platforms: [] };
    const haystack = `${title ?? ''}\n${text}`;
    const platforms = providerConfig.platformNames.filter(name => new RegExp(escapeRegExp(name), 'i').test(haystack));
    return { isRequest: platforms.length > 0 && REQUEST_VERBS.test(haystack), platforms };
}

// 汇总所有确定性事实。`extraText` 是作者后续的补充评论，追问是否补齐时一起算。
export function extractFacts({ title, body, labels, extraText = '' }, { templateLines, config }) {
    const kind = detectKind(title, labels);
    const qr = parseQr(title, body);
    const text = `${effectiveText(body, templateLines)}\n${extraText}`.trim();
    const rawWithExtra = `${body ?? ''}\n${extraText}`;
    const meaningful = text.replace(/^\s*(?:[-*]|\d+\.)\s*/gm, '').replace(/[\s:：\-—_*#>`]/g, '');
    return {
        kind,
        qr,
        version: extractVersion(rawWithExtra.replace(/例如[:：]\s*`[^`]*`/g, '').replace(/\[例如[:：][^\]]*\]/g, '')),
        deployment: extractDeployment(text) ?? (qr?.hasDiagnostics && /Electron\//.test(body ?? '') ? 'electron' : null),
        hasErrorLog: hasErrorLog(text),
        effectivelyEmpty: meaningful.length < 15 && !hasImage(text),
        proseLength: proseLength(text),
        providerRequest: detectProviderRequest(title, text, kind, config.providerRequest),
        mentionsAppleMusic: new RegExp(config.providerRequest.appleMusicPattern, 'i').test(`${title ?? ''}\n${body ?? ''}`),
    };
}
