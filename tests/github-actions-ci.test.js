'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'verify.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const releaseWorkflowPath = path.join(__dirname, '..', '.github', 'workflows', 'release.yml');
const releaseWorkflow = fs.readFileSync(releaseWorkflowPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

test('GitHub Actions verifies the release branch and default branch', () => {
  assert.match(workflow, /name: Verify/);
  assert.match(workflow, /- main/);
  assert.match(workflow, /- 'codex\/\*\*'/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /node --test --test-concurrency=1/);
  assert.match(workflow, /node --check desktop\/main\.js/);
  assert.match(workflow, /git diff --check/);
});

/**
 * 验证发布工作流为安装器、blockmap 和 latest.yml 生成同一份校验清单。
 * @returns {void}
 */
test('发布工作流清单覆盖全部自动更新资产', () => {
  // 资产名跟着 build.nsis.artifactName（二创版带 -oirge），从 package.json 推导，避免两边各写死一份。
  // 用函数式替换：字符串替换值里的 `$` 会被当成特殊记号。
  const setupAsset = packageJson.build.nsis.artifactName
    .replace('${version}', () => '$version')
    .replace('${ext}', () => 'exe');
  assert.ok(
    releaseWorkflow.includes(`${setupAsset}.blockmap`),
    `发布工作流缺少 blockmap 资产 ${setupAsset}.blockmap`,
  );
  assert.match(releaseWorkflow, /"latest\.yml"/);
  assert.match(releaseWorkflow, /\$lines = foreach \(\$file in \$files\)/);
  assert.match(releaseWorkflow, /"\$hash \*\$file"/);
});

test('发布工作流默认标签跟随当前 package 版本', () => {
  const tag = 'v' + packageJson.version;
  assert.match(releaseWorkflow, new RegExp("description: 'Release tag \\(e\.g\. " + tag + "\\)'"));
  assert.match(releaseWorkflow, new RegExp("default: '" + tag + "'"));
});
