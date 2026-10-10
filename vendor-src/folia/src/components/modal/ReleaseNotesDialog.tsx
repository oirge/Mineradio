import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NewFeaturesIntro } from './NewFeaturesIntro';
import { resolveReducedMotion, useMotionSettingsStore } from '../../stores/useMotionSettingsStore';
import { OVERLAY_TRANSITION, OVERLAY_CALM_TRANSITION, overlayBackdropMotion, overlayPanelMotionFor } from '../shared/overlayEntranceMotion';
import type { Theme } from '../../types';

// src/components/modal/ReleaseNotesDialog.tsx
// 进出场走 overlayEntranceMotion 那一份，和其它全屏覆盖层同一个手感。

type ReleaseNotesDialogProps = {
    isOpen: boolean;
    isDaylight: boolean;
    theme?: Theme;
    onClose: () => void;
};

const ReleaseNotesDialog: React.FC<ReleaseNotesDialogProps> = ({ isOpen, isDaylight, theme, onClose }) => {
    const { t } = useTranslation();
    const calm = useMotionSettingsStore(state => resolveReducedMotion(state, 'uiMicroMotion'));

    const classes = {
        textPrimary: isDaylight ? 'text-zinc-900' : 'text-zinc-50',
        textSecondary: isDaylight ? 'text-zinc-500' : 'text-zinc-400',
        tipCardBg: isDaylight ? 'bg-zinc-50/90 border border-zinc-100' : 'bg-white/[0.04] border border-white/10',
        iconTileBg: isDaylight ? 'bg-white shadow-sm' : 'bg-white/10',
        cardBg: isDaylight ? 'bg-zinc-50 border border-zinc-100' : 'bg-zinc-800/50 border border-zinc-700/50',
    };

    // AnimatePresence 必须包在 isOpen 外面，否则关闭时这棵树直接消失，退场动画没有机会播。
    return createPortal(
        <AnimatePresence>
            {isOpen && (
        <motion.div
            {...overlayBackdropMotion}
            transition={calm ? OVERLAY_CALM_TRANSITION : OVERLAY_TRANSITION}
            data-folia-keyboard-window="true"
            data-testid="release-notes-dialog"
            className="fixed inset-0 z-[210] flex items-center justify-center bg-black/65 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="release-notes-title"
            onClick={onClose}
        >
            <motion.div
                {...overlayPanelMotionFor(calm)}
                className={`relative max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border p-7 shadow-2xl ${
                    isDaylight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-[#18181b]'
                }`}
                onClick={event => event.stopPropagation()}
            >
                <button
                    type="button"
                    data-testid="release-notes-close"
                    onClick={onClose}
                    aria-label={t('ui.close')}
                    className="absolute right-5 top-5 rounded-full p-2 opacity-50 transition-opacity hover:opacity-100"
                    style={{ color: 'var(--text-primary)' }}
                >
                    <X size={18} />
                </button>
                <h2 id="release-notes-title" className={`mb-5 pr-12 text-2xl font-bold ${classes.textPrimary}`}>
                    {t('help.releaseNotes')}
                </h2>
                <div
                    className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full blur-[70px]"
                    style={{ backgroundColor: theme?.accentColor || '#f43f5e', opacity: 0.14 }}
                />
                <NewFeaturesIntro isDaylight={isDaylight} classes={classes} />
            </motion.div>
        </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
};

export default ReleaseNotesDialog;
