'use strict';

// Build the vendored source without installing or launching a second Electron application.
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { verifyBundledLicenses, LICENSE_FILE } = require('./folia-licenses.cjs');
const root = path.resolve(__dirname, '..');
const folia = path.join(root, 'vendor-src', 'folia');
const vite = path.join(folia, 'node_modules', 'vite', 'bin', 'vite.js');
const destination = path.join(root, 'public', 'vendor', 'folia');
const checkOnly = process.argv.includes('--check');

function requireFile(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size === 0) {
    throw new Error('Folia 文件缺失或为空：' + path.relative(root, file));
  }
}

// Check the actual entry references so missing assets stop desktop packaging immediately.
function verifyOutput() {
  const entry = path.join(destination, 'index.html');
  requireFile(entry);
  requireFile(path.join(destination, 'local-player-build.json'));
  const html = fs.readFileSync(entry, 'utf8');
  const scope = JSON.parse(fs.readFileSync(path.join(destination, 'local-player-build.json'), 'utf8'));
  const licenses = path.join(destination, LICENSE_FILE);
  requireFile(licenses);
  verifyBundledLicenses(scope.thirdPartyLicenses, fs.readFileSync(licenses, 'utf8'));
  const forbidden = Array.isArray(scope.modules) ? scope.modules.filter(id =>
    (id.startsWith('src/components/app/') && !id.startsWith('src/components/app/lattice/')) ||
    ['src/App.tsx', 'src/bootstrap.tsx', 'src/stores/usePlaybackStore.ts', 'src/services/netease.ts', 'src/services/db.ts', 'src/services/appDatabase.ts'].includes(id)
    || ['src/mods/', 'src/services/onlineMusic/', 'src/components/remote/', 'src/components/obs/', 'src/components/visualizer/backgrounds/url/'].some(prefix => id.startsWith(prefix))) : ['missing module inventory'];
  if (scope.surface !== 'folia-local-player' || scope.entry !== 'src/mineradio/local-entry.tsx'
      || !html.includes('folia-local-player') || forbidden.length) {
    throw new Error('Folia 产物必须只包含本地播放器入口，不能加载完整应用：' + forbidden.join(', '));
  }
  if (!/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=/i.test(html)) {
    throw new Error('Folia 产物没有 module 入口，请重新执行 npm run build:folia。');
  }
  if (/<script\b[^>]*\btype=["']importmap["']/i.test(html)) {
    throw new Error('Folia 嵌入版不能依赖上游 importmap。');
  }
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi)) {
    const reference = match[1];
    if (!reference.startsWith('./')) {
      throw new Error('Folia 入口资源必须使用相对本地路径：' + reference);
    }
    const resolved = path.resolve(destination, reference.split(/[?#]/)[0]);
    const relative = path.relative(destination, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Folia 入口资源越出产物目录：' + reference);
    }
    requireFile(resolved);
  }
  for (const file of ['LICENSE', 'MINERADIO-UPSTREAM.json']) {
    const output = path.join(destination, file);
    requireFile(output);
    if (!fs.readFileSync(output).equals(fs.readFileSync(path.join(folia, file)))) {
      throw new Error('Folia 产物中的 ' + file + ' 与源码不一致，请重新构建。');
    }
  }
}

try {
  if (Number(process.versions.node.split('.')[0]) < 24) {
    throw new Error('Folia 构建需要 Node.js 24 或更新版本。');
  }
  const unknown = process.argv.slice(2).filter(argument => argument !== '--check');
  if (unknown.length) throw new Error('不支持的构建参数：' + unknown.join(' '));
  for (const file of ['LICENSE', 'MINERADIO-UPSTREAM.json', 'package.json', 'package-lock.json', 'vite.mineradio.config.ts']) {
    requireFile(path.join(folia, file));
  }
  const upstream = JSON.parse(fs.readFileSync(path.join(folia, 'MINERADIO-UPSTREAM.json'), 'utf8'));
  const sourcePackage = JSON.parse(fs.readFileSync(path.join(folia, 'package.json'), 'utf8'));
  if (upstream.version !== sourcePackage.version || !/^[a-f0-9]{40}$/i.test(upstream.observedMainCommit)) {
    throw new Error('Folia 上游版本记录与源码不匹配，或缺少完整 commit SHA。');
  }
  if (!checkOnly) {
    if (!fs.existsSync(vite)) {
      throw new Error('先执行 npm ci --prefix vendor-src/folia --ignore-scripts --no-audit --no-fund');
    }
    const result = spawnSync(process.execPath, [vite, 'build', '--config', 'vite.mineradio.config.ts'], {
      cwd: folia,
      stdio: 'inherit',
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error('Folia 构建失败（' + (result.signal || result.status || '未返回退出码') + '）。');
    }
    for (const file of ['LICENSE', 'MINERADIO-UPSTREAM.json']) {
      fs.copyFileSync(path.join(folia, file), path.join(destination, file));
    }
  }
  verifyOutput();
  console.log('Folia 界面' + (checkOnly ? '校验通过' : '已构建并校验') + '：' + destination);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
