import { expect, test } from './fixtures';

// test/component/latticeTitle.spec.ts — three-line fitting from the target width, and the caching
// and stability that surround it.
const lines = (title: import('@playwright/test').Locator) => title.evaluate(node => {
    const style = getComputedStyle(node);
    return (node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom))
        / parseFloat(style.lineHeight);
});

test('fits to three lines on the first paint and keeps the full title accessible', async ({ mount }) => {
    const component = await mount('latticeTitle');
    const title = component.locator('.lattice-poster-copy strong').first();
    const original = await title.getAttribute('aria-label');
    await expect(title).toHaveAttribute('data-title-settled', 'true');
    expect(await title.textContent()).not.toBe(original);
    expect(await title.textContent()).toMatch(/…$/);
    expect(await lines(title)).toBeLessThanOrEqual(3.02);
    await component.screenshot({ path: 'test-results/lattice-title-settled.png' });
});

test('a new target width refits without waiting out a debounce', async ({ mount, page }) => {
    const component = await mount('latticeTitle');
    const title = component.locator('.lattice-poster-copy strong').first();
    const original = await title.getAttribute('aria-label');
    await expect(title).toHaveAttribute('data-title-settled', 'true');
    const width = component.getByLabel('Expanded poster width');

    // Wide enough that nothing has to be dropped: the whole title comes back.
    await width.fill('1400');
    await expect(title).toHaveText(original!);
    await expect(title).toHaveAttribute('data-title-settled', 'true');
    expect(await lines(title)).toBeLessThanOrEqual(3.02);

    // The fit is arithmetic over font metrics, so a width it has never seen still lands on the
    // frame it is asked for rather than after a settle timer.
    const elapsed = await page.evaluate(async () => {
        const node = document.querySelector<HTMLElement>('.lattice-poster-copy strong')!;
        const input = document.querySelector<HTMLInputElement>('input[type="number"]')!;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        const before = node.textContent;
        const start = performance.now();
        setter.call(input, '357');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        for (let i = 0; i < 120 && node.textContent === before; i++) {
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        return performance.now() - start;
    });
    expect(elapsed).toBeLessThan(100);
    await expect(title).not.toHaveText(original!);
    await expect(title).toHaveAttribute('data-title-settled', 'true');
    expect(await lines(title)).toBeLessThanOrEqual(3.02);
});

test('a transform on the card does not disturb a settled title', async ({ mount, page }) => {
    const component = await mount('latticeTitle');
    const title = component.locator('.lattice-poster-copy strong').first();
    await expect(title).toHaveAttribute('data-title-settled', 'true');
    await title.evaluate(node => {
        (window as unknown as { titleMutations: number }).titleMutations = 0;
        new MutationObserver(() => { (window as unknown as { titleMutations: number }).titleMutations++; })
            .observe(node, { childList: true, attributes: true, characterData: true, subtree: true });
        (node.closest('.lattice-poster') as HTMLElement).style.transform = 'scale(1.15)';
    });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { titleMutations: number }).titleMutations)).toBe(0);
});

test('a remounted title reuses the earlier measurement instead of fitting again', async ({ mount, page }) => {
    const component = await mount('latticeTitle');
    const settled = component.locator('.lattice-poster-copy strong[data-title-settled]');
    const root = component.locator('.lattice-root');
    await expect(settled).not.toHaveCount(0);
    await page.waitForTimeout(200);
    const before = await settled.count();
    const fits = await root.getAttribute('data-fits');
    expect(Number(fits)).toBeGreaterThan(0);

    // Standing in for a poster that panned off screen and came back: the component and its state
    // are gone, so only a cache outliving them can spare the second measurement.
    await component.getByRole('button', { name: 'Remount titles' }).click();
    await expect(component.locator('[data-generation]')).toHaveAttribute('data-generation', '1');
    await expect(settled).toHaveCount(before);
    await page.waitForTimeout(200);
    await expect(root).toHaveAttribute('data-fits', fits!);
});

test('an expanding poster carries its fitted title from the first frame', async ({ mount, page }) => {
    const component = await mount('latticeTitleExpansion');
    await page.waitForTimeout(1500);
    // Clicked from inside the page: the wall is virtualized and the first card sits off-screen.
    const report = await component.locator('.lattice-poster').first().evaluate(async (poster: HTMLElement) => {
        const title = () => poster.querySelector('strong')!;
        const start = performance.now();
        poster.click();
        let lastWidth = -1;
        let widthStoppedAt = 0;
        let unsettledFrames = 0;
        for (let i = 0; i < 600; i++) {
            await new Promise(resolve => requestAnimationFrame(resolve));
            const node = title();
            const width = Math.round(node.getBoundingClientRect().width);
            if (width !== lastWidth) { widthStoppedAt = performance.now() - start; lastWidth = width; }
            if (!node.hasAttribute('data-title-settled')) unsettledFrames++;
            if (performance.now() - start > widthStoppedAt + 300) break;
        }
        const node = title();
        const style = getComputedStyle(node);
        return {
            unsettledFrames,
            full: node.getAttribute('aria-label'),
            shown: node.textContent,
            // The settled rule drops the CSS clamp, so a fit that overflowed would show here.
            lines: (node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom))
                / parseFloat(style.lineHeight),
        };
    });

    // The target rect is known before the spring starts, so the card never shows an unfitted title
    // on its way out - which is what the old head-start prediction existed to approximate.
    expect(report.unsettledFrames).toBe(0);
    expect(report.shown).not.toBe(report.full);
    expect(report.shown).toMatch(/…$/);
    expect(report.lines).toBeLessThanOrEqual(3.02);
});

test('a viewport-driven type size change refits once the window comes to rest', async ({ mount, page }) => {
    const component = await mount('latticeTitle');
    // The compact posters keep the stylesheet's `clamp(22px, 2vw, 36px)`, so their type size
    // follows the window even though their column does not.
    const title = component.locator('.lattice-poster:not(.is-expanded) .lattice-poster-copy strong').first();
    const root = component.locator('.lattice-root');
    await expect(title).toHaveAttribute('data-title-settled', 'true');
    await page.waitForTimeout(200);
    const fits = Number(await root.getAttribute('data-fits'));
    const size = () => title.evaluate(node => getComputedStyle(node).fontSize);
    const before = await size();

    await page.setViewportSize({ width: 900, height: 1000 });
    await expect.poll(size).not.toBe(before);
    // The clamp goes back on while the window is moving, so a preview measured against the old
    // type size cannot bleed a fourth line through the padding on the way.
    await expect(title).not.toHaveAttribute('data-title-settled', 'true');
    await expect(title).toHaveAttribute('data-title-settled', 'true');
    expect(Number(await root.getAttribute('data-fits'))).toBeGreaterThan(fits);
    expect(await lines(title)).toBeLessThanOrEqual(3.02);
});
