import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Heart, Trash2, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlayerState } from '../../types';

interface FmTabProps {
    playerState: PlayerState;
    modeLabel: string;
    /** Absent when the active provider has no FM modes, which hides the entry entirely. */
    onOpenModePicker?: () => void;
    onTogglePlay: () => void;
    onNextTrack: () => void;
    onPrevTrack: () => void;
    onTrash: () => void;
    onLike: () => void;
    isLiked: boolean;
    likeDisabled?: boolean;
    likeDisabledReason?: string;
    isDaylight?: boolean;
    primaryColor?: string;
}

const FmTab: React.FC<FmTabProps> = ({
    playerState,
    modeLabel,
    onOpenModePicker,
    onTogglePlay,
    onNextTrack,
    onPrevTrack,
    onTrash,
    onLike,
    isLiked,
    likeDisabled = false,
    likeDisabledReason,
    isDaylight = false,
    primaryColor = 'var(--text-primary)'
}) => {
    const { t } = useTranslation();
    const btnBg = isDaylight ? 'bg-black/5 hover:bg-black/10 text-black/80' : 'bg-white/10 hover:bg-white/20 text-white/80';
    const mainBtnBg = isDaylight ? 'bg-black/90 text-white hover:scale-105 transition-all' : 'bg-white text-black hover:scale-105 transition-all';

    return (
        <div className="flex flex-col items-center justify-center p-6 space-y-6 h-full min-h-[160px]">
            {/* Opens the command palette's FM mode picker: the same surface the palette offers, so
                the mode lives in one place instead of being reimplemented inside the panel. */}
            {onOpenModePicker && (
                <button
                    onClick={onOpenModePicker}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${btnBg}`}
                    title={t('personalFmMode.openPicker', 'Switch the Personal FM mode')}
                >
                    <Radio size={13} />
                    <span>{modeLabel}</span>
                </button>
            )}

            <div className="flex items-center justify-center gap-6 w-full max-w-sm">

                {/* Previous (Disabled by default typically for FM, but requested) */}
                <button
                    onClick={onPrevTrack}
                    className={`p-3 rounded-full transition-colors opacity-50 hover:opacity-100 ${btnBg}`}
                    title={t('ui.previousTrack')}
                >
                    <SkipBack size={24} />
                </button>

                {/* Play/Pause Main Button */}
                <button
                    onClick={onTogglePlay}
                    className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl ${mainBtnBg}`}
                    style={!isDaylight ? { backgroundColor: primaryColor, color: 'var(--bg-color)' } : {}}
                    title={playerState === PlayerState.PLAYING ? t('player.pause') : t('player.play')}
                >
                    {playerState === PlayerState.PLAYING ? (
                        <Pause size={28} fill="currentColor" />
                    ) : (
                        <Play size={28} fill="currentColor" className="ml-1" />
                    )}
                </button>

                {/* Next Button */}
                <button
                    onClick={onNextTrack}
                    className={`p-3 rounded-full transition-colors opacity-50 hover:opacity-100 ${btnBg}`}
                    title={t('ui.nextTrack')}
                >
                    <SkipForward size={24} />
                </button>
            </div>

            {/* Secondary Actions Row */}
            <div className="flex items-center justify-center gap-10 mt-6 w-full">
                {/* Trash Button */}
                <button
                    onClick={onTrash}
                    className={`flex flex-col items-center gap-2 group opacity-50 hover:opacity-100 transition-opacity`}
                    title={t('ui.trashDislike')}
                    style={{ color: 'var(--text-primary)' }}
                >
                    <div className={`p-3 rounded-full transition-colors ${btnBg} group-hover:bg-red-500/20 group-hover:text-red-500`}>
                        <Trash2 size={24} />
                    </div>
                </button>

                {/* Like Button */}
                <button
                    onClick={onLike}
                    disabled={likeDisabled}
                    className={`flex flex-col items-center gap-2 group transition-opacity ${isLiked ? 'opacity-100' : 'opacity-50 hover:opacity-100'} disabled:cursor-not-allowed disabled:opacity-30`}
                    title={likeDisabledReason || (isLiked ? t('player.unlike') : t('player.like'))}
                    aria-label={likeDisabledReason || (isLiked ? t('player.unlike') : t('player.like'))}
                    style={{ color: isLiked ? '#ef4444' : 'var(--text-primary)' }}
                >
                    <div className={`p-3 rounded-full transition-colors ${btnBg} ${isLiked ? 'bg-red-500/20' : ''}`}>
                        <Heart size={24} fill={isLiked ? '#ef4444' : 'transparent'} className={isLiked ? 'text-red-500' : ''} />
                    </div>
                </button>
            </div>
        </div>
    );
};

export default FmTab;
