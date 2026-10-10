import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForLocalCoverServiceWorkerReady } from '../../../src/services/localCoverRuntime';

// test/unit/services/localCoverRuntime.test.ts
// Verifies local-cover startup cannot wait indefinitely for service worker readiness.

describe('local cover runtime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the ready registration before the timeout', async () => {
    vi.useFakeTimers();
    const registration = {} as ServiceWorkerRegistration;

    await expect(waitForLocalCoverServiceWorkerReady(Promise.resolve(registration), 50))
      .resolves.toBe(registration);
  });

  it('rejects with a timeout error when readiness never settles', async () => {
    vi.useFakeTimers();
    const waiting = waitForLocalCoverServiceWorkerReady(
      new Promise<ServiceWorkerRegistration>(() => undefined),
      50,
    );
    const assertion = expect(waiting).rejects.toThrow(
      'Local cover service worker readiness timed out after 50ms.',
    );

    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });
});
