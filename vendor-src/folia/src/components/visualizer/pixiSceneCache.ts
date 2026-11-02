// Copyright (c) 2026 chthollyphile
// src/components/visualizer/pixiSceneCache.ts
// 段落场景缓存（sonnet、tempera、lumiere 共用）：按段落下标缓存当前段 ±1 的场景，换歌时整批换下（retire），
// 换下的场景由调用方在空闲帧一帧销毁一个。缓存只管存取与销毁；哪一帧建什么、按什么优先级预建邻段，
// 仍由各运行时自己的 renderFrame 决定。

export interface PixiSceneCacheHooks<TScene> {
    /** 当前歌的段落数，ensure 越界时不建。 */
    count: () => number;
    /** 按当前歌建一个段落场景并挂到场景层上。 */
    build: (index: number) => TScene;
    /** 销毁一个场景（含从场景层摘下）。 */
    destroy: (scene: TScene) => void;
    /** 只从场景层摘下、暂不销毁；retireAll 用。 */
    detach?: (scene: TScene) => void;
}

export class PixiSceneCache<TScene> {
    private readonly scenes = new Map<number, TScene>();
    /**
     * Scenes the song handover replaced, waiting to be freed. Destroying a scene walks every
     * shot and every glyph's Text, and doing that for the whole cache on the frame the swap
     * lands is exactly the stall the wipe was supposed to hide. They are dropped one per frame
     * once the sweep is over instead.
     *
     * 换歌时换下来的场景，之后一帧销毁一个，免得交接那一帧卡住。
     */
    private readonly retired: TScene[] = [];

    constructor(private readonly hooks: PixiSceneCacheHooks<TScene>) { }

    get size() {
        return this.scenes.size;
    }

    /** 还有等着销毁的换下场景。 */
    get hasRetired() {
        return this.retired.length > 0;
    }

    has(index: number) {
        return this.scenes.has(index);
    }

    get(index: number) {
        return this.scenes.get(index);
    }

    forEach(callback: (scene: TScene, index: number) => void) {
        this.scenes.forEach(callback);
    }

    /** 取缓存里的场景，没有就建；越界返回 null。 */
    ensure(index: number) {
        if (index < 0 || index >= this.hooks.count()) return null;
        const cached = this.scenes.get(index);
        if (cached) return cached;
        const scene = this.hooks.build(index);
        this.scenes.set(index, scene);
        return scene;
    }

    /** 收下一个在缓存外建好的场景（换歌交接的 staged）。 */
    adopt(index: number, scene: TScene) {
        this.scenes.set(index, scene);
    }

    /** 销毁离 index 超过一段、且不在 keep 里的场景。 */
    prune(index: number, keep?: ReadonlySet<number>) {
        this.scenes.forEach((scene, sceneIndex) => {
            if (Math.abs(sceneIndex - index) <= 1 || keep?.has(sceneIndex)) return;
            this.hooks.destroy(scene);
            this.scenes.delete(sceneIndex);
        });
    }

    /** 立即销毁全部缓存场景（不含已换下的）。 */
    clear() {
        this.scenes.forEach(scene => this.hooks.destroy(scene));
        this.scenes.clear();
    }

    /** 整批换下：摘离场景层但不销毁，留给 drainRetired 一帧一个地释放。 */
    retireAll() {
        this.scenes.forEach(scene => {
            this.hooks.detach?.(scene);
            this.retired.push(scene);
        });
        this.scenes.clear();
    }

    /**
     * 销毁一个换下的场景；没有可销毁的返回 false。
     *
     * Frees one retired scene. Called on frames that are not doing anything else expensive.
     */
    drainRetired() {
        const scene = this.retired.shift();
        if (scene === undefined) return false;
        // Already detached by retireScenes; destroyScene's removeChild is a no-op here.
        this.hooks.destroy(scene);
        return true;
    }

    /** 运行时销毁：缓存与换下的场景全部释放。 */
    destroyAll() {
        this.clear();
        this.retired.forEach(scene => this.hooks.destroy(scene));
        this.retired.length = 0;
    }
}
