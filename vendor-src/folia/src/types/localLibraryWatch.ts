// src/types/localLibraryWatch.ts
// Shared contracts for local-library folder watching, which runs on FileSystemObserver against the
// same directory handles the import flow already holds. Desktop gets it through Electron's
// Chromium; browsers get it wherever FileSystemObserver has shipped.

/** One change the observer reported, reduced to what the rescan decision needs. */
export interface LocalLibraryChangeRecordLike {
    type: string;
    relativePathComponents?: readonly string[];
}

/**
 * The slice of FileSystemObserver this feature uses.
 *
 * Declared here rather than relied on from the DOM lib: the API is new enough that the shipped lib
 * may not describe it, and a hand-written `declare class` would clash the moment it does.
 */
export interface FileSystemObserverLike {
    observe(handle: FileSystemHandle, options?: { recursive?: boolean; }): Promise<void>;
    disconnect(): void;
}

export type FileSystemObserverConstructor = new (
    callback: (records: LocalLibraryChangeRecordLike[], observer: FileSystemObserverLike) => void,
) => FileSystemObserverLike;

/** Why a root the renderer knows about is not being observed. Rendered as a per-folder hint. */
export type LocalLibraryWatchSkipReason = 'permission' | 'unsupported' | 'error';

export interface LocalLibraryAutoScanRootState {
    rootFolderName: string;
    watching: boolean;
    /** False when the platform refused a recursive observation and only the root itself is watched. */
    recursive: boolean;
    skipReason: LocalLibraryWatchSkipReason | null;
    /** Set when observing failed or the observer reported an `errored` record; null while healthy. */
    error: string | null;
}

export interface LocalLibraryAutoScanState {
    /** False wherever FileSystemObserver has not shipped. */
    supported: boolean;
    enabled: boolean;
    /** True while a change-triggered incremental rescan is running. */
    scanning: boolean;
    /** True while observers are being attached to the imported roots. */
    attaching: boolean;
    roots: LocalLibraryAutoScanRootState[];
    lastScanAt: number | null;
    /** Which root the last auto rescan covered, for the settings hint line. */
    lastScanRootFolderName: string | null;
    lastError: string | null;
}
