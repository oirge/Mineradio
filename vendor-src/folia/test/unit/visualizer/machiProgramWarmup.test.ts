import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { compileInto, waitForPrograms, yieldToMain } from '../../../src/components/visualizer/machi/engine/programWarmup';

// test/unit/visualizer/machiProgramWarmup.test.ts
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const rendererWithPrograms = (programs: { isReady: () => boolean }[]) => ({ info: { programs } }) as unknown as THREE.WebGLRenderer;

describe('Machi asynchronous program warmup', () => {
    it('polls without rendering and includes programs added during compilation', async () => {
        let ready = false;
        const first = { isReady: vi.fn(() => ready) };
        const programs: { isReady: () => boolean }[] = [first];
        const promise = waitForPrograms(rendererWithPrograms(programs));
        expect(first.isReady).toHaveBeenCalledTimes(1);
        ready = true;
        let secondReady = false;
        programs.push({ isReady: () => secondReady });
        await vi.advanceTimersByTimeAsync(12);
        expect(vi.getTimerCount()).toBe(1);
        secondReady = true;
        await vi.advanceTimersByTimeAsync(12);
        await promise;
        expect(vi.getTimerCount()).toBe(0);
    });

    it('cancels a pending initialization without leaving a polling loop', async () => {
        const controller = new AbortController();
        const program = { isReady: vi.fn(() => false) };
        const promise = waitForPrograms(rendererWithPrograms([program]), controller.signal);
        const rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
        controller.abort();
        await vi.advanceTimersByTimeAsync(12);
        await rejected;
        expect(program.isReady).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('rejects an already cancelled initialization before touching GPU programs', async () => {
        const controller = new AbortController();
        controller.abort();
        const program = { isReady: vi.fn(() => false) };
        await expect(waitForPrograms(rendererWithPrograms([program]), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(program.isReady).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('has a bounded fallback when a driver never completes its programs', async () => {
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const promise = waitForPrograms(rendererWithPrograms([{ isReady: () => false }]));
        await vi.advanceTimersByTimeAsync(8016);
        await promise;
        expect(warning).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('yields through the browser scheduler or a zero-delay task', async () => {
        const browserYield = vi.fn(() => Promise.resolve());
        vi.stubGlobal('scheduler', { yield: browserYield });
        await yieldToMain();
        expect(browserYield).toHaveBeenCalledTimes(1);
        vi.stubGlobal('scheduler', undefined);
        const promise = yieldToMain();
        expect(vi.getTimerCount()).toBe(1);
        await vi.runAllTimersAsync();
        await promise;
    });
});

describe('Machi render-target-specific compilation', () => {
    it('restores the previous target even when compilation throws', () => {
        const original = new THREE.WebGLRenderTarget(1, 1);
        const target = new THREE.WebGLRenderTarget(2, 2);
        let current: THREE.WebGLRenderTarget | null = original;
        const renderer = {
            getRenderTarget: () => current,
            setRenderTarget: (next: THREE.WebGLRenderTarget | null) => { current = next; },
            compile: vi.fn(() => {
                expect(current).toBe(target);
                throw new Error('compile failed');
            }),
        } as unknown as THREE.WebGLRenderer;
        expect(() => compileInto(renderer, target, new THREE.Scene(), new THREE.Camera(), new THREE.Scene())).toThrow('compile failed');
        expect(current).toBe(original);
        original.dispose();
        target.dispose();
    });

    it('compiles only selected objects without changing the scene hierarchy', () => {
        const root = new THREE.Scene(), camera = new THREE.Camera();
        const selected = new THREE.Object3D(), excluded = new THREE.Object3D();
        root.add(selected, excluded);
        const compiled: THREE.Object3D[] = [];
        const renderer = {
            getRenderTarget: () => null,
            setRenderTarget: vi.fn(),
            compile: (subject: THREE.Object3D) => subject.traverse(object => compiled.push(object)),
        } as unknown as THREE.WebGLRenderer;
        compileInto(renderer, null, root, camera, root, object => object === selected);
        expect(compiled).toEqual([selected]);
        expect(root.children).toEqual([selected, excluded]);
    });
});
