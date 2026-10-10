import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useThemeSettingsStore } from '../../stores/useThemeSettingsStore';
import { useStageSettingsStore } from '../../stores/useStageSettingsStore';

type ObsThemeMode = 'static' | 'builtin' | 'ai';

interface ObsCopyUrlButtonProps {
    // Copies the OBS URL for the currently selected mode (the handler reads webObsThemeMode from the store).
    onCopy: () => void | Promise<void>;
    copied: boolean;
    disabled?: boolean;
    // Padding/sizing for the primary button so it fits its surrounding context (header vs button row).
    buttonClassName?: string;
}

// Rough menu size used to decide the open direction and clamp its width.
const MENU_ESTIMATED_HEIGHT = 150;
const MENU_WIDTH = 224; // w-56

// Split button (obs-endpoint-enhance): a primary "copy OBS URL" action plus a ▾ dropdown to pick the
// theme mode (static / builtin / ai). The dropdown is a pure selector — it only sets the mode; copying
// is the primary button's job. Each mode's behavior shows on hover (title). The menu renders in a
// portal with fixed positioning so it escapes the settings modal's overflow clipping (an absolutely
// positioned menu got cut off near the panel edge); open direction and coordinates come from the live
// trigger rect, kept fresh on scroll/resize while open.
export const ObsCopyUrlButton: React.FC<ObsCopyUrlButtonProps> = ({ onCopy, copied, disabled, buttonClassName }) => {
    const { t } = useTranslation();
    const mode = useStageSettingsStore((s) => s.webObsThemeMode);
    const setMode = useStageSettingsStore((s) => s.setWebObsThemeMode);
    const isDaylight = useThemeSettingsStore((s) => s.isDaylight);
    const [open, setOpen] = useState(false);
    const [openUp, setOpenUp] = useState(false);
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const measure = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const spaceBelow = window.innerHeight - rect.bottom;
        setOpenUp(spaceBelow < MENU_ESTIMATED_HEIGHT && rect.top > spaceBelow);
        setTriggerRect(rect);
    };

    useEffect(() => {
        if (!open) return undefined;
        const onDocMouseDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        // The trigger sits in a scrollable modal, so keep the fixed-position menu pinned to it.
        const reposition = () => measure();
        document.addEventListener('mousedown', onDocMouseDown);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return () => {
            document.removeEventListener('mousedown', onDocMouseDown);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        };
    }, [open]);

    const options: Array<{ value: ObsThemeMode; label: string; hint: string }> = [
        { value: 'static', label: t('options.obsThemeModeStatic'), hint: t('options.obsThemeModeStaticHint') },
        { value: 'builtin', label: t('options.obsThemeModeBuiltin'), hint: t('options.obsThemeModeBuiltinHint') },
        { value: 'ai', label: t('options.obsThemeModeAi'), hint: t('options.obsThemeModeAiHint') },
    ];
    const current = options.find((o) => o.value === mode) ?? options[1];

    const toggleMenu = () => {
        if (open) { setOpen(false); return; }
        measure();
        setOpen(true);
    };

    const pick = (value: ObsThemeMode) => {
        setMode(value); // select only — copying is the primary button's job
        setOpen(false);
    };

    const baseBtn = 'text-xs font-medium flex items-center gap-1.5 bg-white/10 hover:bg-white/15 active:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
    const menuBg = isDaylight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(24, 24, 27, 0.98)';
    const menuBorder = isDaylight ? 'rgba(24, 24, 27, 0.12)' : 'rgba(255, 255, 255, 0.12)';
    // Match the trigger's live width so the menu visually anchors to the split button; fall back to
    // the estimated width only if we somehow render without a measured rect. Cap at 80vw for safety.
    const viewportCap = typeof window !== 'undefined' ? window.innerWidth * 0.8 : MENU_WIDTH;
    const menuWidth = Math.min(triggerRect?.width ?? MENU_WIDTH, viewportCap);

    return (
        <div ref={containerRef} className="relative inline-flex items-stretch">
            <button
                type="button"
                onClick={() => void onCopy()}
                disabled={disabled}
                title={`${current.label} — ${current.hint}`}
                className={`${baseBtn} rounded-l-lg ${buttonClassName ?? 'px-3 py-2'}`}
                style={{ color: copied ? '#86efac' : 'var(--text-primary)' }}
            >
                {copied ? <Check size={13} className="shrink-0" /> : <Copy size={13} className="shrink-0" />}
                {/* Reserve the copy label's width so switching to "copied" never resizes the button.
                    In the flex-wrap button row that resize would flip whether this button wraps to the
                    next line, jumping the whole group. The label (with the mode) stays as an invisible
                    width holder and "copied" is overlaid centered. */}
                <span className="relative inline-flex items-center whitespace-nowrap">
                    <span className={copied ? 'invisible' : undefined}>{`${t('options.copyObsUrl')} | ${current.label}`}</span>
                    {copied && <span className="absolute inset-0 flex items-center justify-center">{t('status.copied')}</span>}
                </span>
            </button>
            <button
                type="button"
                onClick={toggleMenu}
                disabled={disabled}
                aria-label={t('options.obsThemeMode')}
                title={t('options.obsThemeMode')}
                className={`${baseBtn} rounded-r-lg px-1.5 border-l border-black/20`}
                style={{ color: 'var(--text-primary)' }}
            >
                <ChevronDown size={13} />
            </button>
            {open && triggerRect && createPortal(
                <div
                    ref={menuRef}
                    className="rounded-xl border p-1 shadow-xl"
                    style={{
                        position: 'fixed',
                        left: Math.max(8, triggerRect.right - menuWidth),
                        width: menuWidth,
                        ...(openUp
                            ? { bottom: window.innerHeight - triggerRect.top + 4 }
                            : { top: triggerRect.bottom + 4 }),
                        zIndex: 1000,
                        backgroundColor: menuBg,
                        borderColor: menuBorder,
                    }}
                >
                    {options.map((o) => {
                        const selected = o.value === mode;
                        return (
                            <button
                                key={o.value}
                                type="button"
                                onClick={() => pick(o.value)}
                                title={o.hint}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                <Check size={13} className="shrink-0" style={{ opacity: selected ? 1 : 0 }} />
                                <span className="text-xs font-medium">{o.label}</span>
                            </button>
                        );
                    })}
                </div>,
                document.body,
            )}
        </div>
    );
};
