#!/usr/bin/env node
// Build-time fetch of the windowtolayer dependency (Linux desktop wallpaper mode).
//
// Fetches the pinned upstream source, applies the bundled patch, builds the release binary and
// copies it (plus its GPL-3.0 COPYING) into build/ so electron-builder's extraResources packages
// them as resources/windowtolayer. This is the single source of truth shared by local `npm run
// build:electron*` and the CI release workflow, and its output doubles as the dev-path override
// for FOLIA_WINDOWTOLAYER_PATH (see resolveWindowToLayerPath in electron/main.cjs). No-op on
// non-Linux hosts.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC_DIR = path.join(ROOT, '.windowtolayer-src');
const OUT_DIR = path.join(ROOT, 'build');
const OUT_BIN = path.join(OUT_DIR, 'windowtolayer');
const OUT_COPYING = path.join(OUT_DIR, 'windowtolayer-COPYING');
const UPSTREAM_URL = 'https://gitlab.freedesktop.org/mstoeckl/windowtolayer.git';
// Pinned upstream revision; keep in sync with patches/README.md.
const PINNED_REV = '618a482d791e90f4977d643c206417f6aee73936';
// Patches applied on top of PINNED_REV, documented in patches/README.md.
const PATCHES = [
  'windowtolayer-popup-resilience.patch',
  'windowtolayer-single-layer-window.patch',
];

const force = process.argv.includes('--force');

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function succeeds(command, args) {
  try {
    execFileSync(command, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function requireTool(command, hint) {
  try {
    execFileSync(command, ['--version'], { stdio: 'ignore' });
  } catch {
    console.error(`[windowtolayer] missing required tool: ${command}. ${hint}`);
    process.exit(1);
  }
}

if (process.platform !== 'linux') {
  console.log('[windowtolayer] non-Linux host, skipping build');
  process.exit(0);
}

if (existsSync(OUT_BIN) && !force) {
  console.log('[windowtolayer] build/windowtolayer already present, skipping (re-run with --force to rebuild)');
  process.exit(0);
}

requireTool('git', 'Install git to fetch the pinned windowtolayer source.');
requireTool('cargo', 'Install a Rust toolchain to build windowtolayer.');

mkdirSync(OUT_DIR, { recursive: true });

// Rust caches may restore target/ into this workspace without restoring the Git checkout.
// Initialize in place so the cached build artifacts survive and the fetch remains re-runnable.
if (!existsSync(path.join(SRC_DIR, '.git'))) {
  mkdirSync(SRC_DIR, { recursive: true });
  run('git', ['-C', SRC_DIR, 'init']);
}
if (succeeds('git', ['-C', SRC_DIR, 'remote', 'get-url', 'origin'])) {
  run('git', ['-C', SRC_DIR, 'remote', 'set-url', 'origin', UPSTREAM_URL]);
} else {
  run('git', ['-C', SRC_DIR, 'remote', 'add', 'origin', UPSTREAM_URL]);
}
// -f discards any state a previous patch application left behind, so every build starts from
// the exact pinned revision before the patches are applied again.
run('git', ['-C', SRC_DIR, 'fetch', 'origin', PINNED_REV]);
run('git', ['-C', SRC_DIR, 'checkout', '-f', '--detach', PINNED_REV]);
// The source is reset to the pinned revision above, so the unified diffs apply
// deterministically; git apply fails loudly (non-zero exit) if the revision drifts. The
// patches touch different files, so their order does not matter.
for (const patch of PATCHES) {
  run('git', ['-C', SRC_DIR, 'apply', path.join(ROOT, 'packaging', 'linux', 'patches', patch)]);
}
run('cargo', ['build', '--release', '--manifest-path', path.join(SRC_DIR, 'Cargo.toml')]);

copyFileSync(path.join(SRC_DIR, 'target', 'release', 'windowtolayer'), OUT_BIN);
copyFileSync(path.join(SRC_DIR, 'COPYING'), OUT_COPYING);
chmodSync(OUT_BIN, 0o755);
console.log('[windowtolayer] built build/windowtolayer + build/windowtolayer-COPYING');
