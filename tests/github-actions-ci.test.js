'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'verify.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');

test('GitHub Actions verifies the release branch and default branch', () => {
  assert.match(workflow, /name: Verify/);
  assert.match(workflow, /- main/);
  assert.match(workflow, /- 'codex\/\*\*'/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /node --test --test-concurrency=1/);
  assert.match(workflow, /node --check desktop\/main\.js/);
  assert.match(workflow, /git diff --check/);
});
