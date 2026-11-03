import React from 'react';
import { createRoot } from 'react-dom/client';
import { Buffer } from 'buffer';
import i18n from '../i18n/config';
import '../index.css';
import { installGlobalVisualizerFrameRateLimiter } from '../utils/frameRateLimiter';
import { installMineradioSurfaceLifecycle } from './lifecycle';
import LocalErrorBoundary from './local/LocalErrorBoundary';
import { LOCAL_UI_RESOURCES } from './local/locale';

// src/mineradio/local-entry.tsx
// The local player mounts independently of Folia's application bootstrap and services.
Object.assign(globalThis, { Buffer });
for (const [language, resources] of Object.entries(LOCAL_UI_RESOURCES)) {
    i18n.addResourceBundle(language, 'localPlayer', resources, true, true);
}
// Seed the embedded surface from Mineradio's persisted choice before its first render.
let language = 'zh-CN';
try { if (localStorage.getItem('mineradio-ui-language-v1') === 'en') language = 'en'; } catch { /* Storage may be unavailable. */ }
void i18n.changeLanguage(language);
const mount = document.getElementById('root');
if (!mount) throw new Error('Local player mount is missing');
if (new URLSearchParams(location.search).has('videoExport')) {
    // The hidden export document never starts the interactive player or its host lifecycle.
    void import('./local/LocalVideoExportSurface').then(module => module.mountVideoExportSurface(mount)).catch(error => {
        const bridge = (window as Window & { mineradioVideoExport?: { failed: (message: string) => void } }).mineradioVideoExport;
        bridge?.failed(error instanceof Error ? error.message : String(error));
    });
} else {
    installMineradioSurfaceLifecycle();
    installGlobalVisualizerFrameRateLimiter();
    void import('./local/LocalPlayer').then(({ default: LocalPlayer }) => {
        createRoot(mount).render(<React.StrictMode><LocalErrorBoundary surface="player" root><LocalPlayer /></LocalErrorBoundary></React.StrictMode>);
    });
}
