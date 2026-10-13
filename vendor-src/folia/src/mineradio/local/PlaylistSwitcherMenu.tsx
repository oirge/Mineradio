import { useLayoutEffect, useMemo, useRef, type KeyboardEvent, type RefObject } from 'react';
import { Check, Heart, Library, ListMusic, Settings2, X } from 'lucide-react';
import { List, useListRef, type RowComponentProps } from 'react-window';
import { useTranslation } from 'react-i18next';
import type { HostPlaylist } from '../client';

// src/mineradio/local/PlaylistSwitcherMenu.tsx
// Playlist summaries share one row for small menus and bounded virtualized catalogs.
interface RowProps {
    playlists: HostPlaylist[]; currentId: string; disabled: boolean;
    label: (id: string, name: string) => string; onSelect: (id: string) => void;
}
interface Props extends RowProps {
    menuRef: RefObject<HTMLDivElement | null>; id: string; onClose: () => void; onManage?: () => void;
}
function PlaylistOption({ playlist, currentId, disabled, label, onSelect }: Omit<RowProps, 'playlists'> & { playlist: HostPlaylist }) {
    const { t } = useTranslation('localPlayer');
    const liked = playlist.id === 'special-liked';
    const Icon = liked ? Heart : playlist.id === 'library' ? Library : ListMusic;
    return <button type="button" role="menuitemradio" aria-checked={playlist.id === currentId}
        className={`local-playlist-option${liked ? ' is-liked-playlist' : ''}`} data-playlist-id={playlist.id}
        disabled={disabled || playlist.count <= 0} onClick={() => onSelect(playlist.id)}>
        <span className="local-playlist-cover">{playlist.cover ? <img src={playlist.cover} alt="" loading="lazy" decoding="async" />
            : <Icon size={18} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />}</span>
        <span className="local-playlist-info"><strong title={label(playlist.id, playlist.name)}>{label(playlist.id, playlist.name)}</strong>
            <small>{t('tracks', { count: playlist.count })}</small></span>
        <span className="local-playlist-check" aria-hidden="true">{playlist.id === currentId && <Check size={15} />}</span>
    </button>;
}
function PlaylistRow({ index, style, playlists, ...props }: RowComponentProps<RowProps>) {
    return <div style={style}><PlaylistOption playlist={playlists[index]} {...props} /></div>;
}
export default function PlaylistSwitcherMenu({ menuRef, id, playlists, currentId, disabled, label, onSelect, onClose, onManage }: Props) {
    const { t } = useTranslation('localPlayer');
    const list = useListRef(null);
    const pendingFocus = useRef<number | null>(null);
    const virtualized = playlists.length >= 24;
    const rowProps = useMemo(() => ({ playlists, currentId, disabled, label, onSelect }), [playlists, currentId, disabled, label, onSelect]);
    const focusPending = () => {
        const playlist = pendingFocus.current === null ? undefined : playlists[pendingFocus.current];
        if (!playlist) return;
        const button = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-playlist-id]') || [])
            .find(element => element.dataset.playlistId === playlist.id);
        if (button && !button.disabled) { pendingFocus.current = null; button.focus(); }
    };
    const focusRow = (index: number) => {
        pendingFocus.current = index;
        if (virtualized) list.current?.scrollToRow({ index, align: 'auto' });
        focusPending();
    };
    useLayoutEffect(() => {
        const selected = playlists.findIndex(playlist => playlist.id === currentId && playlist.count > 0);
        const first = selected >= 0 ? selected : playlists.findIndex(playlist => playlist.count > 0);
        if (first >= 0) focusRow(first);
        else menuRef.current?.querySelector<HTMLButtonElement>('.local-playlist-close')?.focus();
    }, []);
    const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current = (event.target as HTMLElement).closest<HTMLElement>('[data-playlist-id]')?.dataset.playlistId;
        const start = playlists.findIndex(playlist => playlist.id === current);
        const step = event.key === 'ArrowUp' || event.key === 'End' ? -1 : 1;
        let index = event.key === 'Home' ? -1 : event.key === 'End' ? playlists.length : start;
        for (let scanned = 0; scanned < playlists.length; scanned++) {
            index = (index + step + playlists.length) % playlists.length;
            if (!disabled && playlists[index].count > 0) { focusRow(index); return; }
        }
    };
    return <div ref={menuRef} id={id} className="local-playlist-menu" role="dialog" aria-label={t('collection')}
        data-testid="local-playlist-menu" data-wheel-scroll-region onKeyDown={navigate}>
        <div className="local-playlist-head"><strong>{t('collection')}</strong><span>{playlists.filter(playlist => !playlist.readOnly).length}</span>
            <button type="button" className="local-playlist-close" aria-label={t('close')} title={t('close')} onClick={onClose}><X size={16} /></button></div>
        <div className="local-playlist-list" role="menu" aria-label={t('collection')}>
            {virtualized ? <List listRef={api => {
                list.current = api;
                if (api?.element && pendingFocus.current !== null) {
                    api.scrollToRow({ index: pendingFocus.current, align: 'auto' });
                    focusPending();
                }
            }} rowCount={playlists.length} rowHeight={54} rowComponent={PlaylistRow}
                rowProps={rowProps} overscanCount={3} onRowsRendered={focusPending} style={{ height: 280, width: '100%' }} />
                : playlists.map(playlist => <PlaylistOption key={playlist.id} playlist={playlist} {...rowProps} />)}
        </div>
        {onManage && <div className="local-playlist-footer"><button type="button" onClick={onManage}><Settings2 size={15} />{t('managePlaylists')}</button></div>}
    </div>;
}
