import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// test/unit/library/suiteEntries.test.ts
// suite 的 entry.ts 按源码文本检查（registry 用 eager glob 发现它们，谁碰 registry 谁就加载全部 entry）：
// - 除默认 suite 外，entry 不能静态 import 任何组件，组件一律 React.lazy(() => import('./…'))——
//   否则一个开发版专用的 suite 会把它的整套 UI 拉进首页外壳；
// - 默认 suite（grid）是唯一的例外（首屏与移形换影，理由写在 grid/entry.ts），而且只限下面这份清单：
//   新加的组件要么 lazy，要么有意识地加进清单；
// - 非默认 suite 的 stage（B1，常驻舞台）同样必须是 React.lazy：宿主只挂生效 suite 的 stage，lazy 保证没选它的人
//   不加载它的 chunk。写法限定为 `stage: React.lazy(() => import('./…'))`，或 `stage: X` / 简写 `stage`，其中
//   `const X = … React.lazy(() => import('./…')) …`（可以像 TUI 那样带门控条件）；
// - 开发验证 TUI 用 DEV 与 VITE_LIBRARY_TUI=true 同时门控组件与可用性，生产构建里组件连同动态 import 一起被摇掉。
//   启用/关闭与真实 registry 回退的行为矩阵在 tuiAvailability.test.ts。

const ROOT = path.resolve(__dirname, '../../..');
const SUITES_DIR = 'src/library/suites';
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

const suiteIds = readdirSync(path.join(ROOT, SUITES_DIR), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
const entryOf = (suiteId: string) => `${SUITES_DIR}/${suiteId}/entry.ts`;

/** 静态的值导入（`import type` 不算，它在运行时不存在）。 */
const staticValueImports = (source: string) => [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gms)]
    .filter(match => !/^import\s+type\s/.test(match[0]))
    .map(match => match[1]);
const lazyImports = (source: string) => [...source.matchAll(/React\.lazy\(\s*\(\)\s*=>\s*import\(\s*'([^']+)'\s*\)/g)].map(match => match[1]);
const LAZY_IMPORT = /React\.lazy\(\s*\(\)\s*=>\s*import\(/;

/** manifest 里 stage 属性的值表达式（简写 `stage` 视为标识符 stage）。先去掉注释，免得把注释里的字样当成属性。 */
const stageValues = (source: string) => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    return [...code.matchAll(/(?:^|[{,])\s*stage\s*(?::\s*([^,}\n]+))?\s*(?=[,}\n])/gm)]
        .map(match => (match[1] ?? 'stage').trim());
};

/** stage 的值是 React.lazy：内联的 lazy，或一个声明里带 lazy 动态 import 的 const。 */
const isLazyStageValue = (source: string, value: string) => {
    if (value.startsWith('React.lazy(')) return LAZY_IMPORT.test(value);
    if (!/^[A-Za-z_$][\w$]*$/.test(value)) return false;
    const declaration = source.split('\n').find(line => line.startsWith(`const ${value} `) || line.startsWith(`const ${value}:`));
    return Boolean(declaration && LAZY_IMPORT.test(declaration));
};

const DEFAULT_SUITE = 'grid';
const DEFAULT_SUITE_EAGER_IMPORTS = [
    './home/Grid3D',
    './collection/GridCollectionSurface',
    './artist/GridArtistSurface',
    // 账户 surface（A5）：登录弹窗与切换确认框，A4 时首页外壳里的账户宿主本来就即时 import 它们。
    './account/GridAccountSurface',
    './transitions/CollectionMorphOverlay',
    './transitions/gridHostTransitions',
    // 「完成」时忘掉布局记录（P4.5）：只碰 sessionStorage，依赖的两个键函数所在的模块上面几项本来就即时加载。
    './gridLayout',
];

describe('library suite entries', () => {
    it('every suite folder has an entry', () => {
        expect(suiteIds).toEqual(expect.arrayContaining(['grid', 'tui']));
        for (const suiteId of suiteIds) expect(existsSync(path.join(ROOT, entryOf(suiteId)))).toBe(true);
    });

    it('non-default entries load their components lazily only', () => {
        for (const suiteId of suiteIds.filter(id => id !== DEFAULT_SUITE)) {
            const source = read(entryOf(suiteId));
            // 只允许 react 本身；组件、转场、store 一律不静态 import。
            expect(staticValueImports(source), suiteId).toEqual(staticValueImports(source).filter(source => source === 'react'));
            expect(lazyImports(source).length, suiteId).toBeGreaterThan(0);
        }
    });

    it('non-default stages are React.lazy', () => {
        for (const suiteId of suiteIds.filter(id => id !== DEFAULT_SUITE)) {
            const source = read(entryOf(suiteId));
            for (const value of stageValues(source)) {
                expect(isLazyStageValue(source, value), `${suiteId}: stage ${value}`).toBe(true);
            }
        }
    });

    it('the stage check tells lazy stages from eager ones', () => {
        const lines = (...parts: string[]) => parts.join('\n');
        const lazy = [
            lines("const S = React.lazy(() => import('./Stage'));", "export default { id: 'x', stage: S, surfaces: {} };"),
            lines("const S = ON ? React.lazy(() => import('./Stage')) : undefined;", 'const m = {', '    stage: S,', '};'),
            lines('const m = {', "    stage: React.lazy(() => import('./Stage')),", '};'),
            lines("const stage = React.lazy(() => import('./Stage'));", 'const m = {', '    stage,', '};'),
        ];
        const eager = [
            lines('const S = () => null;', 'const m = {', '    stage: S,', '};'),
            lines('const S = React.memo(() => null);', 'const m = {', '    stage: S,', '};'),
            lines('const m = {', '    stage: () => null,', '};'),
            lines('const m = {', '    stage: ON ? S : undefined,', '};'),
            lines('const m = {', '    stage: Missing', '};'),
        ];
        for (const source of [...lazy, ...eager]) expect(stageValues(source), source).toHaveLength(1);
        for (const source of lazy) expect(isLazyStageValue(source, stageValues(source)[0]), source).toBe(true);
        for (const source of eager) expect(isLazyStageValue(source, stageValues(source)[0]), source).toBe(false);
        // 注释里的字样与别的属性不算 stage。
        expect(stageValues(lines('// stage: Eager,', '/* stage: Eager */', 'const m = { backstage: 1, stageName: 2 };'))).toEqual([]);
    });

    it('the default suite imports eagerly only what the first screen and the morph need', () => {
        const relativeImports = staticValueImports(read(entryOf(DEFAULT_SUITE))).filter(source => source.startsWith('.'));
        expect(relativeImports.filter(source => !DEFAULT_SUITE_EAGER_IMPORTS.includes(source))).toEqual([]);
    });

    it('keeps the TUI out of production builds', () => {
        const source = read(entryOf('tui'));
        expect(source).toContain("const ENABLE_TUI = import.meta.env.DEV && import.meta.env.VITE_LIBRARY_TUI === 'true';");
        for (const component of ['LibraryTuiView', 'LibraryTuiHome', 'LibraryTuiArtist', 'LibraryTuiAccount']) {
            expect(source).toContain(`const ${component} = ENABLE_TUI ? React.lazy(() => import('./${component}')) : null;`);
        }
        expect(source).toContain('available: ENABLE_TUI,');
    });

    it('has no barrel files that would pull a suite in sideways', () => {
        const barrels = readdirSync(path.join(ROOT, 'src/library'), { recursive: true, withFileTypes: true })
            .filter(entry => entry.isFile() && /^index\.tsx?$/.test(entry.name));
        expect(barrels).toEqual([]);
    });
});
