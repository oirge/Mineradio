import type { LibraryHiddenScope } from '../contracts/directory';
import type { LibraryHomeTabKey } from '../contracts/homeModel';
import { resolveHomeDirectoryKey, resolveHomeHiddenScope } from '../model/homeSources';
import { localHomeSectionOfRow } from '../model/localHomeModel';
import { useNavidromeHomeSectionStore } from '../state/useNavidromeHomeSectionStore';

// src/library/core/bindings/useLibraryHomeDirectory.ts
// 首页当前列表是哪个目录：目录会话 key 与隐藏作用域（规则在 core/model/homeSources）。本地 section 来自应用的
// 本地导航状态（activeRow），Navidrome section 来自它的 store。首页只在这里算一次，交给三个列表视图。

export const useLibraryHomeDirectory = ({
    tab,
    providerId,
    localRow,
}: {
    tab: LibraryHomeTabKey;
    providerId: string;
    localRow: number;
}): { directoryKey: string; hiddenScope: LibraryHiddenScope } => {
    const navidromeSection = useNavidromeHomeSectionStore(state => state.section);
    return {
        directoryKey: resolveHomeDirectoryKey({
            tab,
            providerId,
            localSection: localHomeSectionOfRow(localRow).key,
            navidromeSection,
        }),
        hiddenScope: resolveHomeHiddenScope(tab, providerId),
    };
};
