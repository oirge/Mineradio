# Android 1.0.2 后台播放已发布

更新：2026-11-06。用户要求「让能后台播放音乐」，现已完成实现、云端验收、发布和完整安装包回下载核验。下方 1.0.1 记录作为历史保留。

## 下载与源码

- [Android 1.0.2 APK](https://github.com/oirge/Mineradio/releases/download/android-v1.0.2/Mineradio-Android-1.0.2.apk)，14,445,214 字节；[Release](https://github.com/oirge/Mineradio/releases/tag/android-v1.0.2)，Release ID `436096715`。
- 发布时间 `2026-11-06T04:22:52Z`（北京时间 2026-11-06 12:22:52）。
- tag `android-v1.0.2` 指向 `a79e7681fe3083111bd07f892881cb07d17554b6`；versionName `1.0.2`、versionCode `10002`、应用 ID `com.mineradio.oirge.mobile`。
- APK SHA256：`dc189cf5e0d96eb6df766283cbda439e3445d6de93157b4cce21acf6dfef580f`。完整回下载、本地重算、SHA256SUMS、GitHub digest 与云端验收包清单一致，公开下载 HEAD 200。
- 签名 v2 通过，证书沿用 1.0.0／1.0.1：`ee1586586ac8d13b17dda8020eda86712d62bac7b96e3f3b5e8643151faff0a6`，支持覆盖更新。旧版资产未替换，桌面 Latest 仍为 `v2.6.10`。
- 分支 `codex/android-mobile`，[PR #178](https://github.com/oirge/Mineradio/pull/178) 保持打开；最终文档提交与发行 tag 区分，不能重打 tag 或覆盖已发布资产。

## 实现

- 原服务只维持媒体通知，声音依赖 Activity 内的 WebAudio，移除最近任务时会暂停。新增服务内独立的 `NativeBackgroundPlayer`，使用平台 MediaPlayer 维护 SAF 授权队列、播放位置、音量／倍速、音频焦点、耳机断开、唤醒锁、睡眠计时和自然续播。
- 串行交接：先暂停网页 deck 并挂起 AudioContext，再启动原生输出；返回时先释放原生播放器，再恢复当前歌曲、位置和播放／暂停状态。服务不随最近任务移除停止，支持媒体控制和状态持久化。
- 修复验收发现的切歌问题：保存下一首快照前先释放旧 MediaPlayer，避免旧曲尾位置污染新曲起点。自然切歌和媒体键下一首都必须从新歌开头播放，未放宽暂停／继续的进度断言。
- 保留 1.0.1 的内嵌歌词及 Folia 修复，未修改 Folia 源码，无新增 Maven 依赖。

## 云端验收

- [Android 发行验收 42160875686](https://github.com/oirge/Mineradio/actions/runs/42160875686)：build、browser、native、publish 全成功。Node 1676 通过／0 失败／1 可选跳过，手机浏览器 10 项，Android 15 / API 35 原生 11 项；原生 `errors=[]`、`systemDialogs=[]`。
- [完整 Windows Verify 42160882111](https://github.com/oirge/Mineradio/actions/runs/42160882111)、[push Verify 42160875643](https://github.com/oirge/Mineradio/actions/runs/42160875643) 与[实际视频导出 42160882023](https://github.com/oirge/Mineradio/actions/runs/42160882023) 均成功。
- Home 后网页 `audio.paused` 且 AudioContext suspended，原生 audioSessionId 有效；屏幕实际进入 Dozing，原生进度从 `97.584` 秒增至 `118.365` 秒，返回前台接回位置且没有重复输出。
- 精确找到并移除真实最近任务后，原生从 `880.695` 秒继续，到曲尾后独立切换下一首，并从 `1.894` 秒开始播放。无 Activity 时媒体键暂停停在 `2.286` 秒，等待期间不变，继续后到 `4.315` 秒；媒体键下一首从 `1.920` 秒播放。
- 重建 Activity 恢复正在播放的正确歌曲与位置；再次后台暂停后回到前台仍暂停且位置匹配；强制停止后的 SAF 授权、曲库、内嵌歌词恢复和精确签名发行包安装启动通过。
- 已人工查看主舞台、Folia 和冷恢复系统截图，内嵌歌词可见。命名为 `android-background-notification.png` 的截图实际捕获了桌面，不能作为通知面板视觉验收；媒体控制以系统媒体键和真实服务状态为证。

## 证据与边界

- [完整发行核验](android-evidence/1.0.2-verification.json)、[原生 11 项报告](android-evidence/1.0.2-native.json)、[原生后台状态序列](android-evidence/1.0.2-background.json)、[手机浏览器 10 项报告](android-evidence/1.0.2-browser.json)。
- 云端原生 artifact `13476708625`、浏览器 artifact `13477067466`、精确签名包 artifact `13476174782`。本机 `output/cloud/native-1.0.2-accepted`、`browser-1.0.2-accepted`、`published-1.0.2` 保留报告、截图与安装包；核验脚本固定发行 SHA／run。
- 后台暂不执行 WebAudio 音效、ReplayGain 和交叉淡入淡出；前台恢复原设置。后台格式取决于 Android 系统播放器；系统「强行停止」会结束播放。
- Android 预览版尚未覆盖所有品牌、省电策略和实际用户覆盖安装数据组合。此需求没有剩余必做项；品牌设备覆盖、通知面板视觉补验与 PR 合并可后续单独处理。
- 继续遵守云端优先，不在本机启动 GUI／浏览器／模拟器／构建或测试，不操作用户播放器／数据，不发邮件，不创建子代理。

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
