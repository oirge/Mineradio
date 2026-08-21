'use strict';
// 打包白名单守卫。`build.files` 是白名单：没被任何模式命中的根级文件不会进 asar，
// 于是 `require('./x.js')` 在装好的安装包里直接 MODULE_NOT_FOUND，主窗口根本建不起来。
// v1.7.0 就是这么炸的（新增的 plugin-proxy.js 没进白名单），这条测试负责让它不再发生。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const files = packageJson.build.files;

/**
 * 判断一个根级文件是否会被 build.files 白名单收进包里。
 * 只处理本项目实际用到的模式形态：精确文件名和 `dir/**\/*` 目录通配。
 * @param {string} rel 仓库相对路径，用 `/` 分隔。
 * @returns {boolean} 是否被收录。
 */
function isPackaged(rel) {
  let included = false;
  for (const pattern of files) {
    const negated = pattern.startsWith('!');
    const body = negated ? pattern.slice(1) : pattern;
    let hit = false;
    if (body === rel) hit = true;
    else if (body.endsWith('/**/*')) hit = rel.startsWith(body.slice(0, -4));
    else if (body.includes('*')) {
      const re = new RegExp('^' + body.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
      hit = re.test(rel);
    }
    if (hit) included = !negated;
  }
  return included;
}

/**
 * 取出一个文件里所有 `require('./x')` / `require('../x')` 的相对路径。
 * @param {string} absPath 文件绝对路径。
 * @returns {string[]} 相对路径列表。
 */
function relativeRequires(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const out = [];
  const re = /require\(\s*'(\.\.?\/[^']+)'\s*\)/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

test('主进程与本地服务的根级依赖都在打包白名单里', () => {
  // 这三个是安装包里真正会被 require 的入口：主进程、preload、本地 HTTP 服务。
  const entries = ['desktop/main.js', 'desktop/preload.js', 'server.js'];
  for (const entry of entries) {
    assert.equal(isPackaged(entry), true, `${entry} 本身必须在 build.files 里`);
    for (const spec of relativeRequires(path.join(root, entry))) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(entry), spec));
      const candidates = [target, target + '.js', target + '/index.js'];
      const existing = candidates.find((c) => fs.existsSync(path.join(root, c)));
      if (!existing) continue; // 动态拼出来的路径（如 APP_ROOT + server.js）交给下面的显式断言
      assert.equal(isPackaged(existing), true, `${entry} 依赖 ${existing}，但它没进 build.files，装好的包会 MODULE_NOT_FOUND`);
    }
  }
});

test('server.js 与它的同级模块一起被 asarUnpack，避免跨 asar 边界解析', () => {
  const unpack = packageJson.build.asarUnpack;
  assert.ok(unpack.includes('server.js'));
  assert.ok(unpack.includes('plugin-proxy.js'), 'plugin-proxy.js 与 server.js 同级互相 require，解包状态必须一致');
});

test('插件系统的所有源码文件都会进安装包', () => {
  const required = [
    'plugin-proxy.js',
    'public/plugin-manifest.js',
    'public/plugin-runtime.js',
    'public/plugin-sandbox.js',
    'public/plugin-builtin-themes.js',
  ];
  for (const rel of required) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, `${rel} 必须存在`);
    assert.equal(isPackaged(rel), true, `${rel} 必须在 build.files 里`);
  }
});
