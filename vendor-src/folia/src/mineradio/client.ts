// src/mineradio/client.ts
// The embedded Folia surface talks only to its owning Mineradio window.

export interface HostTrack {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    cover: string;
    liked: boolean;
    filePath: string;
    format: string;
}

export interface HostPlaylist {
    id: string;
    name: string;
    count: number;
    cover: string;
    readOnly: boolean;
}

export interface HostPage<T> {
    items: T[];
    total: number;
    offset: number;
    limit: number;
}

export interface HostAudioChain {
    enabled: boolean; gains: number[]; preset: string; profileName: string;
    preampDb: number; autoPreamp: boolean; limiterEnabled: boolean; limiterThresholdDb: number;
    spatialEnabled: boolean; widthRatio: number;
}
export interface HostOutputDevice {
    supported: boolean; deviceId: string; label: string; actualId: string;
    status: 'idle' | 'deferred' | 'pending' | 'fallback' | 'error' | 'applied';
    needsPermission: boolean; errorName: string;
}
export interface HostAudioOptions {
    frequencies: number[]; presets: Array<{ id: string; label: string }>;
    limits: { gain: [number, number]; preamp: [number, number]; threshold: [number, number]; width: [number, number] };
    devices: Array<{ deviceId: string; label: string; fallbackIndex: number }>;
}
export interface HostState {
    uiLanguage?: 'en' | 'zh-CN';
    currentTrack: HostTrack | null;
    currentIndex: number;
    position: number;
    duration: number;
    playing: boolean;
    playbackRate?: number;
    sleepTimer?: { mode: 'off' | 'track' | '15' | '30' | '60'; dueAt: number; fading: boolean };
    replayGain?: { enabled: boolean; mode: 'track' | 'album'; preampDb: number; clipGuard: boolean };
    gapless?: { enabled: boolean; crossfadeSeconds: number };
    audioChain?: HostAudioChain;
    outputDevice?: HostOutputDevice;
    outputLatency?: number;
    volume: number;
    muted: boolean;
    playMode: 'loop' | 'shuffle' | 'single';
    playbackPlaylistId?: string;
    playbackPlaylistName?: string;
    queueRevision: string | number;
    libraryRevision: string | number;
    lyricsRevision: string | number;
    interface: 'folia' | 'mineradio';
}

export interface HostLyrics {
    trackId: string | null;
    lines: Array<{
        time: number;
        endTime?: number;
        text: string;
        translation?: string;
        romanization?: string;
        backgroundVocals?: import('../types').LyricBackgroundVocal[];
        words?: Array<{ time: number; duration: number; text: string }>;
    }>;
}

export interface HostAudio {
    trackId?: string | null;
    position?: number;
    playing?: boolean;
    frequency: number[] | Uint8Array;
    sampleRate: number;
    fftSize: number;
}

export interface HostAnalysis {
    trackId: string | null;
    revision: number;
    source: 'cache' | 'live';
    until?: number;
    beats: import('../services/beatFx/clock').BeatFxEvent[];
    drums: { times: Float64Array; strengths: Float32Array; kinds: Uint8Array } | null;
    vocal: { fps: number; db: Float32Array; top: number; onsets: Uint32Array; from?: number } | null;
}

type HostListener = (data: any) => void;
type PendingRequest = {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
};

const CHANNEL = 'mineradio-folia';
const pending = new Map<string, PendingRequest>();
const subscribers = new Map<string, Set<HostListener>>();
let serial = 0;
let listening = false;

export function isMineradioEmbedded(): boolean {
    return typeof window !== 'undefined' && !!window.parent && !!window.location && window.parent !== window
        && (new URLSearchParams(window.location.search).get('host') === 'mineradio'
            || window.location.pathname.startsWith('/vendor/folia/'));
}

function listen(): void {
    if (listening || !isMineradioEmbedded()) return;
    listening = true;
    window.addEventListener('message', (event: MessageEvent) => {
        if (event.source !== window.parent || event.origin !== window.location.origin) return;
        const message = event.data;
        if (!message || message.channel !== CHANNEL || message.version !== 1) return;
        if (message.type === 'response' && typeof message.id === 'string') {
            const request = pending.get(message.id);
            if (!request) return;
            pending.delete(message.id);
            clearTimeout(request.timer);
            if (message.ok === true) request.resolve(message.result);
            else request.reject(new Error(message.error?.message || message.error?.code || 'Mineradio 操作失败'));
        } else if (message.type === 'event' && typeof message.event === 'string') {
            subscribers.get(message.event)?.forEach((listener) => {
                try { listener(message.data); }
                catch (error) { console.error('[Mineradio] Host event failed:', message.event, error); }
            });
        }
    });
    window.addEventListener('pagehide', () => {
        for (const request of pending.values()) {
            clearTimeout(request.timer);
            request.reject(new Error('Folia 界面已关闭'));
        }
        pending.clear();
    });
}

export function requestHost<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!isMineradioEmbedded()) return Promise.reject(new Error('当前页面未连接 Mineradio'));
    listen();
    const id = `${Date.now().toString(36)}-${(++serial).toString(36)}`;
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`Mineradio 操作超时：${method}`));
        }, 60_000);
        pending.set(id, { resolve, reject, timer });
        try {
            window.parent.postMessage({ channel: CHANNEL, version: 1, type: 'request', id, method, params }, window.location.origin);
        } catch (error) {
            pending.delete(id);
            clearTimeout(timer);
            reject(error instanceof Error ? error : new Error('无法向 Mineradio 发送操作'));
        }
    });
}

export function subscribeHost(event: string, listener: HostListener): () => void {
    listen();
    let listeners = subscribers.get(event);
    if (!listeners) {
        listeners = new Set();
        subscribers.set(event, listeners);
    }
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) subscribers.delete(event);
    };
}
