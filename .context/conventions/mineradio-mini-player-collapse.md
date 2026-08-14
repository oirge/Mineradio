# Mineradio 标准迷你播放器自动收回按钮

## Context

适用于 `public/mini-player.html` 的标准迷你播放器，以及“封面悬停展开”相关交互和测试。

## Fact

- 标准模式完整控制栏右上角的 `×` 用于关闭自动收回，点击后始终显示完整面板。
- 该按钮不关闭迷你播放器，不修改迷你播放器总开关，也不改变极简模式。
- 点击后持久关闭“封面悬停展开”设置；用户可在 DIY 设置中重新开启。
- 返回主界面和桌面歌词按钮必须继续保留。

## Solution / Convention

- `×` 固定调用标准页面内部的 `disableAutomaticCollapse()`，不得改为关闭窗口或禁用迷你播放器。
- 点击后清除延迟折叠计时器、移除按钮焦点、立即切到永久完整态，并发送 `disable-auto-collapse`。
- 主进程只负责校验并转发该命令；主 renderer 通过现有 `toggleMiniPlayerVisual('hoverExpand')` 完成 UI 同步、持久化和状态回推。
- 极简页面 `public/mini-player-compact.html` 不添加该按钮。
- 回归测试必须锁定按钮结构、永久完整模式下的隐藏规则、IPC 持久化、放大与歌词入口，以及极简模式无按钮。

## Reference

- 相关实现：`public/mini-player.html`
- 回归测试：`tests/mini-player-visual.test.js`
