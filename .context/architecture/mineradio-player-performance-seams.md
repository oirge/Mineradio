# Mineradio Player Performance Seams

## Context

适用于 `public/index.html` 和 `desktop/main.js` 中播放器运行时性能优化，尤其是队列渲染、本地库恢复、封面缓存、歌单架刷新、主进程本地曲库扫描和同帧 UI 任务调度。

## Fact / Pitfall

- 队列、封面、歌词和本地元数据会在切歌或后台资产加载时连续触发刷新。如果每次都重建可见 DOM，会造成主线程抖动。
- 播放器性能优化默认不改变 UI 表层。布局、CSS、可见文案、视觉质感和交互入口变化都属于额外产品改动，除非用户明确要求，否则不应混入性能优化提交。
- 队列、搜索结果和歌单详情的可见列表会在高频交互中反复生成 HTML；`slice/map/join` 在大列表上会额外制造中间数组和短命字符串。
- 队列和搜索结果 DOM 签名也属于热路径；每行用临时数组再 `join` 会在封面/歌词/元数据连续刷新时放大 GC 压力。
- 本地搜索索引预热和连续输入会扫描大量歌曲；如果每首歌都用字段数组、`filter` 和 `join` 生成搜索文本，会产生大量短命对象。
- 本地曲库快照和索引可能包含上万首歌。同步 `localStorage.setItem(JSON.stringify(...))` 和 `JSON.parse(...)` 会阻塞主线程。
- 本地节奏缓存也可能包含多个长节奏图。启动时同步解析 `LOCAL_BEATMAP_STORE_KEY` 会拖慢首屏，即使用户本次没有打开节奏分析面板。
- 自定义封面、自定义歌词、用户视觉存档和搜索历史都可能在长期使用后变成较大的 JSON。启动或连续搜索时反复同步解析会放大首屏和输入卡顿。
- 搜索历史最多 10 条；读写和去重不要恢复 `map/filter/slice` 链式处理。
- 本地搜索结果缓存命中后会直接交给渲染函数，不要为了“防御性”再 `slice()` 一份；当前搜索结果数组不应被调用方原地修改。
- Home 听歌画像统计可能累计很多歌曲和歌手记录。启动时同步解析、渲染 Home 时排序完整数组都会给首屏和恢复阶段增加额外主线程压力。
- 听歌统计结算处于切歌路径；最近听歌历史不要恢复 `[record].concat(...filter...).slice(...)`，歌手拆分不要恢复 `split(...).forEach(...)`。
- Home 首屏卡片、马赛克封面、最近播放入口和搜索玻璃贴图刷新处于启动后可见交互路径；不要为最多 5 个卡片或一轮按钮测量恢复 `slice/map/filter/find/forEach` 链式操作。
- 本地曲库快照保存不要先生成完整 `map/filter/slice` 中间数组再截断；超大文件夹导入或后台刷新时应在单次循环里生成签名、截断文件列表和目录列表。
- 本地曲库快照签名、索引 lookup 和索引同步会处理上万条记录；不要恢复 `fileListToArray()` 预复制、`forEach` 或 `Object.keys(...).forEach` 全量回调扫描。
- 同一张本地封面可能被多个队列视图、歌单详情和当前播放视图同时请求。重复 decode 和缩略图 canvas 缩放会浪费 CPU。
- 3D 歌单架、队列面板和视觉暖身任务都可能请求 `requestAnimationFrame`。缺少命名合并时，同一帧会堆积重复任务。
- 3D 歌单架只渲染可见窗口卡片，但如果 rebuild 阶段先把完整播放队列 map 成卡片数据，大队列仍会在切歌或刷新时同步生成大量封面与副标题。
- 3D 歌单详情打开本地库时如果全量 `map(cloneSong)`，超大曲库会在打开详情页时同步分配大量对象；展示阶段不需要克隆，播放入队时再克隆即可。
- 3D 歌单架 rebuild 签名即使只采样头尾项，也不能先用 `slice/concat/map` 创建临时采样数组。
- HTML 转义处于队列、搜索、本地库和歌单详情渲染热路径；每次创建临时 DOM 节点会制造额外对象和 GC 压力。
- 歌曲副标题和本地音质文本会被队列签名、搜索结果、左侧本地库和 3D 歌单架反复读取；不要在这些路径里重复创建数组并重新估算格式化结果。
- 切歌路径不能等待本地元数据标签解析完成再设置 audio source；大 FLAC、机械硬盘或冷缓存会直接拉长“点歌到出声”的时间。
- 空搜索会作为本地库默认列表反复触发；即使只取前 `LOCAL_SEARCH_RESULT_LIMIT` 条，也不要恢复通用 `slice`。
- 本地大文件夹导入会同时建立封面索引和歌曲对象。不要把音频/封面筛选恢复成 `filter().sort().map()/forEach()` 链式写法制造中间数组。
- 本地大文件夹导入会同时建立歌词索引；歌词文件索引也不要恢复 `fileListToArray(...).forEach(...)` 回调式全量扫描。
- `fileListToArray()` 是本地导入、歌词/封面索引和快照归一化共同入口；不要恢复 `Array.prototype.slice.call(...).filter(Boolean)`，否则所有入口都会多一轮中间数组分配。
- 单文件导入入口也可能拖入多个音频文件；判断是否转批量导入时不要先 `filter` 完整列表。
- 主进程本地曲库 `stat` 结果需要保持原始排序；不要用回调式 `filter(Boolean)` 压缩稀疏结果数组。
- 本地资产缓存补水和曲库索引套用会逐块、逐首执行；不要在每次读取前 `keys.filter(Boolean)`，也不要在每首歌上重新分配固定元数据字段数组。
- 用户视觉存档历史实现曾出现重复函数声明，后声明会覆盖前声明；这类死代码会增加解析量并让维护者误读实际生效路径。
- 主进程导入或刷新大曲库时，逐个等待 `fs.promises.stat()` 会把扫描时间线性拉长；改成无限并发又可能压满磁盘队列。
- 启动恢复阶段如果先读取全量封面/歌词缓存，会推迟队列和播放会话可见时间，造成首屏像卡住。
- 本地封面/歌词缓存按范围补水时，单个分块内不要重复计算同一首歌的 asset cache key。
- IndexedDB 缓存清理属于后台任务，但大缓存下也不能在 folder 排序比较器里反复扫描完整 `libraryEntries`。
- 大本地库或大歌单入队会批量克隆歌曲对象；不要恢复 `songs.map(cloneSong)` 这类回调式批量克隆。
- 本地歌词、内嵌歌词和自定义歌词加载会解析长文本；不要在 LRC 解析、歌词 source 转换和 fallback 过滤路径恢复 `map/filter/forEach/every` 链式扫描。

## Solution / Convention

- 队列面板刷新必须通过 `safeRenderQueuePanel()`，由内部调度合并到命名 RAF 任务。
- 性能优化优先改内部数据、缓存、调度和少分配实现；如果必须碰 DOM/HTML 生成，输出结构、class、文案和交互属性必须保持等价。
- 队列 DOM 更新前先比较 `queueVisibleDomSignature()`；签名未变化时跳过 `innerHTML` 重建。
- 队列、搜索结果和歌单详情的可见 HTML 优先用单次循环拼接，避免在热路径里恢复 `slice(...).map(...).join('')`。
- 队列和搜索结果 DOM 签名使用字符串累加，不要为每行恢复 `[...].join('~')` 临时数组。
- 本地搜索文本热路径使用直接字段拼接，不要恢复字段数组、`filter(Boolean)` 和 `join(' ')`。
- 本地曲库快照和索引新写入走 `LOCAL_LIBRARY_CACHE_STORE` IndexedDB 记录；旧 `localStorage` 只作为迁移回退读取。
- 本地节奏缓存启动时只初始化空对象，进入节奏面板或读取缓存时再调用 `ensureLocalBeatPrefsCache()` / `ensureLocalBeatMapCache()`。
- 自定义封面、自定义歌词和用户视觉存档启动时只初始化空对象；真正读取前必须走对应 `ensure...()`，不要在全局初始化阶段直接 `JSON.parse(localStorage...)`。
- 搜索历史读取应复用内存缓存，写入后同步更新缓存，避免连续打开搜索面板时重复解析同一段 JSON。
- 搜索历史读写使用限量循环；本地搜索结果缓存命中时直接返回缓存数组，调用方不得原地修改搜索结果数组。
- Home 听歌画像统计使用 `ensureListenStatsState()` 按需水合；渲染汇总时用单次扫描找最近/最高频条目和总播放数，不要为了取第一名而对完整数组排序。
- 听歌统计历史使用 `compactListenStatsHistory()`，歌手统计使用 `visitListenArtistNames()`，避免切歌结算时连续创建中间数组。
- Home 首屏卡片使用显式循环补齐最多 5 个 tile 并拼接 HTML；马赛克封面收集、最近播放本地匹配用单次循环；搜索玻璃贴图尺寸测量直接遍历 NodeList。
- 3D 歌单架队列模式使用虚拟数组和 `shelfItemAt()` 按可见窗口懒构造卡片项；不要恢复 `playQueue.map(...)` 全量生成卡片数据。
- 3D 歌单详情打开本地库时使用原歌曲数组作为展示源，只有在播放详情行并写入 `playQueue` 时才 `cloneSong()`。
- 3D 歌单架队列或集合签名采样使用固定头尾窗口和单次循环，不要为签名判断创建临时采样数组。
- 3D 歌单详情判断本地歌曲可播放时必须认 `localKey`，不能只认在线歌曲的 `id`。
- HTML 转义使用纯字符串替换，不在列表渲染热路径创建临时 DOM 元素。
- `songDisplaySubtitle()` / `localAudioQualityText()` 使用字段级缓存；元数据、时长、码率或路径变化时通过缓存键自然重算。
- 切歌时先更新队列状态和 audio source，再后台执行 `ensureLocalMetadataForSong()`；元数据完成后刷新控制台、队列、Home 和系统媒体信息。
- 空搜索默认结果使用 `localSearchDefaultResults()` 显式限量循环，不要恢复 `pool.slice(0, LOCAL_SEARCH_RESULT_LIMIT)`。
- `buildLocalCoverMaps()` 和 `createLocalSongsFromFiles()` 在大曲库导入路径使用显式循环收集、排序后单次构造结果，不要恢复链式筛选/映射。
- `buildLocalLyricMaps()` 在大曲库导入路径使用显式循环建立索引，不要恢复 `forEach` 回调扫描。
- `fileListToArray()` 使用单次循环压缩类数组，供导入、索引和快照路径复用。
- `handleFiles()` 用单次循环同时识别首个音频、封面和多音频批量导入，不要恢复 `list.filter(...)` 预扫描。
- 本地搜索池和索引预热优先复用已经全为本地歌曲的数组；只有混入非本地或无效项时才额外构造过滤数组。
- 本地曲库快照保存使用单次循环生成签名和最多 `16000` 条文件、`20000` 条目录记录；不要恢复先保存完整中间数组再 `slice` 的流程。
- 本地曲库快照签名直接遍历类数组；索引 lookup 和索引同步使用显式循环；lookup 构建用 `for...in + hasOwnProperty`，避免 `Object.keys()` 先生成完整 key 数组。
- 本地资产缓存读取用显式循环压缩 key 列表，并用 IndexedDB 返回记录的 `id` 回填结果表；资产缓存和曲库索引套用复用全局元数据字段列表。
- IndexedDB 缓存清理先单次统计每个本地库文件夹的最新时间，再按 folder 排序；不要在 comparator 中扫描完整记录表。
- 进入本地曲库同步比对前先调用 `hydrateLocalLibraryPersistentState(folderPath)`，确保同步比对读取内存缓存。
- 本地封面缩略图通过 `localCoverThumbPromiseCache` 合并并发请求，不要为同一 data URL 重复创建 canvas。
- 成功生成的本地封面缩略图还必须进入 `localCoverThumbResultCache` 短期结果缓存，避免队列、搜索和歌单架在不同时间点重复缩放同一封面。
- 主进程本地曲库扫描和快照刷新统一走 `statLocalLibraryFiles()`，用有上限并发池读取文件元数据，并通过原始 `index` 保持排序稳定。
- `statLocalLibraryFiles()` 用显式循环压缩稀疏结果数组，避免大曲库扫盘完成后再跑 `filter(Boolean)` 回调。
- 启动恢复或大曲库未变化时，先渲染播放队列和恢复播放会话，再延迟调用 `hydrateLocalAssetCacheForSongs()`；后台封面/歌词任务在恢复阶段减少中途 UI 刷新。
- 本地封面/歌词缓存分块补水优先使用 `hydrateLocalAssetCacheForSongRange()` 按范围读取，不要在热路径里反复 `songs.slice(...)`；后台资产预载候选应复用同一轮 `localLibraryAssetProcessingSongs()` 结果，再由排序函数二次过滤当前仍需要预载的歌曲。
- `hydrateLocalAssetCacheForSongRange()` 第一轮收集 key 时同步保存每首歌的 key，应用记录时复用，避免同一分块重复执行 `localAssetCacheKey(song)`。
- 同一作用域内不得保留重复函数声明；如果后续实现已经覆盖旧实现，必须删除旧实现而不是依赖函数提升覆盖。
- 新增同帧 UI 任务优先使用 `scheduleNamedAnimationFrame(key, fn)`；同一 key 只保留最后一次任务。
- 大歌单、本地库整队播放和歌手详情播放使用 `cloneSongList()` 显式循环克隆，保持播放队列语义并减少回调分配。
- 歌词状态克隆、LRC 解析、自定义歌词普通文本拆行和本地歌词 source 标记使用显式循环；输出字段、source 值和双语合并规则必须保持不变。

## Reference

- 相关实现：`public/index.html`、`desktop/main.js`
- 浏览器 IndexedDB API：<https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API>
- 浏览器 requestAnimationFrame API：<https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame>
