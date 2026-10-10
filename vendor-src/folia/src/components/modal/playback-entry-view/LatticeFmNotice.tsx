import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Radio, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlaybackEntryViewStore } from '../../../stores/usePlaybackEntryViewStore';
import { useThemeSettingsStore } from '../../../stores/useThemeSettingsStore';

// src/components/modal/playback-entry-view/LatticeFmNotice.tsx
// Explains why Personal FM opened the standard player instead of Lattice.
//
// It stays off the status toast channel on purpose: that channel is a single slot, and the same
// playSong call fills it twice - once fetching the song, once matching lyrics - so an explanation
// posted there is gone before it can be read. Its own lane below the toast, and its own timer,
// mean the two never compete.

const NOTICE_DURATION_MS = 6000;

export const LatticeFmNotice: React.FC = () => {
    const { t } = useTranslation();
    const token = usePlaybackEntryViewStore(state => state.latticeFmNoticeToken);
    const dismiss = usePlaybackEntryViewStore(state => state.dismissLatticeFmNotice);
    const isDaylight = useThemeSettingsStore(state => state.isDaylight);

    // Keyed on the token rather than on a boolean, so raising the notice again while it is still
    // on screen restarts the countdown instead of inheriting the tail of the previous one.
    useEffect(() => {
        if (token === 0) return;
        const timer = window.setTimeout(dismiss, NOTICE_DURATION_MS);
        return () => window.clearTimeout(timer);
    }, [dismiss, token]);

    return createPortal(
        <AnimatePresence>
            {token !== 0 && (
                <motion.div
                    key={token}
                    initial={{ opacity: 0, y: 60, x: '-50%' }}
                    animate={{ opacity: 1, y: 96, x: '-50%' }}
                    exit={{ opacity: 0, y: 60, x: '-50%' }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
                    className={`fixed top-0 left-1/2 z-[205] flex max-w-[min(92vw,26rem)] items-start gap-3 rounded-2xl px-5 py-3.5 shadow-xl backdrop-blur-md ${isDaylight
                        ? 'border border-black/5 bg-white/80 text-zinc-800'
                        : 'border border-white/10 bg-white/10 text-white'}`}
                >
                    <Radio size={18} className={`mt-0.5 shrink-0 ${isDaylight ? 'text-amber-600' : 'text-amber-300'}`} />
                    <span className="text-sm leading-relaxed">{t('status.latticeFmOpenedInPlayer')}</span>
                    <button
                        type="button"
                        onClick={dismiss}
                        aria-label={t('ui.close')}
                        title={t('ui.close')}
                        className={`-mr-1.5 mt-0.5 shrink-0 rounded-full p-1 transition-colors ${isDaylight
                            ? 'text-zinc-400 hover:bg-black/5 hover:text-zinc-700'
                            : 'text-white/50 hover:bg-white/10 hover:text-white'}`}
                    >
                        <X size={14} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
};
