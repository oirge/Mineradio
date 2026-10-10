import type { LocalSong } from '../../../src/types';
import { getLocalSongs, saveLocalSongs } from '../../../src/services/db';
import { recordProbeCall } from '../libraryBehavior/probeLog';
import { HOME_IMPORTED_LOCAL_SONG } from './homeLocalFixtures';
import type { HookedLocalMusicServiceFunction } from './serviceStubModule';

// dev/probes/homeBehavior/serviceStubs.ts
// 本地曲库服务的钩子（浏览器侧）。转接模块（serviceStubModule.ts，由用例经 page.route 装上）把被接管函数的
// 每次调用交给这里：先记一笔 `service` 账（函数名 + 参数），再决定走替身还是放行到真实现。
// - 替身：需要目录句柄 / 文件选择器的导入、重扫、恢复忽略目录。导入替身往曲库写一首新歌，让「导入后刷新」
//   有可见的结果；全部重扫替身把现有曲目当作重扫结果返回（非空，首页因此会刷新）。
// - 放行：删除文件夹、按 id 删歌、移除导入根——它们只动 IndexedDB，沙盒里跑真实现，结果能从曲库读回来。

type ServiceHook = (module: string, name: string, args: unknown[], callReal: () => unknown) => unknown;

declare global {
    interface Window {
        __foliaProbeServiceHook?: ServiceHook;
    }
}

const FAKES: Partial<Record<HookedLocalMusicServiceFunction, (...args: unknown[]) => Promise<unknown>>> = {
    importFolder: async (): Promise<LocalSong[]> => {
        await saveLocalSongs([HOME_IMPORTED_LOCAL_SONG]);
        return [HOME_IMPORTED_LOCAL_SONG];
    },
    resyncAllFolders: async (): Promise<LocalSong[]> => getLocalSongs(),
    resyncFolder: async () => null,
    clearFolderIgnore: async () => undefined,
};

// 参数只留可序列化的部分（路径、id 列表），记进账里给用例断言。
const serializable = (value: unknown): unknown => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map(serializable);
    return String(value);
};

/** 安装钩子，返回卸载函数。 */
export const installHomeServiceHook = (): (() => void) => {
    const hook: ServiceHook = (_module, name, args, callReal) => {
        recordProbeCall({ kind: 'service', ids: [], key: name, detail: args.map(serializable) });
        const fake = FAKES[name as HookedLocalMusicServiceFunction];
        return fake ? fake(...args) : callReal();
    };
    window.__foliaProbeServiceHook = hook;
    return () => {
        if (window.__foliaProbeServiceHook === hook) delete window.__foliaProbeServiceHook;
    };
};
