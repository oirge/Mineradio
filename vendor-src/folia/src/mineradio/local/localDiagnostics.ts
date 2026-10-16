// src/mineradio/local/localDiagnostics.ts
// Bounded, local-only crash evidence; diagnostic export is an explicit user action.
export const LOCAL_DIAGNOSTICS_KEY = 'mineradio-folia-diagnostics-v1';
export interface LocalDiagnostic {
    at: string;
    surface: string;
    message: string;
    stack: string;
    componentStack: string;
}
const clipped = (value: unknown, max: number): string => {
    try { return String(value ?? '').slice(0, max); } catch { return ''; }
};
export function readLocalDiagnostics(): LocalDiagnostic[] {
    try {
        const text = localStorage.getItem(LOCAL_DIAGNOSTICS_KEY) || '[]';
        if (text.length > 96_000) return [];
        const records: unknown = JSON.parse(text);
        if (!Array.isArray(records)) return [];
        return records.slice(-12).filter(item => item && typeof item === 'object').map(item => ({
            at: clipped(item.at, 32), surface: clipped(item.surface, 80), message: clipped(item.message, 400),
            stack: clipped(item.stack, 2500), componentStack: clipped(item.componentStack, 1500),
        }));
    } catch { return []; }
}
export function recordLocalError(error: unknown, surface: string, componentStack = ''): void {
    try {
        const detail = error instanceof Error ? error : null;
        const record: LocalDiagnostic = {
            at: new Date().toISOString(), surface: clipped(surface, 80),
            message: clipped(detail?.message ?? error, 400), stack: clipped(detail?.stack, 2500),
            componentStack: clipped(componentStack, 1500),
        };
        const records = readLocalDiagnostics();
        const previous = records.at(-1);
        if (previous && previous.surface === record.surface && previous.message === record.message
            && previous.stack === record.stack && Date.now() - Date.parse(previous.at) < 1000) return;
        localStorage.setItem(LOCAL_DIAGNOSTICS_KEY, JSON.stringify([...records.slice(-11), record]));
    } catch { /* Recovery must also work with unavailable or full storage. */ }
}
export function exportLocalDiagnostics(): void {
    const blob = new Blob([JSON.stringify({ schema: 1, userAgent: navigator.userAgent, errors: readLocalDiagnostics() }, null, 2)],
        { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;
    link.download = 'mineradio-folia-diagnostics.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
