// Copyright (c) 2026 chthollyphile
// src/components/visualizer/lumiere/lumiereSongSwap.ts
// 换歌交接的两帧状态机（同 tempera 的 songSwap）：第一帧在旧歌还在画的时候把新歌当前段落的场景建好
// （stage），第二帧切过去（commit）。切的那一帧不做任何重活；中途被取消（abort）或运行时销毁时立即了结，
// 等交接的 promise 一定会 settle，pixiRuntimeHost 的 drain 循环不会挂住。

export interface LumiereSongSwapHooks<TSong, TStaged> {
    /** 离屏建好新歌的场景；没有可建的返回 null。 */
    stage: (song: TSong) => TStaged | null;
    /** 切到新歌；staged 为 null 时由调用方自己重建。 */
    commit: (song: TSong, staged: TStaged | null) => void;
    /** 销毁一个不会再被采用的 staged。 */
    discard: (staged: TStaged) => void;
}

interface PendingSwap<TSong, TStaged> {
    song: TSong;
    staged: TStaged | null;
    prepared: boolean;
    settle: () => void;
    detachAbort: () => void;
}

export class LumiereSongSwap<TSong, TStaged> {
    private pending: PendingSwap<TSong, TStaged> | null = null;

    constructor(private readonly hooks: LumiereSongSwapHooks<TSong, TStaged>) { }

    get active() {
        return this.pending !== null;
    }

    /** 已经建好、还没切过去的场景（tuning / 尺寸变化时需要一起更新或丢弃）。 */
    get staged() {
        return this.pending?.staged ?? null;
    }

    /** 丢掉已建好的 staged（它是按旧的尺寸 / tuning 建的）；交接照常在下一帧切，切的时候重建。 */
    dropStaged() {
        const pending = this.pending;
        if (!pending?.staged) return;
        this.hooks.discard(pending.staged);
        pending.staged = null;
    }

    /** 开始一次交接，两帧之后 resolve。 */
    begin(song: TSong, signal?: AbortSignal): Promise<void> {
        return new Promise<void>(resolve => {
            const onAbort = () => this.settle(true);
            this.pending = {
                song,
                staged: null,
                prepared: false,
                settle: resolve,
                detachAbort: () => signal?.removeEventListener('abort', onAbort),
            };
            signal?.addEventListener('abort', onAbort, { once: true });
        });
    }

    /** 每帧开头调用：第一帧 stage，第二帧 commit。 */
    advance() {
        const pending = this.pending;
        if (!pending) return;
        if (!pending.prepared) {
            pending.prepared = true;
            pending.staged = this.hooks.stage(pending.song);
            return;
        }
        this.settle(true);
    }

    /** 立即了结：commit 为 false（运行时正在销毁）时只丢弃 staged。 */
    settle(commit: boolean) {
        const pending = this.pending;
        if (!pending) return;
        this.pending = null;
        pending.detachAbort();
        if (commit) this.hooks.commit(pending.song, pending.staged);
        else if (pending.staged) this.hooks.discard(pending.staged);
        pending.settle();
    }
}
