import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { StatusMessage } from '../types';
import { setStatusMessage as setStatusMsg } from '../stores/useStatusMessageStore';
import { useNeteaseApiStatusStore } from '../stores/useNeteaseApiStatusStore';

// src/hooks/useElectronNeteaseApiStatus.ts

type StatusSetter = Dispatch<SetStateAction<StatusMessage | null>>;

// Watches the Electron NetEase API startup state, mirrors it into the store the login modal reads,
// and surfaces backend failures through the app toast.
export function useElectronNeteaseApiStatus(t: TFunction) {
    const lastReportedFailureAtRef = useRef<number | null>(null);

    useEffect(() => {
        const electronBridge = window.electron;
        if (!electronBridge?.getNeteaseApiStatus) {
            return;
        }

        let disposed = false;
        useNeteaseApiStatusStore.getState().setSupported(true);

        const reportStatus = (status: ElectronNeteaseApiStatus) => {
            if (disposed) {
                return;
            }

            useNeteaseApiStatusStore.getState().setStatus(status);

            if (status.status !== 'error') {
                return;
            }

            if (lastReportedFailureAtRef.current === status.updatedAt) {
                return;
            }

            lastReportedFailureAtRef.current = status.updatedAt;
            console.warn('[Electron] Netease API failed to start', status.error);
            // The reason travels with the toast: user reports of this failure previously arrived
            // with nothing to go on, because the cause only ever reached the main-process stdout.
            const reason = typeof status.error === 'string' ? status.error.trim() : '';
            setStatusMsg({
                type: 'error',
                text: reason
                    ? t('status.neteaseApiStartupFailedDetail', { reason })
                    : t('status.neteaseApiStartupFailed'),
                nonce: status.updatedAt,
                durationMs: 8000,
            });
        };

        void electronBridge.getNeteaseApiStatus()
            .then(reportStatus)
            .catch((error) => {
                console.warn('[Electron] Failed to read Netease API status', error);
            });

        const unsubscribe = electronBridge.onNeteaseApiStatusChanged?.(reportStatus);

        return () => {
            disposed = true;
            unsubscribe?.();
        };
    }, [setStatusMsg, t]);
}
