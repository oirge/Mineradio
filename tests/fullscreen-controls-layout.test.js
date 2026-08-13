'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, '未找到函数：' + name);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('函数未闭合：' + name);
}

test('全屏 DIY 与退出按钮固定在 Home 左侧', () => {
  const source = read('public/app.js');
  const functionSource = extractFunction(source, 'layoutFullscreenDiyZone');
  const properties = new Map();
  const homeRect = { left: 1852, top: 24, right: 1896, bottom: 68, width: 44, height: 44 };
  const context = {
    innerWidth: 1920,
    innerHeight: 1080,
    document: {
      getElementById(id) {
        if (id === 'home-btn') return { getBoundingClientRect: () => homeRect };
        if (id === 'top-right') return { getBoundingClientRect: () => ({ left: 1800, top: 24, width: 96, height: 44 }) };
        return null;
      },
      documentElement: {
        style: {
          setProperty(name, value) { properties.set(name, value); },
        },
      },
    },
  };

  vm.runInNewContext(functionSource, context);
  const result = context.layoutFullscreenDiyZone();

  assert.equal(result.left + result.width, homeRect.left - 10);
  assert.equal(result.top + result.height / 2, homeRect.top + homeRect.height / 2);
  assert.equal(properties.get('--fullscreen-diy-left'), '1618.0px');
  assert.equal(properties.get('--fullscreen-diy-top'), '20.0px');
  assert.match(functionSource, /getElementById\('home-btn'\)/);
  assert.doesNotMatch(functionSource, /top-account-pill|user-btn/);
});

test('窄屏下仍保留 Home 与全屏按钮间距', () => {
  const source = read('public/app.js');
  const functionSource = extractFunction(source, 'layoutFullscreenDiyZone');
  const homeRect = { left: 644, top: 24, right: 688, bottom: 68, width: 44, height: 44 };
  const context = {
    innerWidth: 700,
    innerHeight: 720,
    document: {
      getElementById(id) {
        return id === 'home-btn' ? { getBoundingClientRect: () => homeRect } : null;
      },
      documentElement: { style: { setProperty() {} } },
    },
  };

  vm.runInNewContext(functionSource, context);
  const result = context.layoutFullscreenDiyZone();

  assert.equal(result.width, 202);
  assert.equal(result.left + result.width, homeRect.left - 8);
  assert.equal(result.top + result.height / 2, homeRect.top + homeRect.height / 2);
});
