'use strict';
// 打包白名单守卫。`build.files` 是白名单：没被任何模式命中的根级文件不会进 asar，
// 于是 `require('./x.js')` 在装好的安装包里直接 MODULE_NOT_FOUND，主窗口根本建不起来。
// v1.7.0 就是这么炸的（当时新增的 plugin-proxy.js 没进白名单），这条测试负责让它不再发生。

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
});

test('低层鼠标钩子的原生模块和它的加载器都进包，而且解出 asar', () => {
  // 上面那条相对依赖扫描只认 `./` / `../`，bare require('uiohook-napi') 它看不见，
  // 而 build.files 是白名单——这两个 node_modules 模式必须手写进去。
  assert.equal(isPackaged('node_modules/uiohook-napi/dist/index.js'), true);
  assert.equal(isPackaged('node_modules/uiohook-napi/prebuilds/win32-x64/uiohook-napi.node'), true);
  assert.equal(isPackaged('node_modules/node-gyp-build/index.js'), true, 'uiohook 的入口就是 require("node-gyp-build")，少了它照样 MODULE_NOT_FOUND');
  // .node 二进制在 asar 里 dlopen 不了，必须解包出来。
  assert.ok(packageJson.build.asarUnpack.includes('node_modules/uiohook-napi/**'));
  assert.equal(packageJson.dependencies['uiohook-napi'], '1.5.5', '原生模块钉死版本，别让 ^ 在某次构建里换掉预编译二进制');
});

test('锁文件里所有依赖都指向官方源，别把本地镜像地址提交上去', () => {
  // 本机 npm 默认走 registry.npmmirror.com，一旦混进锁文件，CI 上的 npm ci 就会去拉一个
  // 跟 integrity 对不上的地址。
  const lock = fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8');
  const bad = (lock.match(/"resolved": "https?:\/\/(?!registry\.npmjs\.org\/)[^"]+"/g) || []);
  assert.deepEqual(bad, []);
  const lockJson = JSON.parse(lock);
  assert.equal(lockJson.packages['node_modules/uiohook-napi'].version, '1.5.5');
  assert.equal(lockJson.packages[''].dependencies['uiohook-napi'], '1.5.5');
});

test('插件系统的所有源码文件都会进安装包', () => {
  const required = [
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
