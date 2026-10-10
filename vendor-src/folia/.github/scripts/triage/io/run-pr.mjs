// .github/scripts/triage/io/run-pr.mjs
// 单个 PR 的 triage 流程：只读取 PR 元数据、改动文件名和 announcement，不接触 PR 的代码。

import { findBotComment } from '../lib/comments.mjs';
import { decidePr } from '../lib/decide-pr.mjs';
import { normalizeComment, normalizeIssue, summarizeTimeline } from '../lib/model.mjs';

export async function runPrTriage({ gh, config, prNumber }) {
    const raw = await gh.get(`/pulls/${prNumber}`);
    const pr = { ...normalizeIssue({ ...raw, pull_request: {} }), draft: Boolean(raw.draft) };
    const [files, announcementsRaw, timelineRaw, commentsRaw] = await Promise.all([
        gh.listPrFiles(prNumber),
        gh.searchIssues('is:issue is:open label:announcement', 50),
        gh.listTimeline(prNumber),
        gh.listComments(prNumber),
    ]);
    const comments = commentsRaw.map(normalizeComment);
    const timeline = summarizeTimeline(timelineRaw, { botLogin: config.botLogin, labels: pr.labels });
    const plan = decidePr({
        pr,
        files,
        announcements: announcementsRaw.map(normalizeIssue),
        botOwnedLabels: timeline.botOwnedLabels,
        config,
        hasExistingComment: Boolean(findBotComment(comments, config.botLogin, 'pr')),
    });
    return { plan, comments };
}
