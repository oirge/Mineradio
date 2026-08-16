# Mineradio 标准迷你播放器自动收回设置

## Context

适用于 `public/mini-player.html` 的标准迷你播放器，以及“封面悬停展开”相关交互和测试。

## Fact

- 标准迷你播放器本体不显示 `×`，避免点击一次后因状态切换而消失。
- 四角“返回主界面”按钮恢复为标准播放器右上角的独立按钮，不再被第二个操作按钮挤到底部。
- `× 自动收回` 作为永久可见的双向开关放在主界面 DIY 顶部独立“迷你”页的“迷你播放器样式”区域，不再埋在“动态 / 叠加效果”里。
- 开启时默认显示封面，鼠标悬停或键盘聚焦后展开并在离开后自动收回；关闭时始终显示完整面板。
- 封面同时承担短按展开和拖动窗口：小于 `5px` 的位移仍按点击处理，超过阈值后只移动窗口，不误触发展开命令。
- 标准窗口靠近当前显示器右侧时，封面停在窗口右端，完整控制栏通过 `row-reverse` 向左展开；靠近左侧时保持向右展开。
- 收回态窗口保持 `360 × 84`，但空白区域必须把鼠标事件交还桌面：只有封面热区参与命中，点击收回后的旧面板位置不能被迷你窗口吞掉。
- 桌面歌词开关随展开方向镜像：向左展开时移动到左下角，与返回按钮的镜像方式保持一致。
- 桌面歌词开关是 `position:absolute`，包含块必须始终是 `.mini-shell`；它一旦落在 `.transport` 内部，收回态那份 `transform` 会让 `.transport` 变成包含块，悬浮展开/收回的 240ms 过渡里按钮会被拽到面板中央压住播放按钮，并被 `.transport` 的 `overflow:hidden` 裁切。
- 该设置不关闭迷你播放器，不修改迷你播放器总开关，也不改变极简模式。

## Solution / Convention

- 标准页面只保留 `restore`、桌面歌词和播放控制，不创建 `collapse` 节点，也不发送 `disable-auto-collapse`。
- `restore` 使用 v1.4.5 的直接子节点布局：`24 × 24`、`align-self:flex-start`；向右展开时保持 `margin:-1px -1px 0 0`，向左展开时镜像为 `margin:-1px 0 0 -1px`。
- 主界面设置区通过 `toggleMiniPlayerVisual('hoverExpand')` 完成双向切换、持久化和状态回推；控件无论开关状态都保持可见，入口固定为 `DIY -> 迷你`。
- 主进程迷你播放器命令白名单不包含 `disable-auto-collapse`。
- 封面拖动通过 `mineradio-mini-player-move-by` 发送增量位移；主进程只接受当前迷你窗口 sender，按工作区夹紧、更新内存坐标并同步新的 `expandDirection`，只在拖动结束 `commit` 时落盘一次。
- 展开方向由主进程比较窗口到当前显示器左右工作区边缘的空间决定；标准 BrowserWindow 继续固定为 `360 × 84`，不通过频繁缩放窗口实现收回动画。
- 收回态穿透只能用 `setIgnoreMouseEvents(true, { forward: true })` 实现，CSS `pointer-events` 管不住窗口命中；穿透期间 renderer 靠转发的 `mousemove` 与 `coverWrap` 矩形（外扩 `6px`）判断指针是否回到封面热区，回到热区立刻通过 `mineradio-mini-player-set-pointer-passthrough` 收回鼠标事件并展开。
- 穿透通道只接受当前迷你窗口 sender，重复上报去重；封面拖动期间和关闭悬停展开时必须强制保持窗口交互，窗口创建 / 销毁 / 关闭都要重置主进程穿透缓存。
- 桌面歌词开关向左展开时用 `left: 5px; right: auto;` 镜像到左下角。
- 桌面歌词按钮在 DOM 上必须是 `.mini-shell` 的直属子节点（排在 `.transport` 之后保持 Tab 顺序），收回态另用 `.mini-shell[data-collapsed="true"] .desktop-lyrics-toggle { opacity:0; pointer-events:none; }` 单独淡出，不再借 `.transport` 的 `opacity` 隐藏。
- 收回态位移动画随展开方向镜像：向右展开用 `translateX(10px)`，向左展开用 `translateX(-10px)`，保证面板始终朝远离封面的一侧滑出。
- 极简页面 `public/mini-player-compact.html` 不添加该按钮。
- 回归测试必须锁定四角按钮原位、标准页面无 `collapse`、设置区 `× 自动收回` 常驻、双向持久化、封面拖动/短按分流、右侧向左展开、桌面歌词入口与左下角镜像、桌面歌词按钮不在 `.transport` 内、收回态鼠标穿透与热区恢复，以及极简模式无按钮。

## Reference

- 相关实现：`public/mini-player.html`
- 回归测试：`tests/mini-player-visual.test.js`、`tests/mini-player-main-gates.test.js`
