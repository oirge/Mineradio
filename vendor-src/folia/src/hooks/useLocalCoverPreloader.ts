import { useEffect, useMemo } from 'react';
import { isLocalCoverAssetUrl } from '../services/localCoverAssetUrl';
import { getSizedCoverUrl } from '../utils/coverUrl';

// src/hooks/useLocalCoverPreloader.ts
// Warms viewport-near stable local-cover responses without retaining full-resolution decoded bitmaps.

const PRELOAD_CONCURRENCY = 2;
const NEIGHBOR_INDEX_RADIUS = 12;
const INITIAL_INDEX_COUNT = 24;
const MAX_PRELOADED_URLS = 256;
const PRELOAD_TIMEOUT_MS = 15_000;
const preloadedUrls = new Map<string, true>();
const pendingUrls = new Map<string, Promise<void>>();

const rememberPreloadedUrl = (url: string): void => {
  preloadedUrls.delete(url);
  preloadedUrls.set(url, true);
  while (preloadedUrls.size > MAX_PRELOADED_URLS) {
    const oldest = preloadedUrls.keys().next().value as string | undefined;
    if (!oldest) break;
    preloadedUrls.delete(oldest);
  }
};

const hasPreloadedUrl = (url: string): boolean => {
  if (!preloadedUrls.has(url)) return false;
  rememberPreloadedUrl(url);
  return true;
};

// Consumes the response as a stream so only compressed chunks, not a full decoded bitmap, are resident.
const preloadImageBytes = (url: string): Promise<void> => {
  const pending = pendingUrls.get(url);
  if (pending) return pending;
  const request = (async () => {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), PRELOAD_TIMEOUT_MS);
    try {
      const response = await fetch(url, { cache: 'force-cache', signal: controller.signal });
      if (!response.ok) throw new Error(`Local cover preload failed with ${response.status}`);
      if (!response.body) return;
      const reader = response.body.getReader();
      try {
        while (!(await reader.read()).done) {
          // Streaming consumption warms the browser cache without collecting the complete payload.
        }
      } finally {
        reader.releaseLock();
      }
      rememberPreloadedUrl(url);
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  })().catch(() => undefined).finally(() => {
    pendingUrls.delete(url);
  });
  pendingUrls.set(url, request);
  return request;
};

export const useLocalCoverPreloader = (
  coverCount: number,
  getCoverUrl: (index: number) => string | undefined,
  renderedIndexes: number[],
): void => {
  const candidates = useMemo(() => {
    const indexes = new Set<number>();
    if (renderedIndexes.length === 0) {
      for (let index = 0; index < Math.min(INITIAL_INDEX_COUNT, coverCount); index += 1) indexes.add(index);
    } else {
      renderedIndexes.forEach(index => {
        const start = Math.max(0, index - NEIGHBOR_INDEX_RADIUS);
        const end = Math.min(coverCount - 1, index + NEIGHBOR_INDEX_RADIUS);
        for (let candidate = start; candidate <= end; candidate += 1) indexes.add(candidate);
      });
    }
    return Array.from(indexes)
      .sort((left, right) => left - right)
      .map(index => getSizedCoverUrl(getCoverUrl(index), 512))
      .filter(isLocalCoverAssetUrl);
  }, [coverCount, getCoverUrl, renderedIndexes]);

  useEffect(() => {
    if (typeof fetch === 'undefined') return;
    let cancelled = false;
    const queue = candidates.filter(url => !hasPreloadedUrl(url));
    const workers = Array.from({ length: Math.min(PRELOAD_CONCURRENCY, queue.length) }, async () => {
      while (!cancelled) {
        const url = queue.shift();
        if (!url) return;
        await preloadImageBytes(url);
      }
    });
    void Promise.all(workers);
    return () => {
      cancelled = true;
    };
  }, [candidates]);
};
