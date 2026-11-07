# Android 安装与构建

Android 版本基于现有本地音乐播放器，采用 Capacitor 8，安装后直接使用手机中的音乐。

## 安装

从 [Android 1.0.5 APK](https://github.com/oirge/Mineradio/releases/download/android-v1.0.5/Mineradio-Android-1.0.5.apk) 下载 `Mineradio-Android-1.0.5.apk`；[发行记录](https://github.com/oirge/Mineradio/releases/tag/android-v1.0.5)。在手机打开并允许浏览器安装此来源的应用。

- 1.0.5 将 Folia 手机控制区隐藏与唤回改为柔和过渡，沿用单一原生音频引擎与签名，可覆盖安装更新。
- 1.0.4 增加 Folia 手机闲置自动隐藏，原生音频沿用 1.0.3，沿用签名，可覆盖安装更新。
- 1.0.3 将前后台音乐统一为媒体服务中的同一套 PCM 引擎和 AudioTrack，切换应用、锁屏、移除最近任务及重新打开界面只同步歌曲、进度与操作，避免更换音频引擎造成的停顿。沿用原签名，可覆盖安装更新。
- 支持 Android 7.0 及以上；音频格式取决于设备的 Android 平台解码器，前后台使用相同解码与输出链路。
- 在首页选择「本地文件」可多选音乐、歌词和封面；「导入文件夹」授权一个音乐目录。
- 导入采用 Android 系统文件选择器，应用保存访问授权，重启后恢复曲库。原始音乐从系统文档提供器流式播放。
- 底部导航提供首页、搜索、播放、歌单、设置。播放栏支持拖动进度、切歌和收藏；更多按钮展开歌词、歌单架和音量。
- 顶部「F」切换 Folia，Folia 顶部电台图标返回 Mineradio；两套界面共享原生播放状态、真实 PCM 频谱与时域分析、内嵌歌词，切换保持播放进度。Folia 提供歌词、悬浮唱片和封面拼贴，底部导航可打开曲库、视觉效果、播放设置和更多工具。
- Folia 手机界面闲置约 2.5 秒后隐藏顶部导航、歌曲信息、播放控件和底部导航，歌词、唱片或封面舞台铺满界面。首次轻触只唤回控件；再次点击可操作。拖动进度或音量期间保持可见，结束或取消拖动后重新计时；曲库、设置和菜单打开时保持可见，关闭后恢复计时。
- 1.0.5 截图核对：最终浏览器截图：隐藏图中顶部导航、歌曲信息、播放控件和底部导航均已消失，歌词舞台铺满视口；恢复图中四组控件正常显示，舞台回到原布局；最终 Android 系统截图：原始系统隐藏截图仍显示四组控件及原舞台布局，与同轮 DOM 隐藏和满舞台记录不一致；恢复截图四组控件正常显示。渲染或截图原因未确认，实际手机显示效果未验收。详见 [发行与验收记录](ANDROID-HANDOFF.md)。
- 播放期间提供媒体通知和前台服务。使用返回键可先回到播放页，再将应用切到后台。
- 开始播放后直接回到桌面、切换应用或锁屏即可后台播放，无需额外开关；通知栏及媒体键可暂停、继续、切歌和跳转。重新打开应用只同步持续运行的原生引擎，通知栏暂停后回来仍保持暂停。
- 前后台保留既有 10 段 EQ、自动／手动预增益、限幅、立体声宽度、ReplayGain 及防削波、保持音高的倍速、无缝接续和交叉淡入淡出；歌单选择提示音也混入同一个 AudioTrack。原生限幅保留全部控制参数，但不保证与 WebAudio 逐样本一致；交叉期间 ReplayGain 沿用既有公共增益语义。系统「强行停止」会结束播放；部分品牌手机需在应用电池设置中允许后台活动。
- 应用内包含全部界面资源，本地播放无需电脑和同一 Wi-Fi。桌面在线翻译与视频导出尚未接入 Android；Android 预览版与桌面 Latest 独立发布。

## 云端构建

`.github/workflows/android.yml` 在 `codex/android-mobile` 分支推送时执行，也可手动运行 **Android APK**。

Android 发行流程包含 Node 回归、Folia 本地嵌入版重新构建、两套手机界面横竖屏交互、APK 签名校验以及 Android 模拟器的安装、系统文件导入、真实 PCM 音效与连续播放、媒体控制和重启恢复。Android build、browser、native 门禁全部通过后自动发布预览版；独立 Windows Verify 与视频回归的具体结果见 [发行与验收记录](ANDROID-HANDOFF.md)。

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
