import { describeCoverUrl, type CoverProvider } from '../../utils/coverUrl';

// src/services/debug/coverSizeSamples.ts
// What the cover CDNs actually return, as opposed to what the app asked them for.
//
// The sizing ladder in `coverUrl.ts` assumes a provider honours the size in the URL. Nothing in the
// app would notice if one quietly ignored it and served a 3000px original for every request - the
// pictures would still look right, and the only symptom would be the cost the ladder exists to
// avoid, still being paid. This records both halves so the two can be compared on real traffic.
//
// Bounded twice, like the memory feed: a fixed number of URLs is tracked, and only one row per URL.
// Recording is a filter on resource timing entries, which is cheap enough to leave installed; the
// dimensions of the delivered image cost an <img> each, so those are resolved only while something
// is actually watching.

/** One cover URL the page fetched, and what came back. */
export interface CoverSizeSample {
    url: string;
    provider: CoverProvider;
    /** Size the URL asked for, null when it carries none and the provider answers with its original. */
    requested: number | null;
    /** Dimensions the provider actually returned, or null until they have been resolved. */
    delivered: { width: number; height: number } | null;
    /** Set once the dimensions have been asked for, so a URL that fails is not retried forever. */
    probed: boolean;
    /** Wall time of the fetch. Cross-origin responses expose this even when they hide byte counts. */
    durationMs: number;
    at: number;
}

// A browsing session goes through covers quickly and the interesting question is about the tail,
// so the cap is well past what one screen produces. A row is a URL string and five small fields;
// the probing below is what costs, and that is bounded separately.
export const MAX_TRACKED_URLS = 2000;
/** Concurrent dimension probes. These are memory-cache hits, but a cold one is a real request. */
const PROBE_CONCURRENCY = 8;
/** Publish part-way through a pass, so a large backlog fills the table in instead of blocking it. */
const PUBLISH_EVERY = 24;

const samples = new Map<string, CoverSizeSample>();
const listeners = new Set<() => void>();
let snapshot: readonly CoverSizeSample[] = [];
let stale = false;
let resolving = false;
let installed = false;

/**
 * Marks the snapshot for rebuilding, and rebuilds it only if anyone is watching.
 *
 * Copying the map is O(n) and recording happens per cover, so a session with the panel closed would
 * otherwise spend O(n^2) building arrays nobody reads. `useSyncExternalStore` needs the reference to
 * stay stable between changes, which the flag preserves: the array is rebuilt once, on the first
 * read after a change.
 */
const invalidate = () => {
    stale = true;
    if (listeners.size === 0) return;
    snapshot = [...samples.values()];
    stale = false;
    listeners.forEach(listener => listener());
};

export const getCoverSizeSamples = (): readonly CoverSizeSample[] => {
    if (stale) {
        snapshot = [...samples.values()];
        stale = false;
    }
    return snapshot;
};

export const subscribeToCoverSizeSamples = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

export const clearCoverSizeSamples = () => {
    samples.clear();
    invalidate();
};

const record = (url: string, initiatorType: string, durationMs: number) => {
    if (samples.has(url)) return;
    // Only what the page loaded as a picture. Without this a dev session records a row per module
    // it imports, which is hundreds of URLs that are not covers and cannot be probed for size.
    if (initiatorType !== 'img' && initiatorType !== 'css') return;
    const description = describeCoverUrl(url);
    if (!description) return;

    samples.set(url, {
        url,
        provider: description.provider,
        requested: description.requestedSize,
        delivered: null,
        probed: false,
        durationMs,
        at: Date.now(),
    });
    while (samples.size > MAX_TRACKED_URLS) {
        const oldest = samples.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        samples.delete(oldest);
    }
    invalidate();
};

/**
 * Fills in the dimensions of everything still unresolved.
 *
 * Every URL here has already been fetched by the page, so each <img> is a memory-cache hit rather
 * than a second request. The element is dropped as soon as its header has been read; `decode()` is
 * deliberately not called, since the numbers wanted are in the header and a decode would allocate a
 * bitmap the audit has no use for.
 */
export const resolveCoverSizeSamples = async (): Promise<void> => {
    if (resolving || typeof Image === 'undefined') return;
    const pending = [...samples.values()].filter(sample => !sample.probed);
    if (pending.length === 0) return;

    resolving = true;
    let done = 0;
    const queue = [...pending];
    const probe = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
            const sample = next;
            const delivered = await new Promise<{ width: number; height: number } | null>(resolve => {
                const image = new Image();
                image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
                image.onerror = () => resolve(null);
                image.src = sample.url;
            });
            const current = samples.get(sample.url);
            if (!current) continue;
            // Marked probed either way: a URL that will not decode - a redirect to an error page,
            // an asset since evicted - would otherwise be retried on every refresh, forever.
            samples.set(sample.url, {
                ...current,
                probed: true,
                delivered: delivered && delivered.width > 0 ? delivered : null,
            });
            done += 1;
            if (done % PUBLISH_EVERY === 0) invalidate();
        }
    };

    try {
        await Promise.all(Array.from({ length: Math.min(PROBE_CONCURRENCY, queue.length) }, probe));
        invalidate();
    } finally {
        resolving = false;
    }
};

/**
 * Starts watching resource timing for cover requests. Covers reach the page as CSS backgrounds and
 * as <img>, and both surface here; `getEntriesByType` would not do, because a dev session fills the
 * 250-entry resource buffer with module requests long before the first cover.
 */
export const installCoverSizeAudit = () => {
    if (installed || typeof PerformanceObserver === 'undefined') return;
    installed = true;

    try {
        new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
                record(entry.name, (entry as PerformanceResourceTiming).initiatorType ?? '', entry.duration);
            }
        }).observe({ type: 'resource', buffered: true });
    } catch {
        // Resource timing is absent in some embedded webviews; the audit is optional everywhere.
        installed = false;
    }
};
