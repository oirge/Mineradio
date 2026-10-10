import { isLocalCoverWebRuntimeSupported } from './localCoverBinaryStore';
import { migrateLegacyLocalCoverAssetsInBackground } from './localCoverAssetService';
import { isLocalCoverAssetUrl } from './localCoverAssetUrl';

// src/services/localCoverRuntime.ts
// Activates the Web resource route before local-library UI mounts, then starts resumable legacy migration.

export const LOCAL_COVER_SERVICE_WORKER_READY_TIMEOUT_MS = 10_000;

// Bounds startup waiting while preserving the original registration result on success.
export const waitForLocalCoverServiceWorkerReady = async (
  ready: PromiseLike<ServiceWorkerRegistration>,
  timeoutMs = LOCAL_COVER_SERVICE_WORKER_READY_TIMEOUT_MS,
): Promise<ServiceWorkerRegistration> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Local cover service worker readiness timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(ready), timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
};

export const initializeLocalCoverRuntime = async (): Promise<void> => {
  if (isLocalCoverWebRuntimeSupported() && 'serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/folia-cover-sw.js', { scope: '/' });
      await waitForLocalCoverServiceWorkerReady(navigator.serviceWorker.ready);
    } catch (error) {
      console.error('[LocalCoverAsset] Failed to initialize the local cover service worker', error);
    }
  }

  void migrateLegacyLocalCoverAssetsInBackground().then(() => {
    // Retry only covers that failed before their legacy payload reached external storage.
    document.querySelectorAll<HTMLImageElement>('img').forEach(image => {
      const source = image.getAttribute('src');
      if (!isLocalCoverAssetUrl(source) || image.naturalWidth > 0) return;
      image.removeAttribute('src');
      queueMicrotask(() => {
        if (image.isConnected) image.src = source;
      });
    });
  });
};
