import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// test/unit/onlineMusic/qqServerlessClosure.test.ts
// 三条部署 gate，都是为了避免「CI 绿 + 生产 404 / 部署被拒」这类只在真平台才暴露的问题：
//   1. `api/qq.js` 这个入库产物必须真的存在（Vercel 直接跑它，源文件编译不出来就是 404）。
//   2. `./serverless` 的依赖闭包必须零 npm 包、零 `node:*`。
//      Cloudflare 可以靠 `nodejs_compat` 容忍 node 内建，Vercel Edge 没有对应开关，
//      闭包一旦混进 `node:*` 就是部署阶段直接被拒 —— 那是最贵的发现时机。
//   3. 闭包里的 `process.env.*` 必须由 Wrangler 编译期 define 消掉；否则 bundle 会成功、
//      但 workerd 在初始化模块时才因 `process is not defined` 崩掉。

const repoRoot = path.resolve(__dirname, '../../..');
const packageRoot = path.join(repoRoot, 'node_modules/@yakult-green-tea/qq-music-api/dist-esm/src');
const serverlessEntry = path.join(packageRoot, 'serverless/index.js');
// Durable Object 从这条子路径获取 MQTT 监听器。根导出 import 时会启动 Koa server，Worker
// 碰不得，所以它必须是独立入口 —— 也就必须独立受同一套闭包约束。
const mqttEntry = path.join(packageRoot, 'serverless/mqtt.js');

// 静态、有 `.js` 后缀的 ESM 产物，所以直接走导入图比起过一遍 bundler 更可靠：
// `--external` / alias 成空模块 / 改 dynamic import 都能骗过 bundler 的 metafile，骗不过这里。
const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g;
const PROCESS_ENV_REFERENCE = /\bprocess\.env\.([A-Z0-9_]+)/g;
const BUFFER_REFERENCE = /\bBuffer\s*(?:\.|\()/;

/** 从入口出发遍历相对导入，回传（已访问文件, 非相对 specifier 集合）。 */
function walkImportGraph(entry: string): { files: string[]; external: string[] } {
    const seen = new Set<string>();
    const external = new Set<string>();
    const queue = [entry];

    while (queue.length > 0) {
        const current = queue.pop() as string;
        if (seen.has(current) || !existsSync(current)) continue;
        seen.add(current);

        const source = readFileSync(current, 'utf8');
        for (const [, specifier] of source.matchAll(IMPORT_SPECIFIER)) {
            if (specifier.startsWith('.')) {
                queue.push(path.resolve(path.dirname(current), specifier));
            } else {
                external.add(specifier);
            }
        }
    }

    return { files: [...seen], external: [...external] };
}

describe('QQ serverless deployment gates', () => {
    it('keeps the compiled Vercel entry in the repository', () => {
        // `api/` 是入库产物目录，Vercel 部署直接消费它；漏掉这一步 CI 全绿但线上 404。
        expect(existsSync(path.join(repoRoot, 'api/qq.js'))).toBe(true);
    });

    it.each([
        ['serverless', serverlessEntry],
        ['mqtt', mqttEntry],
    ])('reaches no npm package and no node builtin from the %s entry', (_name, entry) => {
        expect(existsSync(entry)).toBe(true);

        const { files, external } = walkImportGraph(entry);

        // 闭包不为空才说明遍历真的走通了，否则这条 gate 会安静地永远为绿。
        expect(files.length).toBeGreaterThan(1);
        // 非相对导入一个都不该有：既没有 npm 包（Workers 装不到），也没有 `node:*`
        // （Cloudflare 能靠 nodejs_compat 容忍，Vercel Edge 会在部署阶段直接拒收）。
        expect(external).toEqual([]);
    });

    it('defines every process.env reference before Cloudflare evaluates the bundle', () => {
        const { files } = walkImportGraph(serverlessEntry);
        files.push(...walkImportGraph(mqttEntry).files);
        const references = new Set<string>();
        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            for (const [, name] of source.matchAll(PROCESS_ENV_REFERENCE)) {
                references.add(`process.env.${name}`);
            }
        }

        const wranglerConfig = JSON.parse(readFileSync(path.join(repoRoot, 'wrangler.jsonc'), 'utf8')) as {
            define?: Record<string, string>;
        };
        const uncovered = [...references].filter(reference => !(reference in (wranglerConfig.define ?? {})));

        expect(references.size).toBeGreaterThan(0);
        expect(uncovered).toEqual([]);
    });

    it('installs the Buffer global required by the Cloudflare QQ request path', () => {
        // MQTT codec 也是纯 Buffer 的，而 Durable Object 与入口同在一个 bundle、同一个 isolate，
        // 所以 worker/index.ts 模块作用域里那一行同时管住了两条路径。
        const { files } = walkImportGraph(serverlessEntry);
        files.push(...walkImportGraph(mqttEntry).files);
        expect(files.some(file => BUFFER_REFERENCE.test(readFileSync(file, 'utf8')))).toBe(true);

        const workerEntry = readFileSync(path.join(repoRoot, 'worker/index.ts'), 'utf8');
        expect(workerEntry).toMatch(/import\s*\{\s*Buffer\s*\}\s*from\s*['"]buffer['"]/);
        expect(workerEntry).toMatch(/globalThis[^\n]*Buffer/);
    });
});
