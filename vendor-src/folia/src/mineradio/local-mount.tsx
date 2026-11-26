import React from 'react';
import { createRoot } from 'react-dom/client';
import './local-i18n';
import LocalErrorBoundary from './local/LocalErrorBoundary';
import LocalPlayer from './local/LocalPlayer';

// src/mineradio/local-mount.tsx
// Interactive root, loaded after the embedded surface installs its RAF lifecycle.
export function mountLocalPlayer(mount: HTMLElement): void {
    createRoot(mount).render(<React.StrictMode><LocalErrorBoundary surface="player" root><LocalPlayer /></LocalErrorBoundary></React.StrictMode>);
}
