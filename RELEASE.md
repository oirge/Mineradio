# 发布流程

## v1.1.9 桌面歌词入口与播放器性能微调

- `v1.1.9` 将桌面歌词开关放到播放界面底部控制栏，用户不需要进入视觉控制台也能直接开启/关闭。
- 播放界面桌面歌词图标会与视觉控制台里的桌面歌词开关同步高亮、`aria-pressed` 和提示文本。
- 桌面覆盖层关闭时释放旧同步 key 和歌词游标，避免重开后复用过期状态。
- 本次发布继续上传完整安装包、blockmap、`latest.yml`、Portable ZIP 和 SHA256 校验文件。
- Release 标题建议使用 `Mineradio v1.1.9 桌面歌词入口优化版`。

## v1.1.8 播放器性能优化

- `v1.1.8` 优化播放器运行时性能，降低高刷屏频谱分析、队列刷新、本地库缓存和桌面覆盖层同步的主线程开销。
- 本地曲库快照和索引迁移到 IndexedDB，旧 localStorage 数据保留自动迁移回退。
- 队列面板和迷你队列刷新会合并同帧任务，并在可见内容未变化时跳过 DOM 重建。
- 本次发布需要上传完整安装包、blockmap、`latest.yml`、Portable ZIP 和 SHA256 校验文件。
- Release 标题建议使用 `Mineradio v1.1.8 播放器性能优化版`。

## v1.1.7 更新检测与下载稳定性优化

- `v1.1.7` 优化软件更新检测：自动检查复用 5 分钟缓存，并合并并发检测请求。
- 用户主动打开更新面板时会强制刷新一次，避免长时间运行后继续显示旧检测结果。
- 更新下载增加读流空闲超时；线路响应后如果长时间不传输数据，会中止当前线路并切换下一条。
- 本次发布需要上传完整安装包、blockmap、`latest.yml`、Portable ZIP 和 SHA256 校验文件。
- Release 标题建议使用 `Mineradio v1.1.7 更新稳定性优化版`。

## v1.1.6 更新入口与免安装版修复

- `v1.1.6` 修复纯本地模式下更新入口不可见的问题，更新检查延后到启动动画和本地库恢复之后执行。
- 桌面端 `window.open` 只允许打开 `https://github.com/oirge/Mineradio` 仓库链接，避免渲染层误触发任意外部协议。
- Windows 构建同时生成 NSIS 安装包和 Portable ZIP。
- 本次发布需要上传完整安装包、blockmap、`latest.yml`、Portable ZIP 和 SHA256 校验文件。
- Release 标题建议使用 `Mineradio v1.1.6 更新入口修复版`。

## v1.1.4 界面状态持久化修复

- `v1.1.4` 修复每次打开软件界面像被重置的问题。
- 重点验证：启动前从主进程 `desktop-ui-state.json` 回灌关键 localStorage 状态；已有用户配置时不再强制启动星河预览。
- Release 标题建议使用 `Mineradio v1.1.4 界面状态修复版`。

## v1.1.3 播放启动热修

- `v1.1.3` 是 `v1.1.2` 的本地播放启动热修版。
- 重点修复 `/api/local-file` 本地文件代理运行时缺少 MIME 类型解析导致音频请求 500，以及手动播放路径未传递 manual 标记的问题。
- Release 标题建议使用 `Mineradio v1.1.3 播放启动热修版`。

## v1.1.2 纯本地发布

- `v1.1.2` 是纯本地播放器版本，移除 QQ / 网易云 / 播客在线音乐链路，只保留本地音乐库、更新检查、节拍缓存和本地文件读取接口。
- 本次发布需要上传完整安装包、blockmap、`latest.yml` 和 SHA256 校验文件。
- Release 标题建议使用 `Mineradio v1.1.2 纯本地版`。
- Release 正文重点说明本地库索引、封面缩略图缓存、歌词/封面后台队列和在线遗留代码清理。

## v1.1.0 发布边界

- `v1.1.0` 是纯净安装发布版，从当前 `resources/app` 可信源码重新构建。
- 不复用旧 `dist/`、旧安装包、旧 `node_modules`、旧备份包或任何历史 packaged build。
- 不生成 `v1.0.10 -> v1.1.0` 快速补丁。
- 不把 `v1.1.0` 设置为旧版软件内更新通道的 latest；`v1.0.10` 用户需要手动下载新版安装包并纯净安装。
- GitHub Release 需要明确提示：`v1.0.10` 及更早安装包有风险，请隔离旧 `.exe` 安装包，不要继续安装或转发。
- 安装包样式继续沿用 `docs/INSTALLER_STYLE.md` 的中文极简黑白蓝格式。

## 发布前检查

- 确认 `package.json` 和 `package-lock.json` 版本号正确。
- 确认 `mineradio.update.owner/repo` 指向正式仓库。
- 确认 `.cookie`、`.qq-cookie`、`updates/`、`node_modules/`、旧 `dist/` 没有进入 git。
- 确认 README/SECURITY/CHANGELOG/Release 正文包含 `v1.0.10` 旧安装包隔离说明。
- 运行语法检查：`git diff --check`、`node --check server.js`、前端内联脚本解析。
- 运行 Git 跟踪风险残留检查，确认没有跟踪 `.exe/.dll/.scr/.bat/.cmd/.ps1/.vbs/.jse/.wsf/.hta/.xlsm` 等可执行/脚本残留。
- 从当前源码执行 `npm run build:win` 生成 Windows 安装包。
- 对新生成的安装包和当前源码执行安全扫描。
- 生成并记录新安装包 SHA256。

## GitHub Release

Release tag：

```text
v1.1.0
```

Release 标题：

```text
Mineradio v1.1.0 纯净安装版
```

建议上传资产：

- `dist/Mineradio-1.1.0-Setup.exe`
- `dist/Mineradio-1.1.0-Setup.exe.blockmap`（可选；本次不作为旧版软件内更新使用）
- `dist/Mineradio-1.1.0-SHA256SUMS.txt`

本次不要上传：

- `latest.yml`
- `v1.0.10 -> v1.1.0` 快速补丁

## 更新检测

应用会请求 GitHub Releases latest。为了避免 `v1.0.10` 旧客户端通过软件内更新直接拉到 `v1.1.0`，本次 GitHub Release 不应设为旧更新通道的 latest。

本地验证更新链路时，可以用临时 manifest：

```json
{
  "latestVersion": "1.1.0-test",
  "release": {
    "name": "Mineradio v1.1.0-test",
    "downloadUrl": "http://127.0.0.1:3144/Mineradio-1.1.0-Setup.exe",
    "notes": ["本地在线更新链路测试"]
  }
}
```
