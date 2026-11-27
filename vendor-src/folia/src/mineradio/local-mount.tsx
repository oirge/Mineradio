import React from 'react';
import { createRoot } from 'react-dom/client';
import { localI18nReady } from './local-i18n';
import LocalErrorBoundary from './local/LocalErrorBoundary';
import LocalPlayer from './local/LocalPlayer';
import { prepareInitialLocalStage } from './local/LocalVisualStage';

// src/mineradio/local-mount.tsx
// Interactive root, loaded after the embedded surface installs its RAF lifecycle.
// On an import failure, the normal lazy view reports the error through the player boundary.
const initialStage = prepareInitialLocalStage()?.catch(() => undefined);

export async function mountLocalPlayer(mount: HTMLElement): Promise<void> {
    const [, stage] = await Promise.all([localI18nReady, initialStage]);
    createRoot(mount).render(<React.StrictMode><LocalErrorBoundary surface="player" root><LocalPlayer initialStage={stage} /></LocalErrorBoundary></React.StrictMode>);
}
