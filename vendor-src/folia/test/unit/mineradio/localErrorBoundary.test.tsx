// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocalErrorBoundary from '@/mineradio/local/LocalErrorBoundary';

// test/unit/mineradio/localErrorBoundary.test.tsx
const diagnostics = vi.hoisted(() => ({ record: vi.fn(), export: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/mineradio/client', () => ({ requestHost: vi.fn() }));
vi.mock('@/mineradio/local/localDiagnostics', () => ({
    recordLocalError: diagnostics.record,
    exportLocalDiagnostics: diagnostics.export,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null;
let container: HTMLDivElement;
beforeEach(() => {
    diagnostics.record.mockClear();
    diagnostics.export.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container.remove();
});

describe('LocalErrorBoundary', () => {
    it('replaces a failed renderer with recovery actions and remounts it on retry', async () => {
        let fail = true;
        const render = () => root!.render(
            <LocalErrorBoundary surface="lyrics:classic">
                {fail ? <BrokenRenderer /> : <span data-testid="renderer">Recovered</span>}
            </LocalErrorBoundary>,
        );
        function BrokenRenderer(): React.ReactNode {
            throw new Error('visualizer failed');
        }
        await act(async () => render());
        expect(container.querySelector('[data-testid="local-recovery"]')).not.toBeNull();
        expect(diagnostics.record).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'visualizer failed' }),
            'lyrics:classic',
            expect.any(String),
        );

        fail = false;
        await act(async () => {
            container.querySelector<HTMLButtonElement>('[data-testid="local-recovery"] button')?.click();
        });
        expect(container.querySelector('[data-testid="local-recovery"]')).toBeNull();
        expect(container.querySelector('[data-testid="renderer"]')?.textContent).toBe('Recovered');
    });

    it('captures an unhandled renderer failure and exports diagnostics on request', async () => {
        await act(async () => root!.render(
            <LocalErrorBoundary surface="records" captureRuntime>
                <span>Record wall</span>
            </LocalErrorBoundary>,
        ));
        await act(async () => {
            window.dispatchEvent(new ErrorEvent('error', {
                message: 'wall runtime failed',
                error: new Error('wall runtime failed'),
            }));
        });
        expect(container.querySelector('[data-testid="local-recovery"]')).not.toBeNull();
        expect(diagnostics.record).toHaveBeenCalledWith(expect.any(Error), 'records');
        await act(async () => {
            container.querySelectorAll<HTMLButtonElement>('[data-testid="local-recovery"] button')[2]?.click();
        });
        expect(diagnostics.export).toHaveBeenCalledOnce();
    });
});
