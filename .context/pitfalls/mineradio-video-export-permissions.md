# 视频导出 Permission denied

## 2026-11-04：2.6.7 的实际故障

用户安装发布版后，开始歌词／可视化视频导出提示 Permission denied。正式应用调用 `wallpaperEngineBridge.configureSessionPermissions()`，它为默认 session 同时安装 check／request 处理器；原实现只认识 WE capture grant。独立视频验收没有安装它，Electron 默认允许，造成测试通过而正式版拒绝。

仅在验收脚本加入真实处理器的提交 `1ef5e2a2cc417202383899b6c483cd6d2ab1cf58`，Windows run `41770428840` 已复现相同报错。权限记录中普通 media audio 检查被拒绝，实际 tab 请求为 `media`、`mediaTypes: []`，requestingUrl 指向当前 videoExport UUID 的隐藏窗口。

## 必须保留的限制

- Electron 43 的 tab 捕获请求和摄像头请求都叫 media，空 mediaTypes 才是该 tab 路径；摄像头 video、麦克风 audio 仍拒绝。不同版本可能使用 display-capture，只允许纯视频。
- Chromium 可能将权限请求归属到被采集窗口而非消费音轨的主窗口。两者必须属于同一个当前导出，分别验证真实 WebContents／主 frame／精确 URL；不能只比同源或 URL 的 videoExport 参数。
- 导出管理器是授权所有者；只在生成宿主绑定 tab token 后保留最多 10 秒，首编码块后撤销。取消、完成、窗口销毁或宿主替换后立即失效。
- 使用现有共用处理器委托给导出管理器。禁止全局 callback(true)、关闭 webSecurity、移除 WE 权限检查，或要求用户以管理员身份运行。
- getDisplayMedia 的桌面源处理保持已有 WE grant 限制；视频导出只使用 getMediaSourceId 的 owner 绑定 token，没有桌面／麦克风音轨。

## 验证

`tests/video-export.test.js` 通过完整共用处理器调用管理器，覆盖空 grant 拒绝、当前 owner／surface 允许、摄像头／麦克风／子 frame／其他 URL 与窗口拒绝、10 秒过期与首块／取消／完成撤销。实际媒体脚本必须安装正式权限处理器，再导出并独立解码；不可回退为无权限处理器的默认 session。云端工作流同时跟踪 main 和 WE 权限处理器的改动。本机仍禁止 GUI、安装或操作用户播放器与数据。

修复提交 `2216ec5408d11a0025198f232eb4bc66964767d5` 的 Windows `41771113928` attempt 2 全部通过实际媒体／独立解码；attempt 1 与合并后的 `41772204398` 均已通过权限及横屏，但软件 GPU 竖屏末帧差 `1.361s`／`1.446s` 超过原 `1.25s` 门禁，不宣称所有媒体 CI 全绿或稳定 30 fps。通过重试未改代码／断言／画质／超时。

重试会生成同名 artifact，`gh run download --name video-export-evidence` 曾取到 attempt 1。按创建时间选择正确 ID，不能按 ID 数值大小或第一个同名结果判断。成功 artifact 为 `13294723075`，创建于 `2026-11-04T04:12:14Z`；本地 `verification/video-export-permissions/final-attempt2/` 保留 ZIP、API 和 report。正式发布为 v2.6.8，PR #170 合入 `802fbd55`，构建 `41772216206`，Release `433508708` 于北京时间 `2026-11-04 12:21:10` 公开，四资产与公开更新清单核验通过。完整事实见 RELEASE.md 顶部。

参考：Electron 43.7.9 的 [媒体请求实现](https://github.com/electron/electron/blob/v43.7.9/shell/browser/web_contents_permission_helper.cc) 与 [权限归属实现](https://github.com/electron/electron/blob/v43.7.9/shell/browser/electron_permission_manager.cc)。
