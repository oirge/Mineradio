import type { CoverPalette } from './coverPaletteAnalysis';

// src/utils/builtinTheme/themeNameTable.ts
// The built-in theme naming table. Names mirror the AI theme contract's paired form
// (e.g. 忧郁破晓 / 忧郁子夜): light and dark share the Chinese prefix and differ only in the suffix,
// then both carry the English Built-in marker so a generated theme never reads as an AI one.

export const BUILTIN_NAME_SUFFIX = ' Built-in';

const NEUTRAL_SATURATION_CEILING = 0.12;

const NEUTRAL_PREFIXES = ['月白', '银灰', '素墨', '雾白', '灰烬'];

const HUE_PREFIX_BUCKETS: { maxHue: number; prefixes: string[]; }[] = [
    { maxHue: 20, prefixes: ['绯色', '朱砂', '珊瑚', '赤霞', '石榴'] },
    { maxHue: 45, prefixes: ['琥珀', '暮光', '橘光', '麦浪', '落日'] },
    { maxHue: 70, prefixes: ['鎏金', '稻香', '芒草', '秋黄', '沙丘'] },
    { maxHue: 105, prefixes: ['新柳', '青苔', '竹露', '草木', '春芜'] },
    { maxHue: 165, prefixes: ['苔痕', '松风', '薄荷', '翡翠', '深林'] },
    { maxHue: 205, prefixes: ['潮汐', '雾蓝', '海雾', '天青', '汀洲'] },
    { maxHue: 255, prefixes: ['深蓝', '靛青', '群青', '远洋', '蓝调'] },
    { maxHue: 300, prefixes: ['紫烟', '丁香', '暮霭', '紫棠', '薰衣'] },
    { maxHue: 360, prefixes: ['玫影', '桃夭', '藕荷', '蔷薇', '胭脂'] },
];

const LIGHT_SUFFIXES = ['破晓', '晨光', '微光', '初雪', '白昼', '浮云', '日砂'];
const DARK_SUFFIXES = ['子夜', '夜色', '深潭', '暗涌', '沉夜', '夜航', '星屑'];

const pickFrom = <T,>(items: readonly T[], random: () => number): T => (
    items[Math.min(items.length - 1, Math.floor(random() * items.length))]
);

const resolveHuePrefixes = (hue: number) => (
    HUE_PREFIX_BUCKETS.find(bucket => hue < bucket.maxHue)?.prefixes
    ?? HUE_PREFIX_BUCKETS[HUE_PREFIX_BUCKETS.length - 1].prefixes
);

// Light and dark share the hue-matched prefix; only the day/night suffix differs.
export const pickBuiltinThemeNames = (
    palette: CoverPalette,
    random: () => number,
): { light: string; dark: string; } => {
    const prefixes = palette.baseSaturation < NEUTRAL_SATURATION_CEILING
        ? NEUTRAL_PREFIXES
        : resolveHuePrefixes(palette.baseHue);
    const prefix = pickFrom(prefixes, random);

    return {
        light: `${prefix}${pickFrom(LIGHT_SUFFIXES, random)}${BUILTIN_NAME_SUFFIX}`,
        dark: `${prefix}${pickFrom(DARK_SUFFIXES, random)}${BUILTIN_NAME_SUFFIX}`,
    };
};
