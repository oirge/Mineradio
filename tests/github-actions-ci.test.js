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
  assert.match(releaseWorkflow, /\[IO\.File\]::WriteAllText\(/);
  assert.match(releaseWorkflow, /\[Text\.UTF8Encoding\]::new\(\$false\)/);
  assert.match(releaseWorkflow, /\(\$lines -join "`n"\) \+ "`n"/);
  assert.doesNotMatch(releaseWorkflow, /Out-File/);
});

test('发布工作流禁用构建器发布并只创建或复用一个 Release', () => {
  assert.match(releaseWorkflow, /uses: actions\/checkout@v5/);
  assert.match(releaseWorkflow, /uses: actions\/setup-node@v5/);
  assert.match(releaseWorkflow, /npm run build:win -- --publish never/);
  assert.match(releaseWorkflow, /concurrency:/);
  assert.match(releaseWorkflow, /function Get-TagReleases/);
  assert.match(releaseWorkflow, /\$releases\.Count -gt 1/);
  assert.match(releaseWorkflow, /\$releases\.Count -eq 0/);
  assert.match(releaseWorkflow, /gh release create \$tag/);
  assert.match(releaseWorkflow, /--draft/);
  assert.match(releaseWorkflow, /--verify-tag/);
  assert.ok(releaseWorkflow.indexOf('gh release create') < releaseWorkflow.indexOf('gh release upload'));
  assert.match(releaseWorkflow, /gh release upload \$tag[\s\S]*--clobber/);
  assert.equal((releaseWorkflow.match(/^\s+gh release create \$tag/gm) || []).length, 1);
});

test('发布工作流默认标签跟随当前 package 版本', () => {
  const tag = 'v' + packageJson.version;
  assert.match(releaseWorkflow, new RegExp("description: 'Release tag \\(e\.g\. " + tag + "\\)'"));
  assert.match(releaseWorkflow, new RegExp("default: '" + tag + "'"));
});
