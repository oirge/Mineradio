import React from 'react';
import { Loader2, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// src/components/modal/settings/AiConnectionTest.tsx
// "Test connection" button and result block for the AI provider settings. It sends the unsaved form
// values to the main process and shows the reply; nothing here is persisted.

type AiConnectionTestProps = {
    /** Values currently in the form, exactly as typed. */
    payload: AiConnectionTestPayload;
    buttonClassName: string;
    isDaylight: boolean;
};

const AiConnectionTest: React.FC<AiConnectionTestProps> = ({ payload, buttonClassName, isDaylight }) => {
    const { t } = useTranslation();
    const [running, setRunning] = React.useState(false);
    const [result, setResult] = React.useState<AiConnectionTestResult | null>(null);
    // Each click gets a number; a reply is only shown if it is still the latest one. Unmounting
    // (provider switched, settings closed) bumps it too, so a late reply cannot land on a stale form.
    const requestSeqRef = React.useRef(0);

    React.useEffect(() => () => {
        requestSeqRef.current += 1;
    }, []);

    // Editing the connection fields makes an old result misleading, so drop it (and any reply still
    // in flight) when they change.
    React.useEffect(() => {
        requestSeqRef.current += 1;
        setRunning(false);
        setResult(null);
    }, [payload.apiKey, payload.apiUrl, payload.model, payload.stream, payload.useSystemProxy]);

    const runTest = async () => {
        if (running || !window.electron?.testAiConnection) {
            return;
        }
        const seq = requestSeqRef.current + 1;
        requestSeqRef.current = seq;
        setRunning(true);
        setResult(null);
        let next: AiConnectionTestResult;
        try {
            next = await window.electron.testAiConnection(payload);
        } catch (error) {
            next = {
                ok: false,
                durationMs: 0,
                errorKind: 'network',
                error: error instanceof Error ? error.message : String(error),
            };
        }
        if (requestSeqRef.current !== seq) {
            return;
        }
        setResult(next);
        setRunning(false);
    };

    const metaParts: string[] = [];
    if (result) {
        metaParts.push(`${t('options.aiTestDuration')}: ${result.durationMs} ms`);
        if (typeof result.status === 'number') {
            metaParts.push(`HTTP ${result.status}`);
        }
        if (result.ok && result.model) {
            metaParts.push(`${t('options.aiTestModel')}: ${result.model}`);
        }
    }

    const emptyMessage = result?.ok && !result.text
        ? t(result.emptyReason === 'reasoning' ? 'options.aiTestEmptyReasoning' : 'options.aiTestEmpty')
        : null;
    const statusColor = result
        ? (result.ok ? (isDaylight ? '#15803d' : '#4ade80') : (isDaylight ? '#b91c1c' : '#f87171'))
        : undefined;

    return (
        <div className="space-y-2 text-left">
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={runTest}
                    disabled={running}
                    className={`shrink-0 px-4 py-1.5 border active:scale-95 disabled:scale-100 disabled:opacity-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${buttonClassName}`}
                    style={{ color: 'var(--text-primary)' }}
                >
                    {running ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    <span>{running ? t('options.aiTestRunning') : t('options.aiTestConnection')}</span>
                </button>
                <span className="text-[10px] opacity-45 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {t('options.aiTestConnectionDesc')}
                </span>
            </div>

            {result && (
                <div className="space-y-1.5" role="status" aria-live="polite">
                    <div className="text-xs font-semibold" style={{ color: statusColor }}>
                        {result.ok ? t('options.aiTestSuccess') : t('options.aiTestFailed')}
                    </div>
                    <div className="text-[10px] opacity-60 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {metaParts.join(' · ')}
                    </div>
                    {emptyMessage && (
                        <div className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {emptyMessage}
                        </div>
                    )}
                    {(result.ok ? result.text : result.error) ? (
                        <pre
                            className={`max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border p-2 text-[11px] leading-relaxed font-mono ${isDaylight ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/5'}`}
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {result.ok ? result.text : result.error}
                        </pre>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default AiConnectionTest;
