import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LibraryLoginView } from '../../core/bindings/useLibraryAccount';

// src/library/suites/tui/LibraryTuiAccountLogin.tsx
// TUI 的扫码登录框（只做展示）：等宽方框，标题嵌在上边框里；多方式时上面一排登录方式（↑↓ 移动高亮、Enter 选），
// 中间左边是二维码图片 / 选方式的占位 / 后端故障原因，右边是状态行、主动作（重试或重启后端），失败后右边接着是
// 简单办法（重启 Folia；换个网络再重启）、自检结论，最后才是「还是不行？」与复制诊断；下面是 provider 的说明与按键提示。数据全部来自 useLibraryAccountLogin 翻译好的快照，动作经回调交给 account surface
// （LibraryTuiAccount）调账户 controller；按键在 account surface 的捕获监听里处理，这里的按钮给鼠标用。

export type LibraryTuiDiagnosticsCopyState = 'idle' | 'working' | 'copied' | 'failed';

type LibraryTuiAccountLoginProps = {
    view: LibraryLoginView;
    accentColor: string;
    /** 方框与嵌在边框上的标题 / 关闭按钮的底色（带回落值，由 account surface 给出）。 */
    boxBackground: string;
    /** 方向键高亮着的登录方式（多方式时）。 */
    focusedMethodId: string | null;
    /** suite 声明了 account-login-diagnostics。 */
    showDiagnostics: boolean;
    /** suite 声明了 account-backend-restart。 */
    showRestart: boolean;
    copyState: LibraryTuiDiagnosticsCopyState;
    onFocusMethod: (methodId: string) => void;
    onSelectMethod: (methodId: string) => void;
    onRetry: () => void;
    onRestart: () => void;
    onCopyDiagnostics: () => void;
    onClose: () => void;
};

const LibraryTuiAccountLogin: React.FC<LibraryTuiAccountLoginProps> = ({
    view,
    accentColor,
    boxBackground,
    focusedMethodId,
    showDiagnostics,
    showRestart,
    copyState,
    onFocusMethod,
    onSelectMethod,
    onRetry,
    onRestart,
    onCopyDiagnostics,
    onClose,
}) => {
    const { t } = useTranslation();
    const { session, methodStep, backendFailure } = view;
    const awaitingMethod = Boolean(methodStep) && session.selectedMethodId == null;
    const canRestart = showRestart && Boolean(backendFailure);
    const diagnostics = showDiagnostics && view.diagnosticsPrompt ? view.diagnosticsPrompt : null;
    const failureTips = diagnostics ? view.failureTips : null;

    // 按键提示跟着此刻能做的事走（与捕获监听里的判断同一套条件）。
    const hints = [
        methodStep ? t('libraryTui.loginHintMethod') : null,
        view.canRetry ? t('libraryTui.loginHintRetry') : null,
        canRestart && session.backend.canRestart ? t('libraryTui.loginHintRestart') : null,
        diagnostics ? t('libraryTui.loginHintDiagnostics') : null,
        t('libraryTui.loginHintClose'),
    ].filter(Boolean).join(' · ');

    const copyLabel = copyState === 'copied'
        ? t('home.qrDiagnosticsCopied')
        : copyState === 'failed'
            ? t('home.qrDiagnosticsCopyFailed')
            : t('home.qrDiagnosticsCopy');

    return (
        <section
            role="dialog"
            aria-modal="true"
            aria-label={view.title}
            data-tui-account-login={session.providerId}
            data-tui-login-phase={session.phase}
            className={`relative w-full ${diagnostics ? 'max-w-2xl' : 'max-w-md'} border px-4 pb-3 pt-4 text-[13px]`}
            style={{ borderColor: accentColor, backgroundColor: boxBackground, color: 'var(--text-primary)' }}
        >
            <h3 className="absolute -top-2.5 left-3 px-1 font-bold" style={{ color: accentColor, backgroundColor: boxBackground }}>
                {view.title}
            </h3>
            <button
                type="button"
                onClick={onClose}
                aria-label={view.closeLabel}
                className="absolute -top-2.5 right-3 px-1 opacity-60 hover:opacity-100"
                style={{ backgroundColor: boxBackground }}
            >
                [x]
            </button>

            {methodStep && (
                <div className="mb-3" data-tui-login-methods>
                    <p className="opacity-60">{methodStep.title}</p>
                    <p className="whitespace-pre-line text-[12px] opacity-45">{methodStep.hint}</p>
                    <div className="mt-1 flex flex-col">
                        {methodStep.options.map(option => {
                            const selected = session.selectedMethodId === option.id;
                            const focused = focusedMethodId === option.id;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    aria-pressed={selected}
                                    data-tui-login-method={option.id}
                                    data-focused={focused ? 'true' : undefined}
                                    onMouseEnter={() => onFocusMethod(option.id)}
                                    onClick={() => onSelectMethod(option.id)}
                                    className={`text-left ${focused ? 'font-bold' : 'opacity-70 hover:opacity-100'}`}
                                    style={focused ? { color: accentColor } : undefined}
                                >
                                    <span aria-hidden="true">{`${focused ? '>' : ' '} ${selected ? '(•)' : '( )'} `}</span>
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex gap-4">
                <div className="flex h-40 w-40 shrink-0 items-center justify-center border border-current/20 bg-white" data-tui-login-qr>
                    {backendFailure ? (
                        <div className="flex h-full w-full flex-col justify-center gap-1 p-2 text-[11px] text-red-600" data-tui-login-backend>
                            <span className="font-bold">{backendFailure.title}</span>
                            {session.backend.detail ? <span className="break-words opacity-80">{session.backend.detail}</span> : null}
                        </div>
                    ) : awaitingMethod ? (
                        <span className="p-3 text-center text-[11px] text-zinc-500">{methodStep?.pending}</span>
                    ) : session.qrImageUrl ? (
                        <img src={session.qrImageUrl} alt="QR Code" className="h-[152px] w-[152px]" />
                    ) : (
                        <span className="text-zinc-500" aria-hidden="true">…</span>
                    )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {methodStep && !awaitingMethod ? <span className="text-[12px] opacity-50">{methodStep.current}</span> : null}
                    {view.status ? (
                        <span data-tui-login-status className={session.phase === 'error' || (session.phase === 'expired' && session.failure) ? 'text-red-500' : undefined}>
                            {view.status}
                        </span>
                    ) : null}
                    {canRestart && backendFailure ? (
                        <button
                            type="button"
                            data-tui-login-restart
                            disabled={session.backend.restarting}
                            onClick={onRestart}
                            className="self-start hover:underline disabled:opacity-50"
                            style={{ color: accentColor }}
                        >
                            <span aria-hidden="true">[</span>
                            {session.backend.restarting ? backendFailure.restartingLabel : backendFailure.restartLabel}
                            <span aria-hidden="true">]</span>
                        </button>
                    ) : null}
                    {view.canRetry ? (
                        <button type="button" data-tui-login-retry onClick={onRetry} className="self-start hover:underline" style={{ color: accentColor }}>
                            <span aria-hidden="true">[</span>
                            {view.retryLabel}
                            <span aria-hidden="true">]</span>
                        </button>
                    ) : null}
                    {diagnostics ? (
                        <div className="mt-1 border-t border-current/15 pt-2 text-[12px]" data-tui-login-diagnostics>
                            {failureTips ? (
                                <div data-tui-login-tips>
                                    <p className="font-bold opacity-75">{failureTips.title}</p>
                                    {failureTips.items.map((item, index) => <p key={item}>{`${index + 1}. ${item}`}</p>)}
                                </div>
                            ) : null}
                            {view.selfCheck ? (
                                <div className="mt-2" data-tui-login-self-check={view.selfCheck.running ? 'running' : 'done'}>
                                    <p className="font-bold opacity-75">{view.selfCheck.title}</p>
                                    {view.selfCheck.running ? <p className="opacity-60">{view.selfCheck.runningText}</p> : null}
                                    {view.selfCheck.verdict ? <p data-tui-login-self-check-verdict>{view.selfCheck.verdict}</p> : null}
                                    {view.selfCheck.proxyNote ? <p className="text-[11px] opacity-60">{view.selfCheck.proxyNote}</p> : null}
                                    {view.selfCheck.error ? <p className="opacity-70">{view.selfCheck.error}</p> : null}
                                    {view.selfCheck.items.map(item => (
                                        <p key={item.id} className="text-[11px] opacity-70" data-tui-login-self-check-item={item.id}>
                                            {`${item.state === 'ok' ? '[ok]' : item.state === 'fail' ? '[!!]' : '[??]'} ${item.label}${item.detail && item.state !== 'ok' ? `: ${item.detail}` : ''}`}
                                        </p>
                                    ))}
                                </div>
                            ) : null}
                            {/* 诊断与反馈放在最后、调暗：先让用户试简单办法。 */}
                            <div className="mt-2 opacity-70">
                                {failureTips ? <p>{failureTips.escalation}</p> : null}
                                <p className="text-[11px] opacity-80">{diagnostics}</p>
                                <p className="text-[11px] opacity-60">{t('home.qrDiagnosticsDisclosure')}</p>
                                <button
                                    type="button"
                                    data-tui-login-diagnostics-copy={copyState}
                                    disabled={copyState === 'working'}
                                    onClick={onCopyDiagnostics}
                                    className="mt-1 hover:underline disabled:opacity-50"
                                    style={{ color: accentColor }}
                                >
                                    <span aria-hidden="true">[</span>
                                    {copyLabel}
                                    <span aria-hidden="true">]</span>
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            <p className="mt-3 text-[11px] opacity-35">{view.note}</p>
            <p className="mt-1 text-[11px] opacity-50" data-tui-login-hints>{hints}</p>
        </section>
    );
};

export default LibraryTuiAccountLogin;
