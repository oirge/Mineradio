import React, { useEffect, useState, useSyncExternalStore } from 'react';
import type { GridSurfaceState } from '../../../src/types/gridCommandSurface';
import { useCollectionNavigationStore } from '../../../src/stores/useCollectionNavigationStore';
import { useAppViewStore } from '../../../src/stores/useAppViewStore';
import { useGridSurfaceStore } from '../../../src/stores/useGridSurfaceStore';
import type { LibraryProbeHarness } from './useLibraryProbeHarness';
import { clearProbeCalls, clearProbeRequests, getProbeLog, subscribeProbeLog } from './probeLog';

// dev/probes/libraryBehavior/ProbeControlPanel.tsx
// 探针左侧的手动点检面板：打开 fixture、改筛选、跑 surface 动作，并实时看请求与回调两本账。
// 用例不点这里（走 window.__libraryProbe），面板只给人用。

const SANDBOX_ONLY = new Set(['local-playlist', 'local-album', 'navi-album', 'navi-playlist']);

// surface 的 getState 每次都是新读，不会通知；面板低频轮询即可。
const useSurfaceSnapshot = (): GridSurfaceState | null => {
    const [snapshot, setSnapshot] = useState<GridSurfaceState | null>(null);
    useEffect(() => {
        const timer = window.setInterval(() => {
            setSnapshot(useGridSurfaceStore.getState().gridSurface?.getState() ?? null);
        }, 300);
        return () => window.clearInterval(timer);
    }, []);
    return snapshot;
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-4">
        <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{title}</h3>
        {children}
    </section>
);

export const ProbeControlPanel: React.FC<{ harness: LibraryProbeHarness }> = ({ harness }) => {
    const log = useSyncExternalStore(subscribeProbeLog, getProbeLog);
    const stack = useCollectionNavigationStore(state => state.snapshot)?.stack ?? [];
    const commandFilter = useAppViewStore(state => state.commandFilter);
    const surface = useSurfaceSnapshot();
    const [query, setQuery] = useState('');

    return (
        <aside
            data-probe-panel
            className="absolute inset-y-0 left-0 w-[300px] overflow-y-auto border-r border-white/10 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-200"
        >
            <h2 className="mb-1 text-sm font-bold">Library behavior probe</h2>
            <p className="mb-3 text-zinc-500">
                {harness.sandbox
                    ? 'sandbox: 本地曲库与 Navidrome 配置写进本源存储'
                    : '非沙盒：只用内存数据。加 &sandbox 可开全部 fixture（会写本源 IndexedDB）'}
                {' · '}{harness.ready ? 'ready' : 'seeding…'}
            </p>

            <Section title="Fixtures">
                <div className="flex flex-wrap gap-1">
                    {harness.fixtures.map(id => (
                        <button
                            key={id}
                            type="button"
                            data-probe-open={id}
                            disabled={!harness.ready || (SANDBOX_ONLY.has(id) && !harness.sandbox)}
                            onClick={() => harness.open(id)}
                            className="rounded border border-white/15 px-1.5 py-0.5 hover:bg-white/10 disabled:opacity-30"
                        >
                            {id}
                        </button>
                    ))}
                </div>
                <button type="button" onClick={harness.back} className="mt-2 rounded bg-white/10 px-2 py-0.5 hover:bg-white/20">
                    ← back (history)
                </button>
            </Section>

            <Section title={`Stack (${stack.length})`}>
                <ol className="list-decimal pl-4">{stack.map((item, index) => <li key={`${index}-${item.name}`}>{item.name}</li>)}</ol>
            </Section>

            <Section title="Filter">
                <form
                    className="flex gap-1"
                    onSubmit={event => {
                        event.preventDefault();
                        commandFilter?.setQuery(query);
                    }}
                >
                    <input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        disabled={!commandFilter}
                        className="min-w-0 flex-1 rounded border border-white/15 bg-transparent px-1.5 py-0.5"
                        placeholder={commandFilter ? 'query' : 'no filter owner'}
                    />
                    <button type="submit" disabled={!commandFilter} className="rounded bg-white/10 px-2 disabled:opacity-30">set</button>
                </form>
                <div className="mt-1 text-zinc-500">current: {JSON.stringify(commandFilter?.getQuery() ?? null)}</div>
            </Section>

            <Section title="Surface">
                {surface ? (
                    <>
                        <div>tracks in scope: {surface.filteredTrackCount} · filter {String(surface.isFilterActive)}</div>
                        <div>sort: {surface.sortField} {surface.sortDirection} · edit {String(surface.isEditMode)}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                            {surface.availableActions.map(action => (
                                <button
                                    key={action}
                                    type="button"
                                    onClick={() => useGridSurfaceStore.getState().gridSurface?.run(action)}
                                    className="rounded border border-sky-400/30 px-1.5 py-0.5 text-sky-300 hover:bg-sky-400/10"
                                >
                                    {action}
                                </button>
                            ))}
                        </div>
                    </>
                ) : <div className="text-zinc-500">no surface registered</div>}
            </Section>

            <Section title={`Calls (${log.calls.length})`}>
                <button type="button" onClick={clearProbeCalls} className="mb-1 text-zinc-500 hover:text-zinc-200">clear</button>
                <ul className="space-y-0.5">
                    {log.calls.slice(-15).reverse().map(call => (
                        <li key={call.seq} className="break-all">
                            <span className="text-amber-300">{call.kind}</span> {call.ids.slice(0, 3).join(', ')}
                            {call.ids.length > 3 ? ` …+${call.ids.length - 3}` : ''}
                            {call.queueIds ? ` · queue ${call.queueIds.length}` : ''}
                            {call.text ? ` · ${call.text}` : ''}
                        </li>
                    ))}
                </ul>
            </Section>

            <Section title={`Requests (${log.requests.length})`}>
                <button type="button" onClick={clearProbeRequests} className="mb-1 text-zinc-500 hover:text-zinc-200">clear</button>
                <ul className="space-y-0.5">
                    {log.requests.slice(-25).reverse().map(request => (
                        <li key={request.seq} className={request.outcome === 'error' ? 'text-red-400' : ''}>
                            {request.op} {request.target}
                            {request.offset !== undefined ? ` @${request.offset}+${request.limit ?? ''}` : ''}
                            {request.ids ? ` [${request.ids.join(',')}]` : ''}
                        </li>
                    ))}
                </ul>
            </Section>
        </aside>
    );
};
