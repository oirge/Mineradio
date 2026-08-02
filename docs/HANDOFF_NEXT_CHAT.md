# Mineradio Next Chat Handoff

更新时间：2026-07-26

## 新对话先执行

当前可用工作区：

```powershell
cd C:\Users\oirg\Desktop\mok\Mineradio-sync
git status --short --branch
git log --oneline -5 --decorate
Get-Content AGENTS.md -Encoding UTF8
Get-Content docs\PROJECT_MEMORY.md -Encoding UTF8
Get-Content docs\HANDOFF_NEXT_CHAT.md -Encoding UTF8
```

如涉及 3D 歌单架、玻璃 SVG 质感、发布或安装包，再读：

```powershell
Get-Content docs\3D_PLAYLIST_SHELF_MEMORY.md -Encoding UTF8
Get-Content docs\GLASS_SVG_TEXTURE.md -Encoding UTF8
Get-Content CHANGELOG.md -Encoding UTF8 -TotalCount 120
Get-Content RELEASE.md -Encoding UTF8
Get-Content package.json -Encoding UTF8
```

## 当前状态

- 当前可写代码/Git 仓库：`C:\Users\oirg\Desktop\mok\Mineradio-sync`
- 本轮检查时旧规则里的 `E:\桌面\播放器软件\Mineradio\resources\app` 不存在；不要盲目切去旧路径。
- 当前版本：`v1.2.44`
- GitHub 仓库：`https://github.com/oirge/Mineradio`
- 当前分支：`codex/release-1.2.44-memory`
- 当前提交：`9bba136 release: finalize 1.2.44 local asset and desktop memory ownership`（已推送到远端同名分支）。
- 正式发布基线：远端 tag `v1.2.44`（提交 `9bba136`），已是 GitHub Latest；远端旧 `main` 仍停在 `v1.2.34`，不要从旧 `main` 发布。
- `v1.2.44` 是把内存优化移植到 `v1.2.43` 基线后完成并发布的提交。
- 当前工作树只剩本轮文档回填（`docs/PROJECT_MEMORY.md`、本文件、`AI_HANDOFF.md`）待提交；代码、tag 和 GitHub Release 均已完成。
- `package.json` 发布配置 owner/repo 已是 `oirge/Mineradio`。

## 最近完成

- 2026-07-26：完成 `v1.2.44` 本地资产与桌面状态内存优化。已播放歌词原文由精确当前队列对象持有播放租约；切歌、清队列、同 key 接管和迟到异步结果均校验对象所有权，释放后的 `ready` 摘要保持可恢复，不会错误退回 `pending`。
- 2026-07-26：修复空曲库后台资产任务取消和旧 token 污染；本地曲库持久内存按当前文件夹所有权隔离，阻止 A→B→A 旧异步读取回填；本地封面、Object URL、内嵌封面 Blob、文件范围读取和缓存生命周期改为受限驻留。
- 2026-07-26：桌面歌词、壁纸和迷你播放器加入状态缓存及窗口/renderer/PowerShell 进程所有权门禁；新增 3 个桌面状态模块和 35 个纯 Node 回归测试。`scripts/test-mini-player-memory.ps1` 已改为 AST-only 源码门禁，不启动 Electron。
- 2026-07-26：`npm run build:win` 成功生成 `dist\Mineradio-1.2.44-Setup.exe`（104747336 字节）、blockmap、Portable ZIP 与 `latest.yml`；`latest.yml` 已确认版本为 `1.2.44`。已生成 `dist\Mineradio-1.2.44-SHA256SUMS.txt`（4 项）和 `dist\Mineradio-1.2.43-to-1.2.44.patch.json`（2401785 字节，7 个运行时文件）。
- 2026-07-24：发布 `v1.2.43`，将本地音质显示切换为网易云风格中文档位，作为本轮正式基线。
- 2026-07-04：发布 `v1.2.11`，继续低风险性能优化：本地封面/歌词缓存补水改为按范围读取，分块阶段不再反复 `slice`；后台资产预载候选、播放队列位置映射和排序队列减少中间数组并复用同一轮候选；列表入场动画只收集实际需要动画的前几项。左侧歌单显示/隐藏/固定按钮和 3D 歌单架“自动隐藏/常驻”选项保持不变。
- 2026-07-04：发布 `v1.2.10`，继续做多维性能优化：启动阶段自定义封面/歌词/用户视觉存档按需解析，Home 听歌画像按需水合并单次扫描，3D 歌单架大队列虚拟取项，队列/搜索/歌单详情 HTML 减少中间数组，本地搜索池和索引预热复用纯本地数组，本地曲库快照/索引保存改为单次循环；左侧歌单常开/自动隐藏逻辑和 3D 歌单架“自动隐藏/常驻”选项保持不变。
- 2026-07-04：发布 `v1.2.9`，继续优化 3D 歌单架交互性能：同一指针事件复用 Raycaster/卡片命中结果，详情行、面板和卡片屏幕命中复用临时对象，滚轮路径延迟射线检测，鼠标移动只在面板可见或需要时读取矩形；左侧歌单常开/自动隐藏逻辑和 3D 歌单架“自动隐藏/常驻”选项保持不变。
- 2026-07-03：将渲染进程 UI 状态备份从每次立即 IPC/写盘，改为 180ms 合并写入；首次全量同步仍立即写，`beforeunload` / `pagehide` 前会 flush，降低连续拖动视觉滑条和设置切换时的主进程写盘抖动。
- 2026-07-03：交接文档从旧 `v1.1.0 / XxHuberrr` 发布线更新到当前 `v1.2.8 / oirge` 工作区，避免后续接手走错仓库。

## 已知验证

- 旧基线回归曾复现 12 通过 / 1 失败的 `ready`→`pending` 回归；修复后目标回归为 13/13 通过。
- 移植到 `v1.2.43` 基线后的完整 Node 测试：95/95 通过。
- `desktop/main.js`、`server.js`、`desktop/` 与 `tests/` 全部 JavaScript `node --check` 通过；`public/index.html` 4 个内联脚本解析通过。
- AST-only 内存门禁、`git diff --check`、冲突标记扫描和调试标记扫描通过。
- 所有测试使用 `BelowNormal` 与 `--test-concurrency=1`；本轮没有启动 Electron、浏览器、服务、PowerShell 轮询或后台 GUI，避免影响用户正常使用电脑。
- Windows 构建使用代理 `127.0.0.1:7897`（`HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 均为 `http://127.0.0.1:7897`）；构建、推送与 `gh release create` 均成功。
- 已核对远端 Release：5 个资产（安装包、blockmap、`latest.yml`、SHA256 清单、快速补丁）状态均为 uploaded，大小与本地一致；重新下载安装包与 `latest.yml` 校验 SHA256 与本地字节级一致，`v1.2.44` 已是 Latest。

## 后续优先级

- `v1.2.44` 已发布并核对远端资产；剩余动作是提交本轮文档回填（`docs/PROJECT_MEMORY.md`、本文件、`AI_HANDOFF.md`）。
- 继续处理两个已知内存方向：IndexedDB `assets` 拆分 `lyrics` store 并做 v2→v3 流式迁移；外置封面改走 `/api/local-file` 流式 URL，避免主进程完整 Buffer/base64 和 renderer data URL。

## 不要做

- 不要修改不存在或旧归档的外层源码目录。
- 不要恢复旧的侧边栏闪烁、控制台播放暂停失效、3D 歌单架强制切回星河等问题。
- 不要把搜索结果、左侧歌单、3D 歌单架的性能优化做成一次性渲染全部内容。
- 不要把玻璃 SVG 黄金质感改成普通毛玻璃或廉价透明面板。
- 后台验证默认保持低优先级、串行、无 Electron/GUI；除非用户明确要求，不要启动会占用桌面的长期测试进程。
