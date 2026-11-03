import { useContext, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ListMusic, Music2, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HostPlaylist, HostState } from '../client';
import type { LocalCommand } from './useLibraryPage';
import { LOCAL_ACTIONS, localActionView, localCommandMatches } from './localCommandCatalog';
import { LocalActionsContext } from './LocalActionsContext';
import { COMMAND_PAGE_SIZE, useLocalCommandCatalog } from './useLocalCommandCatalog';
import LocalToolPanel from './LocalToolPanel';
import './localControls.css';

// src/mineradio/local/LocalCommandPalette.tsx
// Search local songs, playlist pages and the isolated player's command registry with one keyboard flow.
interface Result { id: string; kind: 'action' | 'track' | 'playlist'; title: string; detail: string; icon: LucideIcon; run: () => void }
const LANDING = ['playback', 'audio', 'subtitles', 'visuals', 'library', 'queue', 'addPlaylist', 'like'];
export default function LocalCommandPalette({ state, command, onClose }: { state: HostState | null; command: LocalCommand; onClose: () => void }) {
    const { t } = useTranslation('localPlayer');
    const context = useContext(LocalActionsContext);
    const [query, setQuery] = useState(''), [offset, setOffset] = useState(0), [selected, setSelected] = useState(0);
    const [scope, setScope] = useState<HostPlaylist | null>(null);
    const catalog = useLocalCommandCatalog(state, command, query, scope?.id ?? 'library', offset);
    const list = useRef<HTMLDivElement>(null);
    const playlistName = (playlist: HostPlaylist) => playlist.id === 'library' ? t('allMusic') : playlist.id === 'special-liked' ? t('liked') : playlist.name;
    const actions = query ? LOCAL_ACTIONS.filter(action => action.id !== 'commands'
        && localCommandMatches(`${t(localActionView(action.id, state).label)} ${action.keywords}`, query))
        : LANDING.map(id => LOCAL_ACTIONS.find(action => action.id === id)!);
    const results: Result[] = [
        ...(scope ? [] : actions.filter(action => !localActionView(action.id, state).disabled).slice(0, 10).map(action => {
            const view = localActionView(action.id, state);
            return { id: action.id, kind: 'action' as const, title: t(view.label), detail: t('commandActions'), icon: view.icon,
                run: () => { onClose(); context?.run(action.id); } };
        })),
        ...(scope ? [] : catalog.playlists.filter(playlist => localCommandMatches(playlistName(playlist), query)).slice(0, query ? 8 : 3).map(playlist => ({
            id: playlist.id, kind: 'playlist' as const, title: playlistName(playlist), detail: t('tracks', { count: playlist.count }), icon: ListMusic,
            run: () => { setScope(playlist); setQuery(''); setOffset(0); setSelected(0); },
        }))),
        ...catalog.page.items.map(track => ({ id: track.id, kind: 'track' as const, title: track.title,
            detail: track.artist || t('unknownArtist'), icon: Music2,
            run: () => { onClose(); void command('play', { id: track.id, playlistId: scope?.id ?? 'library' }).catch(() => {}); },
        })),
    ];
    const activeIndex = Math.min(selected, Math.max(0, results.length - 1));
    useEffect(() => {
        if (!catalog.loading && offset > 0 && offset >= catalog.page.total) setOffset(0);
    }, [catalog.loading, catalog.page.total, offset]);
    useEffect(() => {
        list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, results.length]);
    return <LocalToolPanel id="local-command-palette" title={`${t('commands')} · Ctrl+K`} onClose={onClose} initialFocus="[data-command-input]" wide>
        {scope && <button type="button" onClick={() => { setScope(null); setOffset(0); setSelected(0); }}><ArrowLeft size={16} />{t('commandBack')}</button>}
        {scope && <small className="local-tool-hint" data-i18n-skip>{t('commandScope', { name: playlistName(scope) })}</small>}
        <input className="local-command-input" data-command-input data-testid="local-command-search" maxLength={240} value={query}
            role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="local-command-results"
            aria-activedescendant={results.length ? `local-command-result-${activeIndex}` : undefined} aria-label={t('commandSearch')} placeholder={t('commandSearch')}
            onChange={event => { setQuery(event.target.value); setOffset(0); setSelected(0); }}
            onKeyDown={event => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault(); setSelected((activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % (results.length || 1));
                }
                if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); results[activeIndex].run(); }
            }} />
        <div ref={list} id="local-command-results" role="listbox" aria-label={t('commands')} className="local-command-results">
            {results.map((result, index) => <button key={`${result.kind}:${result.id}`} id={`local-command-result-${index}`} type="button" role="option"
                aria-selected={activeIndex === index} className="local-command-result" data-result-kind={result.kind} data-result-key={result.id}
                onMouseEnter={() => setSelected(index)} onClick={result.run}>
                <result.icon size={18} /><span {...(result.kind === 'action' ? {} : { 'data-i18n-skip': true })}><strong>{result.title}</strong><small>{result.detail}</small></span>
            </button>)}
        </div>
        {catalog.loading && <p className="local-tool-hint" role="status">{t('loading')}</p>}
        {catalog.error && <div className="local-tool-error" role="alert">{t('commandFailed')} <button type="button" onClick={catalog.refresh}>{t('retry')}</button></div>}
        {!catalog.loading && !catalog.error && !results.length && <p className="local-tool-hint">{t('commandNoResults')}</p>}
        {(catalog.page.total > COMMAND_PAGE_SIZE || offset > 0) && <div className="local-command-paging">
            <button type="button" disabled={!offset || catalog.loading} onClick={() => { setOffset(value => Math.max(0, value - COMMAND_PAGE_SIZE)); setSelected(0); }}>{t('previousPage')}</button>
            <span>{t('page', { page: Math.floor(offset / COMMAND_PAGE_SIZE) + 1, pages: Math.ceil(catalog.page.total / COMMAND_PAGE_SIZE) })}</span>
            <button type="button" disabled={offset + COMMAND_PAGE_SIZE >= catalog.page.total || catalog.loading}
                onClick={() => { setOffset(value => value + COMMAND_PAGE_SIZE); setSelected(0); }}>{t('nextPage')}</button>
        </div>}
        <small className="local-tool-hint">{t('commandHint')}</small>
    </LocalToolPanel>;
}
