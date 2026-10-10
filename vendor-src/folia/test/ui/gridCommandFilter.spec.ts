import { expect, test, type Page } from '@playwright/test';
import { installBaseState, localImportFixture, mockNeteaseApi, openApp } from './helpers/appFixtures';

// test/ui/gridCommandFilter.spec.ts
// 首页网格的「打字即筛选」现在由命令面板承担：网格只注册自己读键入，面板负责画框、
// 收字符、写回去。这条链路横跨 store 注册、inline 呈现和 portal 定位，单测覆盖不到接缝。

const filterBox = (page: Page) => page.getByTestId('command-palette-filter');
const filterInput = (page: Page) => filterBox(page).getByRole('combobox');
const trackCard = (page: Page) => page.getByText('Midnight Train');

/** 导入固件库，再打开其中一个合集——网格视图是在这一层才出现的。 */
const openTrackGrid = async (page: Page) => {
    await installBaseState(page, { neteaseMode: 'guest', localImportFixture });
    await mockNeteaseApi(page, 'guest');
    await openApp(page);

    await page.getByRole('button', { name: 'Folder' }).last().click();
    await page.getByRole('button', { name: 'Import Folder' }).last().click();
    await expect(page.getByText('All Songs').first()).toBeVisible();
    await page.getByRole('heading', { name: 'All Songs' }).first().click();
    await expect(trackCard(page).first()).toBeVisible();
};

/**
 * 网格的注册和面板的键盘监听都比首屏晚装上一拍，定长 sleep 只是赌它们已经就位。
 * 反复敲直到框真的出现——多敲进去的字符随后被 fill 覆盖。
 */
const typeUntilFilterOpens = async (page: Page, key: string) => {
    await expect.poll(async () => {
        await page.keyboard.press(key);
        return filterBox(page).count();
    }).toBeGreaterThan(0);
};

test('a printable character opens the palette as the grid filter box', async ({ page }) => {
    await openTrackGrid(page);

    await typeUntilFilterOpens(page, 'm');

    await expect(filterInput(page)).toBeFocused();
    // 触发的那一下是被刻意丢掉的：把它补进输入框，会在同一次按键正在启动的输入法
    // 组合前面塞一个多余的拉丁字符。网格自己的框当年就是为此吞掉第一个键的。
    await expect(filterInput(page)).toHaveValue('');
});

test('takes the caret with it when picked out of the command list', async ({ page }) => {
    await openTrackGrid(page);

    // 从 Ctrl/Cmd+K 的根列表进——这一步会把面板从遮罩换成 inline 框，输入框是重新挂载的，
    // 不重新取焦点的话光标会落在空处。
    await expect.poll(async () => {
        await page.keyboard.press('ControlOrMeta+k');
        return page.getByTestId('command-palette-panel').count();
    }).toBeGreaterThan(0);
    await page.getByTestId('command-palette-panel').getByRole('combobox').fill('filter');
    await page.waitForTimeout(400);
    await page.getByTestId('command-palette-panel').getByText('Filter this view', { exact: true }).first().click();

    await expect(filterBox(page)).toBeVisible();
    await expect(filterInput(page)).toBeFocused();

    // 焦点真的在框里：直接打字就能筛。
    await page.keyboard.type('nothing matches this');
    await expect(trackCard(page)).toHaveCount(0);
});

test('filters the grid as the listener types, and keeps the box up on Enter', async ({ page }) => {
    await openTrackGrid(page);
    await typeUntilFilterOpens(page, 'm');

    await filterInput(page).fill('nothing matches this');
    await expect(trackCard(page)).toHaveCount(0);

    // Enter 在网格自己的框里也是被吞掉的：关掉框就等于筛过的网格上没有任何说明。
    await page.keyboard.press('Enter');
    await expect(filterBox(page)).toBeVisible();
    await expect(trackCard(page)).toHaveCount(0);
});

test('the primary modifier and F opens it, and Escape puts the grid back', async ({ page }) => {
    await openTrackGrid(page);

    await typeUntilFilterOpens(page, 'ControlOrMeta+f');
    await filterInput(page).fill('nothing matches this');
    await expect(trackCard(page)).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(filterBox(page)).toBeHidden();
    await expect(trackCard(page).first()).toBeVisible();
});

test('the colon opens execute mode on a grid instead of the filter', async ({ page }) => {
    await openTrackGrid(page);

    // ':' 是执行模式的入口，在网格上也一样。网格读键入的一方原本连它也吞掉，执行模式在网格上
    // 就完全进不去了；冒号又从来不是有意义的筛选字符，所以让给命令。
    const panel = page.getByTestId('command-palette-panel');
    await expect.poll(async () => {
        await page.keyboard.press(':');
        return panel.count();
    }).toBeGreaterThan(0);

    await expect(panel.getByText('Execute mode')).toBeVisible();
    await expect(filterBox(page)).toHaveCount(0);
});

test('other printable keys still filter the grid', async ({ page }) => {
    await openTrackGrid(page);

    await typeUntilFilterOpens(page, 'r');

    await expect(page.getByTestId('command-palette-panel')).toHaveCount(0);
});

/** 直接写 store：这几条验的是设置的效果，不是设置面板本身。 */
const setInteractionSetting = async (page: Page, patch: Record<string, unknown>) => {
    await page.evaluate(async (values) => {
        const storeModulePath = '/src/stores/useInteractionSettingsStore.ts';
        const { useInteractionSettingsStore } = await import(storeModulePath);
        useInteractionSettingsStore.setState(values);
    }, patch);
};

const isMuted = (page: Page) => page.evaluate(async () => {
    const storeModulePath = '/src/stores/useAudioSettingsStore.ts';
    const { useAudioSettingsStore } = await import(storeModulePath);
    return useAudioSettingsStore.getState().isMuted;
});

const currentView = (page: Page) => page.evaluate(async () => {
    const storeModulePath = '/src/stores/useAppViewStore.ts';
    const { useAppViewStore } = await import(storeModulePath);
    return useAppViewStore.getState().view;
});

test('points the action button at the command list when asked to', async ({ page }) => {
    await openTrackGrid(page);
    await setInteractionSetting(page, { gridActionButtonSlideTarget: 'command-palette' });

    // 手势本身不变：按住右下角按钮往左拖过阈值。变的只是它落到哪里。
    const button = page.getByRole('button', { name: 'View tracks' });
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();

    await expect(page.getByTestId('command-palette-panel')).toBeVisible();
    await expect(filterBox(page)).toBeHidden();
});

test('hands S to the command list only once the setting says so', async ({ page }) => {
    await openTrackGrid(page);
    await typeUntilFilterOpens(page, 's');
    // 默认下 S 和别的字母一样，进筛选框。
    await expect(page.getByTestId('command-palette-panel')).toHaveCount(0);
    // 关框前先等焦点真的在输入框里：网格自己的 Escape 梯子也听着这个键，只靠
    // 「焦点在 input 里」让路，而焦点是在一帧之后才取的。
    await expect(filterInput(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(filterBox(page)).toBeHidden();

    await setInteractionSetting(page, { gridCommandPaletteHotkey: true });
    const panel = page.getByTestId('command-palette-panel');
    await page.keyboard.press('s');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('combobox')).toBeFocused();

    // 其余字符仍然是筛选输入，只有 S 被让出去。
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await page.keyboard.press('m');
    await expect(filterBox(page)).toBeVisible();
});

test('runs the listeners own Alt shortcut from anywhere', async ({ page }) => {
    await openTrackGrid(page);
    await setInteractionSetting(page, { customShortcutLetter: 'j', customShortcutCommandId: 'navigate-player' });

    expect(await currentView(page)).toBe('home');
    await page.keyboard.press('Alt+j');

    await expect.poll(() => currentView(page)).toBe('player');
});

test('binds a controls-tab action that used to need the panel open', async ({ page }) => {
    await openTrackGrid(page);
    await setInteractionSetting(page, { customShortcutLetter: 'm', customShortcutCommandId: 'playback-mute' });

    expect(await isMuted(page)).toBe(false);
    await page.keyboard.press('Alt+m');
    await expect.poll(() => isMuted(page)).toBe(true);

    // 面板一次都没开过，视图也没动——这正是「全局可用」要保证的。
    expect(await currentView(page)).toBe('home');
    await expect(page.getByTestId('command-palette-panel')).toHaveCount(0);
});

test('ignores an Alt shortcut whose letter has been claimed since', async ({ page }) => {
    await openTrackGrid(page);
    // ':' 是执行模式的入口，但它没有 alt——真正会被拒的是绑到需要特定界面的命令上，
    // 那种绑定即使存进去了也不该开火。
    await setInteractionSetting(page, { customShortcutLetter: 'j', customShortcutCommandId: 'panel-cover' });

    await page.keyboard.press('Alt+j');
    await page.waitForTimeout(400);

    expect(await currentView(page)).toBe('home');
    await expect(page.getByTestId('command-palette-panel')).toHaveCount(0);
});

test('gives the keyboard back when the grid is left', async ({ page }) => {
    await openTrackGrid(page);
    await typeUntilFilterOpens(page, 'm');
    await page.keyboard.press('Escape');
    await expect(filterBox(page)).toBeHidden();

    // 第二下 Escape 落到网格自己的返回梯子上——筛选已清空，所以直接退出这一层。
    await page.keyboard.press('Escape');
    await expect(trackCard(page)).toHaveCount(0);
    await page.keyboard.press('m');
    await page.waitForTimeout(500);

    // 首页那层没有注册筛选，单字符不该再把框拉起来。
    await expect(filterBox(page)).toBeHidden();
});

test('takes the filter box down when the view leaves the grid under it', async ({ page }) => {
    await openTrackGrid(page);
    await typeUntilFilterOpens(page, 'm');
    await expect(filterInput(page)).toBeFocused();

    // 直接写 view：真实触发是「筛选框开着时播放一首歌」，但固件里的假音频到不了播放页。
    // 这条要盯的接缝在视图之后——网格随之注销，面板得自己知道宿主没了。
    await page.evaluate(async () => {
        const storeModulePath = '/src/stores/useAppViewStore.ts';
        const { useAppViewStore } = await import(storeModulePath);
        useAppViewStore.getState().setView('player');
    });
    await expect.poll(() => currentView(page)).toBe('player');

    // 留着它，面板会退回遮罩形态，顶上还挂着一颗指向不存在的网格的「筛选当前视图」药丸。
    await expect(filterBox(page)).toBeHidden();
    await expect(page.getByTestId('command-palette-panel')).toHaveCount(0);
});

/** 队列与当前歌曲直接读 store：这几条验的是 flag 真的落到了动作上。 */
const playbackSnapshot = (page: Page) => page.evaluate(async () => {
    const storeModulePath = '/src/stores/usePlaybackStore.ts';
    const { usePlaybackStore } = await import(storeModulePath);
    const state = usePlaybackStore.getState();
    return { queueLength: state.playQueue.length, currentSongName: state.currentSong?.name ?? null };
});

test('offers the two flags once -- is typed, and names what each would do', async ({ page }) => {
    await openTrackGrid(page);
    await typeUntilFilterOpens(page, 'm');

    await filterInput(page).fill('--');

    const hints = page.getByTestId('command-palette-syntax-hints');
    await expect(hints).toBeVisible();
    await expect(hints.locator('[data-syntax-flag="play"]')).toBeVisible();
    await expect(hints.locator('[data-syntax-flag="add"]')).toBeVisible();

    // 药丸里没有预览行也没有匹配列表，所以这一行是「回车会做什么、对几首做」的唯一说明——
    // 用的就是左侧面板那两个按钮上的原话。
    await filterInput(page).fill('midnight --play');
    await expect(page.getByTestId('command-palette-filter-action')).toHaveText('Play 1 songs');

    await filterInput(page).fill('midnight --add');
    await expect(page.getByTestId('command-palette-filter-action')).toHaveText('Add 1 songs to queue');
});

test('--add appends the filtered songs and drops the flag, leaving the filter up', async ({ page }) => {
    await openTrackGrid(page);
    await typeUntilFilterOpens(page, 'm');

    await filterInput(page).fill('midnight --add');
    await expect(trackCard(page).first()).toBeVisible();
    await page.keyboard.press('Enter');

    await expect.poll(async () => (await playbackSnapshot(page)).queueLength).toBeGreaterThan(0);
    // flag 被摘掉，筛选词留下——面板里那两个按钮也不会关掉自己，而 --add 值得再筛一次接着用。
    await expect(filterInput(page)).toHaveValue('midnight');
    await expect(filterBox(page)).toBeVisible();
});

test('--play takes the play path, not the queue path', async ({ page }) => {
    await openTrackGrid(page);
    await typeUntilFilterOpens(page, 'm');

    await filterInput(page).fill('midnight --play');
    await expect(trackCard(page).first()).toBeVisible();
    await page.keyboard.press('Enter');

    // 队列长度分不开两条路：播放也会把这一首放进队列。能分开的是当前曲目——播放路径会把它
    // 设成这首歌，追加路径（onAddAllToQueue）只往队列里塞，当前曲目保持为空。
    await expect.poll(async () => (await playbackSnapshot(page)).currentSongName).toBe('Midnight Train');
    // 播放会切到播放页，网格和筛选框随之离场，所以这里不再检查筛选框的值。
});

test('a filter with no flag never reaches the grid with the flag token in it', async ({ page }) => {
    await openTrackGrid(page);
    await typeUntilFilterOpens(page, 'm');

    // 半截 flag 不是动作，但它也不能被当成筛选词——否则输到一半网格就空了。
    await filterInput(page).fill('--pl');
    await expect(trackCard(page).first()).toBeVisible();
});

/** 根命令列表（遮罩态），与筛选药丸是两个不同的呈现。 */
const openRootPalette = async (page: Page) => {
    await expect.poll(async () => {
        await page.keyboard.press('ControlOrMeta+k');
        return page.getByTestId('command-palette-panel').count();
    }).toBeGreaterThan(0);
};

test('offers the grid commands only where a track grid is on screen', async ({ page }) => {
    await installBaseState(page, { neteaseMode: 'guest', localImportFixture });
    await mockNeteaseApi(page, 'guest');
    await openApp(page);

    await page.getByRole('button', { name: 'Folder' }).last().click();
    await page.getByRole('button', { name: 'Import Folder' }).last().click();
    await expect(page.getByText('All Songs').first()).toBeVisible();

    // 合集这一层还没有网格注册自己，排序这类命令连匹配都不该产生。
    const panel = page.getByTestId('command-palette-panel');
    await openRootPalette(page);
    await panel.getByRole('combobox').fill('sort by file name');
    // 队列在两层都可用，用它当锚：它出现了才说明排序确实按新查询跑过一遍。
    await expect(panel.getByText('Queue', { exact: true }).first()).toBeVisible();
    await expect(panel.getByText('Sort by file name', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

    // 进到曲目网格里，同一条查询就该命中——本地「所有歌曲」是支持排序的分支。
    await page.getByRole('heading', { name: 'All Songs' }).first().click();
    await expect(trackCard(page).first()).toBeVisible();

    await openRootPalette(page);
    await panel.getByRole('combobox').fill('sort by file name');
    await expect(panel.getByText('Sort by file name', { exact: true }).first()).toBeVisible();
});


test('runs a grid command against the grid it was offered on', async ({ page }) => {
    await openTrackGrid(page);

    const panel = page.getByTestId('command-palette-panel');
    await openRootPalette(page);
    await panel.getByRole('combobox').fill('reverse sort order');
    await panel.getByText('Reverse sort order', { exact: true }).first().click();

    // 方向存在 localStorage 里，所以命令真的打到网格自己的 setter 上，而不是只关掉了面板。
    await expect.poll(() => page.evaluate(() => localStorage.getItem('local_track_sort_direction'))).toBe('desc');
    await expect(panel).toHaveCount(0);
});
