// .github/scripts/triage/lib/plan.mjs
// Plan 是决策层的唯一输出：要加/撤的标签、要 upsert 或新发的评论、是否关闭。
// 执行层只认 Plan；dry-run 时把它渲染成 job summary，不做任何写入。

import { canBotAdd, canBotRemove } from './config.mjs';

export function createPlan(number, kind) {
    return { number, kind, labelsAdd: [], labelsRemove: [], upsert: null, comments: [], close: null, notes: [], blocked: [] };
}

// 只保留白名单内、且确实需要变化的标签；被白名单挡掉的记进 notes。
export function finalizePlan(plan, currentLabels, config) {
    const current = new Set(currentLabels);
    const add = [];
    for (const name of new Set(plan.labelsAdd)) {
        if (current.has(name)) continue;
        if (canBotAdd(config, name)) add.push(name);
        else plan.notes.push(`标签 ${name} 不在 botMayAdd 白名单，已忽略`);
    }
    const remove = [];
    for (const name of new Set(plan.labelsRemove)) {
        if (!current.has(name) || add.includes(name)) continue;
        if (canBotRemove(config, name)) remove.push(name);
        else plan.notes.push(`标签 ${name} 不在 botMayRemove 白名单，已忽略`);
    }
    plan.labelsAdd = add;
    plan.labelsRemove = remove;
    return plan;
}

export const isEmptyPlan = plan => !plan.labelsAdd.length && !plan.labelsRemove.length && !plan.upsert && !plan.comments.length && !plan.close;

const cell = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

// 渲染成 job summary 的 Markdown：一行概要表格加折叠的评论预览和拦截原因。
export function renderPlanSummary(plans, { mode, title }) {
    const lines = [`## ${title}`, '', `模式：\`${mode}\``, ''];
    if (plans.length === 0) {
        lines.push('没有需要处理的条目。');
        return lines.join('\n');
    }
    lines.push('| # | 加标签 | 撤标签 | 评论 | 关闭 |', '|---|---|---|---|---|');
    for (const plan of plans) {
        const commentCount = (plan.upsert ? 1 : 0) + plan.comments.length;
        lines.push(`| #${plan.number} | ${cell(plan.labelsAdd.join(', '))} | ${cell(plan.labelsRemove.join(', '))} | ${commentCount || ''} | ${cell(plan.close ? `${plan.close.reason}（${plan.close.stateReason}）` : '')} |`);
    }
    for (const plan of plans) {
        const details = [];
        if (plan.notes.length) details.push(`**备注**\n${plan.notes.map(note => `- ${note}`).join('\n')}`);
        if (plan.blocked.length) details.push(`**护栏拦截**\n${plan.blocked.map(item => `- ${item.reason}：${item.blockedBy.join('；')}`).join('\n')}`);
        if (plan.upsert) details.push(`**upsert 评论（${plan.upsert.kind}）**\n\n\`\`\`markdown\n${plan.upsert.body}\n\`\`\``);
        for (const body of plan.comments) details.push(`**新评论**\n\n\`\`\`markdown\n${body}\n\`\`\``);
        if (details.length) lines.push('', `<details><summary>#${plan.number}</summary>`, '', details.join('\n\n'), '', '</details>');
    }
    return lines.join('\n');
}
