'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('Windows 发布构建只生成 x64 NSIS 安装包', () => {
  assert.deepEqual(packageJson.build.win.target, [
    {
      target: 'nsis',
      arch: ['x64']
    }
  ]);
  assert.equal(
    Object.prototype.hasOwnProperty.call(packageJson.build.win, 'artifactName'),
    false,
    'Windows 构建不得恢复 Portable ZIP 专用 artifactName'
  );
});
