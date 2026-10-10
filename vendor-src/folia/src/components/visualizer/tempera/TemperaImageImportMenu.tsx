import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Replace, Upload } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { TemperaDialogTokens } from './temperaDialogTokens';

// src/components/visualizer/tempera/TemperaImageImportMenu.tsx
// Keeps the two destructive meanings of backup import behind one anchored action menu.

interface TemperaImageImportMenuProps {
    disabled: boolean;
    appendDisabled: boolean;
    isDaylight: boolean;
    tokens: TemperaDialogTokens;
    t: TFunction;
    onChoose: (mode: 'append' | 'replace') => void;
}

const TemperaImageImportMenu: React.FC<TemperaImageImportMenuProps> = ({
    disabled,
    appendDisabled,
    isDaylight,
    tokens,
    t,
    onChoose,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (disabled) setIsOpen(false);
    }, [disabled]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const closeOnOutsideClick = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(false);
        };
        document.addEventListener('mousedown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [isOpen]);

    const choose = (mode: 'append' | 'replace') => {
        setIsOpen(false);
        onChoose(mode);
    };

    return (
        <div ref={rootRef} className="relative inline-flex">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(current => !current)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-35 disabled:hover:bg-transparent ${tokens.hoverSurfaceClass}`}
                style={{ color: tokens.textPrimary, borderColor: tokens.line }}
            >
                <Upload size={14} />
                {t('options.temperaImportImages') || '导入备份'}
                <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div
                    role="menu"
                    className="absolute bottom-full left-0 z-30 mb-2 w-52 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-xl"
                    style={{
                        color: tokens.textPrimary,
                        borderColor: tokens.line,
                        backgroundColor: isDaylight ? 'rgba(255,255,255,0.98)' : 'rgba(24,24,27,0.98)',
                    }}
                >
                    <button
                        type="button"
                        role="menuitem"
                        disabled={appendDisabled}
                        onClick={() => choose('append')}
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors disabled:opacity-35 disabled:hover:bg-transparent ${tokens.hoverSurfaceClass}`}
                    >
                        <Plus size={14} className="shrink-0" />
                        {t('options.temperaImportAppendImages') || '追加到当前图片池'}
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => choose('replace')}
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors ${tokens.hoverSurfaceClass}`}
                    >
                        <Replace size={14} className="shrink-0" />
                        {t('options.temperaImportReplaceImages') || '替换当前图片池'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default TemperaImageImportMenu;
