# Mineradio Next Chat Handoff

更新时间：2026-09-10

## 新对话先执行

**仓库以 GitHub `https://github.com/oirge/Mineradio` 为准，本地路径随机器变化**；旧文档里的 `C:\Users\oirg\Desktop\mok\Mineradio-sync`、`C:\Users\Administrator\Desktop\Mineradio-main` 在当前环境都不存在。先确认仓库再读文档：

```powershell
git remote -v
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

- 当前版本：`v2.0.10`（歌词显示与翻译 + LLM 翻译源 + WE 选择入口修复），发布中（详情发布后回填 RELEASE.md）。
- GitHub 仓库：`https://github.com/oirge/Mineradio`。`package.json` 发布配置 owner/repo 为 `oirge/Mineradio`。
- 正式发布基线：线上 Latest 是 `v2.0.9`（玻璃与左栏参数组 + 隐藏房子按钮），Release `387445460`，`published_at` `2026-09-12T03:50:55Z`，四项资产齐全（Setup.exe sha256 `cf358317…` 实物校验一致）；tag `v2.0.9` 指向 release commit `ba7c46e`（PR #86 merge `02681cf`）。上一版 `v2.0.8`（Release `387419553`，tag 指向 `739d0cf`）、更早 `v2.0.7`（Release `386939633`，tag 指向 `15804c9`）。
- `main` 是发布线，发版走 `codex/release-vX.Y.Z` 分支 + PR（**用 merge commit 合，绝不 squash**，否则 tag 会离开 `main` 可达历史），tag 打在 release commit 上。
- `package.json` 发布配置 owner/repo 已是 `oirge/Mineradio`。

## 最近完成

- 2026-09-12：移植上游「显示与翻译」（歌词行数模式/双语翻译模式/译文三滑条，默认 cinema/multi/10/0.92/0.65/0.86），多行语义用轻量行池在本仓库单 mesh 引擎上复刻；新增 LLM 翻译服务（用户端点走 `/api/lyric-translate` 本地代理，英文 system prompt，行级内容寻址缓存永不重翻）；修复 v2.0.8 引入的 WE「识别 / 导入」按钮溢出回归。测试 14 例，回归 `1183/1183`。**用户已授权发布 v2.0.10**。
- 2026-09-12：按用户纠正把房子按钮从「直接删除」改为「原版同款把手控制」：恢复 `#home-btn`，新增 `#home-btn-hide-btn` 把手（`toggleHomeBtnAutoHide`，持久化 `mineradio-home-btn-auto-hide-v1`，四处同步键清单），`tests/home-btn-auto-hide.test.js` 3 例。回归 `1169/1169`。工作区改动未发版。
- 2026-09-12：发布 `v2.0.9`（玻璃与左栏参数组移植 + 隐藏右上角房子按钮）。tag `v2.0.9` → `ba7c46e`（PR #86 merge `02681cf`），Release `387445460` 已设 Latest，run `34671295714`，四资产齐全、SHA256 三路校验一致，`latest.yml` `version: 2.0.9`。应用内公告四条过真实解析器 4/4 保留（解析器上限 4 条，正文不带标题行）。
- 2026-09-12：移植上游「玻璃与左栏」参数组（用户原话「把原项目的这个功能移植到我这个项目一模一样就行」）。新增 6 个 fx 键（`windowBackgroundOpacity`/`backgroundGlassOpacity`/`playlistPanelGlassBlur`/`playlistPanelGlassDensity`/`playlistPanelOpenDuration`/`playlistPanelCloseDuration`，默认 1/0/14/0.55/0.72/0.48 逐字照上游）+ 6 条 DIY 外观区滑条；左栏玻璃头 `.playlist-panel-sticky` + `.queue-toolbar` 玻璃款（CSS 变量族 `--playlist-sticky-*`/`--playlist-toolbar-*`，主题补偿规则豁免这两个类）；面板开合 transition 接 `--playlist-panel-motion-ms`（closing 类切收起时长、pl 隐藏延迟 72ms）；`applyCustomBackground` 补窗口透明（`body.custom-window-transparent` + `--custom-bg-base-opacity`，override 公式故意不加这两项）与毛玻璃（`custom-bg-glass-active` + `--custom-bg-glass-*`，公式照上游）。新增 `tests/glass-playlist-panel-fx.test.js` 27 例，全量回归 `1166/1166`（基线 1139）。**未发版**，等用户授权。
- 2026-09-11：实现 `v2.0.8`，修复 Wallpaper Engine「识别 / 导入」弹窗样式全失效（`wallpaper-engine.css` 的 `#custom-bg::after` 规则缺一个收尾 `}`，Chrome CSS 嵌套把文件剩余全部规则吞进永不匹配的规则；v1.4.3 引入）。新增 `tests/wallpaper-engine-css-syntax.test.js` 3 例。全量回归 `1139/1139`。
- 2026-09-11：实现 `v2.0.7`，3D 歌单架新增「舞台」档（`public/shelf-classic.js` 移植上游 XxHuberrr/Mineradio 原版实现，`fx.shelf = off/side/stage` 唯一模式入口：DIY `#shelf-seg` + 主界面 `#shelf-view-btn`）。核心是补齐舞台动态接线：详情动画吃上游参数、`placeDynamicDetailFromCamera` 让详情跟随镜头位置、详情每帧只更新一次、镜头进入/离开速度接入 classic focus、舞台与侧栏基础设置各存一份（`fx.shelfStageSettings`/`fx.shelfSideSettings`）；惰性范围表修复 20 条参数重启读回。真机验证详情相机空间偏移在不同相机位姿下不变（位置真跟拍）。全量回归 `1136/1136`。
- 2026-09-11：发布 `v2.0.6`，常用播放控制提到主界面音量弹层（速度 / 睡眠两组设置 + 无缝 / 均衡两个开关，改的是唯一设置状态、与 DIY 面板双向同步；画质按反馈不进弹层），并新增输出设备选择（`AudioContext.setSinkId`，插拔设备自动刷新）。全量回归 `1107/1107`。
- 2026-09-11：实现 `v2.0.4` 多根曲库（同时监控多个音乐目录）。新增数组键 `mineradio-local-library-folders-v1`（旧单根标量自动迁移 + 保留主根镜像），导入改为追加语义、恢复逐根取回再合并、监控按根列表注册、单目录变化只同步那一根、索引按根保存、备份导出/导入接多根、设置面板新增 `fx-library-fold`。新增 `tests/local-library-multi-root.test.js` 12 例，全量回归 `1088/1088`。
- 2026-09-10：把一次误建的 v2.0.4 文档维护提交与远端 tag 反向提交移除（`1fa9680` / `7850c81`，删 tag `v2.0.4` 与分支 `codex/release-v2.0.4`），`releases/latest` 回到 `v2.0.3`。
- 2026-09-10：发布 `v2.0.3`。SSA 歌词补齐（`.ssa` 与 `.ass` 共用解析）；发布链路改为显式管理单个同 tag Release（`--publish never` + `gh release upload --clobber`），不再由 electron-builder 隐式建双草稿；Actions 升 v5；SHA256 清单改为 LF、无 BOM UTF-8。分支 `codex/release-v2.0.3`，提交 `30b3ba5` / `5bae4cf`，PR #73（merge `d576231`）+ #74（merge `44b39d5`）；首次构建 run `34442721960` 因清单落盘路径失败，`5bae4cf` 修复后 run `34444159148` 成功。四资产回下载三路校验通过。
- 2026-09-10：修复 `RELEASE.md` 自 v1.2.61 起被损坏的编码（GBK 乱码 + 换行丢失），以 `95a36fb` 为干净底本恢复；给 `Verify` 加文档编码门禁。
- 2026-09-08：发布 `v2.0.2`，全屏进入 / 退出过渡与视觉预设构图修复。
- 2026-09-07：发布 `v2.0.1`（视觉预设 6/8 切换不再漏透明）与 `v2.0.0`（视觉预设 7/8 读档不再截回 6）。
- 2026-09-06：发布 `v1.10.0`，安装身份换到 `com.mineradio.desktop.oirge`，与原项目可同时安装、同时运行。
- 更早的 `v1.2.x` / `v1.3+` 内存与性能优化历史保留在 `AI_HANDOFF.md` 的工作日志和 `docs/PROJECT_MEMORY.md`，本文件不再重复。

## 已知验证

- 全量 Node 回归 `1168/1168` 通过（`npm test`，即 `node --test --test-concurrency=1`）；基线 `v2.0.3` `1076` → `v2.0.4` `1088`（多根 12 例）→ `v2.0.5` `1101`（倍速/睡眠 13 例）→ `v2.0.6` `1107`（主界面快捷 + 输出设备）→ `v2.0.7` `1136`（舞台歌单架 25 例）→ `v2.0.8` `1139`（WE 弹窗 CSS 3 例）→ `v2.0.9` `1168`（玻璃与左栏 27 例 + 房子按钮 2 例）→ `v2.0.10` `1183`（显示与翻译 11 + WE 行 3，含把手键三处同步调整）。
- 文档编码门禁：`tests/doc-encoding-integrity.test.js` 检查 `RELEASE.md` / `CHANGELOG.md` / `README*.md` / `AGENTS.md` / `NOTICE.md` / `AI_HANDOFF.md` / `docs/PROJECT_MEMORY.md` / `docs/HANDOFF_NEXT_CHAT.md` 必须是合法 UTF-8、无 U+FFFD、无 GBK 乱码、无 BOM，已接入 `Verify`。
- `desktop/main.js`、`public/app.js`、`server.js` 等入口 `node --check` 通过。
- 发布工作流 `Generate SHA256 checksums` 的清单必须用绝对路径（`Join-Path (Get-Location)`）落盘再上传，相对名会因 .NET 工作目录与 PowerShell 位置不一致而失败（v2.0.3 首次构建已踩过）。
- 所有测试保持低优先级、串行、无 Electron/GUI；除非用户明确要求，不启动会占用桌面的长期测试进程。

## 后续优先级

- 无未完成的发布动作；`v2.0.8` 资产与文档都已回填。下一版起沿用 `codex/release-vX.Y.Z` 分支 + PR 的流程。
- 长期方向（未排期）：IndexedDB `assets` 拆分 `lyrics` store 并做流式迁移；外置封面改走 `/api/local-file` 流式 URL，避免主进程完整 Buffer/base64 和 renderer data URL。
- 观察项：`docs/HANDOFF_NEXT_CHAT.md` / `AI_HANDOFF.md` 的本地路径描述随机器变化，接手时先 `git remote -v` 核对，不要照抄旧路径。

## 不要做

- 不要修改不存在或旧归档的外层源码目录。
- 不要恢复旧的侧边栏闪烁、控制台播放暂停失效、3D 歌单架强制切回星河等问题。
- 不要把搜索结果、左侧歌单、3D 歌单架的性能优化做成一次性渲染全部内容。
- 不要把玻璃 SVG 黄金质感改成普通毛玻璃或廉价透明面板。
- 后台验证默认保持低优先级、串行、无 Electron/GUI；除非用户明确要求，不要启动会占用桌面的长期测试进程。
