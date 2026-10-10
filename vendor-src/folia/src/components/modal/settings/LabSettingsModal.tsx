import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Boxes, Check, ChevronLeft, ChevronsLeftRight, GamepadDirectional, Mic, Monitor, Moon, Play, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { Theme } from '../../../types';
import { SettingsAnchor } from './navigation/SettingsAnchorContext';
import SettingsSectionHeading from './navigation/SettingsSectionHeading';
import { useAudioSettingsStore } from '../../../stores/useAudioSettingsStore';
import { useTypographySettingsStore } from '../../../stores/useTypographySettingsStore';
import { usePlayerChromeSettingsStore } from '../../../stores/usePlayerChromeSettingsStore';
import { useThemeSettingsStore } from '../../../stores/useThemeSettingsStore';
import { useDesktopSettingsStore } from '../../../stores/useDesktopSettingsStore';

// src/components/modal/settings/LabSettingsModal.tsx
// Experimental settings subview kept outside SettingsModal to avoid another giant inline panel.
// Graphics switches now live in GraphicsSettingsSubview, the mod switch in ModsSettingsSubview and
// the Ponder hints in GeneralSettingsSubview.

type LabSettingsModalProps = {
    isOpen: boolean;
    onClose: () => void;
    theme?: Theme;
    voiceInputPause?: {
        enabled: boolean;
        supported: boolean;
        onToggle: () => void;
    };
    embedded?: boolean;
};

const shellTransition = { duration: 0.24, ease: 'easeOut' as const };
const panelMotion = {
    initial: { opacity: 0, scale: 0.98, y: 18 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: 18 },
};

const LabSettingsModal: React.FC<LabSettingsModalProps> = ({
    isOpen,
    onClose,
    theme,
    voiceInputPause,
    embedded,
}) => {
    const { t } = useTranslation();
    const isMouseDownOnOverlayRef = useRef(false);
    const {
        preventDisplaySleepDuringPlayback,
        onTogglePreventDisplaySleepDuringPlayback,
    } = useDesktopSettingsStore(useShallow(state => ({
        preventDisplaySleepDuringPlayback: state.preventDisplaySleepDuringPlayback,
        onTogglePreventDisplaySleepDuringPlayback: state.handleTogglePreventDisplaySleepDuringPlayback,
    })));
    const isDaylight = useThemeSettingsStore(state => state.isDaylight);
    const {
        hidePlayerProgressBar,
        hidePlayerRightPanelButton,
        alwaysShowPlayerBackButton,
        alwaysShowTrackSwitchButtons,
        alwaysShowMainWindowTitlebar,
        useNativeMacFullscreenButton,
        showOpenPanelCloseButton,
        onToggleHidePlayerProgressBar,
        onToggleHidePlayerRightPanelButton,
        onToggleAlwaysShowPlayerBackButton,
        onToggleAlwaysShowTrackSwitchButtons,
        onToggleAlwaysShowMainWindowTitlebar,
        onToggleNativeMacFullscreenButton,
        onToggleOpenPanelCloseButton,
    } = usePlayerChromeSettingsStore(useShallow(state => ({
        hidePlayerProgressBar: state.hidePlayerProgressBar,
        hidePlayerRightPanelButton: state.hidePlayerRightPanelButton,
        alwaysShowPlayerBackButton: state.alwaysShowPlayerBackButton,
        alwaysShowTrackSwitchButtons: state.alwaysShowTrackSwitchButtons,
        alwaysShowMainWindowTitlebar: state.alwaysShowMainWindowTitlebar,
        useNativeMacFullscreenButton: state.useNativeMacFullscreenButton,
        showOpenPanelCloseButton: state.showOpenPanelCloseButton,
        onToggleHidePlayerProgressBar: state.handleToggleHidePlayerProgressBar,
        onToggleHidePlayerRightPanelButton: state.handleToggleHidePlayerRightPanelButton,
        onToggleAlwaysShowPlayerBackButton: state.handleToggleAlwaysShowPlayerBackButton,
        onToggleAlwaysShowTrackSwitchButtons: state.handleToggleAlwaysShowTrackSwitchButtons,
        onToggleAlwaysShowMainWindowTitlebar: state.handleToggleAlwaysShowMainWindowTitlebar,
        onToggleNativeMacFullscreenButton: state.handleToggleNativeMacFullscreenButton,
        onToggleOpenPanelCloseButton: state.handleToggleOpenPanelCloseButton,
    })));
    const {
        hidePlayerTranslationSubtitle,
        onToggleHidePlayerTranslationSubtitle,
    } = useTypographySettingsStore(useShallow(state => ({
        hidePlayerTranslationSubtitle: state.hidePlayerTranslationSubtitle,
        onToggleHidePlayerTranslationSubtitle: state.handleToggleHidePlayerTranslationSubtitle,
    })));
    const autoPlayOnLaunch = useAudioSettingsStore(state => state.autoPlayOnLaunch);
    const onToggleAutoPlayOnLaunch = useAudioSettingsStore(state => state.handleToggleAutoPlayOnLaunch);
    const borderColor = isDaylight ? 'border-zinc-300/70' : 'border-white/10';
    const overlayBackground = isDaylight ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.5)';
    const subviewPanelBg = isDaylight ? 'bg-zinc-200' : 'bg-zinc-900';
    const toggleOffBackgroundClass = isDaylight ? 'bg-zinc-300/90' : 'bg-white/10';
    const settingsCardClass = isDaylight
        ? 'border-zinc-300/70 bg-white/55'
        : 'border-white/10 bg-white/5';
    const settingsCardInteractiveClass = isDaylight
        ? 'border-zinc-300/70 bg-white/60 hover:bg-white/80'
        : 'border-white/10 bg-white/5 hover:bg-white/10';
    const utilityGhostButtonClass = isDaylight
        ? 'border-zinc-300 bg-white/50 hover:bg-white/80'
        : 'border-white/10 bg-white/5 hover:bg-white/10';
    const isElectron = typeof window !== 'undefined' && Boolean(window.electron);
    const isMacElectron = window.electron?.platform === 'darwin';

    const renderToggle = (checked: boolean, onChange: () => void) => (
        <button
            type="button"
            onClick={onChange}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${checked ? '' : toggleOffBackgroundClass}`}
            style={{ backgroundColor: checked ? theme?.secondaryColor || 'rgba(114, 119, 134, 1)' : undefined }}
        >
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
    );

    const handleOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        isMouseDownOnOverlayRef.current = event.target === event.currentTarget;
    };

    const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget && isMouseDownOnOverlayRef.current) {
            onClose();
        }
    };

    const content = (
        <>
            <div className={embedded ? "space-y-4" : "flex-1 overflow-y-auto custom-scrollbar px-4 py-5 sm:px-6 relative z-10"}>
            <div className={embedded ? "space-y-4" : "space-y-4"}>
                <SettingsAnchor anchorId="labPlayerUi" label={t('options.labPlayerUiSection')} className="space-y-4">
                    <SettingsSectionHeading icon={Settings2} label={t('options.labPlayerUiSection')} />

                                <div className={`p-4 rounded-xl border space-y-3 ${settingsCardClass}`}>
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                            <Settings2 size={14} />
                                            {t('options.labHidePlayerUi')}
                                        </div>
                                        <div className="text-xs opacity-50 max-w-[420px]" style={{ color: 'var(--text-secondary)' }}>
                                            {t('options.labHidePlayerUiDesc')}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onToggleHidePlayerProgressBar(!hidePlayerProgressBar)}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${hidePlayerProgressBar ? 'bg-white/12 border-white/20' : utilityGhostButtonClass}`}
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            <span className={`flex h-4 w-4 items-center justify-center rounded-sm border ${hidePlayerProgressBar ? 'border-white/30 bg-white/15' : 'border-white/20 bg-transparent'}`}>
                                                {hidePlayerProgressBar ? <Check size={12} /> : null}
                                            </span>
                                            <span>{t('options.hidePlayerProgressBar')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onToggleHidePlayerTranslationSubtitle(!hidePlayerTranslationSubtitle)}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${hidePlayerTranslationSubtitle ? 'bg-white/12 border-white/20' : utilityGhostButtonClass}`}
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            <span className={`flex h-4 w-4 items-center justify-center rounded-sm border ${hidePlayerTranslationSubtitle ? 'border-white/30 bg-white/15' : 'border-white/20 bg-transparent'}`}>
                                                {hidePlayerTranslationSubtitle ? <Check size={12} /> : null}
                                            </span>
                                            <span>{t('options.hidePlayerTranslationSubtitle')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onToggleHidePlayerRightPanelButton(!hidePlayerRightPanelButton)}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${hidePlayerRightPanelButton ? 'bg-white/12 border-white/20' : utilityGhostButtonClass}`}
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            <span className={`flex h-4 w-4 items-center justify-center rounded-sm border ${hidePlayerRightPanelButton ? 'border-white/30 bg-white/15' : 'border-white/20 bg-transparent'}`}>
                                                {hidePlayerRightPanelButton ? <Check size={12} /> : null}
                                            </span>
                                            <span>{t('options.hidePlayerRightPanelButton')}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${settingsCardClass}`}>
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                            <GamepadDirectional size={14} />
                                            {t('options.showOpenPanelCloseButton')}
                                        </div>
                                        <div className="text-xs opacity-50 max-w-[320px]" style={{ color: 'var(--text-secondary)' }}>
                                            {t('options.showOpenPanelCloseButtonDesc')}
                                        </div>
                                    </div>
                                    {renderToggle(showOpenPanelCloseButton, () => onToggleOpenPanelCloseButton(!showOpenPanelCloseButton))}
                                </div>

                                <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${settingsCardClass}`}>
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                            <ChevronLeft size={14} />
                                            {t('options.alwaysShowPlayerBackButton')}
                                        </div>
                                        <div className="text-xs opacity-50 max-w-[320px]" style={{ color: 'var(--text-secondary)' }}>
                                            {t('options.alwaysShowPlayerBackButtonDesc')}
                                        </div>
                                    </div>
                                    {renderToggle(alwaysShowPlayerBackButton, () => onToggleAlwaysShowPlayerBackButton(!alwaysShowPlayerBackButton))}
                                </div>

                                <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${settingsCardClass}`}>
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                            <ChevronsLeftRight size={14} />
                                            {t('options.alwaysShowTrackSwitchButtons')}
                                        </div>
                                        <div className="text-xs opacity-50 max-w-[320px]" style={{ color: 'var(--text-secondary)' }}>
                                            {t('options.alwaysShowTrackSwitchButtonsDesc')}
                                        </div>
                                    </div>
                                    {renderToggle(alwaysShowTrackSwitchButtons, () => onToggleAlwaysShowTrackSwitchButtons(!alwaysShowTrackSwitchButtons))}
                                </div>

                </SettingsAnchor>

                <SettingsAnchor anchorId="labWindowAndTools" label={t('options.labWindowAndToolsSection')} className="space-y-4">
                    <SettingsSectionHeading icon={Boxes} label={t('options.labWindowAndToolsSection')} divider />

                                <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${settingsCardClass}`}>
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                            <Play size={14} />
                                            {t('options.autoPlayOnLaunch')}
                                        </div>
                                        <div className="text-xs opacity-50 max-w-[360px]" style={{ color: 'var(--text-secondary)' }}>
                                            {t('options.autoPlayOnLaunchDesc')}
                                        </div>
                                        <div className="text-[11px] opacity-40 max-w-[360px]" style={{ color: 'var(--text-secondary)' }}>
                                            {t('options.autoPlayOnLaunchDescSub')}
                                        </div>
                                    </div>
                                    {renderToggle(autoPlayOnLaunch, () => onToggleAutoPlayOnLaunch(!autoPlayOnLaunch))}
                                </div>

                                <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${settingsCardClass}`}>
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                            <Monitor size={14} />
                                            {t('options.alwaysShowMainWindowTitlebar')}
                                        </div>
                                        <div className="text-xs opacity-50 max-w-[320px]" style={{ color: 'var(--text-secondary)' }}>
                                            {t('options.alwaysShowMainWindowTitlebarDesc')}
                                        </div>
                                    </div>
                                    {renderToggle(alwaysShowMainWindowTitlebar, () => onToggleAlwaysShowMainWindowTitlebar(!alwaysShowMainWindowTitlebar))}
                                </div>

                                {isMacElectron && (
                                    <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${settingsCardClass}`}>
                                        <div className="space-y-1">
                                            <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                                <Monitor size={14} />
                                                {t('options.useNativeMacFullscreenButton')}
                                            </div>
                                            <div className="text-xs opacity-50 max-w-[360px]" style={{ color: 'var(--text-secondary)' }}>
                                                {t('options.useNativeMacFullscreenButtonDesc')}
                                            </div>
                                        </div>
                                        {renderToggle(useNativeMacFullscreenButton, () => onToggleNativeMacFullscreenButton(!useNativeMacFullscreenButton))}
                                    </div>
                                )}

                                {isElectron && (
                                    <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${settingsCardClass}`}>
                                        <div className="space-y-1">
                                            <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                                <Moon size={14} />
                                                {t('options.preventDisplaySleepDuringPlayback')}
                                            </div>
                                            <div className="text-xs opacity-50 max-w-[360px]" style={{ color: 'var(--text-secondary)' }}>
                                                {t('options.preventDisplaySleepDuringPlaybackDesc')}
                                            </div>
                                        </div>
                                        {renderToggle(preventDisplaySleepDuringPlayback, () => onTogglePreventDisplaySleepDuringPlayback(!preventDisplaySleepDuringPlayback))}
                                    </div>
                                )}

                                {voiceInputPause?.supported && (
                                    <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors hover:bg-white/8 ${settingsCardInteractiveClass}`} onClick={voiceInputPause.onToggle}>
                                        <div className="flex flex-col pr-8">
                                            <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                                <Mic size={14} />
                                                {t('options.voiceInputPause')}
                                            </span>
                                            <span className="text-xs opacity-50 mt-1 max-w-[360px]" style={{ color: 'var(--text-secondary)' }}>
                                                {t('options.voiceInputPauseDesc')}
                                            </span>
                                        </div>
                                        {renderToggle(voiceInputPause.enabled, voiceInputPause.onToggle)}
                                    </div>
                                )}
                </SettingsAnchor>
            </div>
            </div>
        </>
    );

    if (embedded) {
        return content;
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={shellTransition}
                    className="fixed inset-0 z-[136] backdrop-blur-xl p-3 sm:p-5"
                    style={{ backgroundColor: overlayBackground }}
                    onMouseDown={handleOverlayMouseDown}
                    onClick={handleBackdropClick}
                >
                    <motion.div
                        {...panelMotion}
                        transition={shellTransition}
                        className={`mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-[32px] border ${borderColor} ${subviewPanelBg} shadow-[0_24px_80px_rgba(0,0,0,0.28)] relative`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="absolute inset-0 pointer-events-none z-0">
                            <div 
                                className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[80px] ${isDaylight ? 'opacity-20' : 'opacity-10'}`} 
                                style={{ backgroundColor: theme?.accentColor || (isDaylight ? '#60a5fa' : '#3b82f6') }} 
                            />
                            <div 
                                className={`absolute -bottom-24 -left-24 w-64 h-64 rounded-full blur-[80px] ${isDaylight ? 'opacity-20' : 'opacity-10'}`} 
                                style={{ backgroundColor: theme?.secondaryColor || theme?.accentColor || (isDaylight ? '#c084fc' : '#a855f7') }} 
                            />
                        </div>
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6 relative z-10">
                            <div className="flex items-center gap-3 min-w-0">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className={`h-10 w-10 rounded-full border flex items-center justify-center transition-colors ${utilityGhostButtonClass}`}
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <div className="min-w-0">
                                    <div className="text-lg sm:text-xl font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                        {t('options.labSettings')}
                                    </div>
                                    <div className="text-xs opacity-50 mt-1" style={{ color: 'var(--text-secondary)' }}>
                                        {t('options.labSettingsDesc')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {content}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LabSettingsModal;
