// Copyright (c) 2026 chthollyphile
// src/components/visualizer/pixiSongSwap.ts
// 换歌交接的两帧状态机（tempera、lumiere 共用）：第一帧在旧歌还在画的时候把新歌当前段落的场景建好
// （stage），第二帧切过去（commit）。切的那一帧不做任何重活；中途被取消（abort）或运行时销毁时立即了结，
// 等交接的 promise 一定会 settle，pixiRuntimeHost 的 drain 循环不会挂住。

export interface PixiSongSwapHooks<TSong, TStaged> {
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
    /** Set once the build has been attempted, even when it produced nothing. */
    prepared: boolean;
    settle: () => void;
    /** Drops the abort listener, so a long skip session cannot pile them up on one signal. */
    detachAbort: () => void;
}

export class PixiSongSwap<TSong, TStaged> {
    private pending: PendingSwap<TSong, TStaged> | null = null;

    constructor(private readonly hooks: PixiSongSwapHooks<TSong, TStaged>) { }

    get active() {
        return this.pending !== null;
    }

    /** 正在交接的新歌（还没切过去）。 */
    get song() {
        return this.pending?.song ?? null;
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

    /**
     * 每帧开头调用：第一帧 stage，第二帧 commit。
     *
     * One frame of the handover. First frame builds the incoming scene while the outgoing song
     * still holds the picture; second frame cuts to it. Nothing is drawn over the change - the
     * point is that the cut costs no work, not that it is hidden.
     */
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

    /**
     * 立即了结：commit 为 false（运行时正在销毁）时只丢弃 staged。
     *
     * Finishes an in-flight handover immediately, committing whatever it was still holding.
     */
    settle(commit: boolean) {
        const pending = this.pending;
        if (!pending) return;
        this.pending = null;
        pending.detachAbort();
        if (commit) this.hooks.commit(pending.song, pending.staged);
        // Never adopted, so nothing else will ever free it.
        else if (pending.staged) this.hooks.discard(pending.staged);
        pending.settle();
    }
}
