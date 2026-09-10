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

- 当前版本：`v2.0.4`（文档编码修复与发布记录回填，纯维护版、无运行时改动）。上一版 `v2.0.3`（SSA 歌词与发布链路加固）。
- GitHub 仓库：`https://github.com/oirge/Mineradio`。`package.json` 发布配置 owner/repo 为 `oirge/Mineradio`。
- 发布基线：`v2.0.3` 已发布并设为 Latest（annotated tag object `ac634a30…` 指向 `30b3ba5f…`，Release `386043356`）。`v2.0.4` 为纯文档维护版。
- `main` 是发布线，发版走 `codex/release-vX.Y.Z` 分支 + PR（**用 merge commit 合，绝不 squash**，否则 tag 会离开 `main` 可达历史），tag 打在 release commit 上。
- `package.json` 发布配置 owner/repo 已是 `oirge/Mineradio`。

## 最近完成

- 2026-09-10：发布 `v2.0.4`（纯文档维护版）：修复 `RELEASE.md` 自 v1.2.61 起被 GBK 误解码损坏的约 165 行发布说明；新增文档编码门禁 `tests/doc-encoding-integrity.test.js` 并接入 `Verify`；回填 v2.0.3 资产记录、修正项目记忆与交接文档里过期的路径与基线。无运行时改动，回归 `1076/1076`。
- 2026-09-10：发布 `v2.0.3`。SSA 歌词补齐（`.ssa` 与 `.ass` 共用解析）；发布链路改为显式管理单个同 tag Release（`--publish never` + `gh release upload --clobber`），不再由 electron-builder 隐式建双草稿；Actions 升 v5；SHA256 清单改为 LF、无 BOM UTF-8。分支 `codex/release-v2.0.3`，提交 `30b3ba5` / `5bae4cf`，PR #73（merge `d576231`）+ #74（merge `44b39d5`）；首次构建 run `34442721960` 因清单落盘路径失败，`5bae4cf` 修复后 run `34444159148` 成功。四资产回下载三路校验通过。
- 2026-09-08：发布 `v2.0.2`，全屏进入 / 退出过渡与视觉预设构图修复。
- 2026-09-07：发布 `v2.0.1`（视觉预设 6/8 切换不再漏透明）与 `v2.0.0`（视觉预设 7/8 读档不再截回 6）。
- 2026-09-06：发布 `v1.10.0`，安装身份换到 `com.mineradio.desktop.oirge`，与原项目可同时安装、同时运行。
- 更早的 `v1.2.x` / `v1.3+` 内存与性能优化历史保留在 `AI_HANDOFF.md` 的工作日志和 `docs/PROJECT_MEMORY.md`，本文件不再重复。

## 已知验证

- 全量 Node 回归 `1076/1076` 通过（`npm test`，即 `node --test --test-concurrency=1`）；`v2.0.3` 发布时基线为 `1071`，其后新增 5 例文档编码门禁。
- 文档编码门禁：`tests/doc-encoding-integrity.test.js` 检查 `RELEASE.md` / `CHANGELOG.md` / `README*.md` / `AGENTS.md` / `NOTICE.md` / `AI_HANDOFF.md` / `docs/PROJECT_MEMORY.md` / `docs/HANDOFF_NEXT_CHAT.md` 必须是合法 UTF-8、无 U+FFFD、无 GBK 乱码、无 BOM，已接入 `Verify`。
- `desktop/main.js`、`public/app.js`、`server.js` 等入口 `node --check` 通过。
- 发布工作流 `Generate SHA256 checksums` 的清单必须用绝对路径（`Join-Path (Get-Location)`）落盘再上传，相对名会因 .NET 工作目录与 PowerShell 位置不一致而失败（v2.0.3 首次构建已踩过）。
- 所有测试保持低优先级、串行、无 Electron/GUI；除非用户明确要求，不启动会占用桌面的长期测试进程。

## 后续优先级

- 无未完成的发布动作；`v2.0.3` 资产与文档都已回填。下一版起沿用 `codex/release-vX.Y.Z` 分支 + PR 的流程。
- 长期方向（未排期）：IndexedDB `assets` 拆分 `lyrics` store 并做流式迁移；外置封面改走 `/api/local-file` 流式 URL，避免主进程完整 Buffer/base64 和 renderer data URL。
- 观察项：`docs/HANDOFF_NEXT_CHAT.md` / `AI_HANDOFF.md` 的本地路径描述随机器变化，接手时先 `git remote -v` 核对，不要照抄旧路径。

## 不要做

- 不要修改不存在或旧归档的外层源码目录。
- 不要恢复旧的侧边栏闪烁、控制台播放暂停失效、3D 歌单架强制切回星河等问题。
- 不要把搜索结果、左侧歌单、3D 歌单架的性能优化做成一次性渲染全部内容。
- 不要把玻璃 SVG 黄金质感改成普通毛玻璃或廉价透明面板。
- 后台验证默认保持低优先级、串行、无 Electron/GUI；除非用户明确要求，不要启动会占用桌面的长期测试进程。
