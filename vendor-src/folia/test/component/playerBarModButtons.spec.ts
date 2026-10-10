import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// test/component/playerBarModButtons.spec.ts
// 模组按钮压短进度条后，--folium-player-bar-extra 要把轨道长度补回来。宽度由真实 Tailwind 产物里的
// min()/calc() 决定，只能在真实浏览器里量。见 dev/probes/playerBarModButtons.probe.tsx。

const TRACK = '[data-folium-part="progress.track"]';

// 连续这么多次采样都不动才算停下。spring 收尾时每 50ms 只挪零点几像素，负载高、帧变慢时
// 更明显；只比相邻两次会在离终点还差 2–3px 时提前返回。
const STABLE_SAMPLES = 4;

/** 等胶囊的 layout spring 停下来，返回稳定后的轨道宽度 */
async function settledTrackWidth(page: Page): Promise<number> {
    const track = page.locator(TRACK).first();
    let previous = -1;
    let stable = 0;
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const { width } = (await track.boundingBox())!;
        stable = Math.abs(width - previous) < 0.5 ? stable + 1 : 0;
        if (stable >= STABLE_SAMPLES) {
            return width;
        }
        previous = width;
        await page.waitForTimeout(50);
    }
    throw new Error('track width never settled');
}

async function toggle(page: Page, action: 'buttons' | 'extra' | 'expand', attribute: string, value: 'on' | 'off') {
    await page.locator(`[data-probe-action="${action}"]`).click();
    await expect(page.locator(`[${attribute}]`)).toHaveAttribute(attribute, value);
}

test.describe('player bar width with mod buttons', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    for (const state of ['collapsed', 'expanded'] as const) {
        test(`the extra variable gives the ${state} track its length back`, async ({ mount, page }) => {
            await mount('playerBarModButtons');
            if (state === 'expanded') {
                await toggle(page, 'expand', 'data-probe-expanded', 'on');
            }
            const bare = await settledTrackWidth(page);

            await toggle(page, 'buttons', 'data-probe-mod-buttons', 'on');
            await expect(page.locator('[data-probe-mod-button]')).toHaveCount(3);
            const squeezed = await settledTrackWidth(page);
            expect(squeezed).toBeLessThan(bare - 80);

            await toggle(page, 'extra', 'data-probe-extra', 'on');
            const restored = await settledTrackWidth(page);
            expect(Math.abs(restored - bare)).toBeLessThanOrEqual(2);
        });
    }
});
