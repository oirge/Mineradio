const fs = require('node:fs/promises');
const path = require('node:path');

// build/afterPack.cjs

const ONNX_BIN_RELATIVE_PATH = path.join(
  'app.asar.unpacked',
  'node_modules',
  'onnxruntime-node',
  'bin',
  'napi-v6',
);

// electron-builder 的 Arch 枚举，按序号展开。刻意不 require('builder-util')：那只是
// electron-builder 的传递依赖，能解析到纯属 npm 扁平提升的副作用，依赖树一变就会在打包
// 末期才炸。这五个值是 electron-builder 的公开契约，比提升可靠。
const ARCH_NAMES = ['ia32', 'x64', 'armv7l', 'arm64', 'universal'];

async function pathExists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

// Keep only the native ONNX Runtime binaries usable by the package being built.
async function pruneOnnxRuntimeBinaries(context) {
  const resourcesDir = context.packager.getResourcesDir(context.appOutDir);
  const binariesDir = path.join(resourcesDir, ONNX_BIN_RELATIVE_PATH);
  if (!(await pathExists(binariesDir))) return;

  const targetPlatform = context.electronPlatformName;
  const targetArch = ARCH_NAMES[context.arch];
  if (!targetArch) {
    // 不认识的架构就整包留着。少几百 MB 好过删光目标架构自己的 .so。
    console.warn(`[afterPack] unknown Arch ordinal ${context.arch}, keeping every onnxruntime binary`);
    return;
  }
  const keptArchitectures = targetArch === 'universal'
    ? new Set(['x64', 'arm64'])
    : new Set([targetArch]);

  for (const platformEntry of await fs.readdir(binariesDir, { withFileTypes: true })) {
    if (!platformEntry.isDirectory()) continue;
    const platformDir = path.join(binariesDir, platformEntry.name);

    if (platformEntry.name !== targetPlatform) {
      await fs.rm(platformDir, { recursive: true, force: true });
      continue;
    }

    for (const archEntry of await fs.readdir(platformDir, { withFileTypes: true })) {
      if (archEntry.isDirectory() && !keptArchitectures.has(archEntry.name)) {
        await fs.rm(path.join(platformDir, archEntry.name), { recursive: true, force: true });
      }
    }
  }

  await warnIfTargetHasNoBinary(binariesDir, targetPlatform, keptArchitectures);
}

/**
 * 目标平台/架构在 onnxruntime-node 里根本没有原生库时，在构建日志里喊一声。
 *
 * 现在就有一例：onnxruntime-node 1.29 的 darwin 只发 arm64，而 build.mac.target 仍然构建 x64，
 * 于是 mac x64 包裁剪后这里是空的。功能上不是回归——原先塞进去的是 arm64 的 .node，Intel
 * Electron 一样 require 不动，worker.cjs 的顶层 catch 会把它降级成渲染层估算器——但沉默地发一个
 * 分析功能失效的包不该靠人去发现。上游哪天再砍掉一个架构，这行会在打包时就说出来。
 */
async function warnIfTargetHasNoBinary(binariesDir, targetPlatform, keptArchitectures) {
  const platformDir = path.join(binariesDir, targetPlatform);
  const present = (await pathExists(platformDir))
    ? (await fs.readdir(platformDir, { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
    : [];

  const missing = [...keptArchitectures].filter(arch => !present.includes(arch));
  if (missing.length === 0) return;

  console.warn(
    `[afterPack] onnxruntime-node ships no binary for ${targetPlatform}/${missing.join(', ')}`
    + ' - beat detection will fall back to the renderer estimators in this package',
  );
}

exports.default = async (context) => {
  await pruneOnnxRuntimeBinaries(context);
  if (context.electronPlatformName === 'darwin') {
    const { verifyBundledKoffi } = await import('../packaging/macos/prepare-koffi.mjs');
    await verifyBundledKoffi({
      resourcesDir: context.packager.getResourcesDir(context.appOutDir),
      arch: ARCH_NAMES[context.arch],
      version: JSON.parse(await fs.readFile(
        path.join(path.dirname(require.resolve('koffi')), 'package.json'), 'utf8',
      )).version,
    });
  }
};
