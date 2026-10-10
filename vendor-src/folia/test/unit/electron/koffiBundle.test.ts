import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveKoffiPackage, verifyBundledKoffi, verifyKoffiBinary, verifyKoffiIntegrity } from '../../../packaging/macos/prepare-koffi.mjs';

// test/unit/electron/koffiBundle.test.ts
// Cross-architecture macOS builds must fail before publishing a missing or incompatible bridge.

const binaryFor = (cpu: number) => {
  const binary = Buffer.alloc(8);
  binary.writeUInt32LE(0xfeedfacf, 0);
  binary.writeUInt32LE(cpu, 4);
  return binary;
};
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('macOS Koffi packaging', () => {
  it.each(['x64', 'arm64'])('selects the locked %s package independently of the host CPU', async arch => {
    const lock = JSON.parse(await readFile(path.resolve('package-lock.json'), 'utf8'));
    expect(resolveKoffiPackage(lock, arch)).toMatchObject({
      name: `@koromix/koffi-darwin-${arch}`,
      version: lock.packages['node_modules/koffi'].version,
    });
  });

  it('refuses a missing, mismatched, or unsupported target', () => {
    const packages = { 'node_modules/koffi': { version: '3.3.1' } };
    expect(() => resolveKoffiPackage({ packages }, 'x64')).toThrow('Missing matching locked');
    expect(() => resolveKoffiPackage({ packages }, 'universal')).toThrow('Unsupported');
    expect(() => resolveKoffiPackage({ packages: {
      ...packages,
      'node_modules/@koromix/koffi-darwin-x64': { version: '3.2.0', integrity: 'sha512-test', resolved: 'https://registry.npmjs.org/test.tgz' },
    } }, 'x64')).toThrow('Missing matching locked');
  });

  it('rejects an arm64 binary in an Intel package, a truncated file, and non-Mach-O data', () => {
    expect(() => verifyKoffiBinary(binaryFor(0x01000007), 'x64')).not.toThrow();
    expect(() => verifyKoffiBinary(binaryFor(0x0100000c), 'arm64')).not.toThrow();
    expect(() => verifyKoffiBinary(binaryFor(0x0100000c), 'x64')).toThrow('does not match');
    expect(() => verifyKoffiBinary(Buffer.alloc(4), 'x64')).toThrow('does not match');
    expect(() => verifyKoffiBinary(Buffer.alloc(8), 'arm64')).toThrow('does not match');
  });

  it('rejects a download that differs from the lockfile integrity', () => {
    const archive = Buffer.from('locked package');
    const integrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`;
    expect(() => verifyKoffiIntegrity(archive, integrity)).not.toThrow();
    expect(() => verifyKoffiIntegrity(Buffer.from('corrupt package'), integrity)).toThrow('integrity mismatch');
  });

  it('checks the copied resource and its version, not merely the staging directory', async () => {
    const resourcesDir = await mkdtemp(path.join(os.tmpdir(), 'folia-koffi-test-'));
    directories.push(resourcesDir);
    const context = { resourcesDir, arch: 'x64', version: '3.3.1' };
    await expect(verifyBundledKoffi(context)).rejects.toThrow();
    const directory = path.join(resourcesDir, 'koffi/darwin_x64');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: '@koromix/koffi-darwin-x64', version: '3.3.1' }));
    await writeFile(path.join(directory, 'koffi.node'), binaryFor(0x0100000c));
    await expect(verifyBundledKoffi(context)).rejects.toThrow('does not match');
    await writeFile(path.join(directory, 'koffi.node'), binaryFor(0x01000007));
    await expect(verifyBundledKoffi(context)).resolves.toBeUndefined();
    await expect(verifyBundledKoffi({ ...context, version: '3.3.2' })).rejects.toThrow('does not match');
  });
});
