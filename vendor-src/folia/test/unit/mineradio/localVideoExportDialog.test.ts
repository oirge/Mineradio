// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { HostState } from '../../../src/mineradio/client';
import LocalVideoExport from '../../../src/mineradio/local/LocalVideoExport';
import type { LocalVideoExportState } from '../../../src/mineradio/local/localVideoExportData';
import { VIDEO_EXPORT_OPTIONS_KEY } from '../../../src/mineradio/local/localVideoExportData';

const host = vi.hoisted(() => ({ listener: null as ((state: unknown) => void) | null, unsubscribe: vi.fn(), t: (key: string) => key }));
vi.mock('../../../src/mineradio/client', () => ({ subscribeHost: (_name: string, callback: (state: unknown) => void) => {
    host.listener = callback; return host.unsubscribe;
} }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: host.t }) }));
vi.mock('../../../src/mineradio/local/LocalToolPanel', () => ({ default: ({ children }: { children: React.ReactNode }) => React.createElement('section', null, children) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let mount: HTMLDivElement, root: Root;
const idle: LocalVideoExportState = { supported: true, status: 'idle', progress: 0, elapsed: 0 };
const song = { currentTrack: { id: 'song-a' } } as HostState;
beforeEach(() => { host.unsubscribe.mockClear(); mount = document.createElement('div'); document.body.append(mount); root = createRoot(mount); });
afterEach(async () => { await act(async () => root.unmount()); mount.remove(); host.listener = null; localStorage.clear(); });
function control<T extends Element>(id: string) { return mount.querySelector<T>(`[data-testid="${id}"]`)!; }
it('starts with continue recording, sends the selected portrait/start/transition settings, and prevents duplicate requests', async () => {
    let resolveStart!: (value: LocalVideoExportState) => void;
    const command = vi.fn((method: string) => method === 'getVideoExportState' ? Promise.resolve(idle) : new Promise<LocalVideoExportState>(resolve => { resolveStart = resolve; }));
    await act(async () => root.render(React.createElement(LocalVideoExport, { state: song, command, onClose: vi.fn() })));
    const transition = control<HTMLSelectElement>('local-video-transition');
    expect(transition.value).toBe('continue');
    await act(async () => {
        const size = control<HTMLSelectElement>('local-video-resolution'); size.value = '3'; size.dispatchEvent(new Event('change', { bubbles: true }));
        const start = control<HTMLSelectElement>('local-video-start-mode'); start.value = 'current'; start.dispatchEvent(new Event('change', { bubbles: true }));
        transition.value = 'save'; transition.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => { control<HTMLButtonElement>('local-video-start').click(); control<HTMLButtonElement>('local-video-start').click(); });
    expect(command).toHaveBeenCalledTimes(2);
    expect(command).toHaveBeenLastCalledWith('startVideoExport', expect.objectContaining({ width: 1080, height: 1920, startMode: 'current', transitionBehavior: 'save', visuals: expect.objectContaining({ view: 'lyrics' }) }));
    await act(async () => resolveStart({ ...idle, status: 'recording', transitionBehavior: 'save' }));
    expect(control<HTMLButtonElement>('local-video-stop').disabled).toBe(false);
    expect(control<HTMLSelectElement>('local-video-transition').disabled || control<HTMLSelectElement>('local-video-transition').closest('fieldset')!.disabled).toBe(true);
});
it('keeps newer host progress when a stale initial response arrives and detaches without cancelling the recording', async () => {
    let resolveState!: (state: LocalVideoExportState) => void;
    const command = vi.fn(() => new Promise<LocalVideoExportState>(resolve => { resolveState = resolve; }));
    await act(async () => root.render(React.createElement(LocalVideoExport, { state: song, command, onClose: vi.fn() })));
    await act(async () => host.listener?.({ ...idle, status: 'paused', elapsed: 25, progress: .25, transitionBehavior: 'save' }));
    await act(async () => resolveState(idle));
    expect(control('local-video-status').getAttribute('data-status')).toBe('paused');
    expect(control<HTMLSelectElement>('local-video-transition').value).toBe('save');
    expect(control('local-video-transition-hint').textContent).toBe('videoTransitionHint_save');
    await act(async () => root.render(null));
    expect(host.unsubscribe).toHaveBeenCalled();
    expect(command).toHaveBeenCalledTimes(1);
});
it('permits stopping a reopened recording when no current track is displayed and offers retry after a host error', async () => {
    const command = vi.fn((method: string) => Promise.resolve(method === 'getVideoExportState'
        ? { ...idle, status: 'recording', elapsed: 4 } : { ...idle, status: 'error', error: 'Disk full' }));
    await act(async () => root.render(React.createElement(LocalVideoExport, { state: null, command, onClose: vi.fn() })));
    await act(async () => control<HTMLButtonElement>('local-video-stop').click());
    expect(command).toHaveBeenLastCalledWith('stopVideoExport', undefined);
    expect(control('local-video-error').textContent).toBe('Disk full');
    expect(control<HTMLButtonElement>('local-video-start').disabled).toBe(true);
});
it('can cancel during preparation without a late start response reviving the job', async () => {
    let resolveStart!: (state: LocalVideoExportState) => void;
    const command = vi.fn((method: string) => method === 'getVideoExportState' ? Promise.resolve(idle)
        : method === 'cancelVideoExport' ? Promise.resolve({ ...idle, status: 'cancelled' })
        : new Promise<LocalVideoExportState>(resolve => { resolveStart = resolve; }));
    await act(async () => root.render(React.createElement(LocalVideoExport, { state: song, command, onClose: vi.fn() })));
    await act(async () => control<HTMLButtonElement>('local-video-start').click());
    await act(async () => host.listener?.({ ...idle, status: 'preparing' }));
    expect(control<HTMLButtonElement>('local-video-cancel').disabled).toBe(false);
    await act(async () => control<HTMLButtonElement>('local-video-cancel').click());
    expect(control('local-video-status').getAttribute('data-status')).toBe('cancelled');
    await act(async () => resolveStart({ ...idle, status: 'recording' }));
    expect(control('local-video-status').getAttribute('data-status')).toBe('cancelled');
});
it('remembers the selected transition behavior after the dialog is closed and reopened', async () => {
    const command = vi.fn(async () => idle);
    const render = () => root.render(React.createElement(LocalVideoExport, { state: song, command, onClose: vi.fn() }));
    await act(async () => render());
    await act(async () => { const select = control<HTMLSelectElement>('local-video-transition'); select.value = 'save'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(localStorage.getItem(VIDEO_EXPORT_OPTIONS_KEY)).toBe('{"transitionBehavior":"save"}');
    await act(async () => root.render(null)); await act(async () => render());
    expect(control<HTMLSelectElement>('local-video-transition').value).toBe('save');
    expect(control('local-video-transition-hint').textContent).toBe('videoTransitionHint_save');
});
