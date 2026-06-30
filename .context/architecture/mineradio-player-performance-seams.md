# Mineradio Player Performance Seams

## Context

适用于 `public/index.html` 和 `desktop/main.js` 中播放器运行时性能优化，尤其是队列渲染、本地库恢复、封面缓存、歌单架刷新、主进程本地曲库扫描和同帧 UI 任务调度。

## Fact / Pitfall

- 队列、封面、歌词和本地元数据会在切歌或后台资产加载时连续触发刷新。如果每次都重建可见 DOM，会造成主线程抖动。
- 本地曲库快照和索引可能包含上万首歌。同步 `localStorage.setItem(JSON.stringify(...))` 和 `JSON.parse(...)` 会阻塞主线程。
- 同一张本地封面可能被多个队列视图、歌单详情和当前播放视图同时请求。重复 decode 和缩略图 canvas 缩放会浪费 CPU。
- 3D 歌单架、队列面板和视觉暖身任务都可能请求 `requestAnimationFrame`。缺少命名合并时，同一帧会堆积重复任务。
- 主进程导入或刷新大曲库时，逐个等待 `fs.promises.stat()` 会把扫描时间线性拉长；改成无限并发又可能压满磁盘队列。
- 启动恢复阶段如果先读取全量封面/歌词缓存，会推迟队列和播放会话可见时间，造成首屏像卡住。

## Solution / Convention

- 队列面板刷新必须通过 `safeRenderQueuePanel()`，由内部调度合并到命名 RAF 任务。
- 队列 DOM 更新前先比较 `queueVisibleDomSignature()`；签名未变化时跳过 `innerHTML` 重建。
- 本地曲库快照和索引新写入走 `LOCAL_LIBRARY_CACHE_STORE` IndexedDB 记录；旧 `localStorage` 只作为迁移回退读取。
- 进入本地曲库同步比对前先调用 `hydrateLocalLibraryPersistentState(folderPath)`，确保同步比对读取内存缓存。
- 本地封面缩略图通过 `localCoverThumbPromiseCache` 合并并发请求，不要为同一 data URL 重复创建 canvas。
- 成功生成的本地封面缩略图还必须进入 `localCoverThumbResultCache` 短期结果缓存，避免队列、搜索和歌单架在不同时间点重复缩放同一封面。
- 主进程本地曲库扫描和快照刷新统一走 `statLocalLibraryFiles()`，用有上限并发池读取文件元数据，并通过原始 `index` 保持排序稳定。
- 启动恢复或大曲库未变化时，先渲染播放队列和恢复播放会话，再延迟调用 `hydrateLocalAssetCacheForSongs()`；后台封面/歌词任务在恢复阶段减少中途 UI 刷新。
- 新增同帧 UI 任务优先使用 `scheduleNamedAnimationFrame(key, fn)`；同一 key 只保留最后一次任务。

## Reference

- 相关实现：`public/index.html`、`desktop/main.js`
- 浏览器 IndexedDB API：<https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API>
- 浏览器 requestAnimationFrame API：<https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame>
