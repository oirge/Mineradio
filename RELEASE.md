# 发布流程

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
