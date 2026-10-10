import { expect, test, type Page } from '@playwright/test';
import { installBaseState, localImportFixture, mockNeteaseApi, openApp } from './helpers/appFixtures';

// test/ui/addToPlaylistCommand.spec.ts
// 歌单选择器从 UnifiedPanel 里搬了出来，于是有两条都必须成立：命令能在面板关着的时候
// 把它拉起来，而面板上那颗星仍然照常工作——星星的可用性现在由搬出去的宿主发布，
// 宿主没挂上的话它会安静地消失。

const dialog = (page: Page) => page.getByText('Add to Playlist', { exact: true });

/** 直接写 store：这里验的是选择器的归属，不是本地库的导入流程。 */
const seedLocalSong = (page: Page) => page.evaluate(async () => {
    const storeModulePath = '/src/stores/usePlaybackStore.ts';
    const { usePlaybackStore } = await import(storeModulePath);
    usePlaybackStore.setState({
        currentSong: {
            id: 'local-1',
            name: 'Midnight Train',
            isLocal: true,
            localRef: { songId: 'local-1' },
            artists: [{ id: 1, name: 'Test Artist' }],
        },
    });
});

const openLocalLibrary = async (page: Page) => {
    await installBaseState(page, { neteaseMode: 'guest', localImportFixture });
    await mockNeteaseApi(page, 'guest');
    await openApp(page);
    await page.getByRole('button', { name: 'Folder' }).last().click();
    await page.getByRole('button', { name: 'Import Folder' }).last().click();
    await expect(page.getByText('All Songs').first()).toBeVisible();
    await seedLocalSong(page);
};

test('a shortcut opens the picker with the panel closed', async ({ page }) => {
    await openLocalLibrary(page);
    await page.evaluate(async () => {
        const storeModulePath = '/src/stores/useInteractionSettingsStore.ts';
        const { useInteractionSettingsStore } = await import(storeModulePath);
        useInteractionSettingsStore.setState({
            customShortcutLetter: 'p',
            customShortcutCommandId: 'playback-add-to-playlist',
        });
    });

    await expect.poll(async () => {
        await page.keyboard.press('Alt+p');
        return dialog(page).count();
    }).toBeGreaterThan(0);

    // 没有导航、没有开面板——这正是「全局可用」要保证的。
    const view = await page.evaluate(async () => {
        const storeModulePath = '/src/stores/useAppViewStore.ts';
        const { useAppViewStore } = await import(storeModulePath);
        const state = useAppViewStore.getState();
        return { view: state.view, isPanelOpen: state.isPanelOpen };
    });
    expect(view).toEqual({ view: 'home', isPanelOpen: false });
});

test('the panel star still reaches the same dialog', async ({ page }) => {
    await openLocalLibrary(page);
    // 面板只长在播放页上，所以先过去；切页会重放它自己的恢复流程，所以歌曲在那之后再放。
    await page.getByRole('button', { name: 'Back to Player' }).first().click();
    await page.waitForTimeout(1200);
    await seedLocalSong(page);
    await page.waitForTimeout(400);
    await page.evaluate(async () => {
        const storeModulePath = '/src/stores/useAppViewStore.ts';
        const { useAppViewStore } = await import(storeModulePath);
        useAppViewStore.getState().setPanelTab('cover');
        useAppViewStore.getState().setIsPanelOpen(true);
    });

    // 星星的可用性由搬出去的宿主发布；宿主没挂上的话它根本不会出现。
    // 它只在指针停在封面上时才露出来，所以先悬停。
    const star = page.getByRole('button', { name: 'Add to Playlist' });
    await expect(star).toBeAttached();
    await expect(star).toBeEnabled();
    // 通过 DOM 触发而不是真实指针：这颗星藏在封面的悬停层里，那层的显隐是本次没有改动的
    // 既有 UI。这里要验的是它按下去之后还连着谁。
    await star.evaluate(node => (node as HTMLElement).click());

    await expect(dialog(page)).toBeVisible();
});
