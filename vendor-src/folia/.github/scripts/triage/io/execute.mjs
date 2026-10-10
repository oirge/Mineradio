// .github/scripts/triage/io/execute.mjs
// 把 Plan 落地到 GitHub。dry-run 不调用这里；执行顺序是：建缺失标签 → 改标签 → 评论 → 关闭，
// 这样关闭失败时评论和标签至少已经说明了原因。

import { appendFileSync } from 'node:fs';
import { findBotComment } from '../lib/comments.mjs';
import { normalizeComment } from '../lib/model.mjs';

async function ensureLabel(gh, config, name, known) {
    if (known.has(name)) return;
    const spec = config.labels.managed[name];
    if (spec) {
        try {
            await gh.request('POST', '/labels', { name, color: spec.color, description: spec.description });
        } catch (error) {
            // 422 表示同名标签已存在；已有标签的颜色和描述一律不改。
            if (error.status !== 422) throw error;
        }
    }
    known.add(name);
}

// 执行一份 Plan。comments 可传入已拉取的评论列表，省一次请求。
export async function executePlan(gh, plan, config, { comments, knownLabels = new Set() } = {}) {
    for (const name of plan.labelsAdd) await ensureLabel(gh, config, name, knownLabels);
    if (plan.labelsAdd.length) await gh.request('POST', `/issues/${plan.number}/labels`, { labels: plan.labelsAdd });
    for (const name of plan.labelsRemove) {
        try {
            await gh.request('DELETE', `/issues/${plan.number}/labels/${encodeURIComponent(name)}`);
        } catch (error) {
            if (error.status !== 404) throw error;
        }
    }
    if (plan.upsert) {
        const list = comments ?? (await gh.listComments(plan.number)).map(normalizeComment);
        const existing = findBotComment(list, config.botLogin, plan.upsert.kind);
        if (!existing) await gh.request('POST', `/issues/${plan.number}/comments`, { body: plan.upsert.body });
        else if (existing.comment.body !== plan.upsert.body) await gh.request('PATCH', `/issues/comments/${existing.comment.id}`, { body: plan.upsert.body });
    }
    for (const body of plan.comments) await gh.request('POST', `/issues/${plan.number}/comments`, { body });
    if (plan.close) await gh.request('PATCH', `/issues/${plan.number}`, { state: 'closed', state_reason: plan.close.stateReason });
}

export function writeSummary(markdown) {
    const target = process.env.GITHUB_STEP_SUMMARY;
    if (target) appendFileSync(target, `${markdown}\n`);
    else process.stdout.write(`${markdown}\n`);
}
