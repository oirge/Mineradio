import { expect, test, type Page } from '@playwright/test';
import {
    installBaseState,
    localImportFixture,
    mockNavidromeApi,
    mockNeteaseApi,
    NAVIDROME_SERVER,
    navidromeFixtures,
    openApp,
} from './helpers/appFixtures';
import type { SongResult } from '../../src/types';

// test/ui/libraryRendererSwitch.spec.ts
// 完整应用里的 renderer 切换（开发版浮层）。行为探针已经在假宿主里把两套 UI 的语义对齐了；
// 这里只验证探针覆盖不到的那一层：真实 App 的装配——浮层出现在哪、TUI 经由真实的播放端口把歌
// 交给真实的播放控制器、命令面板的筛选与 --play 在 TUI 上同样生效。

const filterBox = (page: Page) => page.getByTestId('command-palette-filter');
const filterInput = (page: Page) => filterBox(page).getByRole('combobox');
const rendererSwitch = (page: Page) => page.getByTestId('dev-library-renderer-switch');
const tui = (page: Page) => page.locator('[data-library-renderer="tui"]');
const grid = (page: Page) => page.locator('[data-library-renderer="grid"]');

const openAllSongs = async (page: Page) => {
    await installBaseState(page, { neteaseMode: 'guest', localImportFixture });
    await mockNeteaseApi(page, 'guest');
    await openApp(page);

    await page.getByRole('button', { name: 'Folder' }).last().click();
    await page.getByRole('button', { name: 'Import Folder' }).last().click();
    await expect(page.getByText('All Songs').first()).toBeVisible();
    // P3.4 起开发版浮层在首页上也出现（切换的是首页 surface）。
    await expect(rendererSwitch(page)).toHaveCount(1);
    await page.getByRole('heading', { name: 'All Songs' }).first().click();
    await expect(grid(page)).toHaveCount(1);
    await expect(page.getByText('Midnight Train').first()).toBeVisible();
};

/** 导入本地曲库，停在网格首页的本地页签上（还没打开任何集合）。 */
const openLocalHome = async (page: Page) => {
    await installBaseState(page, { neteaseMode: 'guest', localImportFixture });
    await mockNeteaseApi(page, 'guest');
    await openApp(page);

    await page.getByRole('button', { name: 'Folder' }).last().click();
    await page.getByRole('button', { name: 'Import Folder' }).last().click();
    await expect(page.getByText('All Songs').first()).toBeVisible();
};

const switchTo = async (page: Page, renderer: 'grid' | 'tui') => {
    await rendererSwitch(page).locator(`[data-renderer="${renderer}"]`).click();
};

const playbackSnapshot = async (page: Page) => page.evaluate(async () => {
    const storeModulePath = '/src/stores/usePlaybackStore.ts';
    const { usePlaybackStore } = await import(/* @vite-ignore */ storeModulePath);
    const state = usePlaybackStore.getState();
    return { queueLength: state.playQueue.length, currentSongName: state.currentSong?.name ?? null };
});

/** 与网格同一个做法：网格 / 列表的注册比首屏晚一拍，反复敲到筛选框真的出现。 */
const typeUntilFilterOpens = async (page: Page, key: string) => {
    await expect.poll(async () => {
        await page.keyboard.press(key);
        return filterBox(page).count();
    }).toBeGreaterThan(0);
};

test('the DEV switch moves the open collection into the TUI and back', async ({ page }) => {
    await openAllSongs(page);

    await switchTo(page, 'tui');
    await expect(tui(page)).toHaveCount(1);
    await expect(grid(page)).toHaveCount(0);
    await expect(tui(page).locator('[data-tui-title]')).toHaveText('All Songs');
    await expect(tui(page).locator('[data-tui-row="0"]')).toContainText('Midnight Train');
    await expect(tui(page).locator('[data-tui-row="0"]')).toHaveAttribute('aria-selected', 'true');

    await switchTo(page, 'grid');
    await expect(grid(page)).toHaveCount(1);
    await expect(tui(page)).toHaveCount(0);
    await expect(page.getByText('Midnight Train').first()).toBeVisible();
});

test('grid to TUI and back preserves the playing queue and current song identities', async ({ page }) => {
    await installBaseState(page, { neteaseMode: 'logged-in', navidromeEnabled: true });
    await mockNeteaseApi(page, 'logged-in');
    await mockNavidromeApi(page);
    // 服务器歌词由真实 loader 解析；避免这条身份回归走在线自动匹配与外部请求。
    await page.route(`${NAVIDROME_SERVER}/rest/getLyrics?**`, route => route.fulfill({
        json: { 'subsonic-response': { status: 'ok', lyrics: { value: '[00:00.00]Starboard Lights\n[00:04.00]Fixture lyrics' } } },
    }));
    await openApp(page);
    await page.getByRole('button', { name: 'Navi' }).last().click();
    await page.getByRole('tab', { name: 'Playlists' }).click();
    const favoritesCard = page.locator('[data-grid3d-index="1"]');
    await expect(favoritesCard.getByRole('heading', { name: 'Favorites', exact: true })).toBeVisible();
    await favoritesCard.click();
    // 首页卡片先聚焦再打开；等标题与实际卡片位置都提交，再只发出一次打开（与 homeCardPosition 的居中判据一致）。
    await expect(page.locator('[data-grid3d-slider] + div h3')).toHaveText('Favorites');
    await expect.poll(() => favoritesCard.evaluate(card => {
        const viewport = card.closest('[data-grid3d-slider]')!.getBoundingClientRect();
        const bounds = card.getBoundingClientRect();
        return Math.abs(bounds.x + bounds.width / 2 - viewport.x - viewport.width / 2);
    })).toBeLessThan(5);
    await favoritesCard.click();
    await expect(grid(page)).toHaveCount(1);
    await expect(grid(page).getByText('Starboard Lights').first()).toBeVisible();

    await typeUntilFilterOpens(page, 's');
    await filterInput(page).fill('starboard --play');
    await page.keyboard.press('Enter');
    // Navidrome 播放先完成歌词/元数据加载，再一次提交歌曲、队列与播放页导航；不把加载期替换误算作 suite 切换。
    await expect.poll(async () => page.evaluate(async () => {
        const playbackPath = '/src/stores/usePlaybackStore.ts';
        const viewPath = '/src/stores/useAppViewStore.ts';
        const { usePlaybackStore } = await import(/* @vite-ignore */ playbackPath);
        const { useAppViewStore } = await import(/* @vite-ignore */ viewPath);
        const state = usePlaybackStore.getState();
        return state.currentSong?.name === 'Starboard Lights'
            && state.playQueue.length === 1
            && state.lyrics !== null
            && state.audioSrc?.includes('/rest/stream') === true
            && useAppViewStore.getState().view === 'player';
    })).toBe(true);
    await page.goBack();
    await expect(grid(page)).toBeVisible();
    await expect(rendererSwitch(page)).toHaveAttribute('data-placement', 'collection');

    // 引用留在页面内；跨进程序列化队列内容会丢掉身份，无法发现等长的新数组或同内容的新歌曲。
    const playing = await page.evaluateHandle(async () => {
        const playbackPath = '/src/stores/usePlaybackStore.ts';
        const guardsPath = '/src/utils/appPlaybackGuards.ts';
        const { usePlaybackStore } = await import(/* @vite-ignore */ playbackPath);
        const { getPlaybackSongKey } = await import(/* @vite-ignore */ guardsPath);
        const { playQueue, currentSong } = usePlaybackStore.getState();
        const queueIndexOf = (state: { currentSong: SongResult | null; playQueue: SongResult[] }) => state.currentSong
            ? state.playQueue.findIndex(song => getPlaybackSongKey(song) === getPlaybackSongKey(state.currentSong))
            : -1;
        const queueIndex = queueIndexOf(usePlaybackStore.getState());
        return {
            queueIndex,
            read: () => {
                const state = usePlaybackStore.getState();
                return {
                    sameQueue: state.playQueue === playQueue,
                    sameSong: state.currentSong === currentSong,
                    queueIndex: queueIndexOf(state),
                };
            },
        };
    });
    expect(await playing.evaluate(snapshot => snapshot.queueIndex)).toBe(0);
    for (const renderer of ['tui', 'grid'] as const) {
        await switchTo(page, renderer);
        await expect(renderer === 'tui' ? tui(page) : grid(page)).toBeVisible();
        await expect(renderer === 'tui' ? grid(page) : tui(page)).toHaveCount(0);
        expect(await playing.evaluate(snapshot => snapshot.read())).toEqual({ sameQueue: true, sameSong: true, queueIndex: 0 });
    }
    await playing.dispose();
});

// P3.4：首页也是一个 surface。首页上的 DEV 浮层把首页换成 TUI 的目录列表；从那里打开「全部歌曲」进的是 TUI 的
// 集合视图（suite 是 TUI），返回落回 TUI 首页、焦点还在「全部歌曲」那一行，键盘接着能用。
test('on the home the DEV switch brings up the TUI home; All Songs opens the TUI collection and Back keeps the focus', async ({ page }) => {
    await openLocalHome(page);
    const home = page.locator('[data-library-home="tui"]');
    const rows = home.locator('[data-tui-home-row]');
    const focusedRow = home.locator('[data-tui-home-row][aria-selected="true"]');

    await expect(rendererSwitch(page)).toHaveAttribute('data-placement', 'home');
    await switchTo(page, 'tui');
    await expect(home).toHaveCount(1);
    await expect(home.locator('[data-tui-source="local"]')).toHaveAttribute('aria-selected', 'true');
    await expect(rows.first()).toContainText('All Songs');
    expect(await rows.count()).toBeGreaterThan(1);

    // 先把焦点移开再点回「全部歌曲」，确认回来时落的是记住的那一行，而不是默认的第一行碰巧对上。
    await rows.nth(1).click();
    await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
    await rows.first().click();
    await expect(rows.first()).toHaveAttribute('aria-selected', 'true');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Enter');

    await expect(tui(page)).toHaveCount(1);
    await expect(tui(page).locator('[data-tui-title]')).toHaveText('All Songs');
    await expect(tui(page).locator('[data-tui-row="0"]')).toContainText('Midnight Train');
    await expect(rendererSwitch(page)).toHaveAttribute('data-placement', 'collection');

    // 返回点页头的 [← Back]：集合视图顶上让出了桌面版标题栏的拖拽区（h-8），按钮中心处命中的是按钮自己，
    // 而不是盖在窗口最上面的拖拽区（P3.4 时它被盖住，只能用 Esc；Esc 返回由行为探针覆盖）。
    const back = tui(page).locator('[data-tui-back]');
    await expect(back).toBeVisible();
    expect(await back.evaluate(button => {
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return Boolean(hit && button.contains(hit));
    })).toBe(true);
    await back.click();
    await expect(tui(page)).toHaveCount(0);
    await expect(home).toBeVisible();
    await expect(focusedRow).toHaveCount(1);
    await expect(focusedRow).toContainText('All Songs');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
});

test('typing filters the TUI through the command palette, and --play reaches the real player', async ({ page }) => {
    await openAllSongs(page);
    await switchTo(page, 'tui');
    await expect(tui(page)).toHaveCount(1);

    await typeUntilFilterOpens(page, 'm');
    await filterInput(page).fill('midnight --play');
    await expect(tui(page).locator('[data-tui-filter]')).toContainText('midnight');
    await page.keyboard.press('Enter');

    await expect.poll(async () => (await playbackSnapshot(page)).currentSongName).toBe('Midnight Train');
    expect((await playbackSnapshot(page)).queueLength).toBe(1);
});

test('Ctrl+Enter in the TUI plays the whole scope through the real playback port', async ({ page }) => {
    await openAllSongs(page);
    await switchTo(page, 'tui');
    await expect(tui(page).locator('[data-tui-row="0"]')).toHaveAttribute('aria-selected', 'true');

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Control+Enter');

    await expect.poll(async () => (await playbackSnapshot(page)).currentSongName).toBe('Midnight Train');
    expect((await playbackSnapshot(page)).queueLength).toBe(1);
});

// 真实应用里 TUI 的变更：Navidrome 歌单里按 Delete，经真实的变更端口（navidromeApi.updatePlaylist）
// 发出按原始下标的删除，TUI 立即少一行、焦点落到下一行。歌单内容与删除由这里的路由应答（其余端点仍走 mockNavidromeApi）。
test('Delete in the TUI removes a Navidrome playlist entry through the real mutation port', async ({ page }) => {
    await installBaseState(page, { neteaseMode: 'logged-in', navidromeEnabled: true });
    await mockNeteaseApi(page, 'logged-in');
    await mockNavidromeApi(page);
    let entries = ['tui-song-1', 'tui-song-2', 'tui-song-3'];
    const removals: string[][] = [];
    await page.route(`${NAVIDROME_SERVER}/rest/**`, async route => {
        const url = new URL(route.request().url());
        const endpoint = url.pathname.replace('/rest/', '');
        const respond = (body: object) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ 'subsonic-response': { status: 'ok', ...body } }),
        });
        if (endpoint === 'getPlaylist') {
            await respond({
                playlist: {
                    id: 'playlist-main',
                    name: 'Workspace Rotation',
                    owner: navidromeFixtures.config.username,
                    songCount: entries.length,
                    duration: 600,
                    entry: entries.map((id, index) => ({
                        id,
                        isDir: false,
                        title: `TUI Track ${id.slice(-1)}`,
                        album: 'Aurora Echoes',
                        albumId: 'album-aurora',
                        artist: 'Test Ensemble',
                        artistId: 'artist-1',
                        track: index + 1,
                        duration: 200,
                        type: 'music',
                    })),
                },
            });
            return;
        }
        if (endpoint === 'updatePlaylist') {
            const indexes = url.searchParams.getAll('songIndexToRemove');
            removals.push(indexes);
            const removing = new Set(indexes.map(Number));
            entries = entries.filter((_, index) => !removing.has(index));
            await respond({});
            return;
        }
        await route.fallback();
    });
    await openApp(page);

    await page.getByRole('button', { name: 'Navi' }).last().click();
    await page.getByRole('tab', { name: 'Playlists' }).click();
    // 第一下把卡片移到中间（焦点），第二下才打开。
    await expect.poll(async () => {
        await page.getByRole('heading', { name: 'Workspace Rotation' }).first().click();
        return grid(page).count();
    }, { timeout: 15_000 }).toBe(1);
    await switchTo(page, 'tui');
    await expect(tui(page).locator('[data-tui-row]')).toHaveCount(3);
    await expect(tui(page).locator('footer')).toContainText('Del remove');

    const second = tui(page).locator('[data-tui-row="1"]');
    await expect(second).toContainText('TUI Track 2');
    await second.click();
    await expect(second).toHaveAttribute('aria-selected', 'true');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Delete');

    await expect(tui(page).locator('[data-tui-row]')).toHaveCount(2);
    expect(removals).toEqual([['1']]);
    await expect(tui(page).getByText('TUI Track 2')).toHaveCount(0);
    await expect(tui(page).locator('[data-tui-row][aria-selected="true"]')).toContainText('TUI Track 3');
});
