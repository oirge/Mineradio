import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { syncNow } from '../services/sync/syncCoordinator';
import { isSyncConfigured } from '../services/sync/syncConfig';
import { setStatusMessage } from '../stores/useStatusMessageStore';

// src/hooks/useThemeSyncAction.ts
// 面板底部主题同步按钮的 idle / syncing / complete 状态机。

const COMPLETE_STATE_HOLD_MS = 1600;

export type ThemeSyncState = 'idle' | 'syncing' | 'complete';

export const useThemeSyncAction = () => {
    const { t } = useTranslation();
    const [themeSyncState, setThemeSyncState] = useState<ThemeSyncState>('idle');
    const completeTimerRef = useRef<number | null>(null);

    useEffect(() => () => {
        if (completeTimerRef.current !== null) {
            window.clearTimeout(completeTimerRef.current);
        }
    }, []);

    const runThemeSync = useCallback(async () => {
        if (themeSyncState === 'syncing') {
            return;
        }

        if (!isSyncConfigured()) {
            setStatusMessage({
                type: 'info',
                text: t('commandPalette.syncNotConfigured'),
            });
            return;
        }

        if (completeTimerRef.current !== null) {
            window.clearTimeout(completeTimerRef.current);
        }

        setThemeSyncState('syncing');
        const result = await syncNow({ syncThemes: true, applyRemoteSettings: false, pushSettings: false });
        if (!result) {
            setThemeSyncState('idle');
            return;
        }

        setThemeSyncState('complete');
        completeTimerRef.current = window.setTimeout(() => {
            setThemeSyncState('idle');
            completeTimerRef.current = null;
        }, COMPLETE_STATE_HOLD_MS);
    }, [t, themeSyncState]);

    return { themeSyncState, runThemeSync };
};
