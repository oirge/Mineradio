# 手机交互动效规范与优化报告

更新：2026-11-09。当前源码目标为 Android 1.0.6 / versionCode 10006；构建、交互及发布结果将在云端验收后写入本报告和 `ANDROID-HANDOFF.md`。

## 技术栈与问题

Mineradio 手机外壳沿用 DOM / CSS / GSAP，嵌入 Folia 使用 React 19、Framer Motion 和已有虚拟列表。原生音频始终由同一 PCM 引擎和 AudioTrack 输出。本轮复用现有技术，不增加运行依赖。

原有页面依赖 `display:none` 与类切换，部分浮层在 React 条件移除时来不及执行退出动画；旧 GSAP 控件反馈持续较长，部分包含模糊、光晕和较大旋转，且未覆盖系统减少动态效果。曲库刷新原先切换为加载空态；重复开关和快速返回容易留下旧动画或移走新浮层的焦点。

## 统一参数

唯一参数源为 `public/mobile-motion-tokens.js`。宿主写入 CSS 变量，Folia 从同一文件导入参数。

| 场景 | 时长 |
| --- | --- |
| 按压、图标与收藏反馈 | 150ms |
| 普通组件、列表与展开 | 200ms |
| 页面与视觉界面切换 | 280ms |
| 对话框和遮罩 | 240ms |
| 底部面板 | 280ms |
| 下拉与操作菜单 | 200ms |
| 封面与状态提示 | 200ms |

普通位移为 8px，底部浮层为 16px，缩放为 0.985；行交错间隔 12ms，首窗最多 8 个目标，最大延迟 84ms。普通缓动为 `cubic-bezier(.22,1,.36,1)`，页面为 `cubic-bezier(.4,0,.2,1)`。返回使用进入方向的反向；中途开关从当前绘制值继续。

Folia 已有闲置隐藏是独立契约：约 2500ms 无操作后隐藏，控制层 520ms、舞台中心 560ms、8px，保留原缓动。不会以统一短时长覆盖此已验收行为。

## 覆盖与文件

| 区域 | 实现与主要文件 |
| --- | --- |
| 共享规范与生命周期 | `public/mobile-motion-tokens.js`、`mobile-motion.js`、`mobile-motion.css`；Folia `hooks/useMobileMotion.ts`、`utils/mobileMotion.ts` |
| 原生手机导航 | `public/mobile.js`、`mobile-view-motion.js`、`mobile.css`：五个页面、返回/前进、外部设置入口、更多控件行 |
| 宿主弹窗与反馈 | `public/app.js`：GSAP 弹窗的手机分支、列表首窗、队列删除、播放模式、FX 页签、更新与封面裁剪反馈；`public/index.html` 接入共享资源 |
| 两套界面切换与自动隐藏 | `public/folia-host.js`、`folia-mobile-chrome.js`、`useLocalFocusMotion.ts`：切换前释放旧动画，闲置隐藏与手动沉浸共用舞台过渡，退出浮层仍保留操作保护 |
| Folia 页面与详情 | `LocalVisualStage.tsx`、`useLocalViewMotion.ts`、`LibraryPanel.tsx`、`LocalLibraryContent.tsx`、`TrackDetails.tsx` |
| 列表稳定与唱片墙 | `useLibraryPage.ts`、`useLocalTrackListMotion.ts`、`RecordWallViewport.tsx`、`LocalRecordWall.tsx`、`LocalPosterWall.tsx`、`localNavigationMotion.css` |
| Folia 面板与导航 | `LocalPlayer.tsx`、`LocalHeader.tsx`、`PlayerControls.tsx`、`LocalMobileNavigation.tsx`、`LocalToolDialogs.tsx`、`LocalToolPanel.tsx`、`LocalPlaybackSettings.tsx`、`VisualSettings.tsx` |
| 菜单与工具 | `PlaylistSwitcher.tsx`、`PlaylistSwitcherMenu.tsx`、`LocalControlSlot.tsx`、`LocalLatticeTools.tsx`、`LocalAudioSettings.tsx`、`LocalAddToPlaylist.tsx` |
| 加载、空态、错误及封面 | `LocalMotionStatus.tsx`、`LocalPlayerStates.tsx`、`LocalStatusToast.tsx`、`LocalArtwork.tsx`、`localMobileMotion.css`、`localMobile.css` |
| 可复用交互组件 | `SlideActionButton.tsx`、`ThemedDialog.tsx`、`CustomSelect.tsx`、`CustomSelectMenu.tsx`、`overlayEntranceMotion.ts` |
| 云端门禁 | `scripts/verify_mobile_motion.py`、`verify_folia_mobile.py`、`verify-mobile-browser.py`、`verify-android.py`、`.github/workflows/android.yml` |

## 连续性与性能约束

- 页面保留稳定外壳。视觉模式切换立即释放旧 GPU 实例，等待真实 `onReady` 后淡入；不等待两套视觉引擎同时运行。
- 曲库仍为 60 条分页，列表根节点在翻页、搜索及刷新期间保持身份。等待跨页结果时旧内容保留且 inert；同页请求失败保留已有数据。只在列表与单曲详情之间执行整块转场。
- 列表不保留退出行，当前行与总行数均不超过 60；最多 8 个可见行根节点执行入场或位置过渡。滚动不重新播放入场动画，详情返回恢复该范围的滚动位置。
- 封面依真实加载事件或缓存完成状态淡入。宿主只动画处理有限的可见图片；图片动效与行根节点动效分别统计。
- 优先使用 opacity、transform 与独立 translate / scale。仅固定范围的展开组件使用尺寸过渡；没有逐帧 React 时间状态，也不逐帧调整 WebGL 画布尺寸。
- 退出层立即 inert、aria-hidden 并停止点击；菜单、弹窗及面板在退出完成后释放 DOM、事件、RAF 和 WA 句柄。重复开关取消前一批动画，避免动画队列和监听累积。
- 手动沉浸保留导航、歌曲信息和播放控件的同一 DOM 实例；控件沿用 520ms 淡出，舞台与闲置隐藏共用同一中心平移所有者。沉浸立即关闭更多、歌单和快捷槽菜单，释放长按计时器；返回时只恢复一层浮层。
- 减少动态效果与页面隐藏时结束 UI 过渡。焦点仅在没有被新浮层或用户操作接管时恢复。拖动、长按及 Android 返回仍使用原业务语义。
- 最终布局、玻璃质感、主题、接口及 Java 原生音频实现保持原有行为；装饰性持续动画在手机端不再空转。

## 验收状态与待验证项

本机仅进行源码编辑、静态语法和导入路径检查。实际构建、类型检查、自动化触摸、Android 返回、截图及音频连续性都在云端运行，保留正常动画时钟；不 force click、不快进动画，也不放宽原 2 秒唤回期限和音频断言。

新增验收覆盖宿主页面/对话框/更多控件反向、Folia 进入/退出与真实中途反向、手动沉浸的同实例过渡、工具面板上更多菜单的分层返回、视觉页、按压取消、动态 Reduce Motion，以及 96 个真实小 WAV 的长列表分页、搜索、滚动和刷新。报告记录原始全 UI 动画数量、唯一行根节点目标、DOM 身份、退出保护、有效祖先可见性和 rAF 间隔。

待云端结果确认编译、页面与菜单衔接、原有音频回归及新动效断言。软件 GPU 的 rAF 间隔不能等同实际手机 60FPS；物理手机、高刷新率、低性能设备和扬声器听感尚无本轮设备证据。历史 1.0.5 系统隐藏截图与 DOM 不一致的记录保留，不作为本轮视觉验收依据。
