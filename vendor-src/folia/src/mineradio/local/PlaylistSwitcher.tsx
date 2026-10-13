import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, Heart, ListMusic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HostState } from '../client';
import type { LocalCommand } from './useLibraryPage';
import { usePlaybackPlaylists } from './usePlaybackPlaylists';
import PlaylistSwitcherMenu from './PlaylistSwitcherMenu';

// src/mineradio/local/PlaylistSwitcher.tsx
// Keep the popup inside the controls' hover/focus boundary, outside the folding transport.
interface Props { state: HostState | null; command: LocalCommand; onManage?: () => void; }
export default function PlaylistSwitcher({ state, command, onManage }: Props) {
    const { t } = useTranslation('localPlayer');
    const catalog = usePlaybackPlaylists(state, command);
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const menuId = useId();
    const name = (id: string, fallback: string) => id === 'library' ? t('allMusic')
        : id === 'special-liked' ? t('liked') : fallback;
    const displayedId = catalog.pendingId ?? catalog.currentId;
    const currentName = name(displayedId, catalog.playlists.find(playlist => playlist.id === displayedId)?.name
        || state?.playbackPlaylistName || t('collection'));
    const shortName = displayedId === 'library' ? t('allMusicShort') : displayedId === 'special-liked' ? t('likedShort') : currentName;
    const currentListed = catalog.playlists.some(playlist => playlist.id === catalog.currentId);
    const busy = catalog.loading || catalog.pendingId !== null;
    const close = () => { setOpen(false); trigger.current?.focus(); };
    const controls = trigger.current?.closest<HTMLElement>('.local-controls');

    useLayoutEffect(() => {
        if (!open || !menu.current || !controls || !trigger.current) return;
        const position = () => {
            if (!menu.current || !trigger.current) return;
            const bar = controls.getBoundingClientRect();
            const button = trigger.current.getBoundingClientRect();
            const width = Math.min(286, window.innerWidth - 24);
            const left = Math.max(12 - bar.left, Math.min(button.left - bar.left, window.innerWidth - bar.left - width - 12));
            menu.current.style.left = `${left}px`;
            menu.current.style.maxHeight = `${Math.max(100, bar.top - 24)}px`;
        };
        position();
        controls.classList.add('local-playlist-open');
        window.addEventListener('resize', position);
        return () => { controls.classList.remove('local-playlist-open'); window.removeEventListener('resize', position); };
    }, [open, controls]);
    useEffect(() => {
        if (!open) return;
        const outside = (event: Event) => {
            if (event.target instanceof Node && !trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            trigger.current?.focus();
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('focusin', outside);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('focusin', outside);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    return <>
        <button ref={trigger} type="button" className={`local-playlist-trigger${displayedId === 'special-liked' ? ' is-liked' : displayedId !== 'library' ? ' is-custom' : ''}`}
            title={`${t('collection')}: ${currentName}`} aria-label={`${t('collection')}: ${currentName}`}
            aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? menuId : undefined}
            data-testid="local-playlist-switcher" data-playlist-id={displayedId}
            disabled={!state || busy || !catalog.playlists.length} aria-busy={busy}
            onClick={() => setOpen(value => !value)}
            onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}>
            {displayedId === 'special-liked' ? <Heart size={17} fill="currentColor" aria-hidden="true" /> : <ListMusic size={18} aria-hidden="true" />}
            <span className="local-playlist-label">{shortName}</span>
            <ChevronUp className="local-playlist-caret" size={12} aria-hidden="true" />
        </button>
        {open && controls && createPortal(<PlaylistSwitcherMenu menuRef={menu} id={menuId} playlists={currentListed ? catalog.playlists
            : [{ id: catalog.currentId, name: currentName, count: 0, cover: '', readOnly: true }, ...catalog.playlists]}
            currentId={catalog.currentId} label={name} disabled={busy}
            onSelect={id => { close(); void catalog.switchPlaylist(id); }} onClose={close}
            onManage={onManage ? () => { setOpen(false); onManage(); } : undefined} />, controls)}
    </>;
}
