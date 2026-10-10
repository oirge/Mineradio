import { expect, test } from './fixtures';

// test/component/localFolderIgnore.spec.ts

test('shows an ignored folder in an empty library and allows clearing its ignore state', async ({ mount }) => {
    const component = await mount('localFolderIgnore');
    await expect(component.getByText('Hidden', { exact: true })).toBeVisible();
    await expect(component.getByText('Ignored', { exact: true })).toBeVisible();
    const title = component.getByText('Hidden', { exact: true });
    await expect(title).toHaveCSS('text-decoration-line', 'line-through');
    await expect(title).toHaveCSS('opacity', '0.4');
    const restore = component.getByRole('button', { name: 'Restore and rescan' });
    await expect(restore).toBeEnabled();
    await restore.click();
    await expect(restore).toHaveCount(0);
    await expect(component.getByText('Hidden', { exact: true })).toBeVisible();
    await expect(title).toHaveCSS('text-decoration-line', 'none');
    await expect(title).toHaveCSS('opacity', '1');
});

test('finds ignored folders even though they have no song cards', async ({ mount }) => {
    const component = await mount('localFolderIgnore');
    await component.getByRole('textbox', { name: 'Search folders' }).fill('Hidden');
    await expect(component.getByRole('button', { name: 'Restore and rescan' })).toBeVisible();
});
