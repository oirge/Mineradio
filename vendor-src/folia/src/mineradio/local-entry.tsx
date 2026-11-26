import { Buffer } from 'buffer';
import '../index.css';
import { installGlobalVisualizerFrameRateLimiter } from '../utils/frameRateLimiter';
import { installMineradioSurfaceLifecycle, waitForMineradioHost } from './lifecycle';

// src/mineradio/local-entry.tsx
// The local player mounts independently of Folia's application bootstrap and services.
Object.assign(globalThis, { Buffer });
const mount = document.getElementById('root');
if (!mount) throw new Error('Local player mount is missing');
if (new URLSearchParams(location.search).has('videoExport')) {
    // The hidden export document never starts the interactive player or its host lifecycle.
    // Its native capture controls the FPS; the interactive player's saved RAF cap must not limit exports.
    void import('./local/LocalVideoExportSurface').then(module => module.mountVideoExportSurface(mount)).catch(error => {
        const bridge = (window as Window & { mineradioVideoExport?: { failed: (message: string) => void } }).mineradioVideoExport;
        bridge?.failed(error instanceof Error ? error.message : String(error));
    });
} else {
    installMineradioSurfaceLifecycle();
    installGlobalVisualizerFrameRateLimiter();
    void Promise.all([import('./local-mount'), waitForMineradioHost()]).then(([{ mountLocalPlayer }]) => {
        mountLocalPlayer(mount);
    });
}
