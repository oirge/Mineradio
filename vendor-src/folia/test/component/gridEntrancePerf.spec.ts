import { expect, test } from './fixtures';

// test/component/gridEntrancePerf.spec.ts
// 大歌单打开的帧预算。为什么值得一条常驻用例：这块的成本是「几十张真实卡片同时挂载 +
// 同时做入场动画」，靠读代码判断不出主线程还剩多少，只能量。
//
// 断言的是**规模不变量**，不是精确时间：曲目数翻十倍，挂载的卡片数、主线程块、掉帧都不该
// 跟着涨（这才是「惰性塑形」修掉的东西）。绝对值在这台机器上会因为同时跑几个 worker 而翻倍，
// 所以判据写成两档之间的**差**，只兜一个很宽的天花板防灾难性回归。

type PerfReading = {
    longTaskTotal: number;
    longTaskMax: number;
    longTaskCount: number;
    frames: number;
    worstFrame: number;
    slowFrames: number;
    cards: number;
};

const readPerf = async (page: import('@playwright/test').Page): Promise<PerfReading | null> => {
    const raw = await page.locator('[data-probe-reading]').getAttribute('data-probe-reading');
    return raw ? JSON.parse(raw) as PerfReading : null;
};

const openAndMeasure = async (page: import('@playwright/test').Page, root: import('@playwright/test').Locator, count: number) => {
    await root.locator(`[data-probe-size="${count}"]`).click();
    await root.locator('[data-probe-action="open"]').click();
    await expect.poll(() => readPerf(page), { timeout: 20_000 }).not.toBeNull();
    return (await readPerf(page))!;
};

/** 先空跑一次丢掉读数：第一次挂载要付 JIT/CSS/图片解码的冷启动，不丢掉的话 A/B 比的是冷热。 */
const warmUp = async (page: import('@playwright/test').Page, root: import('@playwright/test').Locator) => {
    await openAndMeasure(page, root, 2000);
};

test('the grid mounts only the cards near the viewport, however big the playlist is', async ({ mount, page }) => {
    const root = await mount('gridEntrancePerf');
    await warmUp(page, root);
    const small = await openAndMeasure(page, root, 500);
    const large = await openAndMeasure(page, root, 5000);
    // eslint-disable-next-line no-console
    console.log('PERF cards', JSON.stringify({ small, large }));

    // 渲染环是「视口附近的卡」：曲目数翻十倍，挂载的卡片数不该跟着涨。
    expect(large.cards).toBeLessThan(small.cards * 1.5 + 10);
    // 塑形是惰性的：曲目数翻十倍，主线程块也不该跟着涨。
    // 判据写成「500 首与 5000 首的差」，而不是绝对毫秒 —— 这台机器同时跑几个 worker 时，
    // 连 500 首的挂载都会蹦到 200ms，绝对值判不出来是「大歌单的问题」还是「机器忙」。
    expect(large.longTaskMax - small.longTaskMax).toBeLessThan(150);
    // 再兜一个很宽的天花板：回归成整表塑形时（5000 首实测 ~700ms）这里会直接爆掉。
    expect(large.longTaskMax).toBeLessThan(400);
});

test('the entrance animation is not what eats the main thread', async ({ mount, page }) => {
    const root = await mount('gridEntrancePerf');
    await warmUp(page, root);
    await root.locator('[data-probe-size="2000"]').click();

    // 对照组：同样的挂载成本，不加入场动画。
    if (await root.locator('[data-probe-entrance]').getAttribute('data-probe-entrance') !== 'off') {
        await root.locator('[data-probe-entrance]').click();
    }
    const withoutEntrance = await openAndMeasure(page, root, 2000);

    await root.locator('[data-probe-entrance]').click();
    const withEntrance = await openAndMeasure(page, root, 2000);

    // eslint-disable-next-line no-console
    console.log('PERF entrance', JSON.stringify({ withoutEntrance, withEntrance }));

    // 入场动画只该占一小部分：如果它成了主线程块的主因，说明「几十张卡各跑一条动画」又回来了。
    // 同样比「开/关的差」，机器忙的时候两边一起变慢，不该因此误报。
    expect(withEntrance.longTaskMax).toBeLessThan(withoutEntrance.longTaskMax + 120);
    expect(withEntrance.slowFrames).toBeLessThan(withoutEntrance.slowFrames + 6);
});

test('paging the rest of a big playlist in the background does not cost frames', async ({ mount, page }) => {
    const root = await mount('gridEntrancePerf');
    await warmUp(page, root);
    const setPaging = async (on: boolean) => {
        if ((await root.locator('[data-probe-paging]').getAttribute('data-probe-paging')) !== (on ? 'on' : 'off')) {
            await root.locator('[data-probe-paging]').click();
        }
    };

    await setPaging(false);
    const atOnce = await openAndMeasure(page, root, 5000);
    await setPaging(true);
    const paged = await openAndMeasure(page, root, 5000);
    // eslint-disable-next-line no-console
    console.log('PERF paging', JSON.stringify({ atOnce, paged }));

    // 分页按后台更新提交（transition），每页重算网格项也只塑形视口附近的卡：五次整表更新落在测量窗口里，
    // 主线程块与掉帧都不该比「一次给全」明显变多。同样比差值，不比绝对值。
    expect(paged.longTaskMax - atOnce.longTaskMax).toBeLessThan(150);
    expect(paged.slowFrames - atOnce.slowFrames).toBeLessThan(6);
    expect(paged.cards).toBeLessThan(atOnce.cards * 1.5 + 10);
});
