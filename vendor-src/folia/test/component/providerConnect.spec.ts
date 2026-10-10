import { expect, test } from './fixtures';

// test/component/providerConnect.spec.ts

test.beforeEach(async ({ page, mount }) => {
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
    await mount('providerConnect');
});

test('first click expands a platform, second click selects it', async ({ page }) => {
    const group = page.getByRole('group', { name: '连接平台账户' });
    // 默认展开第一个可用平台，一次点击即可登录。
    await expect(group.getByText('登录到 网易云', { exact: true })).toBeVisible();
    await group.getByRole('button', { name: '登录到 网易云', exact: true }).click();
    await expect(page.getByTestId('selected')).toHaveText('netease');
    for (const [name, id] of [['酷狗', 'kugou'], ['QQ音乐', 'qq'], ['波点', 'bodian'], ['F14', 'f14']]) {
        const label = id === 'f14' ? `切换至${name}` : `登录到 ${name}`;
        const icon = group.getByRole('button', { name: label, exact: true });
        await icon.click();
        await expect(group.getByText(label, { exact: true })).toBeVisible();
        await expect(icon).toHaveAttribute('aria-current', 'true');
        await icon.click();
        await expect(page.getByTestId('selected')).toHaveText(id);
    }
    await expect(group.getByRole('button', { name: /Hidden/ })).toHaveCount(0);
    const disabled = group.getByRole('button', { name: '登录到 Disabled' });
    await disabled.click();
    await expect(disabled).toBeDisabled();
    await expect(page.getByTestId('selected')).toHaveText('f14');
});

test('hover expands a platform and one click selects it', async ({ page }) => {
    const group = page.getByRole('group', { name: '连接平台账户' });
    const kugou = group.getByRole('button', { name: '登录到 酷狗', exact: true });
    await kugou.hover();
    await expect(kugou).toHaveAttribute('aria-current', 'true');
    // 展开后徽章会滑动；静止指针不能触发连锁切换。
    await page.waitForTimeout(400);
    await expect(kugou).toHaveAttribute('aria-current', 'true');
    await kugou.click();
    await expect(page.getByTestId('selected')).toHaveText('kugou');
    // 离开胶囊后保持展开项，不回落到默认平台。
    await page.mouse.move(0, 0);
    await expect(group.getByText('登录到 酷狗', { exact: true })).toBeVisible();
    // 从左往右扫过每个徽章，每一步都应该停在指针下的那个平台。
    for (const name of ['QQ音乐', '波点']) {
        const icon = group.getByRole('button', { name: `登录到 ${name}`, exact: true });
        await page.waitForTimeout(300);
        await icon.hover();
        await expect(icon).toHaveAttribute('aria-current', 'true');
        await page.waitForTimeout(400);
        await expect(icon).toHaveAttribute('aria-current', 'true');
    }
});

test('keyboard expands and selects, removed sources fall back', async ({ page }) => {
    const group = page.getByRole('group', { name: '连接平台账户' });
    const icon = group.getByRole('button', { name: '登录到 酷狗', exact: true });
    await icon.focus();
    await page.keyboard.press('Enter');
    await expect(group.getByText('登录到 酷狗', { exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('selected')).toHaveText('kugou');
    await group.getByRole('button', { name: '切换至F14' }).click();
    await page.getByRole('button', { name: 'Remove F14' }).click();
    await expect(group.getByRole('button', { name: '切换至F14' })).toHaveCount(0);
    await expect(group.getByText('登录到 网易云', { exact: true })).toBeVisible();
});

test('many mod sources stay reachable at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.getByRole('button', { name: 'More sources' }).click();
    const group = page.getByRole('group', { name: '连接平台账户' });
    const mod = group.getByRole('button', { name: '切换至Mod 15', exact: true });
    await mod.click();
    await mod.click();
    await expect(page.getByTestId('selected')).toHaveText('mod-15');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await page.screenshot({ path: 'test-results/provider-connect-mobile.png' });
});

test('desktop look', async ({ page }) => {
    await page.getByRole('group', { name: '连接平台账户' }).getByRole('button', { name: '登录到 QQ音乐' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/provider-connect-desktop.png' });
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/provider-connect-desktop-light.png' });
});
