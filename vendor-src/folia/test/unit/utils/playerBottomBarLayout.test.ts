import { describe, expect, it } from 'vitest';
import {
    PLAYER_BOTTOM_BAR_BASE_OFFSET_PX,
    PLAYER_BOTTOM_BAR_SUBTITLE_CLEARANCE_PX,
    clampPlayerBottomBarOffset,
    resolvePlayerBottomBarMaxOffset,
    resolvePlayerBottomComponentBottomPx,
    resolvePlayerSubtitleBottomFromPresence,
} from '../../../src/utils/playerBottomBarLayout';

// test/unit/utils/playerBottomBarLayout.test.ts

describe('resolvePlayerBottomBarMaxOffset', () => {
    it('keeps the expanded capsule below half the viewport', () => {
        // 900 / 2 = 450，减去展开态胶囊的 132
        expect(resolvePlayerBottomBarMaxOffset(900)).toBe(318);
    });

    it('collapses to the base offset on viewports too short to lift anything', () => {
        // 半屏减去胶囊高度已经低于基线，range 退化成一个点
        expect(resolvePlayerBottomBarMaxOffset(200)).toBe(PLAYER_BOTTOM_BAR_BASE_OFFSET_PX);
    });

    it('falls back to the base offset for a missing or nonsense viewport', () => {
        expect(resolvePlayerBottomBarMaxOffset(0)).toBe(PLAYER_BOTTOM_BAR_BASE_OFFSET_PX);
        expect(resolvePlayerBottomBarMaxOffset(Number.NaN)).toBe(PLAYER_BOTTOM_BAR_BASE_OFFSET_PX);
    });
});

describe('clampPlayerBottomBarOffset', () => {
    it('passes an in-range offset through', () => {
        expect(clampPlayerBottomBarOffset(200, 900)).toBe(200);
    });

    it('never goes below the original bottom-8 baseline', () => {
        expect(clampPlayerBottomBarOffset(0, 900)).toBe(PLAYER_BOTTOM_BAR_BASE_OFFSET_PX);
        expect(clampPlayerBottomBarOffset(-500, 900)).toBe(PLAYER_BOTTOM_BAR_BASE_OFFSET_PX);
    });

    it('never lifts the capsule past half the screen', () => {
        expect(clampPlayerBottomBarOffset(10_000, 900)).toBe(318);
    });

    it('pins to the baseline when the viewport leaves no room', () => {
        expect(clampPlayerBottomBarOffset(300, 200)).toBe(PLAYER_BOTTOM_BAR_BASE_OFFSET_PX);
    });

    it('treats non-finite input as the baseline rather than NaN', () => {
        expect(clampPlayerBottomBarOffset(Number.NaN, 900)).toBe(PLAYER_BOTTOM_BAR_BASE_OFFSET_PX);
    });
});

describe('resolvePlayerBottomComponentBottomPx', () => {
    it('preserves each component original bottom at the default baseline', () => {
        expect(resolvePlayerBottomComponentBottomPx(32, 16)).toBe(16);
        expect(resolvePlayerBottomComponentBottomPx(32, 24)).toBe(24);
        expect(resolvePlayerBottomComponentBottomPx(32, 112)).toBe(112);
    });

    it('adds the same lift to bottom components on every page', () => {
        expect(resolvePlayerBottomComponentBottomPx(152, 16)).toBe(136);
        expect(resolvePlayerBottomComponentBottomPx(152, 24)).toBe(144);
        expect(resolvePlayerBottomComponentBottomPx(152, 112)).toBe(232);
    });
});

describe('resolvePlayerSubtitleBottomFromPresence', () => {
    // 拖动改 offset 要跟手，控制条出现/消失改 presence 要走 spring，
    // 所以这两段必须能分开插值。
    it('lands on the lifted clearance and the bare baseline at the two ends', () => {
        // 控制条在场：当前基线之上再留净空；不在场：没有让位对象，落回基线。
        expect(resolvePlayerSubtitleBottomFromPresence(200, 1))
            .toBe(200 + PLAYER_BOTTOM_BAR_SUBTITLE_CLEARANCE_PX);
        expect(resolvePlayerSubtitleBottomFromPresence(200, 0))
            .toBe(PLAYER_BOTTOM_BAR_BASE_OFFSET_PX);
    });

    it('reproduces the original 112 at the baseline with the bar present', () => {
        expect(resolvePlayerSubtitleBottomFromPresence(PLAYER_BOTTOM_BAR_BASE_OFFSET_PX, 1)).toBe(112);
    });

    it('interpolates the whole gap, lift included, midway through the transition', () => {
        // presence 0.5：基线 32 + 一半的 (168 抬高量 + 80 净空)
        expect(resolvePlayerSubtitleBottomFromPresence(200, 0.5)).toBe(32 + 0.5 * (168 + 80));
    });

    it('stays pinned to the baseline while the bar is absent, whatever the offset', () => {
        expect(resolvePlayerSubtitleBottomFromPresence(300, 0)).toBe(PLAYER_BOTTOM_BAR_BASE_OFFSET_PX);
    });
});
