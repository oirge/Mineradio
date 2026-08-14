# Mineradio 标准迷你播放器自动收回设置

## Context

适用于 `public/mini-player.html` 的标准迷你播放器，以及“封面悬停展开”相关交互和测试。

## Fact

- 标准迷你播放器本体不显示 `×`，避免点击一次后因状态切换而消失。
- 四角“返回主界面”按钮恢复为标准播放器右上角的独立按钮，不再被第二个操作按钮挤到底部。
- `× 自动收回` 作为永久可见的双向开关放在主界面 DIY 顶部独立“迷你”页的“迷你播放器样式”区域，不再埋在“动态 / 叠加效果”里。
- 开启时默认显示封面，鼠标悬停或键盘聚焦后展开并在离开后自动收回；关闭时始终显示完整面板。
- 该设置不关闭迷你播放器，不修改迷你播放器总开关，也不改变极简模式。

## Solution / Convention

- 标准页面只保留 `restore`、桌面歌词和播放控制，不创建 `collapse` 节点，也不发送 `disable-auto-collapse`。
- `restore` 使用 v1.4.5 的直接子节点布局：`24 × 24`、`align-self:flex-start`、`margin:-1px -1px 0 0`。
- 主界面设置区通过 `toggleMiniPlayerVisual('hoverExpand')` 完成双向切换、持久化和状态回推；控件无论开关状态都保持可见，入口固定为 `DIY -> 迷你`。
- 主进程迷你播放器命令白名单不包含 `disable-auto-collapse`。
- 极简页面 `public/mini-player-compact.html` 不添加该按钮。
- 回归测试必须锁定四角按钮原位、标准页面无 `collapse`、设置区 `× 自动收回` 常驻、双向持久化、桌面歌词入口，以及极简模式无按钮。

## Reference

- 相关实现：`public/mini-player.html`
- 回归测试：`tests/mini-player-visual.test.js`
