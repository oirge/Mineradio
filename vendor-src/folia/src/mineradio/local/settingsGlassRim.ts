// src/mineradio/local/settingsGlassRim.ts
// Generates size-matched rim displacement maps for embedded Folia glass settings shells.
const SVG_NS = 'http://www.w3.org/2000/svg';
const SELECTOR = '[data-liquid-glass]';

function createSvgElement(name: string, attributes?: Record<string, string | number>): SVGElement {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes || {})) {
        node.setAttribute(key, String(value));
    }
    return node;
}

/**
 * Observe `[data-liquid-glass]` settings shells in the embedded Folia document and attach
 * rim-only SVG refraction filters without modifying text or interior controls.
 */
export function attachLocalSettingsGlass(): () => void {
    if (typeof window === 'undefined' || !window.ResizeObserver || !window.MutationObserver || !window.CSS
        || !CSS.supports('backdrop-filter', 'url(#settings-glass)') || !document.body) {
        return () => {};
    }

    const surfaces = new Map<HTMLElement, { key: string; filter: SVGFilterElement | null; image: SVGFEImageElement | null }>();
    const maps = new Map<string, string>();
    let serial = 0;
    let svg: SVGSVGElement | null = null;
    let defs: SVGDefsElement | null = null;

    function ensureDefinitions(): void {
        if (defs) return;
        svg = createSvgElement('svg', { 'aria-hidden': 'true', focusable: 'false', width: 0, height: 0 }) as SVGSVGElement;
        svg.style.cssText = 'position:fixed;pointer-events:none;overflow:hidden;left:0;top:0';
        defs = createSvgElement('defs') as SVGDefsElement;
        svg.appendChild(defs);
        document.body.appendChild(svg);
    }

    function displacementMap(width: number, height: number, radius: number): string | null {
        const key = `${width}:${height}:${radius}`;
        const existing = maps.get(key);
        if (existing) return existing;
        const resolution = Math.min(1, 640 / Math.max(width, height), Math.sqrt(150000 / (width * height)));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(2, Math.round(width * resolution));
        canvas.height = Math.max(2, Math.round(height * resolution));
        const context = canvas.getContext('2d');
        if (!context) return null;
        const pixels = context.createImageData(canvas.width, canvas.height);
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const rim = Math.min(18, radius, halfWidth / 2, halfHeight / 2);
        for (let y = 0; y < canvas.height; y += 1) {
            for (let x = 0; x < canvas.width; x += 1) {
                const px = (x + 0.5) * width / canvas.width - halfWidth;
                const py = (y + 0.5) * height / canvas.height - halfHeight;
                const qx = Math.abs(px) - halfWidth + radius;
                const qy = Math.abs(py) - halfHeight + radius;
                const ox = Math.max(qx, 0);
                const oy = Math.max(qy, 0);
                const length = Math.sqrt(ox * ox + oy * oy);
                const distance = length + Math.min(Math.max(qx, qy), 0) - radius;
                const inset = -distance;
                const bend = inset > 0 && inset < rim ? Math.sin(inset / rim * Math.PI) * 0.7 : 0;
                const nx = length > 0 ? ox / length : (qx > qy ? 1 : 0);
                const ny = length > 0 ? oy / length : (qx > qy ? 0 : 1);
                const idx = (y * canvas.width + x) * 4;
                pixels.data[idx] = Math.round(128 + Math.sign(px) * nx * bend * 127);
                pixels.data[idx + 1] = Math.round(128 + Math.sign(py) * ny * bend * 127);
                pixels.data[idx + 2] = 128;
                pixels.data[idx + 3] = 255;
            }
        }
        context.putImageData(pixels, 0, 0);
        const href = canvas.toDataURL();
        maps.set(key, href);
        if (maps.size > 12) {
            const oldest = maps.keys().next().value;
            if (oldest !== undefined) maps.delete(oldest);
        }
        return href;
    }

    function prepare(surface: HTMLElement, width: number, height: number): void {
        const record = surfaces.get(surface);
        if (!record || width < 2 || height < 2 || !surface.isConnected) return;
        const roundedWidth = Math.round(width);
        const roundedHeight = Math.round(height);
        const radius = Math.round(Math.min(
            parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 28,
            roundedWidth / 2,
            roundedHeight / 2,
        ));
        const key = `${roundedWidth}:${roundedHeight}:${radius}`;
        if (record.key === key) return;
        const href = displacementMap(roundedWidth, roundedHeight, radius);
        if (!href) return;
        ensureDefinitions();
        if (!record.filter && defs) {
            const id = `folia-settings-glass-${++serial}`;
            record.filter = createSvgElement('filter', {
                id, x: '-8%', y: '-8%', width: '116%', height: '116%',
                'color-interpolation-filters': 'sRGB',
            }) as SVGFilterElement;
            record.image = createSvgElement('feImage', {
                x: 0, y: 0, width: '100%', height: '100%', preserveAspectRatio: 'none', result: 'rim',
            }) as SVGFEImageElement;
            record.filter.appendChild(record.image);
            [18, 16, 14].forEach((scale, index) => {
                const channel = (['red', 'green', 'blue'] as const)[index];
                record.filter!.appendChild(createSvgElement('feDisplacementMap', {
                    in: 'SourceGraphic', in2: 'rim', scale,
                    xChannelSelector: 'R', yChannelSelector: 'G', result: `${channel}-shift`,
                }));
                const matrix = new Array<number>(20).fill(0);
                matrix[index * 5 + index] = 1;
                matrix[18] = 1;
                record.filter!.appendChild(createSvgElement('feColorMatrix', {
                    in: `${channel}-shift`, type: 'matrix', values: matrix.join(' '), result: channel,
                }));
            });
            record.filter.appendChild(createSvgElement('feBlend', { in: 'red', in2: 'green', mode: 'screen', result: 'red-green' }));
            record.filter.appendChild(createSvgElement('feBlend', { in: 'red-green', in2: 'blue', mode: 'screen' }));
            defs.appendChild(record.filter);
            surface.style.setProperty('--settings-refraction', `url(#${id})`);
        }
        record.image?.setAttribute('href', href);
        record.key = key;
        surface.setAttribute('data-settings-glass-ready', 'true');
    }

    const resize = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const target = entry.target as HTMLElement;
            const box = entry.borderBoxSize?.[0];
            prepare(target, box ? box.inlineSize : target.offsetWidth, box ? box.blockSize : target.offsetHeight);
        }
    });

    function attach(surface: Element): void {
        if (!(surface instanceof HTMLElement) || surfaces.has(surface) || !surface.isConnected) return;
        if (surface.parentElement?.closest(SELECTOR)) return;
        surfaces.set(surface, { key: '', filter: null, image: null });
        resize.observe(surface);
    }

    function detach(surface: Element): void {
        if (!(surface instanceof HTMLElement) || surface.isConnected) return;
        const record = surfaces.get(surface);
        if (!record) return;
        resize.unobserve(surface);
        record.filter?.remove();
        surfaces.delete(surface);
        surface.style.removeProperty('--settings-refraction');
        surface.removeAttribute('data-settings-glass-ready');
    }

    function visit(node: Node, callback: (el: Element) => void): void {
        if (!(node instanceof Element)) return;
        if (node.matches(SELECTOR)) callback(node);
        node.querySelectorAll(SELECTOR).forEach(callback);
    }

    const mutations = new MutationObserver((entries) => {
        for (const entry of entries) {
            entry.addedNodes.forEach((node) => visit(node, attach));
            entry.removedNodes.forEach((node) => visit(node, detach));
        }
    });

    visit(document.body, attach);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
        resize.disconnect();
        mutations.disconnect();
        maps.clear();
        surfaces.clear();
        svg?.remove();
        svg = null;
        defs = null;
    };
}
