import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { List, type RowComponentProps } from 'react-window';

// CustomSelectMenu.tsx
// Renders the viewport-anchored option menu used by CustomSelect.
//
// 选项超过 VIRTUALIZE_THRESHOLD 时改走 react-window。命令面板的固定命令设置和自定义快捷键
// 选择器各要铺约 125 条命令，是仓库里最长的两个下拉；其余三十来个下拉只有 2-8 项，走原来的
// 分支，标记逐字不变，不承担任何风险。
//
// 高度策略：**不引入任何新测量**。虚拟化分支消费的是 CustomSelect.updateDropdownPosition
// 已经算好的 position.maxHeight（开合与 resize/scroll 时更新），只是把它减去内边距当成列表高度。

export interface CustomSelectOption {
    value: string;
    label: string;
}

export interface CustomSelectMenuPosition {
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
    placement: 'top' | 'bottom' | 'viewport';
}

interface CustomSelectMenuProps {
    menuRef: React.RefObject<HTMLDivElement | null>;
    position: CustomSelectMenuPosition;
    options: CustomSelectOption[];
    value: string;
    ariaLabel?: string;
    isDaylight: boolean;
    accentColor: string;
    textColor: string;
    borderColor: string;
    onSelect: (value: string) => void;
}

const VIRTUALIZE_THRESHOLD = 24;
/** px-3 py-2.5 text-sm：10 + 20 + 10。 */
const OPTION_ROW_HEIGHT = 40;
/** 对应 space-y-0.5。虚拟化分支里改成行容器的下内边距，视觉一致。 */
const OPTION_ROW_GAP = 2;
/** p-1.5，上下各 6。 */
const MENU_PADDING = 12;

type OptionRowProps = {
    options: CustomSelectOption[];
    value: string;
    isDaylight: boolean;
    accentColor: string;
    textColor: string;
    onSelect: (value: string) => void;
};

const optionBackground = (isSelected: boolean, isDaylight: boolean, accentColor: string) => (
    isSelected ? (isDaylight ? `${accentColor}12` : `${accentColor}18`) : 'transparent'
);

const OptionButton: React.FC<{
    option: CustomSelectOption;
    isSelected: boolean;
    isDaylight: boolean;
    accentColor: string;
    textColor: string;
    fixedHeight?: number;
    onSelect: (value: string) => void;
}> = ({ option, isSelected, isDaylight, accentColor, textColor, fixedHeight, onSelect }) => (
    <button
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={() => onSelect(option.value)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors text-left cursor-pointer"
        style={{
            color: textColor,
            backgroundColor: optionBackground(isSelected, isDaylight, accentColor),
            ...(fixedHeight ? { height: fixedHeight, paddingTop: 0, paddingBottom: 0 } : {}),
        }}
        onMouseEnter={(event) => {
            if (!isSelected) {
                event.currentTarget.style.backgroundColor = isDaylight
                    ? 'rgba(0, 0, 0, 0.04)'
                    : 'rgba(255, 255, 255, 0.06)';
            }
        }}
        onMouseLeave={(event) => {
            if (!isSelected) {
                event.currentTarget.style.backgroundColor = 'transparent';
            }
        }}
    >
        <span className="truncate mr-2">{option.label}</span>
        {isSelected && (
            <Check
                size={14}
                className="shrink-0"
                style={{ color: accentColor }}
            />
        )}
    </button>
);

const CustomSelectMenuRow = ({
    index,
    style,
    options,
    value,
    isDaylight,
    accentColor,
    textColor,
    onSelect,
}: RowComponentProps<OptionRowProps>): React.ReactElement | null => {
    const option = options[index];
    if (!option) {
        return null;
    }

    return (
        <div style={{ ...style, paddingBottom: OPTION_ROW_GAP }}>
            <OptionButton
                option={option}
                isSelected={option.value === value}
                isDaylight={isDaylight}
                accentColor={accentColor}
                textColor={textColor}
                fixedHeight={OPTION_ROW_HEIGHT}
                onSelect={onSelect}
            />
        </div>
    );
};

export const CustomSelectMenu: React.FC<CustomSelectMenuProps> = ({
    menuRef,
    position,
    options,
    value,
    ariaLabel,
    isDaylight,
    accentColor,
    textColor,
    borderColor,
    onSelect,
}) => {
    const isVirtualized = options.length >= VIRTUALIZE_THRESHOLD;

    const rowProps = useMemo(() => ({
        options,
        value,
        isDaylight,
        accentColor,
        textColor,
        onSelect,
    }), [options, value, isDaylight, accentColor, textColor, onSelect]);

    const listHeight = Math.max(
        OPTION_ROW_HEIGHT,
        Math.min(
            position.maxHeight - MENU_PADDING,
            options.length * (OPTION_ROW_HEIGHT + OPTION_ROW_GAP) - OPTION_ROW_GAP,
        ),
    );

    return (
        <motion.div
            ref={menuRef}
            initial={{
                opacity: 0,
                y: position.placement === 'top' ? 8 : -8,
                scale: 0.96,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
                opacity: 0,
                y: position.placement === 'top' ? 8 : -8,
                scale: 0.96,
            }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`fixed z-[200] rounded-xl border shadow-xl overscroll-contain backdrop-blur-md custom-scrollbar${isVirtualized ? '' : ' overflow-y-auto'}`}
            data-wheel-scroll-region
            role="listbox"
            aria-label={ariaLabel}
            style={{
                left: position.left,
                top: position.top,
                bottom: position.bottom,
                width: position.width,
                maxHeight: position.maxHeight,
                backgroundColor: isDaylight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(24, 24, 27, 0.96)',
                borderColor,
                color: textColor,
            }}
        >
            {isVirtualized ? (
                <div className="p-1.5">
                    <List
                        rowCount={options.length}
                        rowHeight={OPTION_ROW_HEIGHT + OPTION_ROW_GAP}
                        rowComponent={CustomSelectMenuRow}
                        rowProps={rowProps}
                        overscanCount={4}
                        className="custom-scrollbar"
                        style={{ height: listHeight, width: '100%' }}
                    />
                </div>
            ) : (
                <div className="p-1.5 space-y-0.5">
                    {options.map((option) => (
                        <OptionButton
                            key={option.value}
                            option={option}
                            isSelected={option.value === value}
                            isDaylight={isDaylight}
                            accentColor={accentColor}
                            textColor={textColor}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </motion.div>
    );
};
