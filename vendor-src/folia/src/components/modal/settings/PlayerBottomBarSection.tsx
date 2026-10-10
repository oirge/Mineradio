import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Move, RotateCcw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { Theme } from '../../../types';
import { CustomSelect } from '../../shared/CustomSelect';
import { playerBottomBarLiveOffset } from '../../../stores/motionSignals';
import { usePlaybackStore } from '../../../stores/usePlaybackStore';
import { usePlayerChromeSettingsStore } from '../../../stores/usePlayerChromeSettingsStore';
import { usePlayerBottomBarLayoutStore } from '../../../stores/usePlayerBottomBarLayoutStore';
import { PLAYER_BOTTOM_BAR_BASE_OFFSET_PX, resolvePlayerBottomBarMaxOffset } from '../../../utils/playerBottomBarLayout';
import { PLAYER_CONTROL_SLOT_OPTIONS, type PlayerControlSlotActionId } from '../../floating-player/playerControlSlotActions';

// src/components/modal/settings/PlayerBottomBarSection.tsx
// 播放页底部基线的高度，以及进度条右侧两个按钮槽位。挂在「界面设置」的底部界面分区里。

type PlayerBottomBarSectionProps = {
    settingsCardClass: string;
    utilityGhostButtonClass: string;
    rangeInputClass: string;
    /** 槽位下拉走 CustomSelect，菜单是 portal 到 body 的，拿不到容器的主题变量，只能传进去。 */
    isDaylight: boolean;
    theme?: Theme;
};

const PlayerBottomBarSection: React.FC<PlayerBottomBarSectionProps> = ({
    settingsCardClass,
    utilityGhostButtonClass,
    rangeInputClass,
    isDaylight,
    theme,
}) => {
    const { t } = useTranslation();
    const {
        playerBottomBarOffset,
        playerControlSlotPrimary,
        playerControlSlotSecondary,
        handleSetPlayerBottomBarOffset,
        handleSetPlayerControlSlot,
        hidePlayerProgressBar,
    } = usePlayerChromeSettingsStore(useShallow(state => ({
        playerBottomBarOffset: state.playerBottomBarOffset,
        playerControlSlotPrimary: state.playerControlSlotPrimary,
        playerControlSlotSecondary: state.playerControlSlotSecondary,
        handleSetPlayerBottomBarOffset: state.handleSetPlayerBottomBarOffset,
        handleSetPlayerControlSlot: state.handleSetPlayerControlSlot,
        hidePlayerProgressBar: state.hidePlayerProgressBar,
    })));
    const currentSong = usePlaybackStore(state => state.currentSong);
    const requestPositioning = usePlayerBottomBarLayoutStore(state => state.requestPositioning);
    const canStartPositioning = Boolean(currentSong) && !hidePlayerProgressBar;

    // 上限由视口高度决定，设置面板开着时缩放窗口也要跟着收，否则滑块量程是旧的。
    const [viewportHeight, setViewportHeight] = useState(
        () => (typeof window === 'undefined' ? 0 : window.innerHeight),
    );
    useEffect(() => {
        const syncHeight = () => setViewportHeight(window.innerHeight);
        syncHeight();
        window.addEventListener('resize', syncHeight);
        return () => window.removeEventListener('resize', syncHeight);
    }, []);
    const maxOffset = resolvePlayerBottomBarMaxOffset(viewportHeight);

    // 滑块和拖动改的是同一个值，所以这里也要同步推给 MotionValue，
    // 否则设置面板里拖滑块时播放页不会跟着动。
    const applyOffset = (next: number) => {
        handleSetPlayerBottomBarOffset(next);
        playerBottomBarLiveOffset.set(next);
    };

    // 原生 <select> 的弹层由浏览器画，吃不到 --text-primary 以外的主题变量，暗色主题下
    // 白底配浅色文字直接看不清。仓库里所有设置下拉都走 CustomSelect，这里跟上。
    const slotOptions = useMemo(
        () => PLAYER_CONTROL_SLOT_OPTIONS.map(option => ({ value: option.id, label: t(option.labelKey) })),
        [t],
    );

    const renderSlotPicker = (
        slot: 'primary' | 'secondary',
        value: PlayerControlSlotActionId,
        label: string,
    ) => (
        <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
            <span className="text-xs opacity-60" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <CustomSelect
                value={value}
                onChange={next => handleSetPlayerControlSlot(slot, next as PlayerControlSlotActionId)}
                options={slotOptions}
                ariaLabel={label}
                isDaylight={isDaylight}
                theme={theme}
            />
        </div>
    );

    return (
        <>
            <div className={`p-4 rounded-xl border space-y-3 ${settingsCardClass}`}>
                <div className="space-y-1">
                    <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Move size={14} />
                        {t('options.playerBottomBarOffset')}
                    </div>
                    <div className="text-xs opacity-50 max-w-[420px]" style={{ color: 'var(--text-secondary)' }}>
                        {t('options.playerBottomBarOffsetDesc')}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="range"
                        min={PLAYER_BOTTOM_BAR_BASE_OFFSET_PX}
                        max={maxOffset}
                        step={1}
                        value={Math.min(maxOffset, playerBottomBarOffset)}
                        onChange={(e) => applyOffset(Number(e.target.value))}
                        className={rangeInputClass}
                    />
                    <span className="w-14 text-right font-mono text-xs opacity-60" style={{ color: 'var(--text-secondary)' }}>
                        {Math.min(maxOffset, playerBottomBarOffset)}px
                    </span>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={requestPositioning}
                        disabled={!canStartPositioning}
                        title={canStartPositioning ? undefined : t('options.playerBottomBarRepositionUnavailable')}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors disabled:opacity-35 ${utilityGhostButtonClass}`}
                        style={{ color: 'var(--text-primary)' }}
                    >
                        <Move size={14} />
                        <span>{t('options.playerBottomBarReposition')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => applyOffset(PLAYER_BOTTOM_BAR_BASE_OFFSET_PX)}
                        disabled={playerBottomBarOffset === PLAYER_BOTTOM_BAR_BASE_OFFSET_PX}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors disabled:opacity-35 ${utilityGhostButtonClass}`}
                        style={{ color: 'var(--text-primary)' }}
                    >
                        <RotateCcw size={14} />
                        <span>{t('options.playerBottomBarReset')}</span>
                    </button>
                </div>
            </div>

            <div className={`p-4 rounded-xl border space-y-3 ${settingsCardClass}`}>
                <div className="space-y-1">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {t('options.playerControlSlots')}
                    </div>
                    <div className="text-xs opacity-50 max-w-[420px]" style={{ color: 'var(--text-secondary)' }}>
                        {t('options.playerControlSlotsDesc')}
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    {renderSlotPicker('primary', playerControlSlotPrimary, t('options.playerControlSlotPrimary'))}
                    {renderSlotPicker('secondary', playerControlSlotSecondary, t('options.playerControlSlotSecondary'))}
                </div>
            </div>
        </>
    );
};

export default PlayerBottomBarSection;
