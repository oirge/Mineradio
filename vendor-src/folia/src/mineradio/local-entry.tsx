import React from 'react';
import { createRoot } from 'react-dom/client';
import { Buffer } from 'buffer';
import i18n from '../i18n/config';
import '../index.css';
import { installGlobalVisualizerFrameRateLimiter } from '../utils/frameRateLimiter';
import { installMineradioSurfaceLifecycle } from './lifecycle';
import LocalPlayer from './local/LocalPlayer';
import { LOCAL_UI_RESOURCES } from './local/locale';

// src/mineradio/local-entry.tsx
// The local player mounts independently of Folia's application bootstrap and services.
Object.assign(globalThis, { Buffer });
for (const [language, resources] of Object.entries(LOCAL_UI_RESOURCES)) {
    i18n.addResourceBundle(language, 'localPlayer', resources, true, true);
}
installMineradioSurfaceLifecycle();
installGlobalVisualizerFrameRateLimiter();
const mount = document.getElementById('root');
if (!mount) throw new Error('Local player mount is missing');
createRoot(mount).render(<React.StrictMode><LocalPlayer /></React.StrictMode>);
