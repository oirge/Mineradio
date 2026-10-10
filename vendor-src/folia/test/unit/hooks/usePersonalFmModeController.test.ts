import { beforeEach, describe, expect, it, vi } from 'vitest';

// test/unit/hooks/usePersonalFmModeController.test.ts
// 和 useOnlineProviderQrLogin.test.ts 同样的做法：仓库的 vitest 跑在 node 环境，没有 jsdom 也没有
// testing-library，为一个 hook 引进整套渲染依赖并不值得。被测 hook 只用到 useCallback / useMemo，
// 就地复刻这两个即可驱动真实实现。

vi.mock('react', () => ({
    useCallback: (callback: unknown) => callback,
    useMemo: (factory: () => unknown) => factory(),
}));

const omniMock = vi.hoisted(() => ({
    getPersonalFm: vi.fn(),
    getProviderCapabilities: vi.fn(() => ({ personalFmModes: true })),
}));
vi.mock('../../../src/services/onlineMusic/omni', () => ({ omni: omniMock }));

const storeMock = vi.hoisted(() => ({
    selection: { mode: 'DEFAULT', scene: null } as { mode: string; scene: string | null },
    setSelection: vi.fn(),
}));
vi.mock('../../../src/stores/usePersonalFmModeStore', () => ({
    usePersonalFmModeStore: (selector: (state: typeof storeMock) => unknown) => selector(storeMock),
}));
vi.mock('../../../src/stores/useOnlineProviderAccountStore', () => ({
    useOnlineProviderAccountStore: (selector: (state: { activeProviderId: string }) => unknown) => (
        selector({ activeProviderId: 'netease' })
    ),
}));

const { usePersonalFmModeController } = await import('../../../src/hooks/usePersonalFmModeController');
const { useStatusMessageStore } = await import('../../../src/stores/useStatusMessageStore');

const SONGS = [
    { id: 1, name: 'First' },
    { id: 2, name: 'Second' },
] as never[];

const CURRENT_SONG = { id: 99, name: 'On air' } as never;

const createController = (overrides: { isFmMode?: boolean; currentSong?: unknown } = {}) => {
    const playSong = vi.fn();
    const controller = usePersonalFmModeController({
        isFmMode: overrides.isFmMode ?? true,
        currentSong: (overrides.currentSong === undefined ? CURRENT_SONG : overrides.currentSong) as never,
        playSong,
        t: (_key: string, fallback?: string) => fallback ?? '',
    });
    return { controller, playSong };
};

beforeEach(() => {
    useStatusMessageStore.setState({ message: null });
    storeMock.selection = { mode: 'DEFAULT', scene: null };
    storeMock.setSelection.mockReset();
    storeMock.setSelection.mockImplementation((selection: typeof storeMock.selection) => selection);
    omniMock.getPersonalFm.mockReset();
    omniMock.getPersonalFm.mockResolvedValue(SONGS);
});

describe('usePersonalFmModeController', () => {
    it('jumps straight to the first track of the new mode', async () => {
        const { controller, playSong } = createController();

        await controller.setPersonalFmSelection({ mode: 'SCENE_RCMD', scene: 'SLEEP_HELP' });

        expect(omniMock.getPersonalFm).toHaveBeenCalledWith({ mode: 'SCENE_RCMD', submode: 'SLEEP_HELP' });
        expect(playSong).toHaveBeenCalledWith(SONGS[0], SONGS, true);
    });

    it('only records the mode when Personal FM is not on air', async () => {
        const { controller, playSong } = createController({ isFmMode: false });

        await controller.setPersonalFmSelection({ mode: 'EXPLORE', scene: null });

        expect(storeMock.setSelection).toHaveBeenCalledWith({ mode: 'EXPLORE', scene: null });
        expect(omniMock.getPersonalFm).not.toHaveBeenCalled();
        expect(playSong).not.toHaveBeenCalled();
    });

    it('does not refetch when the same mode is picked again', async () => {
        storeMock.selection = { mode: 'EXPLORE', scene: null };
        const { controller, playSong } = createController();

        await controller.setPersonalFmSelection({ mode: 'EXPLORE', scene: null });

        expect(omniMock.getPersonalFm).not.toHaveBeenCalled();
        expect(playSong).not.toHaveBeenCalled();
    });

    it('keeps the current track when the new mode returns nothing', async () => {
        omniMock.getPersonalFm.mockResolvedValue([]);
        const { controller, playSong } = createController();

        await controller.setPersonalFmSelection({ mode: 'FAMILIAR', scene: null });

        expect(playSong).not.toHaveBeenCalled();
        expect(useStatusMessageStore.getState().message).toMatchObject({ type: 'error' });
    });

    it('hides itself when the active provider has no FM modes', () => {
        omniMock.getProviderCapabilities.mockReturnValueOnce({ personalFmModes: false });
        const { controller } = createController();
        expect(controller.isPersonalFmModeSupported).toBe(false);
    });
});
