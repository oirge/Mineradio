# Mineradio Android 1.0.7 预览版

Android 7.0+，沿用原签名，可覆盖安装旧版。

- 修复控制栏隐藏和出现时，歌词界面突然扩张、收缩带来的卡顿和切割感。
- 歌词排版与背景画布保持固定尺寸，外层边界和中心位置同步平滑收放；快速唤回从当前画面连续反向。
- 译文、下一句提示仍在原安全区域排布；保留效果、主题、按钮反馈和原生音频播放。
- 保留 2.5 秒闲置隐藏、首次触摸只唤回、拖动和菜单保护，以及系统减少动态效果支持。
- 手动沉浸和闲置隐藏共用同一 560ms 过渡，控制层沿用 520ms 淡入淡出；无新增运行依赖。

发行经过同一提交的云端构建、浏览器及 Android 原生门禁。专项检查记录隐藏、唤回和中途反向时的裁切范围，要求歌词渲染区域与背景画布尺寸保持不变。

功能与播放取证来自同提交 debug APK；签名 release APK 另验安装和离线导入。未覆盖实际品牌手机、稳定 60FPS、高刷新率、低性能设备和扬声器听感。

历史版本的系统隐藏截图与 DOM 不一致，以及未覆盖的触摸反向场景，仍保留在发行验收记录中；不能用旧版本结果证明本轮通过。Android 预览版与桌面 Latest 独立。

完整结果见 [动效优化报告](https://github.com/oirge/Mineradio/blob/codex/android-mobile/docs/MOBILE-MOTION.md) 与 [发行验收记录](https://github.com/oirge/Mineradio/blob/codex/android-mobile/docs/ANDROID-HANDOFF.md)。
