import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LibraryAccountSurfaceProps } from '../../core/contracts/account';
import {
    useLibraryAccountLogin,
    useLibraryAccountPendingSwitch,
    type LibraryLoginView,
    type LibraryProviderSwitchView,
} from '../../core/bindings/useLibraryAccount';
import LibraryTuiAccountLogin, { type LibraryTuiDiagnosticsCopyState } from './LibraryTuiAccountLogin';
import { useLibraryTuiAccountKeys } from './useLibraryTuiAccountKeys';

// src/library/suites/tui/LibraryTuiAccount.tsx
// TUI 的 account surface（Library v2 · A6，开发版）：扫码登录框与平台切换确认，叠在 TUI 首页（以及集合层）之上。
// 数据全部来自账户 controller 的绑定（useLibraryAccountLogin / useLibraryAccountPendingSwitch），动作全部调 controller；
// 不碰 omni 与账户 store。登录会话与待确认切换在 controller 里，换 suite 会重挂这个组件，接着显示同一个会话。
// - 层：忽略宿主给的 layer（那是网格首页交上来的挂载点），自己渲染一个 fixed 全屏层（z-200，与网格的确认框同层），
//   挂 data-folia-keyboard-window（可交互时）让 TUI 首页 / 集合层的按键与全局热键让路，按键由捕获监听独占
//   （useLibraryTuiAccountKeys）；data-ponder-page-scope="none" 与其它 TUI surface 一致。
// - 登录（account-login / account-login-method）：↑↓ / ←→ 移动登录方式的高亮，Enter 是此刻的主动作——选高亮的方式、
//   重试、或重启后端；Esc 关闭（keyed 取消会话）；F4 复制诊断报告（account-login-diagnostics）。
// - 切换确认（account-switch-confirm）：Enter 确认、Esc 取消；不等 confirmSwitch 的事务走完，controller 同步清掉待确认
//   请求，层随之收起。登录框与确认同时存在时（例如刷新失败后又来了切换请求）确认盖在上面，按键归确认。
// - 可选动作按声明显示：没声明 account-login-diagnostics / account-backend-restart 就不给那个入口。

/** 多方式时方向键高亮着的那个：没有记录（或记录的不在列表里）时落在已选的方式上，再不然是第一个。 */
const resolveFocusedMethod = (view: LibraryLoginView | null, focusedId: string | null): string | null => {
    const options = view?.methodStep?.options ?? [];
    if (options.length === 0) return null;
    if (focusedId && options.some(option => option.id === focusedId)) return focusedId;
    return view?.session.selectedMethodId ?? options[0].id;
};

/**
 * 方框（及嵌在上边框里的标题）的底色：跟随应用的 --bg-color，没定义时（例如探针页）回落到主题背景色，
 * 否则底色透明，上边框会从标题文字中间穿过。
 */
const resolveTuiBoxBackground = (themeBackground: string | undefined) => (
    themeBackground ? `var(--bg-color, ${themeBackground})` : 'var(--bg-color, Canvas)'
);

const LibraryTuiAccountConfirm: React.FC<{
    view: LibraryProviderSwitchView;
    accentColor: string;
    boxBackground: string;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({
    view,
    accentColor,
    boxBackground,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();
    return (
        <section
            role="alertdialog"
            aria-modal="true"
            aria-label={view.title}
            data-tui-account-confirm={view.request.to}
            data-tui-confirm-reason={view.request.reason}
            className="relative w-full max-w-md border px-4 pb-3 pt-4 text-[13px]"
            style={{ borderColor: accentColor, backgroundColor: boxBackground, color: 'var(--text-primary)' }}
        >
            <h3 className="absolute -top-2.5 left-3 px-1 font-bold" style={{ color: accentColor, backgroundColor: boxBackground }}>
                {view.title}
            </h3>
            <p data-tui-confirm-message>{view.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3">
                <button type="button" data-tui-confirm-answer="confirm" onClick={onConfirm} className="hover:underline" style={{ color: accentColor }}>
                    {`[${t('libraryTui.confirm')}]`}
                </button>
                <button type="button" data-tui-confirm-answer="cancel" onClick={onCancel} className="opacity-70 hover:opacity-100">
                    {`[${t('libraryTui.cancel')}]`}
                </button>
                <span className="text-[11px] opacity-50">{t('libraryTui.promptHint')}</span>
            </div>
        </section>
    );
};

const LibraryTuiAccount: React.FC<LibraryAccountSurfaceProps> = ({ account, theme, isInteractive, declaredActions }) => {
    const login = useLibraryAccountLogin(account);
    const pendingSwitch = useLibraryAccountPendingSwitch(account);
    const accentColor = theme.accentColor || 'currentColor';
    const boxBackground = resolveTuiBoxBackground(theme.backgroundColor);
    const showDiagnostics = declaredActions.actions.includes('account-login-diagnostics');
    const showRestart = declaredActions.actions.includes('account-backend-restart');
    const containerRef = useRef<HTMLDivElement>(null);

    const loginVisible = Boolean(login?.visible);
    const visible = loginVisible || Boolean(pendingSwitch);

    const [focusedMethodRaw, setFocusedMethod] = useState<string | null>(null);
    const focusedMethod = resolveFocusedMethod(login, focusedMethodRaw);
    // 诊断复制的反馈只属于这一轮失败：换了会话代次（重试、换方式）就回到初始。
    const [copy, setCopy] = useState<{ sessionId: number; state: LibraryTuiDiagnosticsCopyState } | null>(null);
    const copyState = copy && copy.sessionId === login?.session.id ? copy.state : 'idle';

    // 登录换了 provider（新的一轮登录）时，方式高亮从头算。
    const loginProviderId = login?.session.providerId ?? null;
    useEffect(() => setFocusedMethod(null), [loginProviderId]);

    // 显示出来时把焦点拿进层里：首页上开着的行内输入框不该继续接收按键。
    useEffect(() => {
        if (visible && isInteractive) containerRef.current?.focus({ preventScroll: true });
    }, [visible, isInteractive, pendingSwitch?.request.id]);

    const copyDiagnostics = async () => {
        if (!login || !showDiagnostics || !login.diagnosticsPrompt) return;
        const sessionId = login.session.id;
        setCopy({ sessionId, state: 'working' });
        try {
            const result = await account.buildLoginDiagnosticReport();
            if (result.status !== 'ok') throw new Error('no login session to report');
            await navigator.clipboard.writeText(result.report);
            setCopy({ sessionId, state: 'copied' });
        } catch (error) {
            console.warn('[ProviderQrLogin] diagnostics:copy-failed', error);
            setCopy({ sessionId, state: 'failed' });
        }
    };

    const moveMethodFocus = (delta: 1 | -1) => {
        const options = login?.methodStep?.options ?? [];
        if (options.length === 0) return false;
        const index = Math.max(0, options.findIndex(option => option.id === focusedMethod));
        setFocusedMethod(options[(index + delta + options.length) % options.length].id);
        return true;
    };

    /** 登录框的 Enter：选高亮的（还没选中的）方式 → 重试 → 重启后端，取此刻第一个可做的。 */
    const runLoginPrimary = (view: LibraryLoginView) => {
        const { session } = view;
        if (view.methodStep && focusedMethod && focusedMethod !== session.selectedMethodId && !session.backend.failed) {
            void account.selectLoginMethod(focusedMethod);
            return true;
        }
        if (view.canRetry) {
            void account.retryLogin();
            return true;
        }
        if (showRestart && session.backend.canRestart) {
            void account.restartLoginBackend();
            return true;
        }
        return false;
    };

    useLibraryTuiAccountKeys({
        isActive: visible && isInteractive,
        containerRef,
        onKey: (key) => {
            if (pendingSwitch) {
                const requestId = pendingSwitch.request.id;
                // 不 await：controller 同步清掉待确认请求，层随之收起；清理与刷新在后台走完。
                if (key === 'Enter') void account.confirmSwitch(requestId);
                else if (key === 'Escape') account.cancelSwitch(requestId);
                else return false;
                return true;
            }
            if (!login || !loginVisible) return false;
            switch (key) {
                case 'ArrowUp':
                case 'ArrowLeft':
                    return moveMethodFocus(-1);
                case 'ArrowDown':
                case 'ArrowRight':
                    return moveMethodFocus(1);
                case 'Enter':
                    return runLoginPrimary(login);
                case 'Escape':
                    account.closeLogin();
                    return true;
                case 'F4':
                    if (!showDiagnostics || !login.diagnosticsPrompt) return false;
                    void copyDiagnostics();
                    return true;
                default:
                    return false;
            }
        },
    });

    if (!visible) return null;

    return (
        <div
            ref={containerRef}
            tabIndex={-1}
            data-tui-account={pendingSwitch ? 'confirm' : 'login'}
            data-ponder-page-scope="none"
            data-folia-keyboard-window={isInteractive ? 'true' : undefined}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 font-mono outline-none"
            // 点在遮罩上不把焦点交出去（按键照样归这一层，这里只是别让首页的元素拿到焦点）。
            onMouseDown={event => {
                if (event.target === event.currentTarget) event.preventDefault();
            }}
        >
            {login && loginVisible ? (
                <LibraryTuiAccountLogin
                    view={login}
                    accentColor={accentColor}
                    boxBackground={boxBackground}
                    focusedMethodId={focusedMethod}
                    showDiagnostics={showDiagnostics}
                    showRestart={showRestart}
                    copyState={copyState}
                    onFocusMethod={setFocusedMethod}
                    onSelectMethod={methodId => {
                        setFocusedMethod(methodId);
                        void account.selectLoginMethod(methodId);
                    }}
                    onRetry={() => void account.retryLogin()}
                    onRestart={() => void account.restartLoginBackend()}
                    onCopyDiagnostics={() => void copyDiagnostics()}
                    onClose={() => void account.closeLogin()}
                />
            ) : null}
            {pendingSwitch ? (
                <div className={loginVisible ? 'absolute inset-0 flex items-center justify-center bg-black/40 p-4' : 'contents'}>
                    <LibraryTuiAccountConfirm
                        view={pendingSwitch}
                        accentColor={accentColor}
                        boxBackground={boxBackground}
                        onConfirm={() => void account.confirmSwitch(pendingSwitch.request.id)}
                        onCancel={() => void account.cancelSwitch(pendingSwitch.request.id)}
                    />
                </div>
            ) : null}
        </div>
    );
};

export default LibraryTuiAccount;
