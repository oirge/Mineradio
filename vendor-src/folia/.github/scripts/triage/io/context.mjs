// .github/scripts/triage/io/context.mjs
// 读取仓库内的 triage 配置、issue 模板和 prompt，并组装成各入口共用的运行上下文。

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMode, validateConfig } from '../lib/config.mjs';
import { templateLinesFrom } from '../lib/parse-issue.mjs';

const GITHUB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export function loadConfig() {
    return validateConfig(JSON.parse(readFileSync(join(GITHUB_DIR, 'triage/config.json'), 'utf8')));
}

export function loadTemplateLines() {
    const dir = join(GITHUB_DIR, 'ISSUE_TEMPLATE');
    return templateLinesFrom(readdirSync(dir).filter(name => name.endsWith('.md')).map(name => readFileSync(join(dir, name), 'utf8')));
}

// 读取 prompt 模板并填入模块列表和超范围主题。
export function loadPrompts(config) {
    const read = name => readFileSync(join(GITHUB_DIR, 'triage/prompts', name), 'utf8');
    const modules = Object.entries(config.modules).map(([id, description]) => `  - \`${id}\`：${description}`).join('\n');
    const outOfScope = config.outOfScope.map(item => `    - \`${item.id}\`：${item.description}`).join('\n');
    return {
        classify: read('issue-classify.md').replace('{{modules}}', modules).replace('{{outOfScope}}', outOfScope),
        duplicateConfirm: read('duplicate-confirm.md'),
    };
}

export function modeFromEnv(config, env = process.env) {
    return resolveMode({
        dispatchDryRun: env.TRIAGE_DISPATCH_DRY_RUN === 'true',
        varMode: env.TRIAGE_MODE || undefined,
        configMode: config.mode,
    });
}

export function readEvent(env = process.env) {
    return env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')) : {};
}
