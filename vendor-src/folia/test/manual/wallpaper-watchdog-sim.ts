import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// test/manual/wallpaper-watchdog-sim.ts
// Standalone simulation of watchdog trigger point 2 ("wtl 崩溃后自动回退普通窗口"), runnable
// without Electron or a Wayland compositor:
//
//   1. A fake "windowtolayer" (a long-lived `sleep`) is spawned; its pid is handed to the wrapped
//      stand-in (wallpaper-watchdog-child.cjs), which wires the real watchdog module with stubs.
//   2. The stand-in starts the parent liveness probe against that fake wtl pid.
//   3. The fake wtl is SIGKILLed — the stand-in is reparented, its captured parentPid is dead.
//   4. The probe recovers: the stand-in reports a plain relaunch (with the correct env rules) and
//      exits, which this script asserts.
//
// Expected status sequence: `started` → `relaunch-spawned ... FOLIA_RELAUNCH=1 WAYLAND_SOCKET= WRAPPED=` → `exit 0`.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statusFile = path.join(os.tmpdir(), `folia-watchdog-sim-${process.pid}.log`);

const readStatus = () => {
  try {
    return fs.readFileSync(statusFile, 'utf8');
  } catch {
    return '';
  }
};

const waitFor = (predicate: (status: string) => boolean, timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const poll = () => {
      if (predicate(readStatus())) {
        return resolve(true);
      }
      if (Date.now() >= deadline) {
        return resolve(false);
      }
      setTimeout(poll, 50);
    };
    poll();
  });
};

const finish = (passed: boolean) => {
  console.log(`[sim] status file: ${statusFile}`);
  console.log(readStatus());
  if (passed) {
    console.log('[sim] PASS');
    process.exit(0);
  }
  console.error('[sim] FAIL');
  process.exit(1);
};

const run = async () => {
  const fakeWtl = spawn('sleep', ['60']);
  const fakeWtlPid = fakeWtl.pid;
  console.log(`[sim] fake windowtolayer pid=${fakeWtlPid}`);

  const standIn = spawn(process.execPath, [path.join(__dirname, 'wallpaper-watchdog-child.cjs')], {
    env: {
      ...process.env,
      WATCHDOG_SIM_STATUS: statusFile,
      WATCHDOG_SIM_PARENT_PID: String(fakeWtlPid),
    },
    stdio: 'inherit',
  });

  const cleanup = () => {
    try { fakeWtl.kill('SIGKILL'); } catch { /* already dead */ }
    try { standIn.kill('SIGKILL'); } catch { /* already exited */ }
  };

  try {
    const started = await waitFor((status) => status.includes('started'), 5000);
    if (!started) {
      console.error('[sim] FAIL: wrapped stand-in never started');
      cleanup();
      return finish(false);
    }

    console.log('[sim] stand-in started, killing fake windowtolayer...');
    fakeWtl.kill('SIGKILL');

    const recovered = await waitFor(
      (status) =>
        status.includes('relaunch-spawned') &&
        status.includes('FOLIA_RELAUNCH=1') &&
        status.includes('WAYLAND_SOCKET= ') &&
        status.includes('WRAPPED='),
      5000,
    );
    const exited = await waitFor((status) => status.includes('exit 0'), 5000);

    cleanup();
    return finish(recovered && exited);
  } catch (error) {
    cleanup();
    console.error('[sim] unexpected error', error);
    return finish(false);
  }
};

run().catch((error) => {
  console.error('[sim] unexpected error', error);
  process.exit(1);
});
