// .github/scripts/triage/lib/decide-pr.mjs
// PR 管理决策，纯确定性、不调用 LLM：按标题前缀打类型标签、检查暂停区、判断改动规模。
// 只看 PR 的元数据和改动文件名，从不读取或执行 PR 里的代码。

import { isMaintainerAssociation } from './config.mjs';
import { renderPrComment } from './comments.mjs';
import { createPlan, finalizePlan } from './plan.mjs';

const TITLE_RE = /^(\w+)(?:\([^)]*\))?(!)?:\s*\S/;

export function parseConventionalTitle(title) {
    const match = TITLE_RE.exec(String(title ?? '').trim());
    return match ? { type: match[1].toLowerCase(), breaking: Boolean(match[2]) } : null;
}

// 把 `**/*.snap` 这类简单 glob 转成正则；只支持 `**`、`*`，够用即可。
export function globToRegExp(glob) {
    let source = '';
    for (let index = 0; index < glob.length; index += 1) {
        const char = glob[index];
        if (char === '*' && glob[index + 1] === '*') {
            source += glob[index + 2] === '/' ? '(?:.*/)?' : '.*';
            index += glob[index + 2] === '/' ? 2 : 1;
        } else if (char === '*') {
            source += '[^/]*';
        } else {
            source += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^${source}$`);
}

// 读取 announcement 正文里的 ```folia-triage 块：
//   paused-path-prefixes:
//     - src/components/
export function parseAnnouncementBlock(body) {
    const block = /```folia-triage\s*\n([\s\S]*?)```/.exec(String(body ?? ''))?.[1];
    if (!block) return [];
    const prefixes = [];
    let inList = false;
    for (const line of block.split('\n')) {
        if (/^\s*paused-path-prefixes\s*:/.test(line)) { inList = true; continue; }
        const item = /^\s*-\s*(\S+)\s*$/.exec(line);
        if (inList && item) prefixes.push(item[1]);
        else if (line.trim()) inList = false;
    }
    return prefixes;
}

// 生效的暂停区：只认维护者开的、open 且带 announcement 标签的 issue。
export function activePausedAreas(announcements, config) {
    const areas = [];
    for (const announcement of announcements) {
        if (announcement.state !== 'open' || !announcement.labels.includes('announcement')) continue;
        if (!isMaintainerAssociation(config, announcement.authorAssociation)) continue;
        const configured = config.pausedAreas.filter(area => area.announcement === announcement.number);
        const prefixes = [...configured.flatMap(area => area.pathPrefixes), ...parseAnnouncementBlock(announcement.body)];
        if (prefixes.length) areas.push({ announcement: announcement.number, note: configured[0]?.note ?? null, prefixes: [...new Set(prefixes)] });
    }
    return areas;
}

export function measureSize(files, config) {
    const ignore = config.pr.ignoreFilesForSize.map(globToRegExp);
    const counted = files.filter(file => !ignore.some(pattern => pattern.test(file.filename)));
    return { lines: counted.reduce((sum, file) => sum + (file.additions ?? 0) + (file.deletions ?? 0), 0), files: counted.length };
}

// 临时放宽撤标签白名单，只放行 bot 自己打过的那几个标签。
const allowRemoving = (config, names) => ({ ...config, labels: { ...config.labels, botMayRemove: [...config.labels.botMayRemove, ...names] } });

// 主入口。pr 为 normalizeIssue 后的结构（另带 draft）；botOwnedLabels 来自时间线。
export function decidePr({ pr, files, announcements, botOwnedLabels, config, hasExistingComment }) {
    const plan = createPlan(pr.number, 'pr');
    if (pr.labels.includes('bot: skip') || config.pr.exemptAuthors.includes(pr.author) || /\[bot\]$/.test(pr.author)) {
        plan.notes.push('豁免作者或带 bot: skip，跳过');
        return finalizePlan(plan, pr.labels, config);
    }

    const typeLabelSet = new Set(Object.values(config.pr.typeLabels));
    const parsed = parseConventionalTitle(pr.title);
    const desired = new Set();
    const typeLabel = parsed ? config.pr.typeLabels[parsed.type] : null;
    if (typeLabel) desired.add(typeLabel);
    if (parsed?.breaking || /^BREAKING CHANGE:/m.test(pr.body)) desired.add('breaking-change');
    plan.labelsAdd.push(...desired);
    // 只撤 bot 自己打过、且已不再符合标题的类型标签；维护者手动打的永远不动。
    for (const name of botOwnedLabels) {
        if ((typeLabelSet.has(name) || name === 'breaking-change') && !desired.has(name)) plan.labelsRemove.push(name);
    }
    // 类型标签不在 botMayRemove 里，这里单独放行 bot 自己打的那几个。
    const removable = [...plan.labelsRemove];

    if (isMaintainerAssociation(config, pr.authorAssociation)) {
        plan.notes.push('维护者的 PR，只调整类型标签');
        return finalizePlan(plan, pr.labels, allowRemoving(config, removable));
    }

    const pausedHits = [];
    for (const area of activePausedAreas(announcements, config)) {
        const hitFiles = files.map(file => file.filename).filter(name => area.prefixes.some(prefix => name.startsWith(prefix)));
        if (hitFiles.length) pausedHits.push({ announcement: area.announcement, note: area.note, files: hitFiles });
    }

    const size = measureSize(files, config);
    const limits = config.pr.scopeTooLarge;
    const tooLarge = size.lines > limits.changedLines || size.files > limits.changedFiles;
    if (tooLarge) plan.labelsAdd.push('scope too large');
    else if (botOwnedLabels.includes('scope too large')) {
        plan.labelsRemove.push('scope too large');
        removable.push('scope too large');
    }

    const titleHint = !parsed;
    if (titleHint || pausedHits.length || tooLarge || hasExistingComment) {
        plan.upsert = {
            kind: 'pr',
            body: renderPrComment({
                state: { kind: 'pr' },
                titleHint,
                pausedHits,
                scope: tooLarge ? { ...size, maxLines: limits.changedLines, maxFiles: limits.changedFiles } : null,
            }),
        };
    }
    return finalizePlan(plan, pr.labels, allowRemoving(config, removable));
}
