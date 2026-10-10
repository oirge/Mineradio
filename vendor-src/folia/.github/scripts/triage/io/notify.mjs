// .github/scripts/triage/io/notify.mjs
// 熔断 / 余额不足时通知维护者：维护一条固定标题的通知 issue，每个熔断窗口只追加一条评论。

import { parseMarker, renderBreakerNotice } from '../lib/comments.mjs';
import { executePlan } from './execute.mjs';
import { createPlan } from '../lib/plan.mjs';

export async function notifyMaintainers(gh, config, { windowKey, reasons, now }) {
    const title = config.breaker.notifyIssueTitle;
    const found = (await gh.searchIssues(`is:issue is:open in:title "${title}"`, 10)).find(item => item.title === title);
    let number = found?.number;
    if (!number) {
        const created = await gh.request('POST', '/issues', {
            title,
            body: '本 issue 由 triage bot 维护：LLM 熔断或 DeepSeek 余额不足时会在这里留言。确认处理后可以关闭，下次触发时会重新开一条。',
        });
        number = created.data.number;
        // 自己开的通知 issue 不参与 triage。
        const plan = createPlan(number, 'issue');
        plan.labelsAdd.push('bot: skip');
        await executePlan(gh, plan, config, { comments: [] });
    }
    const comments = await gh.listComments(number);
    if (comments.some(comment => parseMarker(comment.body)?.kind === 'breaker' && parseMarker(comment.body).windowKey === windowKey)) return number;
    await gh.request('POST', `/issues/${number}/comments`, { body: renderBreakerNotice({ windowKey, reasons, at: new Date(now).toISOString() }) });
    return number;
}
