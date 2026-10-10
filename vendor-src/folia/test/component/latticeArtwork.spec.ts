import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

// test/component/latticeArtwork.spec.ts
// Each poster requests the cover variant its own box needs, and trades up when it changes gear.
// Both only show up in a real browser: the chosen step lands in a computed background-image, and
// the swap is an image decode racing the expansion spring.

// A 1x1 PNG. What matters is which URL a card asks for, not what the bytes decode to.
const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
);

// Past the end of the opening tile-landing wave, so no card is measured mid-flight.
const settle = (page: Page) => page.waitForTimeout(1200);

const serveCovers = (page: Page) => page.route(
    'https://navidrome.test/**',
    route => route.fulfill({ contentType: 'image/png', body: PIXEL }),
);

/** Size parameter in a poster's painted cover URL, which is the ladder step it settled on. */
const coverStep = (poster: Locator) => poster.evaluate(node => (
    Number(getComputedStyle(node).backgroundImage.match(/size=(\d+)/)?.[1] ?? 0)
));

test('every poster asks for the cover step its own box needs', async ({ mount, page }) => {
    await serveCovers(page);
    const wall = await mount('lattice', { covers: 'stepped' });
    await settle(page);

    const posters = await wall.evaluate(node => (
        [...node.querySelectorAll<HTMLElement>('.lattice-poster')].map(poster => {
            const rect = poster.getBoundingClientRect();
            return {
                // A square cover is scaled to the longer edge, so that edge is what has to be covered.
                pixels: Math.max(rect.width, rect.height) * window.devicePixelRatio,
                step: Number(getComputedStyle(poster).backgroundImage.match(/size=(\d+)/)?.[1] ?? 0),
            };
        })
    ));

    expect(posters.length).toBeGreaterThan(8);
    // Nothing falls back to the provider's own asset, which is what every card used to load.
    expect(posters.filter(poster => ![256, 512, 1024].includes(poster.step))).toEqual([]);
    // A block mixes gears, so a wall drawing one size for all of them would not be following boxes.
    expect(new Set(posters.map(poster => poster.step)).size).toBeGreaterThan(1);
    // The guarantee the ladder owes every card: at least as many pixels as the box paints. The
    // reverse does not hold and must not be asserted - a card that shrank when a neighbour opened
    // keeps the sharper variant it already had rather than refetching a smaller one.
    expect(posters.filter(poster => poster.step < poster.pixels)).toEqual([]);
});

test('expanding a card trades up without ever emptying its box', async ({ mount, page }) => {
    await serveCovers(page);
    const wall = await mount('lattice', { covers: 'stepped' });
    await settle(page);

    // Smallest card fully inside the viewport: clickable, and far enough down the ladder that
    // opening it is a real change of step.
    const instanceId = await wall.evaluate(node => {
        const inView = [...node.querySelectorAll<HTMLElement>('.lattice-poster:not(.is-expanded)')]
            .map(poster => ({ poster, rect: poster.getBoundingClientRect() }))
            .filter(({ rect }) => rect.left >= 0 && rect.top >= 0
                && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight)
            .sort((left, right) => (
                Math.max(left.rect.width, left.rect.height) - Math.max(right.rect.width, right.rect.height)
            ));
        return inView[0]?.poster.dataset.instanceId ?? '';
    });
    expect(instanceId).not.toBe('');

    const poster = wall.locator(`.lattice-poster[data-instance-id="${instanceId}"]`);
    const collapsedStep = await coverStep(poster);
    expect(collapsedStep).toBeLessThan(1024);

    await poster.click();
    // Sampled every frame across the expansion spring. A card that pointed at the sharper variant
    // before its bytes had decoded would leave frames here with no artwork at all.
    const frames = await poster.evaluate(node => new Promise<string[]>(resolve => {
        const seen: string[] = [];
        const start = performance.now();
        const sample = () => {
            seen.push(getComputedStyle(node).backgroundImage);
            if (performance.now() - start < 900) requestAnimationFrame(sample);
            else resolve(seen);
        };
        sample();
    }));

    expect(frames.length).toBeGreaterThan(10);
    expect(frames.filter(frame => !frame.startsWith('url('))).toEqual([]);
    await expect(poster).toHaveClass(/is-expanded/);
    expect(await coverStep(poster)).toBeGreaterThan(collapsedStep);
});
