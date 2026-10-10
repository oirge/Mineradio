import { describe, expect, it, vi } from 'vitest';
import * as pixi from 'pixi.js';
import {
    destroyPixiContainerChildren,
    destroyPixiDisplayTree,
    unloadPixiDisplayTree,
} from '@/components/visualizer/pixiDisplayResources';
import { SonnetPixiRuntime } from '@/components/visualizer/sonnet/createSonnetPixiRuntime';
import { TemperaPixiRuntime } from '@/components/visualizer/tempera/createTemperaPixiRuntime';

// test/unit/visualizer/pixiGpuRelease.test.ts
// 场景 / 画框 / 片尾卡被丢掉时，Graphics 自建的 GraphicsContext 要当场销毁，不能留给 Pixi 的 GC（空闲 60 秒才收）。
// 起因：destroy({ children: true }) 把同一份选项传给子节点，Pixi 8 的 Graphics.destroy 收到选项对象却没写 context: true
// 时不销毁自建的 context；大号 context 各自挂着一个 batcher 和两块 WebGL 缓冲，商籁 / 凝彩 8 倍速下存活缓冲涨到上千。
// 而 context: true 会把构造时传进来的共享 context 也销毁，所以只能按归属放。

const drawn = () => new pixi.Graphics().moveTo(0, 0).lineTo(40, 40).stroke({ width: 2, color: 0xffffff });

/** 一棵有自建 context、共享 context 与精灵的树，返回要检查的几样东西。 */
const buildTree = () => {
    const shared = new pixi.GraphicsContext().rect(0, 0, 10, 10).fill({ color: 0xffffff });
    const owned = drawn();
    const deep = drawn();
    const sharer = new pixi.Graphics(shared);
    const texture = new pixi.Texture();
    const sprite = new pixi.Sprite(texture);
    const root = new pixi.Container();
    const branch = new pixi.Container();
    const leafHolder = new pixi.Container();
    leafHolder.addChild(deep);
    branch.addChild(sharer, leafHolder, sprite);
    root.addChild(owned, branch);
    return { root, branch, shared, owned, deep, sharer, texture, sprite, ownedContexts: [owned.context, deep.context] };
};

describe('共用的 Pixi 显示树释放', () => {
    it('destroyPixiDisplayTree：自建的 context 随树销毁，共享的 context 与纹理不动', () => {
        const tree = buildTree();
        destroyPixiDisplayTree(tree.root);
        expect(tree.ownedContexts.every(context => context.destroyed)).toBe(true);
        expect(tree.shared.destroyed).toBe(false);
        expect(tree.texture.destroyed).toBe(false);
        expect([tree.root, tree.branch, tree.owned, tree.deep, tree.sharer, tree.sprite].every(node => node.destroyed)).toBe(true);
    });

    it('destroyPixiContainerChildren：摘下来的子树同样按归属销毁 context，容器本身保留', () => {
        const tree = buildTree();
        const holder = new pixi.Container();
        holder.addChild(tree.root);
        destroyPixiContainerChildren(holder);
        expect(holder.destroyed).toBe(false);
        expect(holder.children).toHaveLength(0);
        expect(tree.ownedContexts.every(context => context.destroyed)).toBe(true);
        expect(tree.shared.destroyed).toBe(false);
    });

    it('unloadPixiDisplayTree：藏起来的树连 Graphics 的 context 一起 unload，几何指令保留', () => {
        const tree = buildTree();
        const unloads = [...tree.ownedContexts, tree.shared].map(context => vi.spyOn(context, 'unload'));
        unloadPixiDisplayTree(tree.root);
        unloads.forEach(unload => expect(unload).toHaveBeenCalledOnce());
        // 只放 GPU 数据：指令还在，再画到时 Pixi 按指令重建、重传。
        expect(tree.ownedContexts.every(context => !context.destroyed && context.instructions.length > 0)).toBe(true);
        destroyPixiDisplayTree(tree.root);
    });
});

describe('商籁 / 凝彩运行时丢场景时放掉 Graphics 的 context', () => {
    it('商籁 destroyScene', () => {
        const tree = buildTree();
        const sceneContainer = new pixi.Container();
        sceneContainer.addChild(tree.root);
        const runtime = Object.assign(Object.create(SonnetPixiRuntime.prototype), { sceneContainer, outroBlurScene: null });
        const scene = { container: tree.root, shots: [{ haloLayer: tree.branch }], postProcessFilters: [] };
        (runtime as unknown as { destroyScene: (value: unknown) => void }).destroyScene(scene);
        expect(sceneContainer.children).toHaveLength(0);
        expect(tree.ownedContexts.every(context => context.destroyed)).toBe(true);
        expect(tree.shared.destroyed).toBe(false);
    });

    it('凝彩 destroyScene', () => {
        const tree = buildTree();
        const sceneContainer = new pixi.Container();
        sceneContainer.addChild(tree.root);
        const runtime = Object.assign(Object.create(TemperaPixiRuntime.prototype), { sceneContainer });
        const scene = { container: tree.root, shots: [{ textLayer: tree.branch }], postProcessFilters: [] };
        (runtime as unknown as { destroyScene: (value: unknown) => void }).destroyScene(scene);
        expect(sceneContainer.children).toHaveLength(0);
        expect(tree.ownedContexts.every(context => context.destroyed)).toBe(true);
        expect(tree.shared.destroyed).toBe(false);
    });

    it('凝彩重画画框：上一版的角标与擦除块的 context 一起销毁', () => {
        const overlayContainer = new pixi.Container();
        const runtime = Object.assign(Object.create(TemperaPixiRuntime.prototype), {
            pixi,
            overlayContainer,
            options: { tuning: { showCornerMarks: true }, theme: { primaryColor: '#ff8800' } },
        }) as unknown as { drawOverlay: (width: number, height: number) => void };
        runtime.drawOverlay(1600, 900);
        const first = (overlayContainer.children as pixi.Graphics[]).map(graphics => graphics.context);
        expect(first).toHaveLength(2);
        runtime.drawOverlay(1600, 900);
        expect(first.every(context => context.destroyed)).toBe(true);
        expect(overlayContainer.children).toHaveLength(2);
    });
});
