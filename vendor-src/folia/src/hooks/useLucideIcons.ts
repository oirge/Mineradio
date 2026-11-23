import { useEffect, useSyncExternalStore } from 'react';
import {
    getLucideIconRevision,
    loadLucideIcons,
    subscribeLucideIcons,
} from '../services/lucideIconResolver';

// src/hooks/useLucideIcons.ts
// Loads a theme's lucide icons on demand and re-renders the caller as they arrive.

/**
 * Starts loading `names` and returns a revision that changes whenever an icon finishes loading.
 * Render with resolveLucideIcon / getLucideIconStatus, and take the revision as a dependency of
 * anything memoized over them.
 */
export const useLucideIcons = (names: readonly string[] | undefined): number => {
    // Theme lists are often rebuilt per render; key the load on their content instead.
    const signature = names?.join('\n') ?? '';

    useEffect(() => {
        if (signature) {
            void loadLucideIcons(signature.split('\n'));
        }
    }, [signature]);

    return useSyncExternalStore(subscribeLucideIcons, getLucideIconRevision, getLucideIconRevision);
};

export default useLucideIcons;
