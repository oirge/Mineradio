// dev/probes/libraryBehavior/probeGates.ts
// 可以按住的应答：用例先 hold，再在想要的时机 release，让「请求已发出、结果还没回来」这段窗口可控
// （例如删除的退出动画期间才送达的后台分页、迟迟不来的曲库刷新）。没有 hold 时 wait() 立即完成。

export type ProbeGate = {
    hold: () => void;
    release: () => void;
    isHeld: () => boolean;
    /** hold 期间挂起，release 时一起放行。 */
    wait: () => Promise<void>;
};

export const createProbeGate = (): ProbeGate => {
    let held: { promise: Promise<void>; resolve: () => void } | null = null;
    return {
        hold: () => {
            if (held) return;
            let resolve!: () => void;
            const promise = new Promise<void>(next => { resolve = next; });
            held = { promise, resolve };
        },
        release: () => {
            const current = held;
            held = null;
            current?.resolve();
        },
        isHeld: () => held !== null,
        wait: () => held?.promise ?? Promise.resolve(),
    };
};

/** 宿主的两种刷新：本地曲库（歌单、歌曲）与账户（歌单列表，在线集合据此换新版本）。 */
export type ProbeRefreshKind = 'refreshLocalSongs' | 'refreshUser';

const refreshGates: Record<ProbeRefreshKind, ProbeGate> = {
    refreshLocalSongs: createProbeGate(),
    refreshUser: createProbeGate(),
};

export const probeRefreshGate = (kind: ProbeRefreshKind): ProbeGate => refreshGates[kind];

/** 探针挂载时调用：上一次用例留下的 hold 一律放行。 */
export const releaseAllProbeRefreshGates = (): void => {
    Object.values(refreshGates).forEach(gate => gate.release());
};
