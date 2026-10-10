// src/services/audioEffects/effectBranchRelease.ts
// Shared contract and deferred-release helper for the optional effect branches.

export type AudioEffectBranch = {
    set: (amount: number) => void;
    dispose: () => void;
};

const RELEASE_DELAY_MS = 800;

// Wraps deferred teardown so a branch turned back on before its fade completes keeps its nodes.
export const createReleaseTimer = () => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return {
        cancel: () => {
            if (timer === null) return;
            clearTimeout(timer);
            timer = null;
        },
        schedule: (release: () => void) => {
            if (timer !== null) return;
            timer = setTimeout(() => {
                timer = null;
                release();
            }, RELEASE_DELAY_MS);
        },
    };
};
