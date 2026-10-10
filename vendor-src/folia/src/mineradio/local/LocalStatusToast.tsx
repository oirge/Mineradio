import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStatusMessageStore } from '../../stores/useStatusMessageStore';

// src/mineradio/local/LocalStatusToast.tsx
// Preserve feedback from the upstream image import and tuning panels.
export default function LocalStatusToast() {
    const { t } = useTranslation('localPlayer');
    const { message, setMessage } = useStatusMessageStore();
    useEffect(() => {
        if (!message || message.durationMs === 0) return;
        const timer = window.setTimeout(() => setMessage(current => current === message ? null : current), message.durationMs ?? 4500);
        return () => window.clearTimeout(timer);
    }, [message, setMessage]);
    return message ? <div className="local-error" role={message.type === 'error' ? 'alert' : 'status'}>
        <span>{message.text}</span><button aria-label={t('close')} onClick={() => setMessage(null)}><X size={16} /></button>
    </div> : null;
}
