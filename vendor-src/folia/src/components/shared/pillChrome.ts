// src/components/shared/pillChrome.ts
// 首页平台连接与网格页签共享的胶囊颜色；不装载任何 suite 或 React 组件。

/**
 * The look of the controls row under the home header. Pill and text colours come from the header's
 * own tab switcher (Grid3D: navPillBg, navPillInactiveText) so the row reads as part of the same
 * chrome. The active option deliberately does not reuse the header's white pill: that marks the
 * page, and a second one of equal weight right below it made the two levels impossible to tell
 * apart.
 */
export const pillChromeClassesFor = (isDaylight: boolean) => ({
    pill: isDaylight ? 'bg-black/5' : 'bg-white/10',
    softText: isDaylight ? 'text-black/60 hover:text-black' : 'text-white/60 hover:text-white',
    strongText: isDaylight ? 'text-black/85' : 'text-white/90',
    activePill: isDaylight ? 'bg-black/10' : 'bg-white/15',
    divider: isDaylight ? 'bg-black/10' : 'bg-white/15',
});
