// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { HostState } from '../../../src/mineradio/client';
import LocalPlaybackSettings from '../../../src/mineradio/local/LocalPlaybackSettings';

// test/unit/mineradio/localPlaybackSettings.test.ts
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
it('keeps the latest native checkbox edit visible through older replies and restores failed edits', async () => {
    const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const original = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);
    const pending: Array<{ resolve: (value: unknown) => void; reject: (error: Error) => void }> = [];
    const command = vi.fn(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
    const state = { playbackRate: 1, replayGain: { enabled: false, mode: 'track', preampDb: 0, clipGuard: true },
        sleepTimer: { mode: 'off', dueAt: 0, fading: false }, gapless: { enabled: true, crossfadeSeconds: 0 } } as HostState;
    try {
        await act(async () => root.render(createElement(LocalPlaybackSettings, { state, command, onClose: () => {} })));
        const input = container.querySelector<HTMLInputElement>('[data-testid="local-replaygain-enabled"]')!;
        act(() => input.click()); expect(input.checked).toBe(true);
        act(() => input.click()); expect(input.checked).toBe(false);
        await act(async () => pending[0].resolve({ ...state, replayGain: { ...state.replayGain, enabled: true } }));
        expect(input.checked).toBe(false);
        await act(async () => pending[1].resolve(state));
        act(() => input.click()); expect(input.checked).toBe(true);
        await act(async () => pending[2].reject(new Error('Host unavailable')));
        expect(input.checked).toBe(false);
        expect(command.mock.calls).toHaveLength(3);
    } finally { await act(async () => root.unmount()); environment.IS_REACT_ACT_ENVIRONMENT = original; }
});
