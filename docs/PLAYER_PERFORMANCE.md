# 播放器性能优化（v2.7.2 基线）

基线为 `oirge/Mineradio` 的 `50cda772`，产品版本保持 2.7.2。优化内部查询、保存与隐藏列表更新，不改变布局、质感、画质档位和播放引擎。

## 改动

- 后台资产预载按运行缓存已找不到的当前歌曲，避免每处理一首都重新扫描剩余队列；切歌与重复项仍按原顺序提升。
- SQLite 接管后，单曲资产完成只构造并保存该歌曲的索引记录，原位更新当前根的驻留索引。写入失败可重试，切库与迟到回复不能覆盖新状态；旧壳保留原有保存入口。
- 主队列、迷你队列、曲库和歌单按各自可见状态刷新。隐藏页面保留脏标记，打开时合并补刷，全部歌曲与末项操作继续可访问。
- 搜索只有完整保留所有匹配项时才允许在上一轮结果上继续筛选，修复截断结果导致后段歌曲搜不到的问题。
- Folia 歌词定位使用顺播游标、跳转二分与结束时间索引，避免时间校正和静默间隙重复扫描长歌词。
- 共享和声层在声部或词状态边界变化时重算快照，连续帧复用已有结果；开始与结束端点语义保持一致。

## 可复现的工作量

| 场景 | 优化前 | 优化后 |
| --- | ---: | ---: |
| 10,000 首后台预载，当前歌位于已处理前缀：候选键读取 | 49,995,001 | 10,000 |
| 10,000 首曲库，10 次单曲资产索引更新：记录构造 | 100,000 | 10 |
| 10,000 行歌词，600 帧及 50 次微小时间校正：行读取 | 466,410 | 1,287 |
| 隐藏曲库连续 20 次刷新：歌曲枚举、封面读取和 DOM 写入 | 重复执行 | 0 |
| 同一和声状态下 600 帧：快照重算 | 600 | 1 |

这些数字衡量实际生产函数执行的工作量，不代表特定电脑上的 FPS、启动时长或 CPU 百分比。GPU、驱动、封面大小和磁盘速度仍需实际设备测量。

## 验证

```powershell
node --test tests/local-library-background-performance.test.js tests/folia-hidden-queue-performance.test.js tests/folia-lyric-lookup.test.mjs tests/local-search-cache.test.js tests/library-maintenance.test.js
npm test --prefix vendor-src/folia -- harmonyRuntime
python scripts/verify-browser-ui.py --suite performance
```

`Verify` 工作流覆盖新增和声回归与隔离浏览器中的大曲库补刷、迷你队列和搜索。浏览器证据保存在 `browser-ui-evidence` 工件的 `performance-report.json`；完整 Folia 构建也由云端执行。
