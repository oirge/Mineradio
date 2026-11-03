# Mineradio 辅助窗口任务栏预览

## Context（上下文）

- Windows Electron 43.7.9；`desktop/main.js` 的桌面歌词和标准／极简迷你播放器。
- 用户截图中任务栏预览出现 `Mineradio Compact Mini Player` 与 `Mineradio Desktop Lyrics`。

## Fact / Pitfall（事实或坑点）

- 现有构造已有 `skipTaskbar: true`。Electron 43.7.9 在 Windows 通过 `ITaskbarList::DeleteTab` 实现该设置，没有据此添加 `WS_EX_TOOLWINDOW`；Shell 重新枚举窗口时仍可能纳入辅助窗口。
- 用户安装实例的只读样式核验显示两个辅助窗口没有 `WS_EX_TOOLWINDOW`。不要修改其数据或操作该实例来测试。

## Solution / Convention（解决方案或规约）

- 两个辅助窗口构造保留 `skipTaskbar: true`，增加 `type: 'toolbar'`，在构造期写入原生 `WS_EX_TOOLWINDOW`。
- 桌面歌词继续 `focusable: false`，迷你播放器继续 `focusable: true`。保留置顶、鼠标穿透、窗口恢复和单一音频所有权。
- 不通过设置主窗口 `parent` 修复，避免主窗口最小化连带隐藏辅助窗口；不增加定时任务栏轮询。
- 用户明确「不要影响我使用电脑」。后续只做低优先级后台检查和云端构建，不在本机启动图形测试、切换窗口或抢占焦点，不自行安装新版。

## Verification（验证边界）

- 用户提出后台工作约束前，隔离 Electron 43.7.9 加载真实修改后的主进程：极简迷你窗口 exStyle `00000088`、桌面歌词 `080800A8`，均含 `WS_EX_TOOLWINDOW`；主窗口没有该标记。隔离测试进程已关闭。
- 既有桌面歌词与迷你播放器行为回归 `72/72` 通过。
- 未完成人工任务栏鼠标预览、Alt+Tab、拖动、隐藏／重显／重载交互验收；不能将原生样式与模拟行为测试等同于完整桌面实测。
- 本地证据位于忽略目录 `verification/aux-taskbar/`，不提交测试 profile、二进制或外部 Electron 源码。

## Reference（溯源）

- 2026-11-03 用户截图、修复要求与后台工作约束。
- [Electron 43.7.9 原生窗口实现](https://github.com/electron/electron/blob/v43.7.9/shell/browser/native_window_views.cc)。
- [Electron BaseWindow 窗口类型](https://www.electronjs.org/docs/latest/api/base-window)。
- [Microsoft 扩展窗口样式](https://learn.microsoft.com/en-us/windows/win32/winmsg/extended-window-styles)：工具窗口不进入任务栏与 Alt+Tab。
