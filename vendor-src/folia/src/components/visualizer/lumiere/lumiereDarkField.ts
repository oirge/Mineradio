// Copyright (c) 2026 chthollyphile
import type { Container, Sprite } from 'pixi.js';
import type { Theme } from '../../../types';
import { hexOf, luminance, rgbOf, scaleRgb, type Rgb } from './color';

// src/components/visualizer/lumiere/lumiereDarkField.ts
// 暗场底：光后面铺一整块主题背景色压暗的底，压住 folia 的共享背景层，光束才像打在烟里的光。
// 它由运行时画在所有段落场景（和片尾卡）之下，不随段落转场的透明度 / 模糊 / 缩放变化——
// 放在场景里时，出场帧的透明度、边界后的交叉渐变（两层各半透明，叠起来盖不满）和片尾交接都会让背景透出来闪一下。
// 光场着色器仍保留 uDark 通路，folia 里恒传 0。
type PixiModule = typeof import('pixi.js');

/** 主题背景亮度超过它就算浅色主题。 */
const BRIGHT_BACKGROUND_LUMINANCE = 0.18;
/** 浅色主题的暗场保底（lumisynth 定的「绘光始终在暗场里」）：亮背景透出来光就不成立了。 */
export const LUMIERE_BRIGHT_DARK_FIELD_FLOOR = 0.94;
/** 暗场颜色 = 主题背景色 × 这个系数。 */
const DARK_FIELD_SHADE = 0.06;

export interface LumiereDarkField {
    color: Rgb;
    alpha: number;
}

/** 生效的暗场：深色主题 alpha = darkField；浅色主题取 max(darkField, 0.94)。颜色是主题背景色压暗。 */
export const resolveLumiereDarkField = (theme: Pick<Theme, 'backgroundColor'>, darkField: number): LumiereDarkField => {
    const background = rgbOf(theme.backgroundColor, [0, 0, 0]);
    const strength = Number.isFinite(darkField) ? Math.min(1, Math.max(0, darkField)) : 0;
    const bright = luminance(background) > BRIGHT_BACKGROUND_LUMINANCE;
    return {
        color: scaleRgb(background, DARK_FIELD_SHADE),
        alpha: bright ? Math.max(strength, LUMIERE_BRIGHT_DARK_FIELD_FLOOR) : strength,
    };
};

/** 运行时的暗场层：一块整屏的纯色 sprite，每帧按当前主题、尺寸和 tuning 现算（只在变化时写属性）。 */
export class LumiereDarkFieldLayer {
    readonly view: Container;
    private readonly sprite: Sprite;
    private theme: Theme | null = null;
    private darkField = Number.NaN;
    private width = 0;
    private height = 0;

    constructor(pixi: PixiModule) {
        this.sprite = new pixi.Sprite(pixi.Texture.WHITE);
        this.sprite.visible = false;
        this.view = this.sprite;
    }

    update(theme: Theme, darkField: number, width: number, height: number) {
        if (theme !== this.theme || darkField !== this.darkField) {
            this.theme = theme;
            this.darkField = darkField;
            const field = resolveLumiereDarkField(theme, darkField);
            this.sprite.tint = hexOf(field.color);
            this.sprite.alpha = field.alpha;
            this.sprite.visible = field.alpha > 0.002;
        }
        if (width !== this.width || height !== this.height) {
            this.width = width;
            this.height = height;
            this.sprite.setSize(width, height);
        }
    }

    destroy() {
        this.sprite.destroy();
    }
}
