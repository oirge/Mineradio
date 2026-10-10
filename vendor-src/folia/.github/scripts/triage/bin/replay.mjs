// .github/scripts/triage/bin/replay.mjs
// 本地只读回放：对历史 issue 跑一遍 triage 决策，与维护者的真实处理结果对比，用于上线前确认误关为 0。
//
//   node .github/scripts/triage/bin/replay.mjs --issue 514
//   node .github/scripts/triage/bin/replay.mjs --range 440-523 [--no-llm] [--save-fixtures] [--json]
//
// GitHub token 取 GITHUB_TOKEN，没有就用 `gh auth token`；DeepSeek key 取 DEEPSEEK_API_KEY，没有就自动 --no-llm。

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, loadPrompts, loadTemplateLines } from '../io/context.mjs';
import { createDeepSeek } from '../io/deepseek.mjs';
import { createGitHub } from '../io/github.mjs';
import { runIssueTriage } from '../io/run-issue.mjs';
import { normalizeComment } from '../lib/model.mjs';
import { scrubCredentials } from '../lib/sanitize.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = name => args[args.indexOf(name) + 1];

let numbers = [];
if (flag('--issue')) numbers = [Number(option('--issue'))];
if (flag('--range')) {
    const [from, to] = option('--range').split('-').map(Number);
    for (let n = from; n <= to; n += 1) numbers.push(n);
}
if (numbers.length === 0 || numbers.some(n => !Number.isInteger(n))) {
    console.error('用法：replay.mjs --issue <n> | --range <from>-<to> [--no-llm] [--save-fixtures] [--json]');
    process.exit(1);
}

const token = process.env.GITHUB_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
const repo = process.env.GITHUB_REPOSITORY || 'chthollyphile/folia-major';
const gh = createGitHub({ token, repo, readOnly: true });
const config = loadConfig();
const prompts = loadPrompts(config);
const templateLines = loadTemplateLines();
const useLlm = !flag('--no-llm') && Boolean(process.env.DEEPSEEK_API_KEY);

// 一次性拉取全部 issue，用于还原每条 issue 创建时的候选集与汇总 issue 状态。
const all = (await gh.paginate('/issues?state=all&sort=created&direction=asc', 5000)).filter(item => !item.pull_request);
const byNumber = new Map(all.map(item => [item.number, item]));
const openAt = (item, at) => Date.parse(item.created_at) < at && (!item.closed_at || Date.parse(item.closed_at) > at);

const rows = [];
for (const number of numbers) {
    const issueRaw = byNumber.get(number);
    if (!issueRaw) continue;
    const createdAt = Date.parse(issueRaw.created_at);
    const now = createdAt + 60 * 1000;
    const candidates = all
        .filter(item => item.number !== number && openAt(item, createdAt) && createdAt - Date.parse(item.created_at) < config.llm.candidateWindowDays * DAY_MS)
        .reverse()
        .slice(0, config.llm.candidateLimit)
        .map(item => ({ n: item.number, t: item.title, l: item.labels.map(label => label.name) }));
    const aggregateTargets = Object.fromEntries(config.aggregates.map(item => {
        const target = byNumber.get(item.issue);
        return [item.issue, target ? { number: target.number, open: openAt(target, createdAt) } : null];
    }));
    // 回放「刚创建时」的状态：标签只保留模板自带的，没有评论和时间线。
    const templateLabel = /^\s*\[bug\]/i.test(issueRaw.title) ? ['bug'] : /^\s*\[feature\]/i.test(issueRaw.title) ? ['enhancement'] : [];
    const atCreation = { ...issueRaw, state: 'open', state_reason: null, closed_at: null, labels: templateLabel.map(name => ({ name })), assignees: [], milestone: null, locked: false };
    const llmClient = useLlm ? createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY, config }) : null;
    const result = await runIssueTriage({
        gh, llmClient, config, prompts, templateLines, mode: 'live', issueRaw: atCreation, trigger: 'opened', now,
        overrides: { comments: [], timeline: [], candidates, aggregateTargets, skipBreaker: true },
    });
    const actualClosed = issueRaw.state === 'closed' && issueRaw.state_reason !== 'completed';
    rows.push({
        number,
        title: issueRaw.title.slice(0, 40),
        predictedClose: result.plan.close?.reason ?? null,
        actual: issueRaw.state === 'closed' ? issueRaw.state_reason : 'open',
        actualLabels: issueRaw.labels.map(label => label.name),
        addLabels: result.plan.labelsAdd,
        blocked: result.plan.blocked.map(item => item.reason),
        llm: result.llm.status,
        verdict: result.plan.close ? (actualClosed ? 'agree-close' : 'FALSE-CLOSE') : actualClosed ? 'missed' : 'agree-keep',
    });

    if (flag('--save-fixtures')) {
        const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../test/fixtures/triage/issues');
        mkdirSync(dir, { recursive: true });
        const comments = (await gh.listComments(number)).map(normalizeComment);
        const fixture = {
            number, title: issueRaw.title, body: scrubCredentials(issueRaw.body ?? ''), labels: issueRaw.labels.map(label => label.name),
            user: { login: issueRaw.user.login, type: issueRaw.user.type }, author_association: issueRaw.author_association,
            created_at: issueRaw.created_at, state: issueRaw.state, state_reason: issueRaw.state_reason,
            comments: comments.map(comment => ({ ...comment, body: scrubCredentials(comment.body) })),
        };
        writeFileSync(join(dir, `${number}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
    }
}

if (flag('--json')) {
    console.log(JSON.stringify(rows, null, 2));
} else {
    for (const row of rows) {
        console.log(`#${row.number}\t${row.verdict}\tpredicted=${row.predictedClose ?? '-'}\tactual=${row.actual}\tllm=${row.llm}\t+[${row.addLabels.join(', ')}]\tblocked=[${row.blocked.join(', ')}]\t${row.title}`);
    }
    const count = verdict => rows.filter(row => row.verdict === verdict).length;
    console.log(`\n共 ${rows.length} 条：一致关闭 ${count('agree-close')}，误关 ${count('FALSE-CLOSE')}，漏判 ${count('missed')}，一致保留 ${count('agree-keep')}`);
    if (count('FALSE-CLOSE') > 0) process.exitCode = 2;
}
