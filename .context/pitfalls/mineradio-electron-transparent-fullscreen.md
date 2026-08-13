# Mineradio Electron 透明窗口全屏

## Context（上下文）

- 适用于 Windows 上的 Mineradio Electron 桌面主窗口。
- 主窗口使用 `frame: false`、`transparent: true`，Electron 版本为 `43.4.0`。
- 涉及 `BrowserWindow.setFullScreen()`、`isFullScreen()`、窗口 `move` 事件和显示器 `bounds` / `workArea`。

## Fact / Pitfall（事实或坑点）

Electron 43.4.0 在 Windows 上处理没有 `WS_THICKFRAME` 的透明无边框窗口时，可以先把窗口边界设为完整的 `display.bounds`，但 `BrowserWindow.isFullScreen()` 仍返回 `false`。

Mineradio v1.4.5 的 `keepMainWindowInsideDisplay()` 只依据 `isFullScreen()` 判断是否跳过普通窗口纠偏。全屏产生的 `move` 事件随后将 `display.bounds` 与较小的 `workArea` 比较，误判窗口过大并调用 `setBounds()`，因此界面状态显示全屏，实际窗口却被缩回普通尺寸。

## Solution / Convention（解决方案或规约）

- 主进程必须维护 `windowFullscreenActive`，在调用 `setFullScreen(true)` 前先设为 `true`。
- 普通窗口边界纠偏必须在以下任一状态成立时直接返回：
  - `win.isFullScreen()`
  - `windowFullscreenActive`
  - `htmlFullscreenActive`
  - `win.isMaximized()`
- 退出窗口全屏时，进入状态必须按 `win.isFullScreen() || windowFullscreenActive` 判断；即使 Electron 返回 `false`，也必须调用 `win.setFullScreen(false)`，再恢复普通窗口边界。
- 主进程处理 `Escape` 时必须识别 `windowFullscreenActive`，但 `htmlFullscreenActive` 为真时不得接管输入；HTML 全屏要交给 Chromium 退出并清理 DOM 全屏状态。
- 回归测试必须同时覆盖：透明窗口逻辑全屏不被缩回、HTML 全屏不被缩回、普通超大窗口仍会纠偏、逻辑全屏可退出、`Escape` 可退出。
- Windows 实机验证必须确认全屏外框等于当前显示器 `display.bounds`，不能只验证渲染层 CSS 或应用状态。

## Reference（溯源）

- Electron BrowserWindow 官方文档：<https://www.electronjs.org/docs/latest/api/browser-window#winsetfullscreenflag>
- Electron 43.4.0 Windows 实现：`electron/electron` 仓库 `shell/browser/native_window_views.cc`，`SetFullScreen()` 附近的无 `WS_THICKFRAME` 分支：<https://github.com/electron/electron/blob/v43.4.0/shell/browser/native_window_views.cc>
