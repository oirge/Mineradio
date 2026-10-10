import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// test/component/nativeDragGuard.spec.ts
// #394：页面上有选区时，进度条和设置滑块不能被浏览器的原生 drag 抢走手势。
// 这是只有真实浏览器里才会发生的事（选区拖拽、pointercancel），所以走组件探针，
// 见 dev/probes/nativeDragGuard.probe.tsx。

const ROOT = '[data-probe-guard]';
const PROGRESS = '[data-probe="progress"] input[type="range"]';
const VOLUME = '[data-probe="volume"]';

const readAttr = (page: Page, name: string) => page.locator(ROOT).getAttribute(name);

/** 在整个页面（含滑块自己）上建立选区，等价于用户 Ctrl+A */
const selectEverything = (page: Page) => page.evaluate(() => {
    window.getSelection()?.selectAllChildren(document.querySelector('[data-probe-guard]')!);
});

/** 只选中封面图和标题文字，选区不包含滑块 */
const selectCoverAndText = (page: Page) => page.evaluate(() => {
    const range = document.createRange();
    range.setStartBefore(document.querySelector('[data-probe="cover"]')!);
    range.setEndAfter(document.querySelector('[data-probe="text"]')!);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
});

/** 从滑块 fromRatio 处按下，水平拖到 toRatio 处再松开 */
async function dragSlider(page: Page, selector: string, fromRatio: number, toRatio: number): Promise<void> {
    const box = (await page.locator(selector).boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * fromRatio, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * ((fromRatio + toRatio) / 2), y, { steps: 6 });
    await page.mouse.move(box.x + box.width * toRatio, y, { steps: 6 });
    await page.mouse.up();
}

const lastSeek = async (page: Page): Promise<number> => {
    const seeks = ((await readAttr(page, 'data-probe-seeks')) ?? '').split(',').filter(Boolean);
    return Number(seeks[seeks.length - 1] ?? NaN);
};

test.describe('开启保护（产品默认）', () => {
    test.beforeEach(async ({ mount }) => {
        await mount('nativeDragGuard');
    });

    test('选区包含进度条时，拖动进度条仍然能 seek 到拖到的位置', async ({ page }) => {
        await selectEverything(page);
        await dragSlider(page, PROGRESS, 0.2, 0.8);

        // 240s * 0.8 = 192s，容许落点取整误差
        expect(await lastSeek(page)).toBeGreaterThan(180);
    });

    test('选区包含音量滑块时，拖动滑块不会收到 pointercancel', async ({ page }) => {
        await selectEverything(page);
        await dragSlider(page, VOLUME, 0.2, 0.9);

        expect(Number(await readAttr(page, 'data-probe-volume'))).toBeGreaterThan(80);
        expect(await readAttr(page, 'data-probe-volume-cancels')).toBe('0');
    });

    test('选区不含滑块（只选了封面和文字）时，拖滑块同样正常', async ({ page }) => {
        await selectCoverAndText(page);
        await dragSlider(page, PROGRESS, 0.2, 0.8);

        expect(await lastSeek(page)).toBeGreaterThan(180);
    });

    test('拖封面图和链接不再发起原生拖拽', async ({ page }) => {
        for (const target of ['cover', 'link']) {
            const box = (await page.locator(`[data-probe="${target}"]`).boundingBox())!;
            await page.mouse.move(box.x + 10, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + 150, box.y + 80, { steps: 8 });
            await page.mouse.up();
        }
        const starts = (await readAttr(page, 'data-probe-dragstarts')) ?? '';
        const prevented = ((await readAttr(page, 'data-probe-dragprevented')) ?? '').split(',').filter(Boolean);
        // 浏览器仍会派发 dragstart（先断言确实发生过，免得下面的断言空转），但每一次都必须被阻止
        expect(starts.split(',').filter(Boolean).length).toBeGreaterThan(0);
        expect(prevented.every(value => value === 'true')).toBe(true);
    });

    test('文本框里的文字选择、拖拽不受影响', async ({ page }) => {
        const field = page.locator('[data-probe="field"]');
        await field.dblclick();
        const selected = await field.evaluate((el: HTMLInputElement) => el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0));
        expect(selected.length).toBeGreaterThan(0);

        // 拖选：从文本框开头拖到中间，应得到一段选区
        const box = (await field.boundingBox())!;
        await page.mouse.move(box.x + 6, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 90, box.y + box.height / 2, { steps: 6 });
        await page.mouse.up();
        const dragSelected = await field.evaluate((el: HTMLInputElement) => (el.selectionEnd ?? 0) - (el.selectionStart ?? 0));
        expect(dragSelected).toBeGreaterThan(3);
    });

    test('文本框内已选中文字时，对选中文字发起拖拽不会被拦截', async ({ page }) => {
        const area = page.locator('[data-probe="area"]');
        await area.focus();
        await page.keyboard.press('Control+A');
        const box = (await area.boundingBox())!;
        await page.mouse.move(box.x + 20, box.y + 12);
        await page.mouse.down();
        await page.mouse.move(box.x + 200, box.y + 60, { steps: 8 });
        await page.mouse.up();

        const prevented = ((await readAttr(page, 'data-probe-dragprevented')) ?? '').split(',').filter(Boolean);
        expect(prevented.length).toBeGreaterThan(0);
        expect(prevented).not.toContain('true');
    });

    test('contenteditable 与显式 data-native-drag 的元素保留原生拖拽', async ({ page }) => {
        const editable = page.locator('[data-probe="editable"]');
        await editable.click();
        await page.keyboard.press('Control+A');
        const box = (await editable.boundingBox())!;
        await page.mouse.move(box.x + 20, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 200, box.y + 80, { steps: 8 });
        await page.mouse.up();

        const allowed = page.locator('[data-probe="draggable-cover"]');
        const allowedBox = (await allowed.boundingBox())!;
        await page.mouse.move(allowedBox.x + 10, allowedBox.y + 10);
        await page.mouse.down();
        await page.mouse.move(allowedBox.x + 160, allowedBox.y - 60, { steps: 8 });
        await page.mouse.up();

        const prevented = ((await readAttr(page, 'data-probe-dragprevented')) ?? '').split(',').filter(Boolean);
        expect(prevented.length).toBeGreaterThan(0);
        expect(prevented).not.toContain('true');
    });

    test('dragstart 目标为文本节点、SVG 元素、shadow DOM 内部元素时不报错且判定正确', async ({ page }) => {
        const result = await page.evaluate(() => {
            const fire = (target: EventTarget) => {
                const event = new DragEvent('dragstart', { bubbles: true, cancelable: true, composed: true });
                target.dispatchEvent(event);
                return event.defaultPrevented;
            };
            const root = document.querySelector('[data-probe-guard]')!;

            const textNode = document.querySelector('[data-probe="text"]')!.firstChild!;
            const editableText = document.querySelector('[data-probe="editable"]')!.firstChild!;

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            svg.appendChild(rect);
            root.appendChild(svg);

            const host = document.createElement('div');
            root.appendChild(host);
            const shadow = host.attachShadow({ mode: 'open' });
            const shadowSpan = document.createElement('span');
            const shadowInput = document.createElement('input');
            shadowInput.type = 'text';
            const shadowRange = document.createElement('input');
            shadowRange.type = 'range';
            shadow.append(shadowSpan, shadowInput, shadowRange);

            const outcome = {
                text: fire(textNode),
                editableText: fire(editableText),
                svgRect: fire(rect),
                shadowSpan: fire(shadowSpan),
                shadowTextInput: fire(shadowInput),
                shadowRange: fire(shadowRange),
            };
            svg.remove();
            host.remove();
            return outcome;
        });

        expect(result).toEqual({
            text: true,
            editableText: false,
            svgRect: true,
            shadowSpan: true,
            shadowTextInput: false,
            shadowRange: true,
        });
    });
});

test.describe('关闭保护（复现 #394 的对照组）', () => {
    test.beforeEach(async ({ mount }) => {
        await mount('nativeDragGuard', { guard: false });
    });

    test('没有保护时，选区存在会让进度条拖动失效', async ({ page }) => {
        await selectEverything(page);
        await dragSlider(page, PROGRESS, 0.2, 0.8);

        // 对照组只用来证明问题真实存在：seek 到不了拖动终点，且发生了原生 dragstart
        const starts = (await readAttr(page, 'data-probe-dragstarts')) ?? '';
        expect(starts.length).toBeGreaterThan(0);
        expect(await lastSeek(page)).not.toBeGreaterThan(180);
    });
});
