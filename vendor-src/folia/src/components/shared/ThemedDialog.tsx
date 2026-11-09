import React, { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { X } from 'lucide-react';
import { useMobileMotion } from '../../hooks/useMobileMotion';
import { overlayBackdropMotionFor, overlayPanelMotionFor } from './overlayEntranceMotion';

// src/components/shared/ThemedDialog.tsx

interface ThemedDialogProps {
    isOpen: boolean;
    onClose: () => void;
    isDaylight?: boolean;
    title: string;
    description?: string;
    headerActions?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidthClass?: string;
    /**
     * Blocks the two close paths this dialog owns - the X and the backdrop - while the caller is
     * mid-way through work a close would leave half-applied. Also dims the X so the wait shows:
     * a caller wrapping `onClose` instead would leave it looking live while it does nothing.
     */
    closeDisabled?: boolean;
    /** Native `title` for the dimmed X, naming the run that has to finish before closing. */
    closeDisabledTitle?: string;
}

const ThemedDialogSurface: React.FC<Omit<ThemedDialogProps, 'isOpen'>> = ({
    onClose,
    isDaylight = false,
    title,
    description,
    headerActions,
    children,
    footer,
    maxWidthClass = 'max-w-md',
    closeDisabled = false,
    closeDisabledTitle,
}) => {
    const { mobile, reducedMotion } = useMobileMotion();
    const present = useIsPresent();
    const panel = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const close = useRef({ onClose, closeDisabled });
    close.current = { onClose, closeDisabled };
    const bgClass = isDaylight ? 'bg-white/90 border-white/30' : 'bg-zinc-900/95 border-white/10';
    const textPrimary = isDaylight ? 'text-zinc-900' : 'text-white';
    const textSecondary = isDaylight ? 'text-zinc-500' : 'text-zinc-400';
    const closeBtnHover = isDaylight ? 'hover:bg-zinc-200/60' : 'hover:bg-white/10';
    const isMouseDownOnOverlayRef = useRef(false);
    useEffect(() => {
        if (!mobile || !present) return;
        const previous = document.activeElement as HTMLElement | null;
        const node = panel.current!;
        if (!node.contains(document.activeElement)) node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
        const hasSelectionMenu = () => document.querySelector('[role="listbox"][data-mobile-motion-presence="present"]') !== null;
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (hasSelectionMenu()) return;
                event.preventDefault(); event.stopPropagation();
                if (!close.current.closeDisabled) close.current.onClose();
                return;
            }
            if (event.key !== 'Tab') return;
            const controls = Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'))
                .filter(control => control.getClientRects().length > 0);
            const first = controls[0], last = controls.at(-1), active = document.activeElement;
            if (!first) { event.preventDefault(); return; }
            if (event.shiftKey && (active === first || !node.contains(active))) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && (active === last || !node.contains(active))) { event.preventDefault(); first.focus(); }
        };
        const back = (event: Event) => {
            if (hasSelectionMenu()) return;
            event.preventDefault(); event.stopImmediatePropagation();
            if (!close.current.closeDisabled) close.current.onClose();
        };
        window.addEventListener('keydown', key, true);
        window.addEventListener('mineradio-mobile-back', back, true);
        return () => {
            window.removeEventListener('keydown', key, true);
            window.removeEventListener('mineradio-mobile-back', back, true);
            if (previous?.isConnected && (node.contains(document.activeElement) || document.activeElement === document.body)) previous.focus({ preventScroll: true });
        };
    }, [mobile, present]);

    const handleOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        isMouseDownOnOverlayRef.current = event.target === event.currentTarget;
    };

    const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (closeDisabled) return;
        if (event.target === event.currentTarget && isMouseDownOnOverlayRef.current) {
            onClose();
        }
    };

    return (
                <motion.div
                    {...overlayBackdropMotionFor(reducedMotion, mobile)}
                    inert={!present} aria-hidden={!present || undefined}
                    data-mobile-motion-presence={mobile ? (present ? 'present' : 'exiting') : undefined}
                    data-folia-keyboard-window="true"
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
                    onMouseDown={handleOverlayMouseDown}
                    onClick={handleBackdropClick}
                >
                    <motion.div
                        ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}
                        {...(mobile ? overlayPanelMotionFor(reducedMotion, true) : {
                            initial: { scale: 0.94, opacity: 0 }, animate: { scale: 1, opacity: 1 },
                            exit: { scale: 0.94, opacity: 0 }, transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
                        })}
                        onClick={(event) => event.stopPropagation()}
                        className={`relative w-full ${maxWidthClass} rounded-3xl border ${bgClass} p-6 shadow-2xl backdrop-blur-sm`}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={closeDisabled}
                            title={closeDisabled ? closeDisabledTitle : undefined}
                            className={`absolute right-4 top-4 rounded-full p-2 transition-colors ${closeDisabled ? 'opacity-20' : `opacity-50 hover:opacity-100 ${closeBtnHover}`} ${textPrimary}`}
                        >
                            <X size={18} />
                        </button>

                        <div className="mb-5 pr-10">
                            <div className="flex items-center justify-between gap-3">
                                <h2 id={titleId} className={`min-w-0 text-xl font-bold ${textPrimary}`}>{title}</h2>
                                {headerActions && (
                                    <div className="shrink-0">{headerActions}</div>
                                )}
                            </div>
                            {description && (
                                // pre-line so a description can break where its meaning does rather
                                // than wherever the width happens to run out.
                                <p className={`mt-2 whitespace-pre-line text-sm ${textSecondary}`}>{description}</p>
                            )}
                        </div>

                        <div>{children}</div>

                        {footer && (
                            <div className="mt-5 flex items-center justify-end gap-3">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
    );
};

const ThemedDialog: React.FC<ThemedDialogProps> = ({ isOpen, ...props }) => (
    <AnimatePresence>{isOpen && <ThemedDialogSurface key="dialog" {...props} />}</AnimatePresence>
);

export default ThemedDialog;
