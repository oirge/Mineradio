import { useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LocalActionsContext } from './LocalActionsContext';
import { localActionView, SLOT_ACTIONS } from './localCommandCatalog';
import { useLocalControlsStore } from './useLocalControlsStore';
import { localDocuments } from './localDocuments';
import './localControls.css';
import { useMobileMotion } from '../../hooks/useMobileMotion';
import { mobileMotionProps } from '../../utils/mobileMotion';

// src/mineradio/local/LocalControlSlot.tsx
// Mouse, touch and keyboard customization share the same swap-and-save operation.
function SlotMenu({ menuRef, index, position, children, onMenuChange }: {
    menuRef: RefObject<HTMLDivElement | null>; index: number; position: CSSProperties; children: ReactNode;
    onMenuChange?: (open: boolean) => void;
}) {
    const { t } = useTranslation('localPlayer');
    const { mobile, reducedMotion } = useMobileMotion();
    const present = useIsPresent();
    const change = useRef(onMenuChange);
    change.current = onMenuChange;
    useEffect(() => {
        change.current?.(true);
        return () => change.current?.(false);
    }, []);
    return <motion.div ref={menuRef} role="menu" aria-label={t('chooseButtonAction')}
        {...(mobile ? mobileMotionProps('menu', reducedMotion) : {})}
        inert={!present} aria-hidden={!present || undefined}
        data-mobile-motion-presence={mobile ? (present ? 'present' : 'exiting') : undefined}
        className="local-slot-menu" style={position} data-testid={`local-slot-menu-${index}`}>
        {children}
    </motion.div>;
}
export default function LocalControlSlot({ index, disabled = false, className = '', onMenuChange }: {
    index: 0 | 1; disabled?: boolean; className?: string; onMenuChange?: (open: boolean) => void;
}) {
    const { t } = useTranslation('localPlayer');
    const context = useContext(LocalActionsContext);
    const actionId = useLocalControlsStore(state => state.slots[index]);
    const assign = useLocalControlsStore(state => state.assign);
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<CSSProperties>({});
    const wrapper = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const suppressClick = useRef(false);
    const origin = useRef({ x: 0, y: 0 });
    const clear = () => { clearTimeout(timer.current); timer.current = undefined; };
    useEffect(() => clear, []);
    useEffect(() => {
        if (disabled) { clear(); suppressClick.current = false; setOpen(false); }
    }, [disabled]);
    useLayoutEffect(() => {
        if (!open || !button.current) return;
        const rect = button.current.getBoundingClientRect();
        setPosition({ position: 'fixed', bottom: window.innerHeight - rect.top + 10,
            left: Math.max(12, Math.min(rect.left, window.innerWidth - 242)), right: 'auto' });
    }, [open]);
    useEffect(() => {
        if (!open || disabled) return;
        const documents = localDocuments(), root = wrapper.current!;
        menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
        const outside = (event: PointerEvent) => {
            if (!event.composedPath().includes(root) && !event.composedPath().includes(menu.current!)) setOpen(false);
        };
        const resize = () => setOpen(false);
        const back = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); setOpen(false); };
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); }
            if (event.key === 'Tab') setOpen(false);
            if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const options = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
            const current = options.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
            options[next]?.focus();
        };
        documents.forEach(doc => { doc.addEventListener('pointerdown', outside); doc.addEventListener('keydown', key, true); });
        window.addEventListener('resize', resize);
        window.addEventListener('mineradio-mobile-back', back, true);
        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mineradio-mobile-back', back, true);
            documents.forEach(doc => { doc.removeEventListener('pointerdown', outside); doc.removeEventListener('keydown', key, true); });
            if (root.contains(document.activeElement) || menu.current?.contains(document.activeElement) || document.activeElement === document.body) button.current?.focus();
        };
    }, [open, disabled]);
    if (!context) return null;
    const action = localActionView(actionId, context.state), Icon = action.icon;
    return <div ref={wrapper} className={`local-control-slot ${className}`} data-slot={index}>
        <button ref={button} type="button" aria-label={t(action.label)} title={`${t(action.label)}\n${t('customizeButton')}`}
            aria-disabled={action.disabled || undefined} disabled={disabled} aria-haspopup="menu" aria-expanded={open}
            data-testid={actionId === 'mode' ? 'local-play-mode' : actionId === 'like' ? 'local-like' : `local-slot-${index}-action`}
            data-slot-action={actionId} className={action.active ? 'is-liked' : ''} aria-pressed={actionId === 'like' ? action.active : undefined}
            onContextMenu={event => { event.preventDefault(); event.stopPropagation(); clear(); setOpen(true); }}
            onKeyDown={event => {
                if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); setOpen(true); }
            }}
            onPointerDown={event => {
                if (event.button !== 0 || disabled) return;
                origin.current = { x: event.clientX, y: event.clientY };
                suppressClick.current = false; clear();
                timer.current = setTimeout(() => { suppressClick.current = true; setOpen(true); }, 500);
            }} onPointerMove={event => {
                if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 8) clear();
            }} onPointerUp={clear} onPointerLeave={clear} onPointerCancel={() => { clear(); suppressClick.current = false; }}
            onClick={event => {
                event.stopPropagation(); clear();
                if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); return; }
                if (!action.disabled) context.run(actionId);
            }}><Icon size={19} fill={actionId === 'like' && action.active ? 'currentColor' : 'none'} /></button>
        {createPortal(<AnimatePresence mode="sync">{open && !disabled && <SlotMenu key={`slot-${index}`} menuRef={menu} index={index} position={position} onMenuChange={onMenuChange}>
            <strong>{t('controlSlot', { count: index + 1 })}</strong>
            {SLOT_ACTIONS.map(item => { const view = localActionView(item.id, context.state), ActionIcon = view.icon;
                return <button key={item.id} type="button" role="menuitemradio" aria-checked={actionId === item.id}
                    data-action={item.id} onClick={event => { event.stopPropagation(); assign(index, item.id); setOpen(false); }}>
                    <ActionIcon size={16} /><span>{t(view.label)}</span></button>;
            })}
            <button type="button" onClick={() => { useLocalControlsStore.getState().reset(); setOpen(false); }}>{t('resetButtons')}</button>
        </SlotMenu>}</AnimatePresence>, wrapper.current?.closest('.local-player') ?? document.body)}
    </div>;
}
