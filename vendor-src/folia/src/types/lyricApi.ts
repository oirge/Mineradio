// src/types/lyricApi.ts
// Renderer-facing status contract for the desktop-local lyrics endpoint.

export interface LyricApiStatus {
    enabled: boolean;
    running: boolean;
    port: number;
    url: string | null;
    error: string | null;
}
