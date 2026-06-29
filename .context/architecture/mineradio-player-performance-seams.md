# Mineradio Player Performance Seams

## Context

适用于 `public/index.html` 中播放器运行时性能优化，尤其是队列渲染、本地库恢复、封面缓存、歌单架刷新和同帧 UI 任务调度。

## Fact / Pitfall

- 队列、封面、歌词和本地元数据会在切歌或后台资产加载时连续触发刷新。如果每次都重建可见 DOM，会造成主线程抖动。
- 本地曲库快照和索引可能包含上万首歌。同步 `localStorage.setItem(JSON.stringify(...))` 和 `JSON.parse(...)` 会阻塞主线程。
- 同一张本地封面可能被多个队列视图、歌单详情和当前播放视图同时请求。重复 decode 和缩略图 canvas 缩放会浪费 CPU。
- 3D 歌单架、队列面板和视觉暖身任务都可能请求 `requestAnimationFrame`。缺少命名合并时，同一帧会堆积重复任务。

## Solution / Convention

- 队列面板刷新必须通过 `safeRenderQueuePanel()`，由内部调度合并到命名 RAF 任务。
- 队列 DOM 更新前先比较 `queueVisibleDomSignature()`；签名未变化时跳过 `innerHTML` 重建。
- 本地曲库快照和索引新写入走 `LOCAL_LIBRARY_CACHE_STORE` IndexedDB 记录；旧 `localStorage` 只作为迁移回退读取。
- 进入本地曲库同步比对前先调用 `hydrateLocalLibraryPersistentState(folderPath)`，确保同步比对读取内存缓存。
- 本地封面缩略图通过 `localCoverThumbPromiseCache` 合并并发请求，不要为同一 data URL 重复创建 canvas。
- 新增同帧 UI 任务优先使用 `scheduleNamedAnimationFrame(key, fn)`；同一 key 只保留最后一次任务。

## Reference

- 相关实现：`public/index.html`
- 浏览器 IndexedDB API：<https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API>
- 浏览器 requestAnimationFrame API：<https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame>
