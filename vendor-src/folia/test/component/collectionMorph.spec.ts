import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

// test/component/collectionMorph.spec.ts
// 「移形换影」的浏览器级回归。为什么要组件测试而不是单测：这段转场的失败方式是层叠、
// 命中测试和时序，不是纯逻辑 —— 封锁层盖住了谁、测量量到了哪个网格、生命周期会不会自己
// 结束，都只有真的挂进 DOM 才看得出来。
//
// 注意：合成层是 portal 到 document.body 的，所以它们只能在 page 上查，不在 mount() 返回的
// #root 里。探针自己的 UI（按钮、状态读数）才从 #root 查。

const MORPH_LAYER = '[data-folia-collection-morph]';
const FRAME = '[data-folia-collection-morph="frame"]';
const COVER = '[data-folia-collection-morph="cover"]';
const BLOCKER = '[data-folia-collection-morph="input-blocker"]';

/**
 * 采样某个元素在接下来一段时间里的 transform 矩阵。形变层现在动画的是**盒子**，
 * 所以 transform 里只应该有等比变换（旋转、均匀缩放）；一旦出现 a ≠ d 的非等比缩放，
 * object-cover 的图片内容就会被拉变形 —— 那正是「封面比例被压窄」的成因。
 */
const sampleTransforms = (locator: Locator, samples: number, gapMs: number) => (
    locator.evaluate(async (el, [count, gap]) => {
        const readings: Array<{ a: number; d: number }> = [];
        for (let i = 0; i < count; i += 1) {
            const matrix = new DOMMatrix(getComputedStyle(el).transform);
            readings.push({ a: matrix.a, d: matrix.d });
            await new Promise(resolve => setTimeout(resolve, gap));
        }
        return readings;
    }, [samples, gapMs] as const)
);

/**
 * 形变层在飞行期间的状态快照，由页内观察器累积。
 */
type FlightRecord = {
    /** 每一层在飞行期间出现过的最大数量（出现即记，之后消失也不回退）。 */
    frame: number;
    cover: number;
    title: number;
    blocker: number;
    layer: number;
    /**
     * 合成层里出现过的所有封面 src（去重累积）。不能只记「第一眼看到的」：源封面先挂上，
     * 交叉淡化的目标封面晚一拍才挂，只看第一眼拿到的是首页那张图。
     */
    coverSources: string[];
    /** 合成层里出现过的所有标题文本（去重累积），同理：先是源标题，后面接上目标标题。 */
    titleTexts: string[];
    /** 飞行期间出现过的计划种类。 */
    plans: string[];
};

/**
 * 把记录器装进页面，**必须在点击之前**调用。
 *
 * 三件套与封锁层只活几百毫秒，而这个进程里一次往返（尤其 CI 上同时跑几个 worker 时）就可能
 * 上百毫秒 —— 用 `expect(locator).toHaveCount(1)` 逐个确认必然漏窗口：查封锁层时它已经收掉了
 * （真实发生过）。更糟的是漏掉之后 `locator.evaluate` 会开始等这个元素重新出现，于是超时。
 * 观察器在页内按突变实时记录，测试事后读一次快照，就不依赖往返速度了。
 */
const recordFlight = async (page: Page): Promise<void> => {
    await page.evaluate(() => {
        const count = (selector: string) => document.querySelectorAll(selector).length;
        const push = (list: string[], values: string[]) => {
            for (const value of values) {
                if (value && !list.includes(value)) list.push(value);
            }
        };
        const record = {
            frame: 0, cover: 0, title: 0, blocker: 0, layer: 0,
            coverSources: [] as string[], titleTexts: [] as string[], plans: [] as string[],
        };
        const capture = () => {
            record.frame = Math.max(record.frame, count('[data-folia-collection-morph="frame"]'));
            record.cover = Math.max(record.cover, count('[data-folia-collection-morph="cover"]'));
            record.title = Math.max(record.title, count('[data-folia-collection-morph="title"]'));
            record.blocker = Math.max(record.blocker, count('[data-folia-collection-morph="input-blocker"]'));
            record.layer = Math.max(record.layer, count('[data-folia-collection-morph]'));
            push(record.coverSources, Array.from(document.querySelectorAll<HTMLImageElement>('[data-folia-collection-morph="cover"] img'))
                .map(image => image.getAttribute('src') ?? ''));
            push(record.titleTexts, [document.querySelector('[data-folia-collection-morph="title"]')?.textContent?.trim() ?? '']);
            const plan = document.querySelector('[data-probe-plan]')?.textContent?.trim() ?? '';
            if (plan && plan !== 'none') push(record.plans, [plan]);
        };
        capture();
        const observer = new MutationObserver(capture);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['src'] });
        (window as unknown as { __flightRecord?: typeof record }).__flightRecord = record;
    });
};

const readFlightRecord = (page: Page) => (
    page.evaluate(() => (window as unknown as { __flightRecord: FlightRecord }).__flightRecord)
);

type RadiusReading = { isPercent: boolean; value: number; width: number; height: number };
type CircleLandingSample = { frame: RadiusReading; cover: RadiusReading | null };

/**
 * 页内 rAF 采样：形变层落到歌手头像那个槽位上的每一帧，记下形变层与封面层的圆角。
 *
 * 同样不能在测试进程里读一次 —— 读完第一处、再去读第二处的时候层可能已经卸载。
 * 判据：落点必须和头像一样是 240×240，且两层的 border-radius 都是**百分比**、数值约等于
 * 半个盒子（弹簧收势会落在 50.2%，浏览器对超过半个盒子的半径一律裁成正圆，观感不受影响）。
 * 写成 px（min(w,h)/2）时，这个方形落点会被非等比缩放拉成圆角方框 —— 那正是回归点。
 */
const measureCircleLanding = async (page: Page, timeoutMs = 6000) => (
    page.evaluate(async (limit: number) => {
        const read = (selector: string): RadiusReading | null => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const raw = getComputedStyle(element).borderTopLeftRadius;
            const box = element.getBoundingClientRect();
            return {
                isPercent: raw.trim().endsWith('%'),
                value: Number.parseFloat(raw),
                width: box.width,
                height: box.height,
            };
        };
        const target = { width: 0, height: 0, known: false };
        const samples: CircleLandingSample[] = [];
        const start = performance.now();
        let sawLayer = false;
        while (performance.now() - start < limit) {
            // 头像在点击之后才挂载，所以落点尺寸得在循环里补认，不能一开始就查。
            if (!target.known) {
                const avatar = document.querySelector('[data-probe-artist-avatar]')?.getBoundingClientRect();
                if (avatar) {
                    target.width = avatar.width;
                    target.height = avatar.height;
                    target.known = true;
                }
            }
            const frame = read('[data-folia-collection-morph="frame"]');
            if (frame) {
                sawLayer = true;
                if (target.known
                    && Math.abs(frame.width - target.width) <= 2
                    && Math.abs(frame.height - target.height) <= 2) {
                    samples.push({ frame, cover: read('[data-folia-collection-morph="cover"]') });
                }
            } else if (sawLayer) {
                break;
            }
            await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
        }
        return samples;
    }, timeoutMs)
);

/**
 * 从点击那一刻起在页面里采样 DOM，返回四个里程碑（毫秒，相对采样开始）：
 * 三件套首次移动 / 三件套落到 hero / 输入封锁层消失 / 所有合成层消失。
 *
 * 「首次打开」的真实代价就在这里：hero 的封面是冷的，而打开动画的时长不该由一张网络图片
 * 决定。用页面内的 performance.now() 采样，避免 Playwright 往返把测量值撑大。
 */
const measureOpenMilestones = async (page: Page, timeoutMs = 6000) => (
    page.evaluate(async (limit: number) => {
        const start = performance.now();
        const readBox = () => {
            const el = document.querySelector('[data-folia-collection-morph="frame"]');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
        };
        const marker = document.querySelector('[data-probe-detail-card]');
        const targetRect = marker ? marker.getBoundingClientRect() : null;

        let startBox: { x: number; y: number; w: number; h: number } | null = null;
        let firstMove: number | null = null;
        let landed: number | null = null;
        let blockerGone: number | null = null;
        let layersGone: number | null = null;
        let heroCoverReady: number | null = null;

        while (performance.now() - start < limit) {
            const box = readBox();
            if (box && !startBox) startBox = box;
            const elapsed = performance.now() - start;
            if (box && startBox && firstMove === null
                && Math.hypot(box.x - startBox.x, box.y - startBox.y) > 5) {
                firstMove = elapsed;
            }
            if (box && targetRect && landed === null
                && Math.hypot(box.x - targetRect.x, box.y - targetRect.y) < 8
                && Math.abs(box.w - targetRect.width) < 8
                && Math.abs(box.h - targetRect.height) < 8) {
                landed = elapsed;
            }
            // 封锁层可能在采样开始前就挂上了，所以要求合成层先出现过再消失。
            if (blockerGone === null && startBox
                && !document.querySelector('[data-folia-collection-morph="input-blocker"]')) {
                blockerGone = elapsed;
            }
            if (layersGone === null && startBox && !document.querySelector('[data-folia-collection-morph]')) {
                layersGone = elapsed;
            }
            const heroCover = document.querySelector<HTMLImageElement>('[data-probe-detail-cover]');
            if (heroCoverReady === null && heroCover?.complete && heroCover.naturalWidth > 0) {
                heroCoverReady = elapsed;
            }
            if (layersGone !== null) break;
            await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
        }
        return { firstMove, landed, blockerGone, layersGone, heroCoverReady };
    }, timeoutMs)
);

test('a cold hero cover must not stretch the open animation', async ({ mount, page }) => {
    // hero 封面延迟 1.2s 才到达 —— 就是「首次打开」时那张还没解码的封面。
    await page.route('**/slow-cover.png', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1200));
        await route.fulfill({
            status: 200,
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#2f9e44"/></svg>',
        });
    });

    const root = await mount('collectionMorph');
    await root.locator('[data-probe-action="cold-cover"]').click();
    await expect(root.locator('[data-probe-detail-cover]')).toHaveCount(0);
    await root.locator('[data-probe-home-card]').click();

    const milestones = await measureOpenMilestones(page);
    // eslint-disable-next-line no-console
    console.log('MILESTONES cold', JSON.stringify(milestones));

    expect(milestones.firstMove).not.toBeNull();
    expect(milestones.landed).not.toBeNull();
    // 预算，不是精确期望：这台机器上量到 455 / 273 / 1381ms，旧实现是 2086 / 2086 —— 余量
    // 留够慢机器，同时仍然能抓到「生命周期在等封面」这种回归。
    expect(milestones.landed!).toBeLessThan(1200);
    // 交互必须在「封面还在路上」的时候就恢复：封锁层挡的是交互，而飞行本身不需要等图片。
    expect(milestones.blockerGone).not.toBeNull();
    expect(milestones.blockerGone!).toBeLessThan(1000);
    expect(milestones.blockerGone!).toBeLessThan(milestones.heroCoverReady ?? Number.POSITIVE_INFINITY);
    // 整层的尾巴也要有界：封面层顶多等到封面到达（或兜底上限）就交还给 hero 卡片。
    expect(milestones.layersGone).not.toBeNull();
    expect(milestones.layersGone!).toBeLessThan(2600);
});

test('a warm open (cover already decoded) finishes inside half a second', async ({ mount, page }) => {
    const root = await mount('collectionMorph');
    await root.locator('[data-probe-home-card]').click();

    const milestones = await measureOpenMilestones(page);
    // eslint-disable-next-line no-console
    console.log('MILESTONES warm', JSON.stringify(milestones));

    // 热封面（这台机器上 238 / 251 / 681ms）：旧实现到这里也还有 ~780ms 的封锁与尾巴。
    expect(milestones.landed!).toBeLessThan(800);
    expect(milestones.blockerGone!).toBeLessThan(700);
    expect(milestones.layersGone!).toBeLessThan(1400);
});

test('the clicked card morphs onto the active grid hero and the flight ends by itself', async ({ mount, page }) => {
    const root = await mount('collectionMorph');
    await expect(root.locator('[data-probe-enabled]')).toHaveAttribute('data-probe-enabled', 'true');
    await recordFlight(page);

    await root.locator('[data-probe-home-card]').click();
    await expect(root.locator('[data-probe-open]')).toHaveAttribute('data-probe-open', 'true');

    // 生命周期自己结束：不能等用户操作才收掉封锁层（封锁层消失、合成层消失、计划归还）。
    await expect(page.locator(BLOCKER)).toHaveCount(0, { timeout: 8000 });
    await expect(page.locator(MORPH_LAYER)).toHaveCount(0);
    await expect(root.locator('[data-probe-plan]')).toHaveAttribute('data-probe-plan', 'none');

    // 飞过的那一段从页内记录器核对：三件套 + 封锁层同在过，计划是 'morph'（有合成层盖着 hero）。
    const record = await readFlightRecord(page);
    expect(record.frame).toBeGreaterThanOrEqual(1);
    expect(record.cover).toBeGreaterThanOrEqual(1);
    expect(record.title).toBeGreaterThanOrEqual(1);
    expect(record.blocker).toBeGreaterThanOrEqual(1);
    expect(record.layer).toBeGreaterThanOrEqual(4);
    expect(record.plans).toEqual(['morph']);

    // 飞行目标必须是**活动**网格那张卡：同一个位置上还压着「正在退出的旧网格」的卡片，
    // 而且它排在前面（距离相同时 probeHeroTargets 取文档顺序里的第一个）。
    // 合成层里出现过目标封面/目标标题，且从没出现过旧网格那张卡的封面/标题。
    expect(record.coverSources.some(src => src.includes('detail'))).toBe(true);
    expect(record.coverSources.some(src => src.includes('stale'))).toBe(false);
    expect(record.titleTexts.some(text => text.includes('Detail Song'))).toBe(true);
    expect(record.titleTexts.some(text => text.includes('Stale Song'))).toBe(false);
});

test('a click on the blockade skips the flight instead of being swallowed', async ({ mount, page }) => {
    const root = await mount('collectionMorph');
    await root.locator('[data-probe-home-card]').click();
    await expect(page.locator(BLOCKER)).toHaveCount(1);

    // 用户的第一反应是点一下跳过。不接 pointerdown 时这一下会被无声吞掉。
    await page.mouse.move(1200, 900);
    await page.mouse.down();
    await page.mouse.up();

    await expect(page.locator(BLOCKER)).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator(MORPH_LAYER)).toHaveCount(0);
    await expect(root.locator('[data-probe-plan]')).toHaveAttribute('data-probe-plan', 'none');
});

test('an artist landing ends as a real circle, not a rounded square', async ({ mount, page }) => {
    const root = await mount('collectionMorph');
    await root.locator('[data-probe-action="destination"]').click();
    await expect(root.locator('[data-probe-destination]')).toHaveAttribute('data-probe-destination', 'artist');

    // 起点是 200×260 的首页卡片，落点是 240×240 的歌手头像 —— 两个方向缩放不同。
    // 采样先起，再点卡片：飞行只有几百毫秒，等点完再开始采样就已经错过了。
    const landing = measureCircleLanding(page);
    await root.locator('[data-probe-home-card]').click();
    const samples = await landing;

    // 至少采到落点：盒子真的落在了头像那个方形槽位上。
    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
        expect(sample.cover).not.toBeNull();
        for (const reading of [sample.frame, sample.cover!]) {
            expect(reading.isPercent).toBe(true);
            expect(reading.value).toBeGreaterThan(49);
            expect(reading.value).toBeLessThan(51);
        }
    }
});

test('the artist flight never squeezes the cover through a non-uniform scale', async ({ mount, page }) => {
    const root = await mount('collectionMorph');
    await root.locator('[data-probe-action="destination"]').click();
    await root.locator('[data-probe-home-card]').click();
    await expect(page.locator(COVER)).toHaveCount(1);

    // 起点是 200×260 的封面、落点是 232×232 的圆形头像：只要用 scaleX/scaleY 做形变，
    // 这两个方向的比例就会不同（1.16 / 0.89），封面内容被拉扁。动画盒子则不会有任何非等比变换。
    const readings = await sampleTransforms(page.locator(COVER), 12, 60);
    expect(readings.length).toBeGreaterThan(8);
    for (const { a, d } of readings) {
        expect(Math.abs(a - d)).toBeLessThan(0.02);
    }
});

test('a nested back flies onto the card while the card is still flying in', async ({ mount, page }) => {
    const root = await mount('collectionMorph');
    await root.locator('[data-probe-action="nested-back"]').click();

    const frame = page.locator(FRAME);
    await expect(frame).toHaveCount(1);

    // 落点卡片的外框在 (620,420) 尺寸 200×260（中心 720,550），它自己还在做 1.4s 的飞入；
    // hero 起点是 (500,300) 的 232×232 圆形头像。旧实现要等内层封面落定才肯起飞，hero 会僵在
    // 原地直到 1.8s 的放弃线 —— 也就是「歌手页退出动画严重滞后」。现在靠外框（挂载即在最终
    // 槽位）判定，两拍就起飞，位置和比例都在 1.2s 内落到卡片的外框上。
    await expect.poll(async () => {
        const box = await frame.boundingBox();
        if (!box) return false;
        const centerDistance = Math.hypot(box.x + box.width / 2 - 720, box.y + box.height / 2 - 550);
        return centerDistance < 8 && Math.abs(box.width / box.height - 200 / 260) < 0.03;
    }, { timeout: 1200 }).toBe(true);
});

test('only the incoming grid carries the active mark while two grids overlap', async ({ mount, page }) => {
    // 这条盖的是标记组件本身：collectionMorph 探针是手写属性的，测不到 useIsPresent 的翻转。
    const root = await mount('activeGridMarker');
    const active = page.locator('[data-folia-active-grid]');

    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('data-probe-grid', 'grid-0');

    await root.locator('[data-probe-action="push"]').click();
    await expect(root.locator('[data-probe-level]')).toHaveAttribute('data-probe-level', '1');

    // 退出动画期间两层网格同时在 DOM 里：标记必须只在正在进入的那层上，
    // 否则移形换影的测量会量到正在消失的上一页。
    await expect(page.locator('[data-probe-grid]')).toHaveCount(2);
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('data-probe-grid', 'grid-1');

    await expect(page.locator('[data-probe-grid]')).toHaveCount(1);
    await expect(active).toHaveAttribute('data-probe-grid', 'grid-1');
});

test('reduced motion never starts the transition', async ({ mount, page }) => {
    // store 在模块 import 时读 localStorage，所以种子必须写在页面脚本之前。
    await page.addInitScript(() => localStorage.setItem('reduce_motion_collectionMorph', 'true'));
    const root = await mount('collectionMorph');
    await expect(root.locator('[data-probe-enabled]')).toHaveAttribute('data-probe-enabled', 'false');

    await root.locator('[data-probe-home-card]').click();
    // 导航照常发生，只是没有任何合成层。
    await expect(root.locator('[data-probe-open]')).toHaveAttribute('data-probe-open', 'true');
    await expect(root.locator('[data-probe-detail-card]')).toBeVisible();

    await expect(page.locator(MORPH_LAYER)).toHaveCount(0);
    await page.waitForTimeout(900);
    await expect(page.locator(MORPH_LAYER)).toHaveCount(0);
    await expect(root.locator('[data-probe-plan]')).toHaveAttribute('data-probe-plan', 'none');
});

test('turning the surface off mid-flight finishes the lifecycle instead of stranding the composite', async ({ mount, page }) => {
    const root = await mount('collectionMorph');
    await root.locator('[data-probe-home-card]').click();
    await expect(page.locator(FRAME)).toHaveCount(1);

    // 等同于用户在飞行途中关掉了这一面动效。按钮此刻在封锁层下面，所以直接触发它的 click，
    // 绕过命中测试 —— 走的是设置面板同一条 store setter。
    await root.locator('[data-probe-action="reduce"]').evaluate((node) => (node as HTMLButtonElement).click());

    await expect(root.locator('[data-probe-enabled]')).toHaveAttribute('data-probe-enabled', 'false');
    await expect(page.locator(MORPH_LAYER)).toHaveCount(0, { timeout: 4000 });
    await expect(root.locator('[data-probe-plan]')).toHaveAttribute('data-probe-plan', 'none');
});


test('closing navigation mid-flight removes the composite and input blockade immediately', async ({ mount, page }) => {
    const root = await mount('collectionMorph');
    await root.locator('[data-probe-home-card]').click();
    await expect(page.locator(FRAME)).toHaveCount(1);

    // 历史返回不经过宿主的 armExit，也不会主动清空 morph store。
    await root.locator('[data-probe-action="close-navigation"]').evaluate((node) => (node as HTMLButtonElement).click());

    await expect(root.locator('[data-probe-open]')).toHaveAttribute('data-probe-open', 'false');
    await expect(page.locator(MORPH_LAYER)).toHaveCount(0, { timeout: 100 });
    await expect(root.locator('[data-probe-plan]')).toHaveAttribute('data-probe-plan', 'none');
});
