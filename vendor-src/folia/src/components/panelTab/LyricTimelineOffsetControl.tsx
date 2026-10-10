import React from 'react';
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDebouncedFocusSync } from '../../hooks/useDebouncedFocusSync';

// src/components/panelTab/LyricTimelineOffsetControl.tsx

type LyricTimelineOffsetControlProps = {
    offsetMs: number;
    onOffsetChange: (offsetMs: number) => void;
    isDaylight: boolean;
};

const STEP_MS = 250;


const LyricTimelineOffsetControl: React.FC<LyricTimelineOffsetControlProps> = ({
    offsetMs,
    onOffsetChange,
    isDaylight,
}) => {
    const { t } = useTranslation();
    const [localOffsetMs, setLocalOffsetMs] = useDebouncedFocusSync(offsetMs, onOffsetChange, 20);
    const [inputValue, setInputValue] = React.useState(localOffsetMs.toString());

    React.useEffect(() => {
        setInputValue(localOffsetMs.toString());
    }, [localOffsetMs]);

    const buttonHover = isDaylight ? 'hover:bg-black/10 active:bg-black/15' : 'hover:bg-white/10 active:bg-white/15';

    return (
        <div className="flex items-center justify-between md:pr-8">
            <div className="flex shrink-0 items-center gap-1">
                <label className="text-[11px] font-semibold opacity-50 uppercase tracking-wider">
                    {t('localMusic.lyricTimelineOffset')}
                </label>
                {localOffsetMs !== 0 && (
                    <button
                        type="button"
                        onClick={() => setLocalOffsetMs(0)}
                        className={`rounded-md p-1 opacity-80 transition-colors ${isDaylight ? 'hover:bg-black/10' : 'hover:bg-white/10'}`}
                        title={t('localMusic.resetLyricTimelineOffset')}
                    >
                        <RotateCcw size={12} />
                    </button>
                )}
            </div>
            <div className="flex items-center">
                <button
                    type="button"
                    onClick={() => setLocalOffsetMs(localOffsetMs - STEP_MS)}
                    className={`p-1 rounded-md transition-colors opacity-70 hover:opacity-100 ${buttonHover}`}
                    title="-250ms"
                >
                    <ChevronLeft size={14} />
                </button>

                <div className="mx-0.5 flex w-16 items-center justify-center bg-transparent">
                    <input
                        type="number"
                        step={STEP_MS}
                        value={inputValue}
                        onChange={(event) => {
                            const val = event.target.value;
                            setInputValue(val);
                            if (val === '' || val === '-') {
                                return;
                            }
                            const parsed = Number.parseInt(val, 10);
                            if (Number.isFinite(parsed)) {
                                setLocalOffsetMs(parsed);
                            }
                        }}
                        className="w-10 min-w-0 bg-transparent py-0.5 text-right text-xs font-mono outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        aria-label={t('localMusic.lyricTimelineOffset')}
                    />
                    <span className="text-[10px] opacity-50 ml-0.5 font-mono">ms</span>
                </div>

                <button
                    type="button"
                    onClick={() => setLocalOffsetMs(localOffsetMs + STEP_MS)}
                    className={`p-1 rounded-md transition-colors opacity-70 hover:opacity-100 ${buttonHover}`}
                    title="+250ms"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
};

export default LyricTimelineOffsetControl;
