import { createContext, useContext } from 'react';
import { ListMusic, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HostState } from '../client';
import type { LocalPlayer } from './playerTypes';

// src/mineradio/local/LocalLatticeExtraControls.tsx
// The original card chrome keeps its layout; only the actions come from Mineradio.
export const LocalLatticeActionsContext = createContext<{
    state: HostState | null;
    command: LocalPlayer['command'];
    onOpenQueue: () => void;
} | null>(null);

export default function LocalLatticeExtraControls({ disabled }: { disabled: boolean }) {
    const context = useContext(LocalLatticeActionsContext);
    const { t } = useTranslation('localPlayer');
    if (!context) return null;
    const run = (method: string, params?: Record<string, unknown>) => { void context.command(method, params).catch(() => {}); };
    const shuffled = context.state?.playMode === 'shuffle';
    const actions = [
        { id: 'prev', icon: SkipBack, label: t('previous'), active: false, onClick: () => run('previous') },
        { id: 'shuffle', icon: Shuffle, label: t('shuffle'), active: shuffled, onClick: () => run('setPlayMode', { mode: shuffled ? 'loop' : 'shuffle' }) },
        { id: 'queue', icon: ListMusic, label: t('queue'), active: false, onClick: context.onOpenQueue },
        { id: 'next', icon: SkipForward, label: t('next'), active: false, onClick: () => run('next') },
    ];
    return <div className="lattice-chrome-actions">
        {actions.map(({ id, icon: Icon, label, active, onClick }) => <button key={id} type="button"
            data-action={id} data-testid={`local-poster-${id}`} className={active ? 'is-active' : ''}
            disabled={disabled} onClick={onClick} title={label} aria-label={label}
            aria-pressed={id === 'shuffle' ? active : undefined}><Icon size={20} /></button>)}
    </div>;
}
