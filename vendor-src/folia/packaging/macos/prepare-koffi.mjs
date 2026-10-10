import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

// packaging/macos/prepare-koffi.mjs
// npm installs optional native packages for the host CPU, while one macOS job packages both CPUs.
// Stage the locked target binary in Koffi's supported resourcesPath fallback instead.

const run = promisify(execFile);
const CPU_TYPES = { x64: 0x01000007, arm64: 0x0100000c };

export function resolveKoffiPackage(lock, arch) {
  if (!CPU_TYPES[arch]) throw new Error(`Unsupported macOS Koffi architecture: ${arch}`);
  const name = `@koromix/koffi-darwin-${arch}`;
  const koffi = lock.packages['node_modules/koffi'];
  const native = lock.packages[`node_modules/${name}`];
  if (!native || native.version !== koffi?.version || !native.integrity || !native.resolved) {
    throw new Error(`Missing matching locked Koffi package: ${name}`);
  }
  return { name, version: native.version, integrity: native.integrity, resolved: native.resolved };
}

export function verifyKoffiBinary(binary, arch) {
  if (!CPU_TYPES[arch] || binary.length < 8 || binary.readUInt32LE(0) !== 0xfeedfacf
      || binary.readUInt32LE(4) !== CPU_TYPES[arch]) {
    throw new Error(`Koffi binary does not match macOS/${arch}`);
  }
}

export function verifyKoffiIntegrity(archive, integrity) {
  const [algorithm, expected] = integrity.split('-');
  const actual = createHash(algorithm).update(archive).digest('base64');
  if (actual !== expected) throw new Error('Koffi integrity mismatch');
}

/** Fetches the exact lockfile package regardless of the build host's CPU, before resource copying. */
export async function prepareBundledKoffi({ arch, projectRoot = process.cwd() }) {
  const lock = JSON.parse(await readFile(path.join(projectRoot, 'package-lock.json'), 'utf8'));
  const target = resolveKoffiPackage(lock, arch);
  const require = createRequire(path.join(projectRoot, 'package.json'));
  const installed = JSON.parse(await readFile(path.join(path.dirname(require.resolve('koffi')), 'package.json'), 'utf8'));
  if (installed.version !== target.version) {
    throw new Error('Installed Koffi does not match package-lock.json; run npm ci');
  }
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'folia-koffi-'));
  try {
    const response = await fetch(target.resolved);
    if (!response.ok) throw new Error(`Unable to download ${target.name}: HTTP ${response.status}`);
    const downloaded = Buffer.from(await response.arrayBuffer());
    verifyKoffiIntegrity(downloaded, target.integrity);
    const archive = path.join(temporary, 'koffi.tgz');
    await writeFile(archive, downloaded);
    const triplet = `darwin_${arch}`;
    await run('tar', ['-xzf', archive, '-C', temporary,
      `package/${triplet}/koffi.node`, 'package/package.json']);
    const metadata = JSON.parse(await readFile(path.join(temporary, 'package/package.json'), 'utf8'));
    if (metadata.name !== target.name || metadata.version !== target.version) {
      throw new Error(`Unexpected Koffi package metadata: ${target.name}`);
    }
    const source = path.join(temporary, 'package', triplet, 'koffi.node');
    verifyKoffiBinary(await readFile(source), arch);
    const output = path.join(projectRoot, 'build', 'koffi', triplet);
    await mkdir(output, { recursive: true });
    await copyFile(source, path.join(output, 'koffi.node'));
    await writeFile(path.join(output, 'package.json'), JSON.stringify(metadata, null, 2) + '\n');
    return output;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

/** Refuses to publish a macOS package with a missing, stale, or wrong-CPU wallpaper bridge. */
export async function verifyBundledKoffi({ resourcesDir, arch, version }) {
  const directory = path.join(resourcesDir, 'koffi', `darwin_${arch}`);
  const metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  if (metadata.name !== `@koromix/koffi-darwin-${arch}` || metadata.version !== version) {
    throw new Error(`Packaged Koffi does not match ${version} for macOS/${arch}`);
  }
  verifyKoffiBinary(await readFile(path.join(directory, 'koffi.node')), arch);
}
