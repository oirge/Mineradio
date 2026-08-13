# Mineradio 标准迷你播放器收起按钮

## Context

适用于 `public/mini-player.html` 的标准迷你播放器，以及“封面悬停展开”相关交互和测试。

## Fact

- 标准模式完整控制栏右上角的 `×` 是收起按钮，只把悬停或键盘聚焦展开的控制栏折叠回圆角封面。
- 该按钮不关闭迷你播放器，不修改迷你播放器总开关，也不改变极简模式。
- 用户关闭“封面悬停展开”后，标准模式始终显示完整面板，此时不显示收起按钮。

## Solution / Convention

- 收起按钮固定调用标准页面内部的 `collapseExpandedControls()`，不得改为发送关闭窗口命令。
- 点击后清除延迟折叠计时器、移除按钮焦点，并立即调用 `setExpanded(false)`。
- 极简页面 `public/mini-player-compact.html` 不添加该按钮。
- 回归测试必须锁定按钮结构、永久完整模式下的隐藏规则、点击折叠行为和极简模式无按钮。

## Reference

- 相关实现：`public/mini-player.html`
- 回归测试：`tests/mini-player-visual.test.js`
