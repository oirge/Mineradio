import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, ClipboardCopy, ExternalLink, Loader2 } from 'lucide-react';
import type { LibraryLoginSelfCheckView } from '../../../core/bindings/useLibraryAccount';
import QrLoginSelfCheckSummary from './QrLoginSelfCheckSummary';

// src/library/suites/grid/account/QrLoginFailureHelp.tsx
// 扫码登录失败后显示在二维码旁边的帮助，按用户该做的顺序排：
// 1. 几条简单办法（重启 Folia；换个网络再重启 Folia）；
// 2. 自动检查的结论与逐项结果（卡在哪一层）；
// 3. 收起的「还是不行？」：展开后才有复制诊断报告、去 GitHub 反馈与报告内容的告知——不一上来就让人发 issue。
// 报告要等用户点了才生成（会等还在跑的自检）；重试后失败形态清空，这块随之卸载，下一次失败时重新收起。

export type QrLoginFailureHelpProps = {
    tips: { title: string; items: string[] };
    /** 失败后的自动检查；provider 没有自检能力时不传。 */
    selfCheck?: LibraryLoginSelfCheckView | null;
    /** 收起诊断与反馈的那一项。 */
    escalationLabel: string;
    prompt: string;
    /** 报告包含哪些数据。 */
    disclosure: string;
    copyLabel: string;
    copiedLabel: string;
    copyFailedLabel: string;
    reportLabel: string;
    buildReport: () => Promise<string>;
    buildIssueUrl: (report: string) => string;
};

type CopyState = 'idle' | 'working' | 'copied' | 'failed';

// Electron 里 <a target="_blank"> 会开一个新的 BrowserWindow，必须走主进程交给系统浏览器。
const openExternal = (url: string) => {
    if (window.electron?.openExternalUrl) {
        void window.electron.openExternalUrl(url);
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
};

const SECTION_TITLE_CLASS = 'text-[10px] font-semibold uppercase tracking-[0.16em] opacity-45 mb-1';

const QrLoginFailureHelp = ({
    tips,
    selfCheck,
    escalationLabel,
    prompt,
    disclosure,
    copyLabel,
    copiedLabel,
    copyFailedLabel,
    reportLabel,
    buildReport,
    buildIssueUrl,
}: QrLoginFailureHelpProps) => {
    const [expanded, setExpanded] = useState(false);
    const [copyState, setCopyState] = useState<CopyState>('idle');

    // 复制与反馈都先把报告放进剪贴板：链接放不下完整报告时，用户在 issue 页直接粘贴即可。
    const copyReport = async (): Promise<string | null> => {
        setCopyState('working');
        let report: string | null = null;
        try {
            report = await buildReport();
            await navigator.clipboard.writeText(report);
            setCopyState('copied');
        } catch (error) {
            console.warn('[ProviderQrLogin] diagnostics:copy-failed', error);
            setCopyState('failed');
        }
        return report;
    };

    const handleReport = async () => {
        const report = await copyReport();
        openExternal(buildIssueUrl(report ?? ''));
    };

    const copyText = copyState === 'copied' ? copiedLabel : copyState === 'failed' ? copyFailedLabel : copyLabel;
    const CopyIcon = copyState === 'working' ? Loader2 : copyState === 'copied' ? Check : ClipboardCopy;
    const Chevron = expanded ? ChevronDown : ChevronRight;

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left" data-qr-failure-help>
            <p className={SECTION_TITLE_CLASS} style={{ color: 'var(--text-secondary)' }}>{tips.title}</p>
            <ol className="list-decimal space-y-0.5 pl-4 text-[11px] leading-snug" style={{ color: 'var(--text-primary)' }} data-qr-failure-tips>
                {tips.items.map(item => <li key={item}>{item}</li>)}
            </ol>

            {selfCheck && (
                <div className="mt-3 border-t border-white/10 pt-3">
                    <QrLoginSelfCheckSummary selfCheck={selfCheck} />
                </div>
            )}

            <div className="mt-3 border-t border-white/10 pt-2">
                <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded(value => !value)}
                    className="flex w-full items-center gap-1 text-left text-[11px] opacity-60 transition-opacity hover:opacity-100 cursor-pointer"
                    style={{ color: 'var(--text-primary)' }}
                >
                    <Chevron size={12} className="shrink-0" />
                    {escalationLabel}
                </button>
                {expanded && (
                    <div className="mt-2" data-qr-failure-escalation>
                        <p className="text-[11px] leading-snug opacity-75" style={{ color: 'var(--text-primary)' }}>{prompt}</p>
                        <p className="text-[10px] leading-snug opacity-45 mt-1" style={{ color: 'var(--text-secondary)' }} data-qr-diagnostics-disclosure>{disclosure}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <button
                                type="button"
                                onClick={() => void copyReport()}
                                disabled={copyState === 'working'}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-default"
                            >
                                <CopyIcon size={12} className={copyState === 'working' ? 'animate-spin' : undefined} />
                                {copyText}
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleReport()}
                                disabled={copyState === 'working'}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[11px] font-semibold opacity-80 transition-colors disabled:opacity-50 disabled:cursor-default"
                            >
                                <ExternalLink size={12} />
                                {reportLabel}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QrLoginFailureHelp;
