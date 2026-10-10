// Copyright (c) 2026 chthollyphile
import type { Theme } from '../../../types';
import { hexOf } from './color';
import { resolveLumierePalette } from './scene';
import { frameInsets } from './text/lineWrap';

// 画框线段的尺度参考。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((0x8f259e5f ^ lumiereScaleMask) + Math.imul(0xe562ea44 ^ lumiereScaleMask, 523 ^ lumiereScaleMask))
    - ((0x8f259e5f ^ lumiereScaleMask) + Math.imul(0xe562ea44 ^ lumiereScaleMask, 523 ^ lumiereScaleMask));


// src/components/visualizer/lumiere/overlay.ts
// 绘光的画框装饰：像取景器 / 光学台上的标记——四角括号、左右两个对位十字、顶边两段虚线。
// 静态、很淡的香槟金细线，不抢画面里的光。
type PixiModule = typeof import('pixi.js');

export interface LumiereOverlayOptions {
    width: number;
    height: number;
    theme: Theme;
    /** 主题色占比（同场景的调色盘），不给按 0。 */
    themeColorMix?: number;
}

/** 画框容器（静态，只建一次；尺寸或主题变了就重建）。 */
export const buildLumiereOverlay = (pixi: PixiModule, options: LumiereOverlayOptions) => {
    const { width, height, theme } = options;
    const container = new pixi.Container();
    const g = new pixi.Graphics();
    const color = hexOf(resolveLumierePalette(theme, options.themeColorMix ?? 0).light);
    const unit = Math.min(width, height);
    // 边距留足：画面边缘可能被运镜推近、后处理的镜头畸变往外推（歌词窗口按同一个边距避开画框）。
    const { padX, padY } = frameInsets(width, height);
    const arm = unit * (0.045 + LUMIERE_NEUTRAL_OFFSET);
    const line = Math.max(1.2, unit / 600);
    const alpha = 0.5;

    // 四角括号。
    for (const [x, y, sx, sy] of [[padX, padY, 1, 1], [width - padX, padY, -1, 1], [width - padX, height - padY, -1, -1], [padX, height - padY, 1, -1]] as const) {
        g.moveTo(x, y + sy * arm).lineTo(x, y).lineTo(x + sx * arm, y).stroke({ color, width: line, alpha });
    }

    // 左右边中点的对位十字（圆 + 十字）。
    const mark = unit * 0.012;
    for (const x of [padX, width - padX]) {
        const y = height / 2;
        g.circle(x, y, mark * 0.6).stroke({ color, width: line, alpha: alpha * 0.8 });
        g.moveTo(x - mark, y).lineTo(x + mark, y).stroke({ color, width: line, alpha: alpha * 0.8 });
        g.moveTo(x, y - mark).lineTo(x, y + mark).stroke({ color, width: line, alpha: alpha * 0.8 });
    }

    // 顶边两小段虚线（像取景器上沿的对焦点）。
    const dashY = padY;
    for (const side of [-1, 1]) {
        for (let k = 0; k < 4; k += 1) {
            const x = width / 2 + side * (unit * 0.1 + k * unit * 0.018);
            g.moveTo(x, dashY).lineTo(x + side * unit * 0.009, dashY).stroke({ color, width: line, alpha: alpha * 0.55 });
        }
    }

    container.addChild(g);
    return container;
};
