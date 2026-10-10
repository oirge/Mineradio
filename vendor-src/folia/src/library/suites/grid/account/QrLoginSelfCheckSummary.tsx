import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import type { LibraryLoginSelfCheckView } from '../../../core/bindings/useLibraryAccount';

// src/library/suites/grid/account/QrLoginSelfCheckSummary.tsx
// 扫码登录失败后自动自检的结果：一句结论（卡在哪一层、该怎么做），可能的代理提示，以及逐项检查（本地服务、DNS、
// IPv4 / IPv6 连接、HTTPS、代理、系统时间）。失败项的错误码与域名直接跟在标签后面，完整内容在悬停提示里。

const STATE_ICON = {
    ok: { Icon: Check, className: 'text-green-400' },
    fail: { Icon: X, className: 'text-red-400' },
    warn: { Icon: AlertTriangle, className: 'text-amber-400' },
    skip: { Icon: Check, className: 'opacity-30' },
} as const;

const QrLoginSelfCheckSummary = ({ selfCheck }: { selfCheck: LibraryLoginSelfCheckView }) => (
    <div data-qr-self-check={selfCheck.running ? 'running' : selfCheck.error ? 'failed' : 'done'}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-45 mb-1" style={{ color: 'var(--text-secondary)' }}>
            {selfCheck.title}
        </p>
        {selfCheck.running && (
            <p className="flex items-center gap-1.5 text-[11px] opacity-70" style={{ color: 'var(--text-primary)' }}>
                <Loader2 size={11} className="animate-spin shrink-0" />
                {selfCheck.runningText}
            </p>
        )}
        {selfCheck.verdict && (
            <p className="text-[11px] leading-snug" style={{ color: 'var(--text-primary)' }} data-qr-self-check-verdict>
                {selfCheck.verdict}
            </p>
        )}
        {selfCheck.proxyNote && (
            <p className="text-[10px] leading-snug opacity-60 mt-1" style={{ color: 'var(--text-secondary)' }}>{selfCheck.proxyNote}</p>
        )}
        {selfCheck.error && (
            <p className="text-[11px] leading-snug opacity-70" style={{ color: 'var(--text-primary)' }}>{selfCheck.error}</p>
        )}
        {selfCheck.items.length > 0 && (
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {selfCheck.items.map(item => {
                    const { Icon, className } = STATE_ICON[item.state];
                    const text = item.detail && item.state !== 'ok' ? `${item.label}: ${item.detail}` : item.label;
                    return (
                        <li key={item.id} className="flex min-w-0 items-center gap-1" title={item.detail ? `${item.label}: ${item.detail}` : item.label} data-qr-self-check-item={item.id} data-state={item.state}>
                            <Icon size={10} className={`shrink-0 ${className}`} />
                            <span className="truncate">{text}</span>
                        </li>
                    );
                })}
            </ul>
        )}
    </div>
);

export default QrLoginSelfCheckSummary;
