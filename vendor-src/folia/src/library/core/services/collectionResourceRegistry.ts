import type { LibraryCollectionDescriptor } from '../contracts/collection';
import type { CollectionResource } from '../contracts/resource';
import { createResourceRegistry, type ResourceRegistry, type ResourceRegistryOptions } from './resourceRegistry';

// src/library/core/services/collectionResourceRegistry.ts
// 资源的生命周期：谁在用、什么时候停、什么时候可以复用。
//
// - peekOrCreate 在渲染期调用，只创建对象、不发请求（请求由 ensure 触发）；
// - retain 在 effect 里调用并返回释放函数。StrictMode 会同步地「挂载 → 卸载 → 挂载」，
//   所以释放后先等一个宽限期，期间重新 retain 就什么都不发生，不会重复请求；
// - 只被 peek、一直没被 retain 的实例（渲染被丢弃）过一段时间后销毁；
// - 最后一个使用者离开后资源先暂停；能复用的在线资源放进一个有界的 LRU，其余直接销毁。
//   复用与否由资源自己判断（版本相同、缓存本来就会命中、已加载完或中断），
//   所以复用不会绕过原先「重进时按曲目更新时间校验缓存」的规则。
// P4.1 起机制本身挪到 resourceRegistry（歌手资源共用），这里只定「只有在线资源进 LRU」。

export type CollectionResourceRegistryOptions = ResourceRegistryOptions;

export type CollectionResourceRegistry = ResourceRegistry<CollectionResource, LibraryCollectionDescriptor>;

export const createCollectionResourceRegistry = (
    options: CollectionResourceRegistryOptions = {},
): CollectionResourceRegistry => createResourceRegistry<CollectionResource, LibraryCollectionDescriptor>({
    ...options,
    retainable: resource => resource.kind === 'online',
});

/** 应用里共用的那一个。 */
export const collectionResourceRegistry = createCollectionResourceRegistry();
