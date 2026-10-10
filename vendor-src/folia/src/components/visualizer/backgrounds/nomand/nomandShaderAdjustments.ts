// src/components/visualizer/backgrounds/nomand/nomandShaderAdjustments.ts
// Pure helpers shared by the Nomand shader layer: the daylight-aware luminance inversion the
// dithering effect has always used, and the pre-zoom the distorting shaders need so their warped
// sampling never runs past the image edge and uncovers the backdrop.

/** 预放大的上限。再高只是把封面裁没，而极端 bulge 下 shader 自己就会把四角淡出，放大也救不回来。 */
const MAX_OVERSCAN = 1.8;
/** 在反解出的最小倍率之上留的余量，避免浮点误差在边缘留下一像素缝。 */
const OVERSCAN_MARGIN = 0.01;
/**
 * 估算可见区域用的宽高比。shader 里的边角半径同时取决于画布和图片的宽高比，
 * 运行时拿不到图片原始尺寸，这里取常见宽屏做保守估计：更窄的画布只会多裁一点，不会重新露边。
 */
const REFERENCE_ASPECT = 16 / 9;

/** PaperTexture 里与外观相关、不开放给用户的固定形状参数；overscan 的系数依赖这里的取值。 */
export const NOMAND_PAPER_TEXTURE_SHAPE = {
    fiberSize: 0.2,
    crumples: 0.35,
    crumpleSize: 0.35,
    folds: 0.65,
    foldCount: 5,
    drops: 0.2,
    seed: 5.8,
} as const;

/** LensDistortion 里固定的镜头形状参数；overscan 需要读 focusEdges。 */
export const NOMAND_LENS_SHAPE = {
    perspective: 0.4,
    count: 20,
    focusCenter: 0.55,
    focusEdges: 0.8,
    swirl: 0.08,
    lensCircle: 0.1,
} as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const clampOverscan = (scale: number) => Math.min(MAX_OVERSCAN, Math.max(1, scale));

/** 只在确实需要放大时才补余量，免得不产生位移的参数组合也被无谓地裁掉一圈。 */
const applyOverscanMargin = (scale: number) => (scale <= 1 ? 1 : clampOverscan(scale + OVERSCAN_MARGIN));

/** 图像 UV 每侧被推出去 `margin` 时，遮住裁切边所需的最小放大倍率。 */
const overscanForMargin = (margin: number) => applyOverscanMargin(1 / (1 - 2 * Math.min(Math.max(margin, 0), 0.45)));

/**
 * 明暗自适应反色。浅色主题下背景底色是亮的，沿用深色主题的亮度方向会让画面主体糊成一团，
 * 所以在非原色模式下把亮度翻转一次。像素画（dithering）一直是这个规则，半调网点沿用同一套。
 */
export const resolveDaylightInversion = (
    inverted: boolean,
    originalColors: boolean,
    isDaylight?: boolean,
) => (isDaylight && !originalColors ? !inverted : inverted);

/**
 * 半调网点的亮度约定和像素画相反：网点半径按 `mix(.25 * baseR, 0., lum)` 随亮度收缩，而网点画的是
 * colorFront。深色主题下 colorFront 比 colorBack 亮，于是图像越暗的地方越亮，整张图看起来是负片
 * （originalColors 模式同理，亮部会缩成网点消失在底色里）。所以基准值先翻一次，让“关闭反色”得到
 * 像素画那种正常观感，用户再按需要用开关翻回去；明暗自适应叠加在这之上。
 */
export const resolveHalftoneInversion = (
    inverted: boolean,
    originalColors: boolean,
    isDaylight?: boolean,
) => resolveDaylightInversion(!inverted, originalColors, isDaylight);

/**
 * PaperTexture 会把纸张法线直接加到图像 UV 上（shader 中 `imageUV += .02 * normalImage`），
 * 边缘像素因此采样到图外、被 getUvFrame 淡出，露出纸张底色。
 * 这里按 shader 里 normalImage 各项的系数估出最大位移，换算成需要的预放大倍率。
 * 副作用是纸张纹理本身也会跟着放大同样的比例，一成左右的差别在背景上看不出来。
 */
export const getPaperTextureOverscan = (roughness: number, fiber: number) => {
    const { folds, crumples, drops } = NOMAND_PAPER_TEXTURE_SHAPE;
    const maxNormal = 2 * folds
        + 1.5 * crumples
        + 0.2 * drops
        + 0.75 * clamp01(roughness)
        + 0.1 * clamp01(fiber);
    return overscanForMargin(0.02 * maxNormal);
};

/**
 * LensDistortion 用 lensWarp 沿半径把采样点推出去（bulge > 0 时是 tan 映射），推到图外就露底色。
 *
 * 反解条件是“可见区域四角被推到的位置仍落在图内”，即 push(cornerRn) <= scale * headroom；
 * cornerRn 随 scale 变小，所以约束随 scale 单调放松，可以直接二分。
 * 另外先把 scale 抬到 shader 开始淡出四角（rn * bulge >= 1.45）之前，
 * 一来避免四角被淡成透明，二来让 tan 映射停在未饱和区间，二分才是单调的。
 * bulge <= 0 是向内收缩，只需为边缘残留的色散留余量。
 */
export const getLensDistortionOverscan = (bulge: number, spread: number) => {
    const outRadius = 0.5 * Math.hypot(REFERENCE_ASPECT, 1);
    const clampedSpread = clamp01(spread);
    const reach = 0.7 * Math.pow(clampedSpread, 1.3 + 2.7 * clampedSpread);
    // focusEdges 已经把边缘处的色散压到 (1 - focusEdges)，只需为这点残量留位置。
    const edgeReach = reach * (1 - NOMAND_LENS_SHAPE.focusEdges);
    const headroom = Math.max(0.35, 1 - edgeReach / outRadius);

    if (bulge <= 0) return applyOverscanMargin(1 / headroom);

    const bulgeAmount = Math.min(bulge, 1) * 1.4;
    // inradius 在参考宽高比 >= 1 时恒为 .5，所以 cornerRn = cornerRadius / .5 = 2 * outRadius / scale。
    const cornerPush = (scale: number) => {
        const cornerRn = (2 * outRadius) / scale;
        return Math.tan(cornerRn * bulgeAmount) / Math.tan(bulgeAmount) / cornerRn;
    };

    let low = Math.max(1, (2 * outRadius * bulgeAmount) / 1.45);
    if (low >= MAX_OVERSCAN || cornerPush(MAX_OVERSCAN) > MAX_OVERSCAN * headroom) return MAX_OVERSCAN;
    if (low === 1 && cornerPush(1) <= headroom) return applyOverscanMargin(1 / headroom);

    let high = MAX_OVERSCAN;
    for (let step = 0; step < 32; step += 1) {
        const mid = (low + high) / 2;
        if (cornerPush(mid) > mid * headroom) low = mid;
        else high = mid;
    }
    return applyOverscanMargin(high);
};
