import { useCallback, useEffect, useRef, useState } from 'react';

// src/hooks/useAudioOutputDevices.ts
// Lazily enumerates audio output devices for the playback settings panel.

export interface AudioOutputDeviceOption {
    deviceId: string;
    /** Raw device label; empty until a media permission grant reveals it. Callers apply their own fallback text. */
    label: string;
}

export type AudioOutputDevicesErrorKey =
    | 'options.audioOutputUnsupported'
    | 'options.audioOutputLoadFailed'
    | 'options.audioOutputSelectFailed';

// Remembers the label of the device the user picked, so the panel can name the active output
// without enumerating. Only one output is selected at a time, so a single pair is enough.
const SELECTED_DEVICE_LABEL_STORAGE_KEY = 'audio_output_device_label';

// Enumeration survives remounts of the settings panel: revisiting the playback section must not
// re-trigger the capture-service cost described below.
let cachedDevices: AudioOutputDeviceOption[] | null = null;

const isAudioOutputSelectionSupported = (): boolean => (
    typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.enumerateDevices === 'function'
    && 'setSinkId' in HTMLMediaElement.prototype
);

const stopMediaStream = (stream: MediaStream | null) => {
    stream?.getTracks().forEach(track => track.stop());
};

const readSelectedDeviceLabel = (deviceId: string): string => {
    if (typeof window === 'undefined' || !deviceId) {
        return '';
    }

    try {
        const stored = localStorage.getItem(SELECTED_DEVICE_LABEL_STORAGE_KEY);
        if (!stored) {
            return '';
        }

        const parsed = JSON.parse(stored) as { deviceId?: string; label?: string; };
        return parsed?.deviceId === deviceId ? (parsed.label ?? '') : '';
    } catch {
        return '';
    }
};

const writeSelectedDeviceLabel = (deviceId: string, label: string) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        if (!deviceId || !label) {
            localStorage.removeItem(SELECTED_DEVICE_LABEL_STORAGE_KEY);
            return;
        }

        localStorage.setItem(SELECTED_DEVICE_LABEL_STORAGE_KEY, JSON.stringify({ deviceId, label }));
    } catch {
        // Storage can be unavailable or full; the label is a nicety, never a correctness requirement.
    }
};

/**
 * Device list state for the audio output picker.
 *
 * `enumerateDevices()` is the only web API that lists audio outputs, but Chromium enumerates video
 * inputs in the same call and spins up the video capture service to do it, without releasing it
 * afterwards (crbug 377749384). Electron enables `ReleaseVideoSourceProviderIfNotInUse` on Windows
 * and macOS so the service can shut down on an idle timer; browsers and Linux have no such escape.
 * The same call also opens the microphone to reveal device labels, which registers this app in the
 * OS "recently used microphone" lists.
 *
 * Two rules follow, and both are load-bearing:
 *   1. never enumerate on mount — only when the user actually reaches for the device picker;
 *   2. subscribe to `devicechange` only for as long as the picker is on screen, and never before the
 *      first enumeration — see the subscription effect below for why both halves matter.
 */
export const useAudioOutputDevices = (selectedDeviceId: string) => {
    const isSupported = isAudioOutputSelectionSupported();
    const [devices, setDevices] = useState<AudioOutputDeviceOption[]>(() => cachedDevices ?? []);
    const [hasLoaded, setHasLoaded] = useState(() => cachedDevices !== null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorKey, setErrorKey] = useState<AudioOutputDevicesErrorKey | null>(null);
    const isLoadingRef = useRef(false);
    const [selectedDeviceLabel, setSelectedDeviceLabel] = useState(() => readSelectedDeviceLabel(selectedDeviceId));

    const load = useCallback(async () => {
        if (!isSupported) {
            setDevices([]);
            setErrorKey('options.audioOutputUnsupported');
            return;
        }

        if (isLoadingRef.current) {
            return;
        }

        isLoadingRef.current = true;
        setIsLoading(true);
        setErrorKey(null);

        let permissionProbeStream: MediaStream | null = null;

        try {
            let enumerated = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = enumerated.filter(device => device.kind === 'audiooutput');
            const hasMissingLabels = audioOutputs.some(device => !device.label?.trim());

            if (hasMissingLabels && typeof navigator.mediaDevices.getUserMedia === 'function') {
                try {
                    permissionProbeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    enumerated = await navigator.mediaDevices.enumerateDevices();
                } catch (permissionError) {
                    console.warn('[useAudioOutputDevices] Audio permission probe failed', permissionError);
                }
            }

            const outputs = enumerated
                .filter(device => device.kind === 'audiooutput')
                .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label ?? '',
                }));

            cachedDevices = outputs;
            setDevices(outputs);
            setHasLoaded(true);
        } catch (error) {
            console.error('[useAudioOutputDevices] Failed to enumerate audio output devices', error);
            setErrorKey('options.audioOutputLoadFailed');
        } finally {
            stopMediaStream(permissionProbeStream);
            isLoadingRef.current = false;
            setIsLoading(false);
        }
    }, [isSupported]);

    /** Enumerate on first demand only; later demands reuse the session cache. */
    const ensureLoaded = useCallback(() => {
        if (cachedDevices !== null || isLoadingRef.current) {
            return;
        }

        void load();
    }, [load]);

    /** Explicit user refresh: drop the cache and pay the enumeration cost again. */
    const refresh = useCallback(() => {
        cachedDevices = null;
        return load();
    }, [load]);

    // Keep the remembered label in sync once a load reveals a name for the active device, so the
    // panel can label it on the next visit without enumerating.
    useEffect(() => {
        if (!selectedDeviceId) {
            setSelectedDeviceLabel('');
            writeSelectedDeviceLabel('', '');
            return;
        }

        const match = devices.find(device => device.deviceId === selectedDeviceId);
        if (match?.label) {
            setSelectedDeviceLabel(match.label);
            writeSelectedDeviceLabel(selectedDeviceId, match.label);
            return;
        }

        setSelectedDeviceLabel(readSelectedDeviceLabel(selectedDeviceId));
    }, [devices, selectedDeviceId]);

    // Chromium only re-evaluates whether the video capture service is still needed when a
    // device-change subscription goes away. Enumerating alone never schedules that check, so the
    // service that `enumerateDevices()` started would live until the process exits even with
    // `ReleaseVideoSourceProviderIfNotInUse` on (electron/main.cjs). Subscribing while the picker is
    // on screen and unsubscribing on unmount gives that idle timer the edge it waits for, and pays
    // for itself with hot-plug refresh in the meantime.
    //
    // The `hasLoaded` guard is the load-bearing half: subscribing also starts device monitoring, so
    // subscribing before the user has asked for the list would drag the cost this hook avoids on
    // mount back in through another door.
    useEffect(() => {
        if (!isSupported || !hasLoaded) {
            return;
        }

        const handleDeviceChange = () => {
            cachedDevices = null;
            void load();
        };

        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, [hasLoaded, isSupported, load]);

    return {
        devices,
        ensureLoaded,
        errorKey,
        hasLoaded,
        isLoading,
        isSupported,
        refresh,
        selectedDeviceLabel,
        setErrorKey,
    };
};

export default useAudioOutputDevices;
