// .github/scripts/triage/lib/comments.mjs
// bot 评论的模板与隐藏 marker。marker 里存 bot 自己的状态（追问时间、模块、TL;DR 等），
// 下一次运行靠它 upsert 同一条评论，不刷屏。所有对外文字都出自这里的固定模板。

const MARKER_PREFIX = '<!-- folia-triage:v1 ';
const MARKER_RE = /<!-- folia-triage:v1 (\{[\s\S]*?\}) -->/;

export function renderMarker(state) {
    // JSON 里出现 `-->` 会提前结束 HTML 注释，把 `>` 转义掉。
    return `${MARKER_PREFIX}${JSON.stringify(state).replace(/>/g, '\\u003e')} -->`;
}

export function parseMarker(body) {
    const match = MARKER_RE.exec(String(body ?? ''));
    if (!match) return null;
    try {
        const state = JSON.parse(match[1]);
        return state && typeof state === 'object' && typeof state.kind === 'string' ? state : null;
    } catch {
        return null;
    }
}

export const hasMarker = body => String(body ?? '').includes('<!-- folia-triage');

// 在评论列表里找 bot 自己发的、指定 kind 的最新一条。
export function findBotComment(comments, botLogin, kind) {
    for (let index = comments.length - 1; index >= 0; index -= 1) {
        const comment = comments[index];
        if (comment.author !== botLogin) continue;
        const state = parseMarker(comment.body);
        if (state?.kind === kind) return { comment, state };
    }
    return null;
}

const FOOTER = '<sub>由 triage bot 自动处理。判断有误请直接回复，维护者会复核。</sub>';

const MISSING_ITEMS = {
    version: 'Folia 版本号：打开 Folia，点击左上角问号按钮，复制中间一行表示版本号的文字',
    deployment: '部署类型：electron 桌面版 / vercel / 其他在线部署',
    errorLog: '报错信息：按 `Ctrl+Shift+I` 打开 devtools，切到 console，重现问题后复制红色报错（或截图）',
    description: '问题描述与重现步骤',
    qrDiagnostics: '扫码诊断信息：Folia 已把诊断复制到剪贴板，直接粘贴到这里即可',
};

export const PROVIDER_REQUEST_TEXT = '添加新的平台需要对应平台的 API 后端。我们会尽可能支持用户需求较高的平台，但这类功能需要较长时间评估，因此无法保证实现。';
export const APPLE_MUSIC_TEXT = 'Apple Music 平台短期内不会支持，因为该平台对第三方接入有非常严格的限制。';

// 统一的 triage 评论。sections 里每一项都可缺省，缺省就不渲染对应段落。
export function renderTriageComment({ state, module, moduleDescription, tldr, providerRequest, missing, infoReceived, related, reason, rateLimited }) {
    const parts = [renderMarker(state)];
    if (module) {
        parts.push(`**初步归属模块**：\`${module}\`（${moduleDescription}）\n<sub>自动判断，如有误维护者可直接修改 \`module: *\` 标签。</sub>`);
    }
    if (tldr?.length) {
        parts.push(`### TL;DR\n> 由 AI 自动生成，可能不准确，以原文为准。\n\n${tldr.map(line => `- ${line}`).join('\n')}`);
    }
    if (providerRequest) {
        const lines = [PROVIDER_REQUEST_TEXT];
        if (providerRequest.appleMusic) lines.push(APPLE_MUSIC_TEXT);
        for (const issue of providerRequest.inProgress) lines.push(`相关平台的支持正在开发中，进度见 #${issue}。`);
        parts.push(`### 关于新平台支持\n${lines.join('\n\n')}`);
    }
    if (missing?.length) {
        parts.push(`### 需要补充的信息\n为了定位问题，请补充以下内容（编辑 issue 或直接回复都可以）：\n${missing.map(key => `- [ ] ${MISSING_ITEMS[key]}`).join('\n')}\n\n超过 14 天未补充，issue 会被自动关闭。`);
    } else if (infoReceived) {
        parts.push('### 需要补充的信息\n已收到补充信息，等待维护者处理。');
    }
    if (related?.length) {
        parts.push(`### 可能相关\n${related.map(number => `- #${number}`).join('\n')}`);
    }
    if (rateLimited) {
        parts.push('<sub>当前自动分类请求较多，详细分类稍后补充。</sub>');
    }
    if (reason) {
        parts.push(`<details><summary>分类依据</summary>\n\n${reason}\n\n</details>`);
    }
    parts.push(FOOTER);
    return parts.join('\n\n');
}

const CLOSE_TEXT = {
    'qr-aggregate': ({ target }) => `这份扫码登录诊断与 #${target} 属于同一类问题，已合并到 #${target} 统一跟踪。如果你认为是不同的问题，请直接回复说明。`,
    duplicate: ({ target }) => `该 issue 与 #${target} 重复，已关闭，请在 #${target} 继续讨论。`,
    invalid: () => '该 issue 没有有效内容，已关闭。请按模板重新填写后回复，或重新提交。',
    out_of_scope: ({ topicDescription }) => `该请求属于「${topicDescription}」，超出 Folia 项目范围，已关闭。`,
    'needs-info-timeout': ({ days }) => `超过 ${days} 天未补充所需信息，已自动关闭。补充信息后回复即可，维护者会复核。`,
    stale: ({ days }) => `该 issue 被标记为 stale 后 ${days} 天仍无活动，已自动关闭。如果问题依然存在，请回复说明。`,
};

export function renderCloseComment(reason, details) {
    return [renderMarker({ kind: 'close', reason, at: details.at }), CLOSE_TEXT[reason](details), FOOTER].join('\n\n');
}

export function renderStaleComment({ at, inactiveDays, closeAfterDays, willClose, isPullRequest = false }) {
    const tail = willClose ? `${closeAfterDays} 天内仍无活动将自动关闭。` : `${isPullRequest ? 'PR' : '这类 issue'}不会被自动关闭。`;
    return [renderMarker({ kind: 'stale', at }), `该条目已 ${inactiveDays} 天无活动，标记为 stale。${tail}回复即可取消标记。`, FOOTER].join('\n\n');
}

export function renderPrComment({ state, titleHint, pausedHits, scope }) {
    const parts = [renderMarker(state)];
    if (titleHint) {
        parts.push('### 标题格式\nPR 标题建议使用 `类型(范围): 描述` 的格式，例如 `fix(qq): 修复扫码登录失败`。类型可选 feat / fix / docs / refactor / perf / test / chore。');
    }
    for (const hit of pausedHits ?? []) {
        const files = hit.files.slice(0, 10).map(file => `- \`${file}\``).join('\n');
        const more = hit.files.length > 10 ? `\n- …以及另外 ${hit.files.length - 10} 个文件` : '';
        parts.push(`### 涉及暂停接受的区域\n根据 #${hit.announcement}${hit.note ? `（${hit.note}）` : ''}，以下改动所在区域暂停接受 PR，合并前请先与维护者确认：\n${files}${more}`);
    }
    if (scope) {
        parts.push(`### 改动规模\n排除 lockfile、代码地图和快照后，本 PR 改动 ${scope.lines} 行、${scope.files} 个文件，超过建议上限（${scope.maxLines} 行 / ${scope.maxFiles} 个文件）。建议拆成多个独立的 PR，便于审阅。`);
    }
    if (parts.length === 1) parts.push('之前提示的问题已解决。');
    parts.push(FOOTER);
    return parts.join('\n\n');
}

export function renderBreakerNotice({ windowKey, reasons, at }) {
    return [renderMarker({ kind: 'breaker', windowKey, at }), `**triage 熔断已触发**（${windowKey}）\n\n${reasons.map(reason => `- ${reason}`).join('\n')}\n\n熔断期间新 issue 只走确定性规则，并打上 \`bot: rate-limited\`，解除后由定时任务补跑分类。`].join('\n\n');
}
