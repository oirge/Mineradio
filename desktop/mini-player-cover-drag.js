'use strict';

const STANDARD_MINI_PLAYER_WIDTH = 360;
const STANDARD_MINI_PLAYER_HEIGHT = 84;
const COLLAPSED_COVER_SIZE = 54;
const WINDOW_BODY_PADDING = 6;
const SHELL_BORDER_WIDTH = 1;
const SHELL_CONTENT_PADDING = 7;
const COVER_RIGHT_COLLAPSED_OFFSET_X = WINDOW_BODY_PADDING + SHELL_BORDER_WIDTH;
const COVER_LEFT_COLLAPSED_OFFSET_X = STANDARD_MINI_PLAYER_WIDTH
  - WINDOW_BODY_PADDING
  - SHELL_BORDER_WIDTH
  - COLLAPSED_COVER_SIZE;
const COVER_RIGHT_EXPANDED_OFFSET_X = COVER_RIGHT_COLLAPSED_OFFSET_X + SHELL_CONTENT_PADDING;
const COVER_LEFT_EXPANDED_OFFSET_X = COVER_LEFT_COLLAPSED_OFFSET_X - SHELL_CONTENT_PADDING;
const COVER_OFFSET_Y = (STANDARD_MINI_PLAYER_HEIGHT - COLLAPSED_COVER_SIZE) / 2;

/**
 * 校验内部拖动几何使用的有限数值，非法状态直接暴露给调用方。
 * @param {unknown} value 待校验的值。
 * @param {string} name 错误信息中的字段名。
 * @returns {number} 已确认的有限数值。
 */
function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} 必须是有限数值`);
  }
  return value;
}

/**
 * 校验拖动几何使用的点坐标。
 * @param {unknown} value 待校验的坐标对象。
 * @param {string} name 错误信息中的字段名。
 * @returns {{x:number,y:number}} 已确认的坐标。
 */
function finitePoint(value, name) {
  if (!value || typeof value !== 'object') throw new TypeError(`${name} 必须是坐标对象`);
  return {
    x: finiteNumber(value.x, `${name}.x`),
    y: finiteNumber(value.y, `${name}.y`),
  };
}

/**
 * 校验窗口或工作区矩形。
 * @param {unknown} value 待校验的矩形对象。
 * @param {string} name 错误信息中的字段名。
 * @returns {{x:number,y:number,width:number,height:number}} 已确认的矩形。
 */
function finiteRect(value, name) {
  const point = finitePoint(value, name);
  return {
    ...point,
    width: finiteNumber(value.width, `${name}.width`),
    height: finiteNumber(value.height, `${name}.height`),
  };
}

/**
 * 校验标准迷你播放器的展开方向。
 * @param {unknown} value 待校验的方向。
 * @returns {'left'|'right'} 已确认的方向。
 */
function normalizeDirection(value) {
  if (value !== 'left' && value !== 'right') throw new RangeError('direction 必须是 left 或 right');
  return value;
}

/**
 * 校验 pointerdown 时页面采用的标准迷你播放器布局。
 * @param {unknown} value 页面布局标记。
 * @returns {'collapsed'|'expanded'} 已确认的布局标记。
 */
function normalizeCoverLayout(value) {
  if (value === undefined || value === null || value === '') return 'collapsed';
  if (value !== 'collapsed' && value !== 'expanded') {
    throw new RangeError('layout 必须是 collapsed 或 expanded');
  }
  return value;
}

/**
 * 在 renderer 只提供真实锚点时推断收回或展开布局，避免把展开态误当成收回态。
 * @param {{x:number,y:number,width:number,height:number}} bounds 当前窗口边界。
 * @param {'left'|'right'} direction 当前展开方向。
 * @param {{x:number,y:number}} anchor renderer 测得的封面屏幕左上角。
 * @returns {'collapsed'|'expanded'} 与实测水平偏移更接近的布局。
 */
function inferCoverLayout(bounds, direction, anchor) {
  const actualOffset = finiteNumber(anchor.x, 'anchor.x') - finiteNumber(bounds.x, 'bounds.x');
  const collapsedDistance = Math.abs(actualOffset - coverOffsetX(direction, 'collapsed'));
  const expandedDistance = Math.abs(actualOffset - coverOffsetX(direction, 'expanded'));
  return expandedDistance < collapsedDistance ? 'expanded' : 'collapsed';
}

/**
 * 返回指定布局下封面相对窗口左边缘的水平偏移。
 * @param {'left'|'right'} direction 完整面板相对封面的展开方向。
 * @param {'collapsed'|'expanded'} layout pointerdown 时页面的布局状态。
 * @returns {number} 封面左边缘相对窗口左边缘的距离。
 */
function coverOffsetX(direction, layout = 'collapsed') {
  const normalizedDirection = normalizeDirection(direction);
  const normalizedLayout = normalizeCoverLayout(layout);
  if (normalizedLayout === 'expanded') {
    return normalizedDirection === 'left'
      ? COVER_LEFT_EXPANDED_OFFSET_X
      : COVER_RIGHT_EXPANDED_OFFSET_X;
  }
  return normalizedDirection === 'left'
    ? COVER_LEFT_COLLAPSED_OFFSET_X
    : COVER_RIGHT_COLLAPSED_OFFSET_X;
}

/**
 * 计算收回态封面在屏幕上的逻辑边界，不包含律动缩放产生的视觉外扩。
 * @param {{x:number,y:number,width:number,height:number}} bounds 标准迷你播放器窗口边界。
 * @param {'left'|'right'} direction 当前展开方向。
 * @returns {{x:number,y:number,width:number,height:number}} 封面的屏幕逻辑边界。
 */
function miniPlayerCoverBounds(bounds, direction, layout = 'collapsed') {
  const windowBounds = finiteRect(bounds, 'bounds');
  return {
    x: windowBounds.x + coverOffsetX(direction, layout),
    y: windowBounds.y + COVER_OFFSET_Y,
    width: COLLAPSED_COVER_SIZE,
    height: COLLAPSED_COVER_SIZE,
  };
}

/**
 * 开始封面拖动并记录未夹紧的逻辑封面坐标。后续每个增量都累加到这份坐标，
 * 即使窗口暂时卡在旧屏边缘，也不会丢掉跨屏前已经产生的位移。
 * @param {{bounds:object,direction:'left'|'right',anchor?:{x:number,y:number},layout?:'collapsed'|'expanded'}} input
 *   拖动起始数据；anchor 是 renderer 测得的未变形封面屏幕左上角。
 * @returns {{coverX:number,coverY:number,direction:'left'|'right',layout:'collapsed'|'expanded'}} 可跨事件复用的拖动会话。
 */
function beginMiniPlayerCoverDrag(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input 必须是拖动数据对象');
  const direction = normalizeDirection(input.direction);
  const bounds = finiteRect(input.bounds, 'bounds');
  const anchor = input.anchor === undefined || input.anchor === null
    ? null
    : finitePoint(input.anchor, 'anchor');
  const layout = input.layout === undefined || input.layout === null
    ? (anchor ? inferCoverLayout(bounds, direction, anchor) : 'collapsed')
    : normalizeCoverLayout(input.layout);
  const cover = anchor || miniPlayerCoverBounds(bounds, direction, layout);
  return {
    coverX: cover.x,
    coverY: cover.y,
    direction,
    layout,
  };
}

/**
 * 按封面在目标工作区左右两侧的剩余空间选择展开方向。
 * @param {{x:number,y:number,width:number,height:number}} cover 期望封面边界。
 * @param {{x:number,y:number,width:number,height:number}} workArea 指针所在显示器工作区。
 * @returns {'left'|'right'} 能让完整面板朝更宽一侧展开的方向。
 */
function directionForCover(cover, workArea) {
  const leftSpace = cover.x - workArea.x;
  const rightSpace = workArea.x + workArea.width - (cover.x + cover.width);
  return rightSpace < leftSpace ? 'left' : 'right';
}

/**
 * 将固定尺寸的标准迷你播放器夹在明确的目标工作区内。
 * @param {{x:number,y:number,width:number,height:number}} bounds 原始窗口边界。
 * @param {{x:number,y:number,width:number,height:number}} workArea 目标显示器工作区。
 * @returns {{x:number,y:number,width:number,height:number}} 工作区内的固定尺寸边界。
 */
function clampStandardBounds(bounds, workArea) {
  const maxX = Math.max(workArea.x, workArea.x + workArea.width - STANDARD_MINI_PLAYER_WIDTH);
  const maxY = Math.max(workArea.y, workArea.y + workArea.height - STANDARD_MINI_PLAYER_HEIGHT);
  return {
    x: Math.round(Math.max(workArea.x, Math.min(bounds.x, maxX))),
    y: Math.round(Math.max(workArea.y, Math.min(bounds.y, maxY))),
    width: STANDARD_MINI_PLAYER_WIDTH,
    height: STANDARD_MINI_PLAYER_HEIGHT,
  };
}

/**
 * 累加 renderer 按屏幕坐标算出的真实位移。窗口到达旧屏边缘后仍保留未夹紧坐标，
 * 指针进入相邻屏时直接改用新工作区；展开方向翻转只补偿透明窗体位置，封面本身不会横跳。
 * @param {{coverX:number,coverY:number,direction:'left'|'right',layout?:'collapsed'|'expanded'}} session 当前拖动会话。
 * @param {number} dx 本次水平位移。
 * @param {number} dy 本次垂直位移。
 * @param {{x:number,y:number,width:number,height:number}} workArea 指针所在显示器工作区，用于决定展开方向。
 * @param {{x:number,y:number,width:number,height:number}=} clampWorkArea 拖动时允许跨显示器的虚拟工作区。
 * @returns {{bounds:{x:number,y:number,width:number,height:number},direction:'left'|'right'}} 新窗口边界与展开方向。
 */
function updateMiniPlayerCoverDrag(session, dx, dy, workArea, clampWorkArea = workArea) {
  if (!session || typeof session !== 'object') throw new TypeError('session 必须是拖动会话');
  const area = finiteRect(workArea, 'workArea');
  const clampArea = finiteRect(clampWorkArea, 'clampWorkArea');
  const layout = normalizeCoverLayout(session.layout);
  session.coverX = finiteNumber(session.coverX, 'session.coverX') + finiteNumber(dx, 'dx');
  session.coverY = finiteNumber(session.coverY, 'session.coverY') + finiteNumber(dy, 'dy');
  const desiredCover = {
    x: session.coverX,
    y: session.coverY,
    width: COLLAPSED_COVER_SIZE,
    height: COLLAPSED_COVER_SIZE,
  };
  const direction = directionForCover(desiredCover, area);
  const bounds = clampStandardBounds({
    x: desiredCover.x - coverOffsetX(direction, layout),
    y: desiredCover.y - COVER_OFFSET_Y,
    width: STANDARD_MINI_PLAYER_WIDTH,
    height: STANDARD_MINI_PLAYER_HEIGHT,
  }, clampArea);
  session.direction = direction;
  return { bounds, direction };
}

module.exports = {
  beginMiniPlayerCoverDrag,
  miniPlayerCoverBounds,
  updateMiniPlayerCoverDrag,
};
