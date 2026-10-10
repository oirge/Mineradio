// src/utils/hexCardFalloff.ts
// 六边形卡片距离衰减的两个下限（缩放、不透明度）的出厂值与可调范围。网格的 hexCardTransform 拿它们
// 当默认值，网格外观设置的 store 与设置页拿它们做夹取和「恢复默认」——后两者不能 import 网格 suite，
// 所以这几个常量单独放在这里。

export const HEX_CARD_MIN_SCALE_DEFAULT = 0.45;
export const HEX_CARD_MIN_OPACITY_DEFAULT = 0.4;
export const HEX_CARD_MIN_SCALE_BOUNDS = { min: 0.2, max: 1.1 } as const;
export const HEX_CARD_MIN_OPACITY_BOUNDS = { min: 0, max: 1 } as const;
