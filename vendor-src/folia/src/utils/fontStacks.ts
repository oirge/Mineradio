import type { Theme } from '../types';

export const MIN_FONT_WEIGHT = 100;
export const MAX_FONT_WEIGHT = 900;
export const FONT_WEIGHT_STEP = 10;

export const normalizeFontWeight = (fontWeight: unknown): number | null => {
    if (typeof fontWeight !== 'number' || !Number.isFinite(fontWeight)) return null;

    const clamped = Math.min(MAX_FONT_WEIGHT, Math.max(MIN_FONT_WEIGHT, fontWeight));
    return Math.round(clamped / FONT_WEIGHT_STEP) * FONT_WEIGHT_STEP;
};

export const resolveThemeFontWeight = (
    theme: Pick<Theme, 'fontWeight'> | null | undefined,
    fallback: number,
) => normalizeFontWeight(theme?.fontWeight) ?? fallback;

const SUGAR_SERIF_FAMILY = '"獅尾四季春加糖SC"';

export const BUILTIN_FONT_STACKS: Record<Theme['fontStyle'], string> = {
    sans: '"Inter", "Noto Sans CJK SC", "Noto Sans JP", "Source Han Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
    serif: `${SUGAR_SERIF_FAMILY}, "Iowan Old Style", "Noto Serif CJK SC", "Noto Serif JP", "Source Han Serif SC", "Songti SC", "STSong", "Georgia", serif`,
    mono: '"IBM Plex Mono", "Sarasa Mono SC", "Noto Sans Mono CJK SC", "Noto Sans Mono", "SFMono-Regular", Consolas, monospace',
};

const TRANSLATION_FONT_STACKS: Record<Theme['fontStyle'], string> = {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Helvetica Neue", Arial, "Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans JP", "Source Han Sans JP", "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif',
    serif: `${SUGAR_SERIF_FAMILY}, "Folia Noto Serif SC", "Iowan Old Style", Georgia, "Times New Roman", "Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", "Noto Serif JP", "Source Han Serif JP", "Yu Mincho", "MS PMincho", serif`,
    mono: 'Consolas, "IBM Plex Mono", "SFMono-Regular", Menlo, Monaco, "Sarasa Mono SC", "Noto Sans Mono CJK SC", "SimHei", "DengXian", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans Mono CJK JP", "MS Gothic", monospace',
};

const CSS_GENERIC_FONT_FAMILIES = new Set([
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'fantasy',
    'system-ui',
    'ui-serif',
    'ui-sans-serif',
    'ui-monospace',
    'ui-rounded',
    'emoji',
    'math',
    'fangsong',
]);

const quoteFontFamily = (fontFamily: string) => `"${fontFamily.replace(/["\\]/g, '\\$&')}"`;

const normalizeFontFamilyName = (fontFamily: string) => fontFamily.trim().replace(/^['"]|['"]$/g, '').trim();

const formatFontFamily = (fontFamily: string) => {
    const normalized = normalizeFontFamilyName(fontFamily);
    if (!normalized) return null;

    return CSS_GENERIC_FONT_FAMILIES.has(normalized.toLowerCase())
        ? normalized
        : quoteFontFamily(normalized);
};

export const normalizeFontFamilyStack = (fontFamilies: Array<string | null | undefined> | null | undefined) => {
    const seen = new Set<string>();
    const stack: string[] = [];

    fontFamilies?.forEach(fontFamily => {
        const normalized = normalizeFontFamilyName(fontFamily ?? '');
        if (!normalized) return;

        const key = normalized.toLocaleLowerCase();
        if (seen.has(key)) return;

        seen.add(key);
        stack.push(normalized);
    });

    return stack;
};

const buildCustomFontFamilyStack = (theme: Pick<Theme, 'fontFamily' | 'fontFamilyStack'>) => {
    const familiesToNormalize: (string | null | undefined)[] = [
        ...(theme.fontFamily ? [theme.fontFamily] : []),
        ...(theme.fontFamilyStack ?? []),
    ];

    if (familiesToNormalize.length === 0) {
        return [];
    }

    return normalizeFontFamilyStack(familiesToNormalize)
        .map(formatFontFamily)
        .filter((fontFamily): fontFamily is string => Boolean(fontFamily));
};

export const getBuiltinThemeFontStack = (fontStyle: Theme['fontStyle']) => {
    return BUILTIN_FONT_STACKS[fontStyle] ?? BUILTIN_FONT_STACKS.sans;
};

export const resolveThemeFontStack = (theme: Pick<Theme, 'fontStyle' | 'fontFamily' | 'fontFamilyStack'>) => {
    const fallbackStack = getBuiltinThemeFontStack(theme.fontStyle);
    const customFontStack = buildCustomFontFamilyStack(theme);

    if (customFontStack.length === 0) {
        return fallbackStack;
    }

    return `${customFontStack.join(', ')}, ${fallbackStack}`;
};

export const resolveThemeTranslationFontStack = (theme: Pick<Theme, 'fontStyle' | 'fontFamily' | 'fontFamilyStack'>) => {
    const fallbackStack = TRANSLATION_FONT_STACKS[theme.fontStyle] ?? TRANSLATION_FONT_STACKS.sans;
    const customFontStack = buildCustomFontFamilyStack(theme);

    if (customFontStack.length === 0) {
        return fallbackStack;
    }

    return `${customFontStack.join(', ')}, ${fallbackStack}`;
};
