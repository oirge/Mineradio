// dev/probes/homeBehavior/serviceStubModule.ts
// 首页探针替换本地曲库服务用的「转接模块」源码。刻意不 import 任何东西：component 用例（Node 侧）
// import 它，用 page.route 把浏览器对 `/src/services/localMusicService.ts` 的请求换成这段转接源码。
//
// 为什么要这样：文件夹导入、重扫、恢复忽略目录都要真实的目录句柄或系统文件选择器，探针里拿不到；
// 而 LocalGrid3DView / Grid3D 是直接 import 这些函数的（ES 模块的导出不能在运行时替换）。转接模块
// 先 `export *` 真模块（另一个 URL：`?folia-real`，vite 照常转换），再用同名导出盖住要接管的几个函数：
// 每次调用先问 `window.__foliaProbeServiceHook`，钩子记账后决定用替身还是放行到真实现。
// 没有钩子时一律放行，所以没装路由的页面、手动打开的探针都走真实服务。

export const LOCAL_MUSIC_SERVICE_PATH = '/src/services/localMusicService.ts';

/** 经过钩子的函数（其余导出原样转出）。 */
export const HOOKED_LOCAL_MUSIC_SERVICE_FUNCTIONS = [
    'importFolder',
    'resyncAllFolders',
    'resyncFolder',
    'clearFolderIgnore',
    'deleteFolderSongs',
    'deleteSongsByIds',
    'removeImportedRoot',
] as const;

export type HookedLocalMusicServiceFunction = typeof HOOKED_LOCAL_MUSIC_SERVICE_FUNCTIONS[number];

/** 只匹配应用对真模块的请求，不匹配转接模块自己发出的 `?folia-real`。 */
export const LOCAL_MUSIC_SERVICE_ROUTE = /\/src\/services\/localMusicService\.ts(\?(?!folia-real).*)?$/;

/** 生成转接模块源码。 */
export const buildServiceStubModule = (
    path: string = LOCAL_MUSIC_SERVICE_PATH,
    names: readonly string[] = HOOKED_LOCAL_MUSIC_SERVICE_FUNCTIONS,
): string => {
    const realUrl = `${path}?folia-real`;
    return [
        `import * as real from '${realUrl}';`,
        `export * from '${realUrl}';`,
        'const route = (name) => (...args) => {',
        '    const hook = window.__foliaProbeServiceHook;',
        `    return hook ? hook('${path}', name, args, () => real[name](...args)) : real[name](...args);`,
        '};',
        ...names.map(name => `export const ${name} = route('${name}');`),
        '',
    ].join('\n');
};
