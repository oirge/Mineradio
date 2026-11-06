# Android 1.0.1 发布与验收记录

更新：2026-11-06。内嵌歌词读取与 Folia 无歌词问题已修复，Android 1.0.1 已发布并完成完整安装包核验。

## 下载与源码

- [下载 APK](https://github.com/oirge/Mineradio/releases/download/android-v1.0.1/Mineradio-Android-1.0.1.apk)，14,432,708 字节；[Release](https://github.com/oirge/Mineradio/releases/tag/android-v1.0.1)，Release ID `436020179`。
- 发布时间 `2026-11-06T02:09:37Z`（北京时间 2026-11-06 10:09:37）。
- tag `android-v1.0.1` 指向 `6cf8a91a8d063a46fd7f8f96a2571ddaa77e295f`；versionName `1.0.1`、versionCode `10001`、应用 ID `com.mineradio.oirge.mobile`。
- 沿用 1.0.0 证书，可覆盖安装；未在用户电脑安装或操作用户播放器／数据。
- APK SHA256：`cecccd73db75a7f9a93dcd4de08075fb4af39cd28e3632d82d6aed7933561fb6`。完整回下载与 SHA256SUMS、GitHub asset digest 三方一致，公开下载 HEAD 200。
- 签名 v2 通过，证书 SHA256：`ee1586586ac8d13b17dda8020eda86712d62bac7b96e3f3b5e8643151faff0a6`。桌面 Latest 仍为 `v2.6.10`。
- 分支 `codex/android-mobile`，[PR #178](https://github.com/oirge/Mineradio/pull/178) 保持打开。

## 修复

- Capacitor 8.6.0 的 `PluginCall.getLong()` 不接受常见 JSON Integer，读取偏移回落为 0；原生改用 `getData().optLong()`，保留 SAF 授权校验。
- JS 每次 1 MiB 桥接读取并聚合完整标签范围，总上限 64 MiB；失败不会成为成功空结果。
- reader 版本签名同时使旧资产、歌词和曲库索引负缓存重新识别；歌曲 key 不变。新增 7 项生产函数回归。
- 普通舞台与 Folia 读取同一歌词数据，未修改 Folia 源码。

## 云端验收

- [Android 发行验收 42147297303](https://github.com/oirge/Mineradio/actions/runs/42147297303)：build、browser、native、publish 全成功。Node 1667 通过／0 失败／1 可选跳过，浏览器 10 项，Android 原生 9 项。
- 真实 ID3v2.4 USLT 内嵌歌词经 SAF 导入、非零范围读取、主引擎解析及 Folia 当前句可见性通过；后台播放、冷启动授权／曲库与内嵌歌词恢复、精确签名发行包安装启动通过。
- 原生报告 `errors=[]`；系统 Pixel Launcher ANR 有一次精确、有限处理并留存证据。
- [完整 Windows Verify 42147367912](https://github.com/oirge/Mineradio/actions/runs/42147367912) 成功，昨天的截图超时本轮未复现。
- [系统屏幕复核 42149065288](https://github.com/oirge/Mineradio/actions/runs/42149065288) 成功，publish 按 `publish_release=false` 跳过，没有替换已发布资产。提交 `7be0c8bf91c45fcdb1b42692c2912b0277f911ee` 仅修改工作流与验收脚本，应用代码与发行源码相同。
- 网页 CDP 截图未包含主舞台 WebGL，ADB 系统截图确认实际歌词可见；后续验收保留两种截图，不能用 CDP 黑图直接判定 WebGL 未显示。

## 实际截图

普通舞台系统截图：

![普通舞台显示内嵌歌词](android-evidence/1.0.1-main-screen.png)

Folia 显示同一音乐的内嵌歌词：

![Folia 显示内嵌歌词](android-evidence/1.0.1-embedded-folia.png)

## 证据与后续

- 发行原生 artifact `13471455791`、手机浏览器 artifact `13470439465`；系统屏幕复核 artifact `13472510510`。
- 本机证据：`output/cloud/native-1.0.1-accepted`、`browser-1.0.1-accepted`、`native-1.0.1-physical`；发行包 `output/cloud/published-1.0.1/`。
- 完整发行核验报告：`output/cloud/published-1.0.1-verification.json`；复查脚本 `output/cloud/verify-published-1.0.1.py` 固定发行 SHA／run，不要改成文档提交或补充截图提交。
- Android 预览版，尚未覆盖全部品牌手机与系统省电策略，解码依赖设备 WebView；没有宣称实际覆盖安装后的所有用户数据组合均已实测。
- 此次需求已完成。后续合并 PR 或扩展品牌设备支持另行处理；不要重复发布或覆盖 1.0.0／1.0.1 资产。
- 2026-11-05 暂停记录和历史失败保留在 Git 历史，可查看文档提交 `6cf8a91a8d063a46fd7f8f96a2571ddaa77e295f`。

继续遵守云端优先、不启动本机 GUI／浏览器／模拟器／构建、不操作用户播放器数据、不发邮件、不创建子代理。
