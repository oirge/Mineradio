import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// test/component/ponderHint.spec.ts
// 思索的进入链路。这里覆盖的全是只有真实浏览器才暴露的东西：600ms/400ms 两个时间门、
// 胶囊到底能不能被点到、G 在输入框里有没有漏进去，以及光标跟随有没有真的绕开 React。
// 见 dev/probes/ponderHint.probe.tsx。

/** mount fixture 的结构类型，照 automixTransitionSwitches.spec.ts。 */
type Mount = (component: string) => Promise<unknown>;

const STATE = '[data-probe-state]';
const CAPSULE = '[data-testid="ponder-hint-capsule"]';
const STAGE = '[data-testid="ponder-stage"]';
const TOGGLE = '[data-testid="panel-toggle"]';

const hoveredOf = (page: Page) => page.locator(STATE).getAttribute('data-probe-hovered');

/** 把指针放到替身开关中心，并留在那里。 */
async function hoverToggle(page: Page): Promise<{ x: number; y: number }> {
    const box = (await page.locator(TOGGLE).boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(point.x, point.y);
    return point;
}

test.beforeEach(async ({ mount }) => {
    await (mount as unknown as Mount)('ponderHint');
});

test.describe('悬停提示', () => {
    test('不到 600ms 不出胶囊，满了才出', async ({ page }) => {
        await hoverToggle(page);

        await page.waitForTimeout(350);
        await expect(page.locator(CAPSULE)).toHaveCount(0);
        expect(await hoveredOf(page)).toBe('');

        await expect(page.locator(CAPSULE)).toBeVisible({ timeout: 2000 });
        expect(await hoveredOf(page)).toBe('panel-slide');
    });

    test('指针离开后胶囊消失', async ({ page }) => {
        await hoverToggle(page);
        await expect(page.locator(CAPSULE)).toBeVisible({ timeout: 2000 });

        await page.mouse.move(5, 5);
        await expect(page.locator(CAPSULE)).toHaveCount(0);
        expect(await hoveredOf(page)).toBe('');
    });

    test('胶囊不可点击：点它命中的是底下的开关', async ({ page }) => {
        const point = await hoverToggle(page);
        await expect(page.locator(CAPSULE)).toBeVisible({ timeout: 2000 });

        // 胶囊在光标右下 12px，所以这一点正落在它身上。
        await page.mouse.click(point.x + 20, point.y + 20);

        await expect(page.locator(CAPSULE)).toHaveCSS('pointer-events', 'none');
        // 点击穿透到了替身开关，计数加一。
        await expect(page.locator(STATE)).toHaveAttribute('data-probe-clicks', '1');
    });

    test('可见性设为关闭时连提示都不出', async ({ page }) => {
        await page.locator('[data-probe-visibility="off"]').click();
        await hoverToggle(page);

        await page.waitForTimeout(900);
        await expect(page.locator(CAPSULE)).toHaveCount(0);
        expect(await hoveredOf(page)).toBe('');
    });

    test('帮助导航页内的悬停提示不被页面遮住', async ({ page }) => {
        await page.locator('[data-probe-open-navigation]').click();

        const navigation = page.locator('[data-testid="ponder-navigation"]');
        await expect(navigation).toBeVisible();
        await page.locator('[data-ponder-nav-target="panel-slide"]').hover();
        const capsule = page.locator(CAPSULE);
        await expect(capsule).toBeVisible({ timeout: 2000 });

        const layers = await Promise.all([
            navigation.evaluate(element => Number(getComputedStyle(element).zIndex)),
            capsule.evaluate(element => Number(getComputedStyle(element).zIndex)),
        ]);
        expect(layers[1]).toBeGreaterThan(layers[0]);
    });
});

test.describe('长按 G', () => {
    test('不到 400ms 松手会取消', async ({ page }) => {
        await hoverToggle(page);
        await expect(page.locator(CAPSULE)).toBeVisible({ timeout: 2000 });

        await page.keyboard.down('g');
        await page.waitForTimeout(150);
        await page.keyboard.up('g');

        await page.waitForTimeout(500);
        await expect(page.locator(STAGE)).toHaveCount(0);
        expect(await page.locator(STATE).getAttribute('data-probe-session')).toBe('');
    });

    test('按满 400ms 打开教程层', async ({ page }) => {
        await hoverToggle(page);
        await expect(page.locator(CAPSULE)).toBeVisible({ timeout: 2000 });

        await page.keyboard.down('g');
        await expect(page.locator(STAGE)).toBeVisible({ timeout: 2000 });
        await page.keyboard.up('g');

        // 教程开着时胶囊必须让位。
        await expect(page.locator(CAPSULE)).toHaveCount(0);
    });

    test('Esc 退出教程层', async ({ page }) => {
        await hoverToggle(page);
        await expect(page.locator(CAPSULE)).toBeVisible({ timeout: 2000 });
        await page.keyboard.down('g');
        await expect(page.locator(STAGE)).toBeVisible({ timeout: 2000 });
        await page.keyboard.up('g');

        await page.keyboard.press('Escape');
        await expect(page.locator(STAGE)).toHaveCount(0);
    });

    test('屏幕上的下一关键帧会停住时间线，退出按钮关闭教程', async ({ page }) => {
        await hoverToggle(page);
        await expect(page.locator(CAPSULE)).toBeVisible({ timeout: 2000 });
        await page.keyboard.down('g');
        await expect(page.locator(STAGE)).toBeVisible({ timeout: 2000 });
        await page.keyboard.up('g');

        // 触屏没有方向键：这对按钮是关键帧跳转唯一按得准的入口，跳完要停在那一拍上。
        await page.locator('[data-testid="ponder-next-keyframe"]').click();
        await page.waitForTimeout(1200);
        const fill = page.locator('[data-testid="ponder-progress-fill"]');
        const settled = await fill.getAttribute('style');
        await page.waitForTimeout(800);
        expect(await fill.getAttribute('style')).toBe(settled);
        await expect(page.locator(`${STAGE} .lucide-play`)).toHaveCount(1);

        await page.locator('[data-testid="ponder-exit"]').click();
        await expect(page.locator(STAGE)).toHaveCount(0);
    });

    test('焦点在输入框时 G 只是打字，不开教程', async ({ page }) => {
        await page.locator('[data-probe-input]').click();
        await page.keyboard.type('g');

        await page.waitForTimeout(600);
        await expect(page.locator(STAGE)).toHaveCount(0);
        await expect(page.locator('[data-probe-input]')).toHaveValue('g');
    });
});

/**
 * 触屏入口。它在桌面上根本不渲染，所以这一组必须自己开一个 coarse pointer 的 context ——
 * 默认那个里面它 0 个元素，用例会「通过」而什么都没验到。
 */
test.describe('触屏上的思索按钮', () => {
    test.use({ hasTouch: true, isMobile: true });

    const BULB = '[data-testid="page-ponder-touch-button"]';

    test('贴右上角，不落在右下角那堆操作按钮上', async ({ page }) => {
        const bulb = page.locator(BULB);
        await expect(bulb).toBeVisible();

        const box = (await bulb.boundingBox())!;
        const viewport = page.viewportSize()!;
        expect(box.y, '按钮跑到下半屏去了').toBeLessThan(viewport.height / 2);
        expect(box.x, '按钮不在右侧').toBeGreaterThan(viewport.width / 2);
    });

    test('露几秒自己收起来，点右上角又回来', async ({ page }) => {
        const bulb = page.locator(BULB);
        await expect(bulb).toHaveAttribute('data-ponder-touch-revealed', 'true');

        // 收起来之后不可点：留着可点的话，右上角会变成一块看不见却能按的地方。
        await expect(bulb).not.toHaveAttribute('data-ponder-touch-revealed', 'true', { timeout: 8000 });
        await expect(bulb).toHaveCSS('pointer-events', 'none');

        const viewport = page.viewportSize()!;
        await page.touchscreen.tap(viewport.width - 24, 24);
        await expect(bulb).toHaveAttribute('data-ponder-touch-revealed', 'true');
    });

    test('设置里关掉之后它整个不在', async ({ page }) => {
        await expect(page.locator(BULB)).toBeVisible();

        await page.evaluate(async () => {
            const storePath = '/src/stores/usePonderStore.ts';
            const { usePonderStore } = await import(storePath);
            usePonderStore.getState().setShowPonderTouchButton(false);
        });

        // 不是淡出，是整个不渲染 —— 关掉之后右上角那块热区也该一起失效。
        await expect(page.locator(BULB)).toHaveCount(0);
        const viewport = page.viewportSize()!;
        await page.touchscreen.tap(viewport.width - 24, 24);
        await page.waitForTimeout(300);
        await expect(page.locator(BULB)).toHaveCount(0);
    });

    test('点右上角以外的地方不会把它叫出来', async ({ page }) => {
        const bulb = page.locator(BULB);
        await expect(bulb).not.toHaveAttribute('data-ponder-touch-revealed', 'true', { timeout: 8000 });

        const viewport = page.viewportSize()!;
        await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
        await page.waitForTimeout(300);
        await expect(bulb).not.toHaveAttribute('data-ponder-touch-revealed', 'true');
    });
});

test.describe('guardrails', () => {
    test('移动 100 次指针不产生任何 PonderHost 重渲染', async ({ page }) => {
        await hoverToggle(page);
        await expect(page.locator(CAPSULE)).toBeVisible({ timeout: 2000 });

        await page.evaluate(() => {
            (window as unknown as { __renderCounts?: Record<string, number> }).__renderCounts = {};
        });

        const box = (await page.locator(TOGGLE).boundingBox())!;
        for (let step = 0; step < 100; step += 1) {
            await page.mouse.move(box.x + 2 + (step % 20), box.y + 2 + (step % 10));
        }

        const counts = await page.evaluate(() => (
            (window as unknown as { __renderCounts?: Record<string, number> }).__renderCounts ?? {}
        ));
        expect(counts.PonderHost ?? 0).toBe(0);
    });
});

test.describe('章节', () => {
    /** 打开教程层并停在第一章。 */
    async function openStage(page: Page): Promise<void> {
        await hoverToggle(page);
        await expect(page.locator(CAPSULE)).toBeVisible({ timeout: 2000 });
        await page.keyboard.down('g');
        await expect(page.locator(STAGE)).toBeVisible({ timeout: 2000 });
        await page.keyboard.up('g');
    }

    test('[ ] 在章节之间循环切换', async ({ page }) => {
        await openStage(page);
        const counter = page.locator(STAGE).getByText('1 / 3').first();
        await expect(counter).toBeVisible();

        await page.keyboard.press(']');
        await expect(page.locator(STAGE).getByText('2 / 3').first()).toBeVisible();

        await page.keyboard.press('[');
        await expect(page.locator(STAGE).getByText('1 / 3').first()).toBeVisible();

        // 往回越界绕到最后一章。
        await page.keyboard.press('[');
        await expect(page.locator(STAGE).getByText('3 / 3').first()).toBeVisible();
    });

    test('一章播完出「下一章」箭头，点它进入下一章', async ({ page }) => {
        await openStage(page);
        // 切到最短的那一章（键盘那章）再等它播完，省去第一章的十几秒。
        await page.keyboard.press(']');
        await page.keyboard.press(']');
        await expect(page.locator(STAGE).getByText('3 / 3').first()).toBeVisible();

        // 末章不该有「下一章」箭头，只有一行静默提示。
        await expect(page.locator('[data-testid="ponder-chapters-done"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="ponder-next-chapter"]')).toHaveCount(0);

        // 回到第一章，播完应当给出指向第二章的按钮。
        await page.keyboard.press(']');
        await expect(page.locator(STAGE).getByText('1 / 3').first()).toBeVisible();
        const next = page.locator('[data-testid="ponder-next-chapter"]');
        await expect(next).toBeVisible({ timeout: 40000 });
        await next.click();
        await expect(page.locator(STAGE).getByText('2 / 3').first()).toBeVisible();
    });
});
