# Android 1.0.1 歌词修复续接记录

更新：2026-11-05。用户要求先将进度上传 GitHub，明天继续，当前工作已停止。

## 当前状态

- 仓库：`oirge/Mineradio`；分支：`codex/android-mobile`；[PR #178](https://github.com/oirge/Mineradio/pull/178) 保持打开。
- 最新功能及验收代码：`f0f82abbfcb66b210016f34a68247551455d9f21`。本记录所在提交只保存进度，提交信息包含 `[skip ci]`。
- [Android 1.0.0](https://github.com/oirge/Mineradio/releases/tag/android-v1.0.0) 已发布。
- **1.0.1 尚未发布，全部原生验收尚未完成。** 不要将 APK 编译通过或已有歌词截图写成最终验收通过。
- [最新 Android 工作流 42005717035](https://github.com/oirge/Mineradio/actions/runs/42005717035) 构建已成功，浏览器和原生验收开始后，按用户暂停要求取消，现为 `cancelled`。需要继续该任务后才能完成验收、发布和安装包核验。
- 不自动安排明天的任务或发送通知；等待用户继续。

## 用户问题

1. 手机版无法识别音乐文件里的内嵌歌词。
2. Folia 完全没有歌词。

## 已提交的修复

- `e1b4fbf04399e6811b3aede2759d4d9afd15f27d`：Capacitor 8.6.0 的 `PluginCall.getLong()` 不接受常见 JSON Integer，导致文件读取偏移回落为 0。原生改为 `call.getData().optLong()`，保留 SAF 授权校验。
- `public/mobile-native.js` 以 1 MiB 原生请求聚合完整文件范围，总范围上限 64 MiB，支持未知大小到 EOF，读取失败不会变成成功空结果。
- 原生文件加入 reader 版本签名，旧资产缓存和歌词缓存失效，重新识别标签。
- `cfc405c03724fe34e971ef3372ae4a4b05379651`：曲库索引同 key 快速命中也需验证原生 reader 签名，避免继续套用旧“无歌词”状态。歌曲 key、URI、大小、mtime 不变。
- 新增 7 项 `tests/mobile-native-reader.test.js` 回归：非零偏移、大范围、未知大小、失败传播，以及资产、歌词和索引三种缓存升级路径。
- 已准备 `1.0.1`、versionCode `10001`、`Mineradio-Android-1.0.1.apk`、独立 tag `android-v1.0.1`，沿用 1.0.0 签名。版本与发行说明已更新。
- 未修改 Folia 源码。

## 已有验证与未通过记录

### 修复代码的上一轮验证

[Android run 42002688213](https://github.com/oirge/Mineradio/actions/runs/42002688213)：

- Node：1667 通过、0 失败、1 可选跳过。
- 手机浏览器：10 项通过，含两套界面及 Folia 六组横竖屏。
- 签名 v2 校验成功，证书 SHA256：`ee1586586ac8d13b17dda8020eda86712d62bac7b96e3f3b5e8643151faff0a6`，与 1.0.0 一致。
- 真正内嵌 ID3v2.4 USLT 的 WAV 经 SAF 导入和播放；非零字节范围读取及主引擎歌词解析已通过。
- Folia 已显示内嵌歌词，截图如下。验收脚本固定查询第一句 `data-overlap-fit-line="0"`，实际播放已进入第二句 `60`，因此等待超时，原生只完成前 4 项，发布被拦住。
- 原生 artifact `13404262152`，浏览器 artifact `13403473097`。

![Folia 显示音乐文件里的内嵌歌词](android-evidence/1.0.1-embedded-folia.png)

- [Windows 完整 Verify 42002688128](https://github.com/oirge/Mineradio/actions/runs/42002688128) 成功；对应 PR Verify 曾在点击／截图时超时，保留该失败记录。
- [视频导出 42002695215](https://github.com/oirge/Mineradio/actions/runs/42002695215) 成功。

### 最新验收脚本

- `7fbb001e7413566c60b8cfeb1032c2a8db9138a8`：根据当前播放时间选择实际歌词句，继续要求歌词及文字 opacity > .9，完整位于舞台内。增加 `fittedLines` 几何诊断。
- `f0f82abbfcb66b210016f34a68247551455d9f21`：普通舞台等待当前 mesh 或多行行池 alpha > .75，再保存截图，避免截到初始透明入场帧。增加 `android-main-lyrics.json`。
- 原生应全部通过 **9 项**，还需完成 Folia 可见性、返回键、后台播放、强制停止后的授权／曲库及内嵌歌词恢复、精确签名发行包安装启动。
- 最新工作流构建产物：APK artifact `13403529422`、debug 验收包 `13404861707`、Folia 静态资源 `13404737173`。这些是尚未验收完成的构建产物。
- 最新视频导出 [42005725101](https://github.com/oirge/Mineradio/actions/runs/42005725101) 已成功。
- 保存进度时，最新 push [Verify 42005716821](https://github.com/oirge/Mineradio/actions/runs/42005716821) 已在 `Verify Folia playback and display options` 失败，尚未排查；最新 PR Verify `42005725114` 已取消。明天需读取该失败日志，不要将最新完整桌面回归写成通过。

## 明天继续

1. 先查看分支和 [42005717035](https://github.com/oirge/Mineradio/actions/runs/42005717035) 状态，确认没有其他人修改功能代码。
2. 可重跑该完整工作流，继续验证 `f0f82abb` 的同一份代码：

   ```powershell
   gh run rerun 42005717035 --repo oirge/Mineradio
   ```

   如果决定从更新后的分支启动新工作流，务必记录其实际 head SHA 和 run ID，更新后续核验脚本中的固定值。
3. 跟进 build、verify-browser、verify-android。原生失败时读取 JSON、截图和日志定位，不放宽歌词可见性断言。不得仅凭构建成功宣布完成。
4. 原生报告要求 9 项通过、`errors=[]`；肉眼检查 `android-player.png`、`android-embedded-folia.png` 和重启恢复截图。手机浏览器要求 10 项通过。
5. 全部门禁通过后工作流自动发布独立 `android-v1.0.1` 预览版。核对 tag 指向、版本 1.0.1／10001、同一证书、完整回下载 APK 的 SHA256、`SHA256SUMS.txt`、GitHub asset digest 和公开下载 HEAD。
6. 更新 PR body、AI_HANDOFF 和状态文档后交付 APK 链接。1.0.0 历史资产保留。

## 当前工作区与操作约束

- 用户要求云端优先，不在本机启动 GUI、浏览器、模拟器或构建，不操作用户播放器／数据，不发邮件，不创建子代理。
- 当前本机是无 `.git` 的源码快照：`C:/Users/Administrator/Desktop/Mineradio-main/Mineradio-main`。远端当前源码缓存位于 `output/cloud/remote/`，不要误改旧外层源码。
- 本机辅助脚本：`output/cloud/fetch-source.py`、`update-mobile.py`、`read-artifact.py`。
- 本机状态：`output/cloud/ANDROID-STATUS.md`；未通过但已有歌词截图的证据：`output/cloud/native-1.0.1/`；浏览器通过报告：`output/cloud/browser-1.0.1/browser-results.json`。
- 本机发行核验脚本 `output/cloud/verify-published-1.0.1.py` 当前固定 SHA `f0f82abb`、run `42005717035`；要求最终证据放在 `native-1.0.1-accepted/`、`browser-1.0.1-accepted/`，构建日志为 `build-1.0.1-f0f82abb.log`。该脚本尚未对 1.0.1 发行包执行。
- 云端模拟器保留 Xvfb + Mesa llvmpipe、`-gpu host -feature -Vulkan` 及精确匹配的 Pixel Launcher ANR 有限处理，不恢复曾崩溃的 SwiftShader 配置。
