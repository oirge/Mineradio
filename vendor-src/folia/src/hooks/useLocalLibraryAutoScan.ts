import { useEffect, useSyncExternalStore } from 'react';
import {
    getLocalLibraryAutoScanState,
    startLocalLibraryAutoScan,
    stopLocalLibraryAutoScan,
    subscribeLocalLibraryAutoScan,
} from '../services/localLibraryAutoScan';
import type { LocalLibraryAutoScanState } from '../types/localLibraryWatch';

// src/hooks/useLocalLibraryAutoScan.ts
// Mounts the local-library folder watcher for the app's lifetime, and exposes its state to the
// settings panel. The runtime itself is reference counted, so both hooks are safe under StrictMode.

/** Call once, from the app root. */
export const useLocalLibraryAutoScan = (): void => {
    useEffect(() => {
        startLocalLibraryAutoScan();
        return () => stopLocalLibraryAutoScan();
    }, []);
};

export const useLocalLibraryAutoScanState = (): LocalLibraryAutoScanState => (
    useSyncExternalStore(subscribeLocalLibraryAutoScan, getLocalLibraryAutoScanState, getLocalLibraryAutoScanState)
);
