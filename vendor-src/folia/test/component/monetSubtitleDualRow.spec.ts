import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';
// test/component/monetSubtitleDualRow.spec.ts

// Monet 歌词轨的副字幕双行：罗马音在上、翻译在下；缺哪一种就少哪一行；每行各自最多两行。

const fontPx = (locator: Locator) => locator.evaluate(el => parseFloat(getComputedStyle(el).fontSize));

test('双行模式下罗马音在上、翻译在下，且第二行字号更小', async ({ mount, page }) => {
    await mount('monetSubtitleDualRow');
    const rows = page.locator('[data-subtitle-track]');

    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-subtitle-track', 'romanization');
    await expect(rows.nth(0)).toHaveText('ohayou gozaimasu');
    await expect(rows.nth(1)).toHaveAttribute('data-subtitle-track', 'translation');
    await expect(rows.nth(1)).toHaveText('早安');

    const top = (await rows.nth(0).boundingBox())!;
    const bottom = (await rows.nth(1).boundingBox())!;
    expect(top.y + top.height).toBeLessThanOrEqual(bottom.y + 1);
    expect(await fontPx(rows.nth(1))).toBeLessThan(await fontPx(rows.nth(0)));
});

test('双行模式下只有一种数据时只剩那一行，两种都没有时不渲染', async ({ mount, page }) => {
    await mount('monetSubtitleDualRow');
    const rows = page.locator('[data-subtitle-track]');

    await page.locator('[data-probe-line="romanizationOnly"]').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-subtitle-track', 'romanization');

    await page.locator('[data-probe-line="translationOnly"]').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-subtitle-track', 'translation');

    await page.locator('[data-probe-line="neither"]').click();
    await expect(rows).toHaveCount(0);
});

test('单来源模式保持单行，字号与双行第一行一致', async ({ mount, page }) => {
    await mount('monetSubtitleDualRow');
    const rows = page.locator('[data-subtitle-track]');
    await expect(rows).toHaveCount(2);
    const dualFirstFontPx = await fontPx(rows.first());

    await page.locator('[data-probe-mode="translation"]').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveText('早安');
    expect(await fontPx(rows.first())).toBe(dualFirstFontPx);

    await page.locator('[data-probe-mode="romanization"]').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveText('ohayou gozaimasu');

    await page.locator('[data-probe-mode="none"]').click();
    await expect(rows).toHaveCount(0);
});

test('每一行各自最多两行，超出被截断而不撑高', async ({ mount, page }) => {
    await mount('monetSubtitleDualRow');
    const rows = page.locator('[data-subtitle-track]');
    await page.locator('[data-probe-line="long"]').click();
    await expect(rows).toHaveCount(2);

    for (const index of [0, 1]) {
        const metrics = await rows.nth(index).evaluate(el => {
            const style = getComputedStyle(el);
            return {
                clientHeight: el.clientHeight,
                scrollHeight: el.scrollHeight,
                lineHeight: parseFloat(style.lineHeight),
                padding: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
            };
        });
        // 预留高度是两行内容加内边距；真实内容更长，所以被裁剪（scrollHeight 超出 clientHeight）。
        expect(metrics.clientHeight).toBeLessThanOrEqual(metrics.lineHeight * 2 + metrics.padding + 1);
        expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    }
});
