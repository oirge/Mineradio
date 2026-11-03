import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localDocuments } from './localDocuments';
import './localTools.css';

// src/mineradio/local/LocalToolPanel.tsx
// One dialog lifecycle for command, subtitle and audio tools, including titlebar portal focus.
export default function LocalToolPanel({ id, title, onClose, children, initialFocus, wide = false }: {
    id: string; title: string; onClose: () => void; children: ReactNode; initialFocus?: string; wide?: boolean;
}) {
    const { t } = useTranslation('localPlayer');
    const panel = useRef<HTMLElement>(null);
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const documents = localDocuments();
        const focusedDocuments = documents.filter(doc => doc.hasFocus());
        const previous = (focusedDocuments.length ? focusedDocuments : documents).map(doc => doc.activeElement).find(node => node && typeof (node as HTMLElement).focus === 'function'
            && node.tagName !== 'BODY' && node.tagName !== 'IFRAME') as HTMLElement | undefined;
        const node = panel.current!;
        (initialFocus ? node.querySelector<HTMLElement>(initialFocus) : node.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
            if (event.key !== 'Tab') return;
            const controls = Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'))
                .filter(control => control.getClientRects().length > 0);
            const first = controls[0], last = controls.at(-1), active = document.activeElement;
            if (!first) { event.preventDefault(); return; }
            if (event.shiftKey && (active === first || !node.contains(active))) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && (active === last || !node.contains(active))) { event.preventDefault(); first.focus(); }
        };
        const outside = (event: PointerEvent) => {
            if (event.composedPath().some(target => typeof (target as Element).closest === 'function' && (target as Element).closest('[data-testid="local-navigation"]'))) return;
            if (!event.composedPath().includes(node)) close.current();
        };
        documents.forEach(doc => { doc.addEventListener('keydown', key, true); doc.addEventListener('pointerdown', outside); });
        return () => {
            documents.forEach(doc => { doc.removeEventListener('keydown', key, true); doc.removeEventListener('pointerdown', outside); });
            if (document.hasFocus() && previous?.isConnected && (node.contains(document.activeElement) || document.activeElement === document.body)) previous.focus({ preventScroll: true });
        };
    }, [initialFocus, id]);
    return <aside ref={panel} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
        className={`local-tool-panel local-glass ${wide ? 'is-wide' : ''}`} data-testid={id}>
        <div className="local-panel-title"><strong id={`${id}-title`}>{title}</strong>
            <button type="button" aria-label={t('close')} onClick={onClose}><X size={17} /></button></div>
        <div className="local-tool-content">{children}</div>
    </aside>;
}
