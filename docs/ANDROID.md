# Android 安装与构建

Android 版本基于现有本地音乐播放器，采用 Capacitor 8，安装后直接使用手机中的音乐。

## 安装

从 [Android 预览版 Release](https://github.com/oirge/Mineradio/releases/tag/android-v1.0.2) 下载 `Mineradio-Android-1.0.2.apk`，在手机打开并允许浏览器安装此来源的应用。

- 1.0.2 增加原生后台播放，支持切换应用、锁屏、移除最近任务后继续播放，以及通知栏控制；保留内嵌歌词修复，沿用签名，可覆盖安装更新。
- 支持 Android 7.0 及以上；前台音频格式取决于 WebView，后台取决于 Android 系统播放器。
- 在首页选择「本地文件」可多选音乐、歌词和封面；「导入文件夹」授权一个音乐目录。
- 导入采用 Android 系统文件选择器，应用保存访问授权，重启后恢复曲库。原始音乐从系统文档提供器流式播放。
- 底部导航提供首页、搜索、播放、歌单、设置。播放栏支持拖动进度、切歌和收藏；更多按钮展开歌词、歌单架和音量。
- 顶部「F」切换 Folia，Folia 顶部电台图标返回 Mineradio；切换共用原有音频实例，保持播放进度。Folia 提供歌词、悬浮唱片和封面拼贴，底部导航可打开曲库、视觉效果、播放设置和更多工具。
- 播放期间提供媒体通知和前台服务。使用返回键可先回到播放页，再将应用切到后台。
- 开始播放后直接回到桌面、切换应用或锁屏即可后台播放，无需额外开关；通知栏可暂停、继续和切歌。重新打开应用会接回当前歌曲和位置，通知栏暂停后回来仍保持暂停。
- 后台暂不执行 WebAudio 音效、ReplayGain 和交叉淡入淡出，返回前台后恢复原设置。系统「强行停止」会结束播放；部分品牌手机需在应用电池设置中允许后台活动。
- 应用内包含全部界面资源，本地播放无需电脑和同一 Wi-Fi。歌词在线翻译等依赖桌面服务的功能尚未接入 Android。

## 云端构建

`.github/workflows/android.yml` 在 `codex/android-mobile` 分支推送时执行，也可手动运行 **Android APK**。

流程包含桌面回归、Folia 本地嵌入版重新构建、两套手机界面横竖屏交互、APK 签名校验以及 Android 模拟器的安装、系统文件导入、播放和重启恢复。全部通过后自动发布 Android 预览版。

安装包保存在 `mineradio-android-apk` 构建产物。签名密钥已在云端生成，并保存到仓库 Secrets `MOBILE_KEYSTORE_BASE64`、`MOBILE_KEYSTORE_PASSWORD`，后续构建自动复用同一签名以支持覆盖安装。首次生成时以仓库公钥加密保存的 `android-signing-sealed.json` 用于安全转存；原始密钥和密码不得提交到仓库或写入日志。

可重现的构建入口为：

```sh
npm install --prefix mobile --ignore-scripts
npm --prefix mobile run prepare:android
cd mobile/android
./gradlew assembleRelease
```

正式签名使用环境变量 `MOBILE_KEYSTORE_PATH`、`MOBILE_KEYSTORE_PASSWORD`，密钥别名为 `mineradio`。

参考：[mineradio-mobile](https://github.com/MorsBrenn/mineradio-mobile)、[Capacitor 配置](https://capacitorjs.com/docs/config)。
