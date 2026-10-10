import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// src/mineradio/local/LocalHeader.tsx
// Keep the live player controls in the desktop titlebar, with an in-frame fullscreen fallback.
function titlebarTarget(): HTMLElement | null {
    try {
        const host = window.parent.document;
        return host.body.classList.contains('desktop-shell') && !host.body.classList.contains('desktop-fullscreen')
            && !host.fullscreenElement ? host.getElementById('folia-titlebar-controls') : null;
    } catch { return null; }
}
interface Props {
    view: 'lyrics' | 'records' | 'posters';
    libraryOpen: boolean;
    settingsOpen: boolean;
    onView: (view: Props['view']) => void;
    onLibrary: () => void;
    onSettings: () => void;
    onFocus: () => void;
}
export default function LocalHeader({ view, libraryOpen, settingsOpen, onView, onLibrary, onSettings, onFocus }: Props) {
    const { t } = useTranslation('localPlayer');
    const [target, setTarget] = useState(titlebarTarget);
    useEffect(() => {
        try {
            const host = window.parent.document;
            const refresh = () => setTarget(titlebarTarget());
            const observer = new MutationObserver(refresh);
            observer.observe(host.body, { attributes: true, attributeFilter: ['class'] });
            host.addEventListener('fullscreenchange', refresh);
            refresh();
            return () => { observer.disconnect(); host.removeEventListener('fullscreenchange', refresh); };
        } catch { return; }
    }, []);
    const navigation = <nav aria-label={t('playbackView')} data-testid="local-navigation">
        <div className="local-view-switch" role="group" aria-label={t('playbackView')}>
            {(['lyrics', 'records', 'posters'] as const).map(value => <button type="button" key={value}
                data-testid={`local-view-${value}`} aria-pressed={view === value} onClick={() => onView(value)}>{t(`${value}View`)}</button>)}
        </div>
        <button type="button" aria-pressed={libraryOpen} data-testid="local-open-library" onClick={onLibrary}>{t('library')}</button>
        <button type="button" aria-pressed={settingsOpen} data-testid="local-open-settings" onClick={onSettings}>{t('effects')}</button>
        <button type="button" aria-label={t('focus')} title={t('focus')} onClick={onFocus}><Maximize2 size={16} /></button>
    </nav>;
    return target ? createPortal(navigation, target) : <header className="local-header">{navigation}</header>;
}
