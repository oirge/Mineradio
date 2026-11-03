import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { executeLocalAction, type LocalActionId, type LocalActionServices, type LocalTool } from './localCommandCatalog';
import { localDocuments } from './localDocuments';

// src/mineradio/local/useLocalActions.ts
// Register shortcuts in both documents while this isolated player is active.
export function useLocalActions(services: Omit<LocalActionServices, 'tool'> & { active: boolean; beforeTool: () => void }) {
    const [tool, setTool] = useState<LocalTool | null>(null);
    const latest = useRef(services);
    latest.current = services;
    const close = useCallback(() => setTool(null), []);
    const open = useCallback((next: LocalTool) => {
        latest.current.beforeTool();
        setTool(current => current === next ? null : next);
    }, []);
    const run = useCallback((id: LocalActionId) => {
        setTool(null);
        executeLocalAction(id, { ...latest.current, tool: open });
    }, [open]);
    useEffect(() => { if (!services.active) close(); }, [services.active, close]);
    useEffect(() => {
        const documents = localDocuments();
        const key = (event: KeyboardEvent) => {
            if (!latest.current.active || event.defaultPrevented || event.isComposing || event.repeat) return;
            if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
                event.preventDefault(); event.stopPropagation(); open('commands');
            }
        };
        documents.forEach(doc => doc.addEventListener('keydown', key, true));
        return () => documents.forEach(doc => doc.removeEventListener('keydown', key, true));
    }, [open]);
    const context = useMemo(() => ({ state: services.state, run }), [services.state, run]);
    return { tool, context, open, close };
}
