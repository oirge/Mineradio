import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

// test/manual/visualizer-memory-probe.mjs

/**
 * 采样单个 visualizer 长跑时的实际内存占用。
 *
 * 为什么不只看 JS 堆：canvas backing store、合成层和 GPU 资源不会完整反映在
 * `Runtime.getHeapUsage` 中。这里按进程采工作集，并按 Chromium 的 --type= 分类，用来
 * 判断增长更接近 renderer、gpu-process 还是 browser；该数据只能缩小范围，不能单独证明
 * 具体分配源。
 *
 * 前置：另开一个终端跑 `npm run dev -- --port 4173`。
 *
 * 用法：
 *   npm run manual:visualizer-memory -- --vis pendolo --seconds 150
 *   npm run manual:visualizer-memory -- --vis monet --dpr 2 --headed
 *   npm run manual:visualizer-memory -- --vis pendolo --query "&heavy=1&switch=5"
 *
 * 注意 --headed：无头模式没有真正的 GPU 合成，gpu-process 那一栏基本没意义。
 * 要对比 GPU 内存必须开 --headed（默认已开）。
 */

const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {
        vis: 'pendolo',
        seconds: 150,
        interval: 15,
        port: '4173',
        dpr: 2,
        width: 1920,
        height: 1080,
        query: '',
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
            case '--vis': options.vis = value; break;
            case '--seconds': options.seconds = Number(value); break;
            case '--interval': options.interval = Number(value); break;
            case '--port': options.port = value; break;
            case '--dpr': options.dpr = Number(value); break;
            case '--width': options.width = Number(value); break;
            case '--height': options.height = Number(value); break;
            case '--query': options.query = value; break;
            default: console.warn(`[visualizer-memory] 未知参数 ${key}`);
        }
    }
    return options;
};

/**
 * 按 user-data-dir 的唯一名字圈出这次启动的整棵 Chromium 进程树，
 * 避免把机器上其它 Chrome 也算进来。
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

const options = parseArgs();
const userDataDir = mkdtempSync(path.join(tmpdir(), 'folia-vismem-'));
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
page.on('console', message => {
    if (message.type() === 'error') console.error('[console.error]', message.text());
});

const url = `http://127.0.0.1:${options.port}/dev-probe.html`
    + `?probe=visualizerMemory&vis=${encodeURIComponent(options.vis)}${options.query}`;
console.log(`[visualizer-memory] ${url}`);
console.log(`[visualizer-memory] ${options.width}x${options.height} @ dpr ${options.dpr}, ${options.headed ? 'headed' : 'headless'}`);
await page.goto(url);
await page.waitForSelector('[data-probe-id="visualizerMemory"]');

// 前几秒是着色器编译、字体加载和纹理预热，读数没有参考价值。
await new Promise(resolve => setTimeout(resolve, 8000));

const rows = [];
const startedAt = Date.now();
while ((Date.now() - startedAt) / 1000 < options.seconds) {
    const sample = sampleByType(readRaw);
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    rows.push({ seconds, ...sample });
    const detail = Object.entries(sample.byType)
        .map(([type, mb]) => `${type}=${mb.toFixed(0)}`)
        .join(' ');
    console.log(`t=${seconds}s total=${sample.total.toFixed(0)}MB  ${detail}`);
    await new Promise(resolve => setTimeout(resolve, options.interval * 1000));
}

const first = rows[0];
const last = rows.at(-1);
if (first && last) {
    console.log(`\n== ${options.vis}${options.query} ==`);
    console.log(`total ${first.total.toFixed(0)} -> ${last.total.toFixed(0)} MB over ${last.seconds - first.seconds}s`);
    for (const type of Object.keys(last.byType)) {
        console.log(`   ${type}: ${(first.byType[type] ?? 0).toFixed(0)} -> ${last.byType[type].toFixed(0)} MB`);
    }
}

await context.close();
