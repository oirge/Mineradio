import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSupportsFinePointer } from '../../hooks/useSupportsFinePointer';
import { usePonderStore } from '../../stores/usePonderStore';
import { ponderTargetsByCategory } from './ponderRegistry';
import { ponderModifierLabel } from './PonderKeyCap';
import type { Theme } from '../../types';

// src/components/ponder/PonderNavigationPage.tsx
// 思索导航页：一屏列完所有能单独讲的东西，按分类分组。
//
// 它存在的理由是总览不能无限长。原先帮助页那颗按钮直接开一段六章的教程，于是
// 「Folia 大致怎么转」和「壁纸模式怎么用」被排在同一条线上 —— 想看后者得先看完前者。
// 拆开之后，总览只剩一章（Ctrl+G 就是它），具体那一条从这里挑。
//
// 每张卡都挂 data-ponder-nav-target：悬停满 600ms 出提示、长按 G 进去，和在真实组件上
// 的操作完全一样；触屏点一下直接进。这两条路由 resolveHoveredPonderTarget 统一认。
//
// 挂 data-folia-keyboard-window 是为了让底下的全局热键让路；思索的悬停提示不受影响 ——
// ponderHintGate 对「目标就在这个窗口内部」的情况是放行的，而这里正是那种情况。

type PonderNavigationPageProps = {
    theme?: Theme;
    isDaylight: boolean;
};

const PonderNavigationPage: React.FC<PonderNavigationPageProps> = ({ theme, isDaylight }) => {
    const { t } = useTranslation();
    const isOpen = usePonderStore(state => state.isNavigationOpen);
    const closeNavigation = usePonderStore(state => state.closeNavigation);
    const openPonder = usePonderStore(state => state.openPonder);
    const seenIds = usePonderStore(state => state.seenTargetIds);
    const supportsFinePointer = useSupportsFinePointer();

    const accent = theme?.accentColor || (isDaylight ? '#27272a' : '#fafafa');
    const groups = React.useMemo(
        () => ponderTargetsByCategory()
            .map(group => ({
                ...group,
                // 目标自己说此刻讲不讲得通（桌面端那一组在浏览器里就不该出现）。
                targets: group.targets.filter(target => target.isAvailable?.() !== false),
            }))
            .filter(group => group.targets.length > 0),
        // 只在打开时求值一次：isAvailable 读的是运行时环境，而它在这一屏开着的时候不会变。
        [isOpen],
    );

    React.useEffect(() => {
        if (!isOpen) {
            return undefined;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeNavigation();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, closeNavigation]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    // 页面级 Ctrl+G 在这一屏上打开的是总览，不是底下那一页。
                    data-ponder-page-scope="help-page"
                    data-folia-keyboard-window="true"
                    data-testid="ponder-navigation"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`fixed inset-0 z-[195] overflow-y-auto px-6 py-10 backdrop-blur-xl ${
                        isDaylight ? 'bg-white/90' : 'bg-zinc-950/92'
                    }`}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('ponder.navigation.title')}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="mx-auto max-w-5xl"
                    >
                        <header className="mb-8 flex items-start gap-4">
                            <span
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-current/5"
                                style={{ color: accent }}
                            >
                                <Lightbulb size={24} aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {t('ponder.navigation.title')}
                                </h1>
                                <p className="mt-1.5 max-w-2xl text-sm leading-6 opacity-60" style={{ color: 'var(--text-secondary)' }}>
                                    {t(supportsFinePointer ? 'ponder.navigation.hint' : 'ponder.navigation.touchHint')}
                                </p>
                            </div>
                            <button
                                type="button"
                                data-testid="ponder-navigation-close"
                                onClick={closeNavigation}
                                aria-label={t('ui.close')}
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                    isDaylight ? 'border-black/10 hover:bg-black/5' : 'border-white/15 hover:bg-white/10'
                                }`}
                                style={{ color: 'var(--text-primary)' }}
                            >
                                <X size={18} aria-hidden="true" />
                            </button>
                        </header>

                        <div className="space-y-8 pb-6">
                            {groups.map(group => (
                                <section key={group.category}>
                                    <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] opacity-45" style={{ color: 'var(--text-secondary)' }}>
                                        {t(`ponder.categories.${group.category}`)}
                                    </h2>
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {group.targets.map(target => (
                                            <button
                                                key={target.id}
                                                type="button"
                                                // 悬停 600ms + 长按 G 走的是和真实组件一模一样的那条路。
                                                data-ponder-nav-target={target.id}
                                                data-ponder-nav-seen={seenIds.has(target.id) || undefined}
                                                onClick={() => openPonder(target.id)}
                                                className={`rounded-2xl border p-4 text-left transition-colors ${
                                                    isDaylight
                                                        ? 'border-black/8 bg-black/[0.02] hover:bg-black/[0.05]'
                                                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                                                }`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                        {t(target.titleKey)}
                                                    </span>
                                                    {seenIds.has(target.id) && (
                                                        <span
                                                            className="h-1.5 w-1.5 shrink-0 rounded-full opacity-60"
                                                            style={{ backgroundColor: accent }}
                                                            aria-label={t('ponder.navigation.seen')}
                                                        />
                                                    )}
                                                </span>
                                                {target.summaryKey && (
                                                    <span className="mt-1 block text-xs leading-5 opacity-55" style={{ color: 'var(--text-secondary)' }}>
                                                        {/* 卡片上那一行和字幕走同一套插值：{{mod}} 要按平台渲染成 Ctrl 或 Cmd。 */}
                                                        {t(target.summaryKey, { mod: ponderModifierLabel })}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PonderNavigationPage;
