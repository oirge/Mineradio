// src/services/localLibraryAvailability.ts
import { isMineradioEmbedded } from '../mineradio/client';
// Centralizes the secure-context requirement for browser local-library access.

export interface LocalLibraryAvailability {
  supported: boolean;
  reason: 'insecure-http' | 'file-system-api-unavailable' | null;
}

export const getLocalLibraryAvailability = (): LocalLibraryAvailability => {
  if (isMineradioEmbedded()) return { supported: true, reason: null };
  if (typeof window === 'undefined') return { supported: false, reason: 'file-system-api-unavailable' };
  if (window.electron) return { supported: true, reason: null };
  const currentLocation = window.location;
  if (!currentLocation) return { supported: false, reason: 'file-system-api-unavailable' };
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(currentLocation.hostname);
  if (!(currentLocation.protocol === 'https:' || isLocalhost) || !window.isSecureContext) {
    return { supported: false, reason: 'insecure-http' };
  }
  if (!('showDirectoryPicker' in window) || typeof navigator.storage?.getDirectory !== 'function') {
    return { supported: false, reason: 'file-system-api-unavailable' };
  }
  return { supported: true, reason: null };
};
