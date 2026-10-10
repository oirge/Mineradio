// .github/scripts/triage/bin/triage-pr.mjs
// triage-pr workflow 的入口。运行在 pull_request_target 下，脚本来自默认分支；
// 这里只调用 GitHub API 读取 PR 元数据，不读取、不执行 PR 分支上的任何文件。

import { loadConfig, modeFromEnv, readEvent } from '../io/context.mjs';
import { executePlan, writeSummary } from '../io/execute.mjs';
import { createGitHub } from '../io/github.mjs';
import { runPrTriage } from '../io/run-pr.mjs';
import { renderPlanSummary } from '../lib/plan.mjs';

const env = process.env;
const config = loadConfig();
const mode = modeFromEnv(config);
if (mode === 'off') {
    console.log('TRIAGE_MODE=off，跳过。');
    process.exit(0);
}

const event = readEvent();
const number = env.GITHUB_EVENT_NAME === 'workflow_dispatch' ? Number(env.TRIAGE_DISPATCH_NUMBER) : event.pull_request?.number;
if (!Number.isInteger(number)) throw new Error('无法确定 PR 编号');

const gh = createGitHub({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPOSITORY, readOnly: mode !== 'live', apiUrl: env.GITHUB_API_URL });
const { plan, comments } = await runPrTriage({ gh, config, prNumber: number });
if (mode === 'live') await executePlan(gh, plan, config, { comments });
writeSummary(renderPlanSummary([plan], { mode, title: 'PR triage' }));
