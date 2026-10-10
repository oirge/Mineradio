// .github/scripts/triage/lib/model.mjs
// 把 GitHub REST / webhook 返回的 issue、评论、时间线规整成决策层使用的精简结构。

export function normalizeIssue(raw) {
    return {
        number: raw.number,
        title: raw.title ?? '',
        body: raw.body ?? '',
        labels: (raw.labels ?? []).map(label => (typeof label === 'string' ? label : label.name)),
        author: raw.user?.login ?? '',
        authorType: raw.user?.type ?? 'User',
        authorAssociation: raw.author_association ?? 'NONE',
        assignees: (raw.assignees ?? []).length,
        hasMilestone: Boolean(raw.milestone),
        locked: Boolean(raw.locked),
        state: raw.state ?? 'open',
        stateReason: raw.state_reason ?? null,
        isPullRequest: Boolean(raw.pull_request),
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        closedAt: raw.closed_at ?? null,
    };
}

export const normalizeComment = raw => ({
    id: raw.id,
    author: raw.user?.login ?? '',
    authorType: raw.user?.type ?? 'User',
    authorAssociation: raw.author_association ?? 'NONE',
    body: raw.body ?? '',
    createdAt: raw.created_at,
});

export const isBotLogin = login => /\[bot\]$/.test(login ?? '');

// 从时间线算出与护栏有关的历史，以及哪些当前标签是 bot 打上去的。
export function summarizeTimeline(events, { botLogin, labels }) {
    const lastLabeler = new Map();
    let reopened = false;
    let botClosedBefore = false;
    for (const event of events) {
        const actor = event.actor?.login ?? '';
        if (event.event === 'labeled' && event.label?.name) lastLabeler.set(event.label.name, { actor, at: event.created_at });
        if (event.event === 'reopened') reopened = true;
        if (event.event === 'closed' && actor === botLogin) botClosedBefore = true;
    }
    const botOwnedLabels = labels.filter(name => lastLabeler.get(name)?.actor === botLogin);
    const labeledAt = name => lastLabeler.get(name)?.at ?? null;
    return { reopened, botClosedBefore, botOwnedLabels, labeledAt };
}
