import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

// Anchored quick picker shared by compact effect controls in the player panel.

interface QuickEffectPickerOption<Value extends string> {
    value: Value;
    label: string;
}

interface QuickEffectPickerProps<Value extends string> {
    value: Value;
    options: QuickEffectPickerOption<Value>[];
    onChange: (value: Value) => void;
    isDaylight: boolean;
    primaryColor: string;
    ariaLabel: string;
    /** 自定义触发器，省略时使用默认的文字胶囊。 */
    renderTrigger?: (state: { isOpen: boolean; toggle: () => void; selectedLabel: string; }) => React.ReactNode;
    /** 列表项前缀，用于放模式字形。 */
    renderOptionPrefix?: (value: Value) => React.ReactNode;
    /** 列表底部的次级入口，替代原来重复的齿轮按钮。 */
    footerAction?: { label: string; onSelect: () => void; };
}

const QuickEffectPicker = <Value extends string>({
    value,
    options,
    onChange,
    isDaylight,
    primaryColor,
    ariaLabel,
    renderTrigger,
    renderOptionPrefix,
    footerAction,
}: QuickEffectPickerProps<Value>) => {
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(option => option.value === value) ?? options[0];

    useEffect(() => {
        if (!isOpen) return undefined;

        const handlePointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isOpen]);

    const selectOption = (nextValue: Value) => {
        onChange(nextValue);
        setIsOpen(false);
    };

    const toggleOpen = () => setIsOpen(prev => !prev);

    return (
        <div ref={pickerRef} className="relative">
            {renderTrigger ? renderTrigger({
                isOpen,
                toggle: toggleOpen,
                selectedLabel: selectedOption?.label ?? value,
            }) : (
                <button
                    type="button"
                    onClick={toggleOpen}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${isDaylight ? 'bg-white shadow-sm hover:bg-white/90' : 'bg-white/20 shadow-sm hover:bg-white/30'}`}
                    style={isOpen ? { color: primaryColor } : undefined}
                    aria-label={ariaLabel}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                >
                    {selectedOption?.label ?? value}
                </button>
            )}

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, x: -12, y: '-50%' }}
                        animate={{ opacity: 1, scale: 1, x: 0, y: '-50%' }}
                        exit={{ opacity: 0, scale: 0.97, x: -8, y: '-50%' }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className={`absolute right-0 top-1/2 z-20 ${renderOptionPrefix ? 'w-[8.5rem]' : 'w-[7.25rem]'} overflow-hidden rounded-[1.15rem] border shadow-2xl ${isDaylight ? 'border-black/[0.08] text-black' : 'border-white/[0.08] text-white'}`}
                        style={{
                            boxShadow: isDaylight
                                ? '0 18px 44px rgba(15, 23, 42, 0.14)'
                                : '0 22px 60px rgba(0, 0, 0, 0.42)',
                            backgroundColor: isDaylight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(0, 0, 0, 0.94)',
                        }}
                    >
                        <div
                            className="visualizer-overlay-scrollbar max-h-[11.25rem] overflow-y-auto px-1.5 py-1.5 pr-1.5"
                            style={{
                                ['--scrollbar-thumb-color' as string]: isDaylight ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.22)',
                                ['--scrollbar-thumb-hover-color' as string]: isDaylight ? 'rgba(0, 0, 0, 0.28)' : 'rgba(255, 255, 255, 0.35)',
                            }}
                            role="listbox"
                            aria-label={ariaLabel}
                        >
                            <div className="relative space-y-0.5">
                                {options.map(option => {
                                    const isActive = option.value === value;
                                    const prefix = renderOptionPrefix?.(option.value);
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => selectOption(option.value)}
                                            className={`relative flex w-full items-center rounded-[0.85rem] px-2 transition-all ${prefix ? 'gap-2 justify-start text-left' : 'justify-center text-center'} ${isActive ? 'py-1.5' : `py-2.5 ${isDaylight ? 'hover:bg-black/[0.04]' : 'hover:bg-white/[0.04]'}`}`}
                                            style={isActive ? {
                                                backgroundColor: isDaylight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)',
                                                color: primaryColor,
                                            } : undefined}
                                            role="option"
                                            aria-selected={isActive}
                                        >
                                            {prefix ? (
                                                <span
                                                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center"
                                                    style={{ color: primaryColor, opacity: isActive ? 1 : 0.55 }}
                                                >
                                                    {prefix}
                                                </span>
                                            ) : isActive && (
                                                <span
                                                    className="absolute left-2 h-1.5 w-1.5 rounded-full"
                                                    style={{
                                                        backgroundColor: isDaylight ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.88)',
                                                        boxShadow: isDaylight
                                                            ? '0 0 0 1px rgba(255,255,255,0.55)'
                                                            : '0 0 0 1px rgba(255,255,255,0.18)',
                                                    }}
                                                />
                                            )}
                                            <span className={`text-[9px] tracking-[0.01em] ${isActive ? 'font-medium' : 'font-normal'} ${isDaylight ? 'text-black/82' : 'text-white/84'}`} style={{ color: primaryColor }}>
                                                {option.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {footerAction && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    footerAction.onSelect();
                                }}
                                className={`flex w-full items-center justify-between gap-2 border-t px-3 py-2 text-[9px] transition-colors ${isDaylight ? 'border-black/[0.08] hover:bg-black/[0.04]' : 'border-white/[0.08] hover:bg-white/[0.04]'}`}
                                style={{ color: primaryColor }}
                            >
                                <span className="opacity-70">{footerAction.label}</span>
                                <ChevronRight size={11} className="opacity-55" />
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default QuickEffectPicker;
