'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function testFrontendVersionMatchesPackage() {
  const root = path.join(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const matches = Array.from(html.matchAll(/\bvar APP_VERSION = '([^']+)';/g));

  assert.equal(matches.length, 1, '前端必须且只能声明一个 APP_VERSION');
  assert.equal(matches[0][1], pkg.version, '前端 APP_VERSION 必须与 package.json 版本一致');
}

test('前端更新版本号与 package.json 保持一致', testFrontendVersionMatchesPackage);
