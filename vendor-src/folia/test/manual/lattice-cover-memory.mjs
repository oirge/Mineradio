import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

// test/manual/lattice-cover-memory.mjs

/**
 * Measures what the poster wall's cover artwork actually costs, per cover strategy.
 *
 * Why not DevTools: its heap panel and the memory tooling attribute retainers rather than resident
 * bytes, and having the frontend attached inflates the renderer on its own. This samples the OS
 * working set of every process in one throwaway Chromium profile instead, split by Chromium's
 * `--type=`, the same way `visualizer-memory-probe.mjs` does.
 *
 * Read the frame-interval table first. Working set is the noisier signal by far: Chromium discards
 * decoded image data under pressure and re-decodes on demand, so oversized sources do not sit in
 * RSS - they come back as raster work on every repaint. Measured here, per-mode run-to-run spread
 * on the gpu process reached 113MB with 1500px sources, which swallows the difference between
 * strategies whole; at 3000px the totals separate far enough to read. Frame pacing during the pan
 * separates cleanly at both sizes. Report a memory delta only when it clears the spread column.
 *
 * Three runs, each in its own cold profile so no image cache carries over:
 *   off       - the wall with no artwork at all, the floor everything else is measured against
 *   original  - every card paints the provider's full-size asset, which is what it did before
 *   stepped   - every card asks for the ladder step its own box needs
 *
 * `original` is not an old build: the probe hands it a URL shape no provider rule matches, so
 * `getSizedCoverUrl` returns it untouched and the current code paints originals everywhere.
 *
 * Covers are synthesised here at whatever size is requested, so nothing leaves the machine. They
 * are smooth gradients, which compress far better than a photograph - read the transfer column as
 * a lower bound on bytes, and the decoded column as the real one, since a decoded bitmap costs
 * width x height x 4 whatever the file compressed to.
 *
 * Prerequisite: a dev server on the port below, e.g. `npm run dev -- --port 4173`.
 *
 * Usage:
 *   node test/manual/lattice-cover-memory.mjs
 *   node test/manual/lattice-cover-memory.mjs --queue 60 --dpr 2 --original 1500
 *   node test/manual/lattice-cover-memory.mjs --headless --queue 24
 *
 * Note --headed (the default): headless has no real GPU compositing, so the gpu row is meaningless
 * there and only the renderer row can be compared.
 */

const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {
        queue: 60,
        original: 1500,
        port: '4173',
        dpr: 2,
        width: 1920,
        height: 1080,
        settleMs: 2500,
        repeat: 3,
        headed: true,
    };
    for (let i = 0; i < args.length; i += 1) {
        const key = args[i];
        if (key === '--headless') { options.headed = false; continue; }
        if (key === '--headed') { options.headed = true; continue; }
        const value = args[i + 1];
        if (value === undefined || !key.startsWith('--')) continue;
        i += 1;
        switch (key) {
            case '--queue': options.queue = Number(value); break;
            case '--original': options.original = Number(value); break;
            case '--port': options.port = value; break;
            case '--dpr': options.dpr = Number(value); break;
            case '--width': options.width = Number(value); break;
            case '--height': options.height = Number(value); break;
            case '--settle': options.settleMs = Number(value); break;
            case '--repeat': options.repeat = Number(value); break;
            default: console.warn(`[lattice-cover-memory] unknown argument ${key}`);
        }
    }
    return options;
};

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
});

const crc32 = (buffer) => {
    let crc = 0xffffffff;
    for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
};

/** A real RGB PNG of exactly `size` square; content is a gradient, only the dimensions matter. */
const renderedCovers = new Map();
const renderCover = (size) => {
    const cached = renderedCovers.get(size);
    if (cached) return cached;

    const stride = size * 3 + 1;
    const raw = Buffer.alloc(stride * size);
    for (let y = 0; y < size; y += 1) {
        const row = y * stride;
        for (let x = 0; x < size; x += 1) {
            const pixel = row + 1 + x * 3;
            raw[pixel] = (x * 255 / size) | 0;
            raw[pixel + 1] = (y * 255 / size) | 0;
            raw[pixel + 2] = ((x ^ y) & 0xff);
        }
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 2;
    const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', header),
        pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
    renderedCovers.set(size, png);
    return png;
};

/**
 * Isolates this launch's process tree by its unique user-data-dir, so other Chromium instances on
 * the machine are not counted.
 */
const createProcessSampler = (marker) => {
    if (process.platform === 'win32') {
        const script = `Get-CimInstance Win32_Process`
            + ` | Where-Object { $_.CommandLine -like '*${marker}*' }`
            + ` | ForEach-Object {`
            + ` $m = [regex]::Match($_.CommandLine, '--type=([a-zA-Z-]+)');`
            + ` $t = if ($m.Success) { $m.Groups[1].Value } else { 'browser' };`
            + ` '{0}|{1}' -f $_.WorkingSetSize, $t }`;
        return () => execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' });
    }

    return () => {
        const out = execFileSync('ps', ['-eo', 'rss=,args='], { encoding: 'utf8' });
        return out
            .split('\n')
            .filter(line => line.includes(marker))
            .map(line => {
                const rssKb = Number(line.trim().split(/\s+/)[0]);
                const type = /--type=([a-zA-Z-]+)/.exec(line)?.[1] ?? 'browser';
                return `${rssKb * 1024}|${type}`;
            })
            .join('\n');
    };
};

const sampleByType = (readRaw) => {
    const byType = {};
    let total = 0;
    for (const line of readRaw().trim().split(/\r?\n/)) {
        if (!line) continue;
        const [bytes, type] = line.split('|');
        const mb = Number(bytes) / 1048576;
        if (!Number.isFinite(mb)) continue;
        byType[type || 'browser'] = (byType[type || 'browser'] ?? 0) + mb;
        total += mb;
    }
    return { total, byType };
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const options = parseArgs();

// Wheel deltas the wall's own handler consumes, so browsing mounts and unmounts real posters
// instead of the run only ever measuring the first screenful.
const panWall = async (page) => {
    for (const [deltaX, deltaY] of [[900, 0], [0, 700], [900, 0], [0, -700], [-1800, 0]]) {
        await page.locator('.lattice-field').evaluate((node, [x, y]) => {
            node.dispatchEvent(new WheelEvent('wheel', { deltaX: x, deltaY: y, bubbles: true, cancelable: true }));
        }, [deltaX, deltaY]);
        await wait(400);
    }
    await wait(1200);
};

const runMode = async (mode) => {
    const userDataDir = mkdtempSync(path.join(tmpdir(), `folia-cover-${mode}-`));
    const marker = path.basename(userDataDir);
    const readRaw = createProcessSampler(marker);

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: !options.headed,
        args: ['--no-sandbox'],
        viewport: { width: options.width, height: options.height },
        deviceScaleFactor: options.dpr,
    });
    const page = context.pages()[0] ?? await context.newPage();
    page.on('pageerror', error => console.error('[pageerror]', error.message));

    // A PerformanceObserver rather than getEntriesByType: dev mode serves hundreds of modules and
    // fills the 250-entry resource buffer long before the first cover, so the entries that matter
    // are exactly the ones that get dropped.
    await page.addInitScript(() => {
        window.__covers = [];
        new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
                if (!entry.name.includes('navidrome.test')) continue;
                window.__covers.push({ name: entry.name, bytes: entry.encodedBodySize || entry.transferSize || 0 });
            }
        }).observe({ type: 'resource', buffered: true });
    });

    // Every cover is generated at the size the URL asks for, so the ladder's choices are what
    // decide how many pixels reach the renderer. Bytes are counted here because a fulfilled route
    // reports an encodedBodySize of 0 to the page's own resource timing.
    let wireBytes = 0;
    await page.route('https://navidrome.test/**', route => {
        const url = new URL(route.request().url());
        const size = Number(url.searchParams.get('size')) || options.original;
        const body = renderCover(size);
        wireBytes += body.length;
        route.fulfill({ contentType: 'image/png', body });
    });

    await page.goto(`http://127.0.0.1:${options.port}/dev-probe.html`);
    await page.evaluate(([covers, queueLength]) => window.mount({
        story: 'lattice',
        props: { covers, queueLength },
    }), [mode, options.queue]);
    await page.waitForSelector('.lattice-poster');
    await wait(options.settleMs);
    // First screenful only: the closest thing to "open the wall and look at it".
    const atRest = sampleByType(readRaw);

    // Frame intervals across the pan. Chromium discards decoded image data and re-decodes on
    // demand, so oversized sources cost repeated raster work long after they stop costing resident
    // bytes - this is where that shows. Intervals include every kind of browser work, so they bound
    // the cost rather than attributing it.
    await page.evaluate(() => {
        window.__frames = [];
        window.__sampling = true;
        let previous = performance.now();
        const tick = (now) => {
            window.__frames.push(now - previous);
            previous = now;
            if (window.__sampling) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
    await panWall(page);
    const frames = await page.evaluate(() => {
        window.__sampling = false;
        return window.__frames.slice(2);
    });
    // Idle long enough for the wall's own unmounts to have run and for the browser to have settled;
    // what is still resident here is what browsing the wall actually holds.
    await wait(2000);

    const memory = sampleByType(readRaw);

    // Read after sampling: these Image objects would otherwise add decoded bitmaps of their own.
    const assets = await page.evaluate(() => {
        const entries = window.__covers ?? [];
        const distinct = [...new Set(entries.map(entry => entry.name))];
        return Promise.all(distinct.map(url => new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve({ url, width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => resolve({ url, width: 0, height: 0 });
            image.src = url;
        }))).then(loaded => ({
            requests: entries.length,
            posters: document.querySelectorAll('.lattice-poster').length,
            loaded,
        }));
    });

    await context.close();

    const decodedBytes = assets.loaded.reduce((sum, asset) => sum + asset.width * asset.height * 4, 0);
    const transferBytes = wireBytes;
    const steps = {};
    for (const asset of assets.loaded) {
        steps[asset.width] = (steps[asset.width] ?? 0) + 1;
    }

    const sortedFrames = [...frames].sort((left, right) => left - right);
    const frameStats = {
        count: frames.length,
        p95: sortedFrames[Math.floor(sortedFrames.length * 0.95)] ?? 0,
        max: sortedFrames.at(-1) ?? 0,
        janky: frames.filter(interval => interval > 33.3).length,
    };

    return { mode, memory, atRest, decodedBytes, transferBytes, steps, frameStats, ...assets };
};

console.log(`[lattice-cover-memory] ${options.width}x${options.height} @ dpr ${options.dpr}, `
    + `queue ${options.queue}, original ${options.original}px, ${options.repeat}x each, `
    + `${options.headed ? 'headed' : 'headless'}`);

const MODES = ['off', 'original', 'stepped'];
const runs = [];
// Modes rotate rather than running all repeats of one before the next, so a machine that warms up
// or throttles during the session cannot line that drift up with a single mode.
for (let round = 0; round < options.repeat; round += 1) {
    for (const mode of MODES) {
        process.stdout.write(`[lattice-cover-memory] round ${round + 1} ${mode} ... `);
        const result = await runMode(mode);
        runs.push(result);
        console.log(`renderer ${(result.memory.byType.renderer ?? 0).toFixed(0)}MB`);
    }
}

const mb = (bytes) => (bytes / 1048576).toFixed(1);
/** Median, not mean: one launch that happens to land next to a GC or a compositor flush skews a mean. */
const median = (values) => {
    const sorted = [...values].sort((left, right) => left - right);
    if (sorted.length === 0) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const summary = MODES.map(mode => {
    const forMode = runs.filter(run => run.mode === mode);
    const pick = (read) => median(forMode.map(read));
    return {
        mode,
        runs: forMode.length,
        posters: forMode[0].posters,
        requests: pick(run => run.requests),
        assets: pick(run => run.loaded.length),
        decoded: pick(run => run.decodedBytes),
        transfer: pick(run => run.transferBytes),
        restGpu: pick(run => run.atRest.byType['gpu-process'] ?? 0),
        renderer: pick(run => run.memory.byType.renderer ?? 0),
        gpuSpread: Math.max(...forMode.map(run => run.memory.byType['gpu-process'] ?? 0))
            - Math.min(...forMode.map(run => run.memory.byType['gpu-process'] ?? 0)),
        rendererSpread: Math.max(...forMode.map(run => run.memory.byType.renderer ?? 0))
            - Math.min(...forMode.map(run => run.memory.byType.renderer ?? 0)),
        gpu: pick(run => run.memory.byType['gpu-process'] ?? 0),
        total: pick(run => run.memory.total),
        framesP95: pick(run => run.frameStats.p95),
        framesMax: pick(run => run.frameStats.max),
        janky: pick(run => run.frameStats.janky),
        frameCount: pick(run => run.frameStats.count),
        steps: forMode[0].steps,
    };
});

console.log();
console.log('median of each column across runs; renderer/gpu are OS working set, not DevTools figures');
console.log('mode      posters  reqs  assets  decoded(MB)  wire(MB)  rest-gpu  gpu  renderer  spread  total');
for (const row of summary) {
    console.log(
        `${row.mode.padEnd(9)} ${String(row.posters).padStart(7)} ${String(row.requests).padStart(5)}`
        + ` ${String(row.assets).padStart(7)} ${mb(row.decoded).padStart(12)} ${mb(row.transfer).padStart(9)}`
        + ` ${row.restGpu.toFixed(0).padStart(9)} ${row.gpu.toFixed(0).padStart(4)}`
        + ` ${row.renderer.toFixed(0).padStart(9)} ${row.rendererSpread.toFixed(0).padStart(7)}`
        + ` ${row.total.toFixed(0).padStart(6)}`,
    );
}

const floor = summary.find(row => row.mode === 'off');
console.log();
console.log('over the artwork-free floor (median):');
for (const row of summary.filter(entry => entry.mode !== 'off')) {
    console.log(`   ${row.mode.padEnd(9)} renderer +${(row.renderer - floor.renderer).toFixed(0)}MB`
        + `  gpu +${(row.gpu - floor.gpu).toFixed(0)}MB`
        + `  total +${(row.total - floor.total).toFixed(0)}MB`);
}
console.log(`   run-to-run gpu spread within a mode: `
    + `${summary.map(row => `${row.mode} ${row.gpuSpread.toFixed(0)}MB`).join(', ')}`);

console.log();
console.log('frame intervals while panning the wall (median across runs):');
console.log('mode      frames  p95(ms)  max(ms)  over 33ms');
for (const row of summary) {
    console.log(`${row.mode.padEnd(9)} ${String(row.frameCount).padStart(6)}`
        + ` ${row.framesP95.toFixed(1).padStart(8)} ${row.framesMax.toFixed(1).padStart(8)}`
        + ` ${String(row.janky).padStart(10)}`);
}

console.log();
console.log('assets fetched, by decoded width:');
for (const row of summary.filter(entry => entry.mode !== 'off')) {
    const detail = Object.entries(row.steps)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([width, count]) => `${width}px x${count}`)
        .join('  ');
    console.log(`   ${row.mode.padEnd(9)} ${detail || 'none'}`);
}
