const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function findNewestRceditInCache(cacheRoot) {
  if (!cacheRoot || !fs.existsSync(cacheRoot)) return null;
  var newest = null;
  var stack = [cacheRoot];
  while (stack.length) {
    var dir = stack.pop();
    var entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    entries.forEach(function(entry) {
      var fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }
      if (entry.isFile() && entry.name.toLowerCase() === 'rcedit-x64.exe') {
        var stat = fs.statSync(fullPath);
        if (!newest || stat.mtimeMs > newest.mtimeMs) newest = { path: fullPath, mtimeMs: stat.mtimeMs };
      }
    });
  }
  return newest && newest.path;
}

function resolveRcedit(projectDir) {
  var candidates = [
    path.join(projectDir, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe')
  ];
  var localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    var cached = findNewestRceditInCache(path.join(localAppData, 'electron-builder', 'Cache', 'winCodeSign'));
    if (cached) candidates.push(cached);
  }
  candidates.push(path.join(projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe'));
  var hit = candidates.find(function(candidate) { return candidate && fs.existsSync(candidate); });
  if (!hit) throw new Error('No usable rcedit executable was found for Mineradio icon injection.');
  return hit;
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  // 二创版把 win.executableName 改成了 Mineradio-oirge，好和原项目的 Mineradio.exe 共存；
  // productFilename 跟的是 productName（含中文），和实际 exe 名不再一致，必须优先用 executableName。
  const platformOptions = context.packager.platformSpecificBuildOptions || {};
  const productName = context.packager.appInfo.productName || 'Mineradio';
  const exeCandidates = [platformOptions.executableName, context.packager.appInfo.productFilename, 'Mineradio']
    .filter(Boolean)
    .map(function(name) { return { name: name, path: path.join(context.appOutDir, `${name}.exe`) }; });
  const exeTarget = exeCandidates.find(function(candidate) { return fs.existsSync(candidate.path); });
  const iconPath = path.join(context.packager.info.buildResourcesDir, 'icon.ico');
  const rceditPath = resolveRcedit(context.packager.projectDir);

  if (!exeTarget) {
    throw new Error(`Mineradio executable was not found: ${exeCandidates.map(function(c) { return c.path; }).join(', ')}`);
  }
  if (!fs.existsSync(iconPath)) throw new Error(`Mineradio icon was not found: ${iconPath}`);

  const version = context.packager.appInfo.version;
  console.log(`  • injecting Mineradio resources  rcedit=${rceditPath}`);
  execFileSync(rceditPath, [
    exeTarget.path,
    '--set-icon', iconPath,
    // 任务管理器按 FileDescription 显示进程名；这里跟随 productName，才能和原项目的进程区分开。
    '--set-version-string', 'FileDescription', productName,
    '--set-version-string', 'ProductName', productName,
    '--set-version-string', 'CompanyName', 'Mineradio',
    '--set-version-string', 'OriginalFilename', `${exeTarget.name}.exe`,
    '--set-file-version', version,
    '--set-product-version', version
  ], { stdio: 'inherit' });
};
