'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  beginMiniPlayerCoverDrag,
  miniPlayerCoverBounds,
  updateMiniPlayerCoverDrag,
} = require('../desktop/mini-player-cover-drag');

const PRIMARY_WORK_AREA = Object.freeze({ x: 0, y: 0, width: 1920, height: 1080 });
const SECONDARY_WORK_AREA = Object.freeze({ x: 1920, y: 0, width: 1920, height: 1080 });
const VIRTUAL_WORK_AREA = Object.freeze({ x: 0, y: 0, width: 3840, height: 1080 });

/**
 * 验证首个拖动事件用增量还原按下位置，不会吞掉超过点击阈值后的第一段位移。
 * @returns {void}
 */
function testFirstDragDeltaIsPreserved() {
  const initialBounds = { x: 680, y: 240, width: 360, height: 84 };
  const session = beginMiniPlayerCoverDrag({
    bounds: initialBounds,
    direction: 'right',
  });

  const result = updateMiniPlayerCoverDrag(session, 12, -8, PRIMARY_WORK_AREA);

  assert.deepEqual(result.bounds, { x: 692, y: 232, width: 360, height: 84 });
  assert.equal(result.direction, 'right');
}

/**
 * 验证方向跨过屏幕中线时只移动透明窗体，封面继续跟随同一个鼠标锚点。
 * @returns {void}
 */
function testDirectionFlipKeepsCoverUnderCursor() {
  const initialBounds = { x: 700, y: 240, width: 360, height: 84 };
  const initialCover = miniPlayerCoverBounds(initialBounds, 'right');
  const session = beginMiniPlayerCoverDrag({
    bounds: initialBounds,
    direction: 'right',
  });

  const before = updateMiniPlayerCoverDrag(session, 933 - initialCover.x, 0, PRIMARY_WORK_AREA);
  const beforeCover = miniPlayerCoverBounds(before.bounds, before.direction);
  const after = updateMiniPlayerCoverDrag(session, 1, 0, PRIMARY_WORK_AREA);
  const afterCover = miniPlayerCoverBounds(after.bounds, after.direction);

  assert.equal(before.direction, 'right');
  assert.equal(after.direction, 'left');
  assert.equal(afterCover.x - beforeCover.x, 1);
  assert.equal(afterCover.y, beforeCover.y);
  assert.ok(Math.abs(after.bounds.x - before.bounds.x) > 250, '透明窗体应补偿封面换边距离');
}

/**
 * 验证指针进入相邻显示器后改用目标工作区，避免当前显示器夹紧吞掉每次小增量。
 * @returns {void}
 */
function testCoverDragCrossesAdjacentDisplays() {
  const initialBounds = { x: 1560, y: 240, width: 360, height: 84 };
  const initialCover = miniPlayerCoverBounds(initialBounds, 'left');
  const session = beginMiniPlayerCoverDrag({
    bounds: initialBounds,
    direction: 'left',
  });

  const first = updateMiniPlayerCoverDrag(session, 24, 0, PRIMARY_WORK_AREA, VIRTUAL_WORK_AREA);
  const firstCover = miniPlayerCoverBounds(first.bounds, first.direction);
  assert.equal(firstCover.x, initialCover.x + 24);
  assert.equal(first.bounds.x, initialBounds.x + 24);

  const crossed = updateMiniPlayerCoverDrag(session, 18, 0, SECONDARY_WORK_AREA, VIRTUAL_WORK_AREA);
  const crossedCover = miniPlayerCoverBounds(crossed.bounds, crossed.direction);
  assert.equal(crossed.direction, 'right');
  assert.equal(crossedCover.x, firstCover.x + 18);
  assert.equal(crossed.bounds.x, 1894);

  const continued = updateMiniPlayerCoverDrag(session, 172, 0, SECONDARY_WORK_AREA, VIRTUAL_WORK_AREA);
  const continuedCover = miniPlayerCoverBounds(continued.bounds, continued.direction);
  assert.equal(continuedCover.x, 2073);
  assert.equal(continued.bounds.x, 2066);
}

/**
 * 验证展开态 renderer 的实测锚点不会被固定收回态偏移覆盖，方向翻转时封面仍连续。
 * @returns {void}
 */
function testExpandedAnchorKeepsCoverContinuous() {
  const initialBounds = { x: 680, y: 240, width: 360, height: 84 };
  const session = beginMiniPlayerCoverDrag({
    bounds: initialBounds,
    direction: 'right',
    anchor: { x: 694, y: 255 },
    layout: 'expanded',
  });
  const moved = updateMiniPlayerCoverDrag(session, 12, 6, PRIMARY_WORK_AREA);
  const movedCover = miniPlayerCoverBounds(moved.bounds, moved.direction, 'expanded');

  assert.deepEqual(moved.bounds, { x: 692, y: 246, width: 360, height: 84 });
  assert.deepEqual(movedCover, { x: 706, y: 261, width: 54, height: 54 });

  const edgeSession = beginMiniPlayerCoverDrag({
    bounds: { x: 1560, y: 240, width: 360, height: 84 },
    direction: 'left',
    anchor: { x: 1852, y: 255 },
    layout: 'expanded',
  });
  const flipped = updateMiniPlayerCoverDrag(
    edgeSession,
    40,
    0,
    SECONDARY_WORK_AREA,
    VIRTUAL_WORK_AREA,
  );
  const flippedCover = miniPlayerCoverBounds(flipped.bounds, flipped.direction, 'expanded');
  assert.equal(flipped.direction, 'right');
  assert.equal(flippedCover.x, 1892);
}

/**
 * 验证封面锚点、布局和方向字段非法时立即抛出，避免主进程沿错误坐标继续拖动。
 * @returns {void}
 */
function testCoverDragAnchorValidation() {
  const bounds = { x: 0, y: 0, width: 360, height: 84 };
  assert.throws(
    () => beginMiniPlayerCoverDrag({ bounds, direction: 'right', anchor: { x: NaN, y: 10 } }),
    /anchor\.x 必须是有限数值/,
  );
  assert.throws(
    () => beginMiniPlayerCoverDrag({ bounds, direction: 'right', layout: 'moving' }),
    /layout 必须是 collapsed 或 expanded/,
  );
}

test('封面拖动保留首个有效增量', testFirstDragDeltaIsPreserved);
test('封面换边时保持鼠标锚点连续', testDirectionFlipKeepsCoverUnderCursor);
test('封面可以跨越相邻显示器', testCoverDragCrossesAdjacentDisplays);
test('展开态实测锚点保持封面连续', testExpandedAnchorKeepsCoverContinuous);
test('封面拖动元数据严格校验', testCoverDragAnchorValidation);
