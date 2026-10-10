// .github/scripts/triage/bin/triage-issue.mjs
// triage-issues workflow 的入口：按事件类型分派到完整 triage、作者补充后的复查、撤 stale、申诉提醒，
// 或 PR 上的 /triage。事件数据只从 GITHUB_EVENT_PATH 读取，不经过 workflow 表达式插值。

import { loadConfig, loadPrompts, loadTemplateLines, modeFromEnv, readEvent } from '../io/context.mjs';
import { createDeepSeek } from '../io/deepseek.mjs';
import { executePlan, writeSummary } from '../io/execute.mjs';
import { createGitHub } from '../io/github.mjs';
import { notifyMaintainers } from '../io/notify.mjs';
import { runIssueTriage } from '../io/run-issue.mjs';
import { runPrTriage } from '../io/run-pr.mjs';
import { hasMarker } from '../lib/comments.mjs';
import { isMaintainerAssociation } from '../lib/config.mjs';
import { isBotLogin, normalizeIssue } from '../lib/model.mjs';
import { createPlan, finalizePlan, isEmptyPlan, renderPlanSummary } from '../lib/plan.mjs';

const env = process.env;
const config = loadConfig();
const mode = modeFromEnv(config);
if (mode === 'off') {
    console.log('TRIAGE_MODE=off，跳过。');
    process.exit(0);
}

const gh = createGitHub({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPOSITORY, readOnly: mode !== 'live', apiUrl: env.GITHUB_API_URL });
const event = readEvent();
const eventName = env.GITHUB_EVENT_NAME;
const now = Date.now();
const force = env.TRIAGE_DISPATCH_FORCE === 'true';
const plans = [];
const notices = [];

// 根据事件决定要做的事；返回 { kind: 'issue'|'pr'|'labels'|null, ... }。
function route() {
    if (eventName === 'workflow_dispatch') return { kind: 'issue', number: Number(env.TRIAGE_DISPATCH_NUMBER), trigger: 'manual', force };
    const issue = event.issue;
    const sender = event.sender?.login ?? '';
    if (!issue || isBotLogin(sender) || event.sender?.type === 'Bot') return { kind: null, why: '来自 bot 的事件' };

    if (eventName === 'issues') {
        if (event.action === 'opened') return { kind: 'issue', number: issue.number, trigger: 'opened' };
        if (event.action === 'reopened') return { kind: 'issue', number: issue.number, trigger: 'reopened' };
        if (event.action === 'edited') {
            if (sender !== issue.user.login || issue.state !== 'open') return { kind: null, why: '不是作者编辑或 issue 已关闭' };
            return { kind: 'issue', number: issue.number, trigger: 'edited' };
        }
        return { kind: null, why: `不处理 issues.${event.action}` };
    }

    if (eventName === 'issue_comment' && event.action === 'created') {
        const comment = event.comment;
        if (hasMarker(comment.body) || isBotLogin(comment.user.login)) return { kind: null, why: 'bot 评论' };
        const command = /^\/triage(?:\s+(force))?\s*$/m.exec(comment.body.trim().split('\n')[0]);
        if (command) {
            if (!isMaintainerAssociation(config, comment.author_association)) return { kind: null, why: `${comment.user.login} 不是维护者，忽略 /triage` };
            if (issue.pull_request) return { kind: 'pr', number: issue.number };
            return { kind: 'issue', number: issue.number, trigger: 'manual', force: command[1] === 'force' };
        }
        const labels = issue.labels.map(label => label.name);
        const plan = createPlan(issue.number, issue.pull_request ? 'pr' : 'issue');
        // 有人回复就撤 stale。
        if (labels.includes('stale')) plan.labelsRemove.push('stale');
        // 被 bot 关掉的 issue，作者回复视为申诉：不自动重开，提醒维护者人工判断。
        if (issue.state === 'closed' && labels.includes('bot: auto-closed') && comment.user.login === issue.user.login) plan.labelsAdd.push('需要他人协助');
        const followup = !issue.pull_request && issue.state === 'open' && labels.includes('needs-info') && comment.user.login === issue.user.login;
        return { kind: 'labels', plan: finalizePlan(plan, labels, config), followup: followup ? { number: issue.number, trigger: 'author-comment' } : null };
    }
    return { kind: null, why: `不处理 ${eventName}` };
}

async function triageIssue({ number, trigger, force: forced }) {
    const issueRaw = await gh.getIssue(number);
    const issue = normalizeIssue(issueRaw);
    if (issue.isPullRequest) return triagePr(number);
    if (issue.labels.includes('bot: skip') && !forced) {
        notices.push(`#${number} 带 bot: skip，跳过`);
        return;
    }
    const llmClient = env.DEEPSEEK_API_KEY ? createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY, config }) : null;
    if (!llmClient) notices.push('未配置 DEEPSEEK_API_KEY，只运行确定性规则');
    const result = await runIssueTriage({
        gh, llmClient, config, prompts: loadPrompts(config), templateLines: loadTemplateLines(), mode, issueRaw, trigger, now,
    });
    plans.push(result.plan);
    if (result.llmUsage) notices.push(`LLM 调用 ${llmClient.callsUsed} 次，prompt ${result.llmUsage.promptTokens} / completion ${result.llmUsage.completionTokens} tokens`);
    if (result.breaker?.tripped) notices.push(`熔断：${result.breaker.reasons.join('；')}`);
    if (result.breaker?.tripped && result.breaker.scope === 'global') {
        await notify({ windowKey: result.breaker.windowKey, reasons: result.breaker.reasons });
    }
    if (result.balanceExhausted) {
        await notify({ windowKey: `balance:${new Date(now).toISOString().slice(0, 10)}`, reasons: ['DeepSeek 返回 402：账户余额不足，已降级为只跑确定性规则'] });
    }
}

async function triagePr(number) {
    const { plan, comments } = await runPrTriage({ gh, config, prNumber: number });
    plans.push(plan);
    return { comments };
}

async function notify(details) {
    if (mode !== 'live') {
        notices.push(`dry-run：本应通知维护者（${details.windowKey}）`);
        return;
    }
    const number = await notifyMaintainers(gh, config, { ...details, now });
    notices.push(`已通知维护者：#${number}`);
}

const routed = route();
if (routed.kind === null) notices.push(`跳过：${routed.why}`);
if (routed.kind === 'issue') await triageIssue(routed);
if (routed.kind === 'pr') await triagePr(routed.number);
if (routed.kind === 'labels') {
    if (!isEmptyPlan(routed.plan)) plans.push(routed.plan);
    if (routed.followup) await triageIssue(routed.followup);
}

if (mode === 'live') {
    for (const plan of plans) await executePlan(gh, plan, config);
}
writeSummary(renderPlanSummary(plans, { mode, title: 'Issue triage' }) + (notices.length ? `\n\n${notices.map(note => `- ${note}`).join('\n')}` : ''));
