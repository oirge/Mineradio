# Mineradio Android 1.0.6 预览版

Android 7.0+，沿用原签名，可覆盖安装旧版。

- 两套手机界面统一页面、弹窗、底部面板与菜单的进入和退出动画；快速返回、重复开关从当前显示位置衔接。
- 按钮、收藏、重置和滑动操作提供轻微反馈；加载、空状态、错误提示与真实封面平滑出现。
- 曲库翻页与刷新保持单一列表，最多 8 个可见行同时过渡，保留原有分页与滚动位置。
- 响应系统“减少动态效果”，退出层立即停止交互并清理动画、焦点和监听。
- 保留 Folia 约 2.5 秒自动隐藏、首次触摸只唤回、拖动及菜单保护，以及单一原生 PCM 引擎和前后台连续播放。

源码覆盖和动效参数见 [动效优化报告](https://github.com/oirge/Mineradio/blob/codex/android-mobile/docs/MOBILE-MOTION.md)，发行与云端验收证据见 [Android 记录](https://github.com/oirge/Mineradio/blob/codex/android-mobile/docs/ANDROID-HANDOFF.md)。

云端模拟器用于验证交互、布局和 AudioTrack 连续性；实际手机帧率、高刷新率和品牌省电策略仍需设备验证。Android 预览版与桌面 Latest 独立发布。
