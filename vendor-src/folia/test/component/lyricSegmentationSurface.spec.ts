import { expect, test } from './fixtures';

// test/component/lyricSegmentationSurface.spec.ts
// 命令面板 body 的高度是一条硬契约（见 test/ui/commandPaletteSizing.spec.ts）。歌词分词面板是
// 唯一内容长度跟歌词走、没有上限的新 surface，所以这里单独把「装满也撑不开」量出来。
//
// 走组件探针而不是整应用：整应用的夹具只塞了歌曲，没有已加载的歌词，那条路径量到的是空态。

const body = '[data-probe-body]';

test('预览再长也不会撑开固定高度的 body', async ({ mount, page }) => {
    const component = await mount('lyricSegmentationSurface');
    await expect(component.getByRole('button', { name: 'Copy prompt' })).toBeVisible();

    const box = await page.locator(body).boundingBox();
    expect(box).not.toBeNull();

    // 盒子自身钉在 min(496px, 50vh)。
    const viewportHeight = page.viewportSize()!.height;
    expect(Math.round(box!.height)).toBe(Math.min(496, Math.round(viewportHeight / 2)));

    // 而且它自己不滚动：滚动发生在内部那一层，否则动作行和导入框会被推出视野。
    const scroll = await page.locator(body).evaluate(node => ({
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
    }));
    expect(scroll.scrollHeight).toBe(scroll.clientHeight);
});

test('AI 跑完后按钮回到可用状态，不会永远转圈', async ({ mount, page }) => {
    await page.route('**/api/segment-lyrics', route => route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Mock segmentation failure' }),
    }));
    // 探针页开着 StrictMode，effect 会 mount → cleanup → mount。isMountedRef 的 setup 一旦漏掉
    // 重新置 true，cleanup 写下的 false 就会伴随组件整个生命周期，于是进度不动、结果不保存、
    // finally 也不复位——按钮永远停在「取消 · Ns」。这条就是钉住那个失效模式。
    //
    // 探针没有 electron bridge，所以走 /api/segment-lyrics，这里显式 mock 每批快速失败，
    // 不调用真实 AI。失败与否不重要，重要的是跑完之后按钮必须回到初始态。
    const component = await mount('lyricSegmentationSurface');
    const aiButton = component.getByRole('button', { name: /Segment with AI|Cancel/ });
    await expect(aiButton).toHaveText(/Segment with AI/);

    await aiButton.click();

    // 转圈期间标签是「Cancel · Ns」；结束后必须变回去。
    await expect(aiButton).toHaveText(/Segment with AI/, { timeout: 30_000 });
    await expect(aiButton).toBeEnabled();
    // 全部批次失败时要给出错误，而不是静默什么都不做。
    await expect(page.locator('[data-probe-body] .text-red-400')).toBeVisible();
});

test('异步加载歌词后可粘贴提示词要求的单行 JSON 对象', async ({ mount, page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const component = await mount('lyricSegmentationSurface');
    await expect(component.getByRole('button', { name: 'Copy prompt' })).toBeVisible();

    const rows = Array.from({ length: 60 }, () => ['我', '想要说的话，', '你', '听见了吗']);
    const input = component.getByRole('textbox', { name: 'Segmentation input' });
    await input.evaluate((node, text) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', text);
        node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
    }, JSON.stringify({ lines: rows }));

    await expect(component.locator('[data-probe-saved-count]')).toHaveAttribute('data-probe-saved-count', '1');
    await expect(component.getByText('Manual · 60 lines')).toBeVisible();
    await expect(input).toHaveValue('');
    await expect(component.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);

    const saved = await component.locator('[data-probe-record]').getAttribute('data-probe-record');
    rows[1] = ['改写的歌词'];
    await input.evaluate((node, text) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', text);
        node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
    }, JSON.stringify({ lines: rows }));

    await expect(component.getByRole('alert')).toHaveText('Line 2 does not reproduce the original lyric text');
    await expect(component.locator('[data-probe-saved-count]')).toHaveAttribute('data-probe-saved-count', '1');
    await expect(component.locator('[data-probe-record]')).toHaveAttribute('data-probe-record', saved!);
});

test('无效的单行粘贴显示错误并保留已有分词', async ({ mount }) => {
    const component = await mount('lyricSegmentationSurface');
    await expect(component.getByRole('button', { name: 'Copy prompt' })).toBeVisible();
    const saved = await component.locator('[data-probe-record]').getAttribute('data-probe-record');

    const input = component.getByRole('textbox', { name: 'Segmentation input' });
    for (const [text, error] of [
        ['{"lines":', 'That is not valid JSON'],
        ['unrecognised response', 'The number of lines does not match these lyrics'],
    ]) {
        await input.evaluate((node, pasted) => {
            const clipboardData = new DataTransfer();
            clipboardData.setData('text/plain', pasted);
            node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
        }, text);
        await expect(component.getByRole('alert')).toHaveText(error);
        await expect(input).toHaveValue('');
        await expect(component.locator('[data-probe-saved-count]')).toHaveAttribute('data-probe-saved-count', '0');
        await expect(component.locator('[data-probe-record]')).toHaveAttribute('data-probe-record', saved!);
    }
});

test('歌词尚未加载时不会拦截并吞掉粘贴', async ({ mount }) => {
    const component = await mount('lyricSegmentationSurface', { lyricDelayMs: 1500 });
    await expect(component.getByText('No lyrics to segment')).toBeVisible();
    const input = component.getByRole('textbox', { name: 'Segmentation input' });
    await input.fill('pending');
    const allowed = await input.evaluate(node => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', '{"lines":[]}');
        return node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
    });
    expect(allowed, '未就绪的输入应允许浏览器正常粘贴').toBe(true);
    await expect(input).toHaveValue('pending');
    await expect(component.locator('[data-probe-saved-count]')).toHaveAttribute('data-probe-saved-count', '0');
    await expect(component.getByRole('button', { name: 'Copy prompt' })).toBeVisible();
});

test('动作行始终留在视野里，滚动只发生在预览区', async ({ mount, page }) => {
    const component = await mount('lyricSegmentationSurface');
    await expect(component.getByRole('button', { name: 'Segment with AI' })).toBeVisible();

    const preview = page.locator(`${body} .overflow-y-auto`).last();
    const scrolled = await preview.evaluate(node => {
        node.scrollTop = node.scrollHeight;
        return { top: node.scrollTop, overflowing: node.scrollHeight > node.clientHeight };
    });

    expect(scrolled.overflowing, '探针有 60 行，预览区必须溢出才谈得上滚动').toBe(true);
    expect(scrolled.top).toBeGreaterThan(0);
    await expect(component.getByRole('button', { name: 'Segment with AI' })).toBeVisible();
    await expect(component.getByRole('button', { name: 'Restore default' })).toBeVisible();
});
