# Mineradio SVG Glass Texture

这是用户明确要求保存的播放器 SVG 玻璃质感基线。后续可以修补偏移、缺角、套用范围和响应式问题，但不要随意重写核心质感。

## User Approval

用户已经确认：当前播放器控制台质感要保存，并计划逐步套用到搜索栏、小按钮、部分面板和 3D 歌单架。

用户不接受：

- 普通毛玻璃，没有扭曲质感。
- 中间糊成一团的毛玻璃。
- 大面积白色渐变扫过去的廉价质感。
- 右侧缺一块、整体右偏、上下错位明显。
- 因套用 SVG 导致性能明显下降。

## Core CSS Variables

位置：`public/index.html` 顶部 `:root`。

```css
:root{
  --saved-panel-glass-bg:rgba(0,0,0,.10);
  --saved-panel-glass-filter:blur(12px) saturate(1.8) brightness(1.16);
  --saved-panel-glass-svg-filter:url(#mineradio-control-glass-filter) saturate(1);
  --saved-panel-glass-shadow:inset 0 0 2px 1px rgba(255,255,255,.35),inset 0 0 10px 4px rgba(255,255,255,.15),0 4px 16px rgba(17,17,26,.05),0 8px 24px rgba(17,17,26,.05),0 16px 56px rgba(17,17,26,.05),inset 0 4px 16px rgba(17,17,26,.05),inset 0 8px 24px rgba(17,17,26,.05),inset 0 16px 56px rgba(17,17,26,.05);
  --saved-panel-glass-radius:50px;
  --saved-button-glass-bg:rgba(0,0,0,.10);
  --saved-button-glass-filter:blur(12px) saturate(1.8) brightness(1.16);
  --saved-button-glass-svg-filter:url(#mineradio-control-glass-filter) saturate(1);
  --saved-button-glass-shadow:inset 0 0 2px 1px rgba(255,255,255,.34),inset 0 0 10px 4px rgba(255,255,255,.13),0 10px 30px rgba(0,0,0,.18);
  --saved-button-glass-hover-bg:rgba(255,255,255,.055);
  --saved-button-glass-hover-shadow:inset 0 0 2px 1px rgba(255,255,255,.42),inset 0 0 12px 5px rgba(255,255,255,.17),0 12px 34px rgba(0,0,0,.22),0 0 18px rgba(255,255,255,.06);
}
```

## Bottom Bar Baseline

位置：`public/index.html` 的 `#bottom-bar`。

```css
#bottom-bar{
  border-radius:50px;
  background:rgba(0,0,0,.10);
  border:0;
  backdrop-filter:blur(12px) saturate(1.8) brightness(1.16);
  -webkit-backdrop-filter:blur(12px) saturate(1.8) brightness(1.16);
  box-shadow:inset 0 0 2px 1px rgba(255,255,255,.35),inset 0 0 10px 4px rgba(255,255,255,.15),0 4px 16px rgba(17,17,26,.05),0 8px 24px rgba(17,17,26,.05),0 16px 56px rgba(17,17,26,.05),inset 0 4px 16px rgba(17,17,26,.05),inset 0 8px 24px rgba(17,17,26,.05),inset 0 16px 56px rgba(17,17,26,.05);
}
html.control-glass-svg-ok #bottom-bar{
  background:rgba(0,0,0,.10);
  backdrop-filter:url(#mineradio-control-glass-filter) saturate(1);
  -webkit-backdrop-filter:url(#mineradio-control-glass-filter) saturate(1);
}
#bottom-bar::before{content:none}
#bottom-bar::after{content:none}
```

## SVG Filter Baseline

位置：`public/index.html` 的 `<svg id="control-glass-svg">`。

关键点：

- `color-interpolation-filters="sRGB"`
- 主 filter：`id="mineradio-control-glass-filter"`
- filter 区域：`x="-12%" y="-28%" width="124%" height="156%"`
- RGB 三通道 displacement scale：Red `180`、Green `170`、Blue `160`
- RGB 偏移：`dx="-90" dy="0"`
- merge 后用 `screen` 混合。
- 最后 `feGaussianBlur stdDeviation="0.5"`。

不要把 RGB 偏移改成正向、不要删三通道色差、不要把 `stdDeviation` 拉大。

## Displacement Map Generator

位置：`public/index.html` 的 `generateControlGlassDisplacementMap(width, height, radius)`。

核心参数：

```js
width = Math.max(240, Math.round(width || 400));
height = Math.max(48, Math.round(height || 92));
radius = Math.max(12, Math.round(radius || 50));
var borderWidth = 0.07;
var edge = Math.min(width, height) * (borderWidth * 0.5);
```

核心 SVG：

```js
'<linearGradient id="glass-red" x1="100%" y1="0%" x2="0%" y2="0%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/></linearGradient>' +
'<linearGradient id="glass-blue" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/></linearGradient>' +
'<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="black"/>' +
'<rect x="0" y="0" width="' + width + '" height="' + height + '" rx="' + radius + '" fill="url(#glass-red)"/>' +
'<rect x="0" y="0" width="' + width + '" height="' + height + '" rx="' + radius + '" fill="url(#glass-blue)" style="mix-blend-mode:difference"/>' +
'<rect x="' + edge.toFixed(2) + '" y="' + edge.toFixed(2) + '" width="' + innerW.toFixed(2) + '" height="' + innerH.toFixed(2) + '" rx="' + radius + '" fill="hsl(0 0% 50% / 1)" style="filter:blur(11px)"/>'
```

## Safe Change Rules

2026-11-25：电脑版设置面板的折射层不能位于内容上方，否则会把文字、开关和分隔线采样成彩色拖影。Folia 的 `localSettingsGlass.css` 使用两个负层级伪元素：`::after`（-2）先采样场景并绘制 9px 折射边缘与高光，`::before`（-1）只负责中心的底色和模糊，正文仍在上方。外壳 `overflow:visible`，标题和内部滚动容器各自裁切圆角，避免外壳提前裁掉 SVG 所需的背景像素；外壳自身的边框、底色和内阴影也不能进入折射输入。宿主 `#fx-panel` 是外壳直接滚动，必须保留它自己的底色与模糊，只把 `settings-glass.css` 的折射层降到内容下方，不能用随内容滚走的伪元素取代整块底色。播放器控制栏的 SVG、色差参数和贴图生成器保持原值。

对应回归为 `python scripts/verify-browser-ui.py --suite settings-glass`：检查真实字幕面板的灰底截图，隐藏文字和控件后边缘像素不变；灰底不能出现彩色接缝；有图案的背景仍须产生仅限边缘的折射差异。另检查主题、窄窗口、原生控件交互和减少透明效果的降级。截图来自隔离 Chromium，不等同于已安装 Electron 或用户显卡的验收。

2026-11-12：贴图尺寸改读元素的 `offsetWidth/offsetHeight`，不能使用带进退动画 scale 的 `getBoundingClientRect()`。底栏用左右 0 与自动外边距居中，进退变换只保留 Y 与 scale，避免居中百分比与玻璃合成相互影响。RGB 折射、偏移与模糊参数保持原值。

- 可以：修复右侧缺块、尺寸缓存、ResizeObserver 更新、特定面板的 SVG map 尺寸。
- 可以：给搜索栏、小按钮等新增独立 filter/map，避免共享同一个大尺寸 map。
- 谨慎：调整 filter 区域、offset、scale。改前截图对比。
- 禁止：整体替换为普通 `blur()` 毛玻璃。
- 禁止：为了性能删除色差或扭曲质感。性能要通过节流、缓存、减少实时重算来做。

## Verification Checklist

在黑底和亮底都看一遍：

- 控制台右侧没有缺块。
- 搜索栏没有右侧缺失、整体右偏或白色廉价渐变。
- 播放器中间不是糊的，仍有水波扭曲和 RGB 色差。
- 鼠标 hover、播放暂停、切歌后没有明显卡顿。
