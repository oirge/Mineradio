// src/utils/panelSlideGesture.ts
// 侧边面板切换按钮那个「向左滑打开命令面板」手势的几何常量。
//
// 抽出来只有一个理由：思索教程的场景脚本要照着这几个数演示这条手势，而脚本和实现分居两地。
// 数字留在 UnifiedPanel 里的话，改了手势而教程还在演旧的，不会有任何测试失败 —— 教程会
// 无声地教错。让两边 import 同一份常量，改一处两处一起动。

/** 按住往左拖的夹紧上限，px。超过这个距离按钮不再跟手。 */
export const PANEL_SLIDE_CLAMP_PX = 44;

/** 触发阈值，px。拖够这么远松手（或拖到就直接触发）即打开命令面板。 */
export const PANEL_SLIDE_TRIGGER_PX = 36;

/** 滑轨常态宽度，px。等于按钮自身宽度，看起来就是「按钮本身」。 */
export const PANEL_SLIDE_TRACK_BASE_PX = 48;

/** 滑轨完全展开后的宽度，px。 */
export const PANEL_SLIDE_TRACK_FULL_PX = 96;
