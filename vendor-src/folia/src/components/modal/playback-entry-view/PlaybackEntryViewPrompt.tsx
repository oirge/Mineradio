import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PlaybackEntryViewOptions } from './PlaybackEntryViewOptions';
import { usePlaybackEntryViewStore } from '../../../stores/usePlaybackEntryViewStore';
import { useThemeSettingsStore } from '../../../stores/useThemeSettingsStore';
import type { Theme } from '../../../types';

// src/components/modal/playback-entry-view/PlaybackEntryViewPrompt.tsx
// Asks once, after the release notes are dismissed, which view pressing play should open.
//
// It closes as answered whichever way it is dismissed, including the backdrop: the preference has
// a working default, so a listener who does not care must not be asked a second time.

export const PlaybackEntryViewPrompt: React.FC<{ theme?: Theme | null }> = ({ theme }) => {
    const { t } = useTranslation();
    const isOpen = usePlaybackEntryViewStore(state => state.isPlaybackEntryViewPromptOpen);
    const playbackEntryView = usePlaybackEntryViewStore(state => state.playbackEntryView);
    const setPlaybackEntryView = usePlaybackEntryViewStore(state => state.setPlaybackEntryView);
    const closePrompt = usePlaybackEntryViewStore(state => state.closePlaybackEntryViewPrompt);
    const isDaylight = useThemeSettingsStore(state => state.isDaylight);

    const accentColor = theme?.accentColor || (isDaylight ? '#3b82f6' : '#60a5fa');
    const bgClass = isDaylight ? 'bg-white border-zinc-200' : 'bg-[#18181b] border-zinc-800';
    const textPrimary = isDaylight ? 'text-zinc-900' : 'text-zinc-50';
    const textSecondary = isDaylight ? 'text-zinc-500' : 'text-zinc-400';
    const btnClass = isDaylight
        ? 'bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 text-white shadow-xl shadow-zinc-900/10'
        : 'bg-gradient-to-r from-zinc-100 to-white hover:from-white hover:to-zinc-100 text-zinc-900 shadow-xl shadow-white/10';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
                    onClick={closePrompt}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                        onClick={(event) => event.stopPropagation()}
                        className={`${bgClass} border rounded-[2rem] max-w-lg w-full max-h-[85vh] p-8 shadow-2xl relative overflow-y-auto hide-scrollbar`}
                    >
                        <div className={`text-lg font-semibold ${textPrimary}`}>
                            {t('playbackEntryView.title')}
                        </div>
                        <div className={`mt-2 text-sm leading-relaxed ${textSecondary}`}>
                            {t('playbackEntryView.description')}
                        </div>

                        <div className="mt-5">
                            <PlaybackEntryViewOptions
                                value={playbackEntryView}
                                onChange={setPlaybackEntryView}
                                isDaylight={isDaylight}
                                accentColor={accentColor}
                            />
                        </div>

                        <div className={`mt-5 text-[11px] ${textSecondary}`}>
                            {t('playbackEntryView.settingsHint')}
                        </div>

                        <div className="mt-5 flex justify-end">
                            <button
                                type="button"
                                onClick={closePrompt}
                                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${btnClass}`}
                            >
                                {t('playbackEntryView.confirm')}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
