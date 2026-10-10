import { expect, test } from './fixtures';

// test/component/latticePerformance.spec.ts — benchmark completion and production-wall integration.
test('runs the real wall and records deferred fitting separately', async ({ mount }) => {
    const component = await mount('latticePerformance');
    await component.getByLabel('运动秒数').selectOption('3');
    await component.getByRole('button', { name: '运行所选', exact: true }).click();
    await expect(component.locator('.lattice-field')).toBeVisible();
    await expect(component.getByTestId('perf-status')).toHaveText('idle', { timeout: 20000 });
    await expect(component.locator('tbody tr')).toHaveCount(2);
    await expect(component.getByRole('alert')).toHaveCount(0);
    await expect(component.locator('tbody tr').first()).toContainText('motion');
    await expect(component.locator('tbody tr').last()).toContainText('settle');
    await component.screenshot({ path: 'test-results/lattice-performance.png' });
});

test('stopping unmounts the workload and does not record an incomplete round', async ({ mount }) => {
    const component = await mount('latticePerformance');
    await component.getByRole('button', { name: '运行所选', exact: true }).click();
    await expect(component.locator('.lattice-field')).toBeVisible();
    await component.getByRole('button', { name: '停止', exact: true }).click();
    await expect(component.getByTestId('perf-status')).toHaveText('idle');
    await expect(component.locator('.lattice-field')).toHaveCount(0);
    await expect(component.locator('tbody tr')).toHaveCount(0);
});

test('reuses the lyric WebGL canvas across an auto-focused track change', async ({ mount }) => {
    const component = await mount('lattice', { withLyrics: true });
    const canvas = component.locator('.lattice-lyrics-canvas canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });
    await canvas.evaluate(node => { (window as unknown as { __latticeCanvas: Element }).__latticeCanvas = node; });
    await component.getByRole('button', { name: 'Next track', exact: true }).click();
    await expect(component.locator('.lattice-poster.is-expanded')).toHaveAttribute('aria-label', 'Poster 1 · Artist');
    await expect(canvas).toBeVisible({ timeout: 10000 });
    expect(await canvas.evaluate(node => node === (window as unknown as { __latticeCanvas: Element }).__latticeCanvas)).toBe(true);
});
