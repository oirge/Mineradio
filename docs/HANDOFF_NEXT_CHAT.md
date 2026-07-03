# Mineradio Next Chat Handoff

更新时间：2026-07-03

## 新对话先执行

当前可用工作区：

```powershell
cd C:\Users\Administrator\Desktop\Mineradio-main
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

- 当前可写代码/Git 仓库：`C:\Users\Administrator\Desktop\Mineradio-main`
- 本轮检查时旧规则里的 `E:\桌面\播放器软件\Mineradio\resources\app` 不存在；不要盲目切去旧路径。
- 当前版本：`v1.2.8`
- GitHub 仓库：`https://github.com/oirge/Mineradio`
- 当前分支：`main...origin/main`
- 当前提交：以 `git log --oneline -5 --decorate` 为准
- `package.json` 发布配置 owner/repo 已是 `oirge/Mineradio`。

## 最近完成

- 2026-07-03：将渲染进程 UI 状态备份从每次立即 IPC/写盘，改为 180ms 合并写入；首次全量同步仍立即写，`beforeunload` / `pagehide` 前会 flush，降低连续拖动视觉滑条和设置切换时的主进程写盘抖动。
- 2026-07-03：交接文档从旧 `v1.1.0 / XxHuberrr` 发布线更新到当前 `v1.2.8 / oirge` 工作区，避免后续接手走错仓库。

## 已知验证

- `git diff --check`
- `node --check server.js`
- `node --check desktop\main.js`
- 前端内联脚本解析检查
- 当前 Windows 系统代理为 `127.0.0.1:7897`；PowerShell / Node 需要显式设置 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 为 `http://127.0.0.1:7897`。
- 已使用该代理成功执行 `npm run build:win:dir`，生成 `dist\win-unpacked`。
- 已使用该代理成功执行 `npm run build:win`，生成 `dist\Mineradio-1.2.8-Setup.exe`、`.blockmap`、`dist\Mineradio-1.2.8-Portable-win-x64.zip` 和 `dist\latest.yml`。
- 本次 `Mineradio-1.2.8-Setup.exe` SHA256：`ED16AAB84BC994BDA0512D6250EAF12FC2DAD8AABCA6ABF6FD98B65CBF5C4601`。

## 后续优先级

- 继续小步优化 3D 歌单架“悬停展开”和“点击可用”之间的手感边界；先读 `docs\3D_PLAYLIST_SHELF_MEMORY.md`，不要推倒重做。
- 继续关注本地大曲库：搜索索引预热、队列/歌单架分批渲染、封面缩略图缓存和桌面歌词 IPC 频率。
- 如要发布，先确认版本号、`CHANGELOG.md`、`RELEASE.md`、安装包和 GitHub Release 资产一致。

## 不要做

- 不要修改不存在或旧归档的外层源码目录。
- 不要恢复旧的侧边栏闪烁、控制台播放暂停失效、3D 歌单架强制切回星河等问题。
- 不要把搜索结果、左侧歌单、3D 歌单架的性能优化做成一次性渲染全部内容。
- 不要把玻璃 SVG 黄金质感改成普通毛玻璃或廉价透明面板。
