import { OnlineProviderError } from '../../../types/onlineMusic';
import type { OnlineProviderId, ProviderAccountSummary, QrLoginErrorReason, QrLoginFailureKind } from '../../../types/onlineMusic';
import type {
    LibraryLoginBackendState,
    LibraryLoginCopy,
    LibraryLoginPhase,
    LibraryLoginSessionSnapshot,
    LibraryLogoutRejectReason,
    LibraryNeteaseBackendHealth,
    LibraryProviderUnavailableReason,
} from '../contracts/account';
import type { LibraryHomeMessage } from '../contracts/homeModel';
import { canSwitchToProviderDirectly } from './onlineProviderAccountView';

// src/library/core/model/accountRules.ts
// 在线账户的纯规则（Library v2 · A1）：选平台走哪一支、当前平台的回落、登录界面的文案 key、登录会话的派生
// （是否在选方式、能否重试、能否给诊断、后端故障）、能否登出。从 Grid3D、useOnlineProviderQrLogin、
// useOnlineProviderPlatform、OnlineProviderLoginModal 与 OnlineProviderSwitcher 里原样提出来，任何 suite 与
// 账户 controller 共用；这里只返回 i18n key，翻译在绑定 / UI。

// ─── 选平台 ─────────────────────────────────────────────────────────────

export type LibraryProviderSelection =
    | { kind: 'unavailable'; reason: LibraryProviderUnavailableReason }
    | { kind: 'switch' }
    | { kind: 'login' };

/**
 * 选一个平台时走哪一支：不在列表里 / 未配置 → unavailable；能直接切（已登录，或 mod 源这类无账户的）→ switch；
 * 否则 → login（未登录、登录失效、账户还在解析都要扫码）。
 */
export const resolveProviderSelection = (provider: ProviderAccountSummary | undefined): LibraryProviderSelection => {
    if (!provider) return { kind: 'unavailable', reason: 'unknown-provider' };
    if (!provider.availability.configured) return { kind: 'unavailable', reason: 'not-configured' };
    if (canSwitchToProviderDirectly(provider)) return { kind: 'switch' };
    return { kind: 'login' };
};

/** 连接面板 / 平台列表上的动作文案：能直接切是「切换到」，否则「登录」（Grid3D 的 getActionLabel）。 */
export const resolveProviderSelectLabel = (provider: ProviderAccountSummary): LibraryHomeMessage => ({
    key: canSwitchToProviderDirectly(provider) ? 'home.switchToProvider' : 'home.loginToProvider',
    values: { provider: provider.shortName || provider.displayName },
});

// ─── 当前平台 ───────────────────────────────────────────────────────────

/** 存的当前平台不在 provider 列表里（例如 mod 源被关掉）时回落到网易；账户缓存不动（原 useOnlineProviderPlatform）。 */
export const resolveActiveProviderId = (
    providers: readonly ProviderAccountSummary[],
    storedProviderId: OnlineProviderId,
): OnlineProviderId => (
    providers.some(provider => provider.providerId === storedProviderId) ? storedProviderId : 'netease'
);

/** 当前平台的摘要；回落后的 id 也找不到（列表里没有网易）时取第一个。 */
export const resolveActiveProviderSummary = (
    providers: readonly ProviderAccountSummary[],
    activeProviderId: OnlineProviderId,
): ProviderAccountSummary | undefined => (
    providers.find(provider => provider.providerId === activeProviderId) || providers[0]
);

// ─── 切换确认 ───────────────────────────────────────────────────────────

/** 切换确认框的文案（原 App.tsx 的 providerSwitchConfirmDialog）；平台名由调用方经账户端口的 getProviderLabel 取。 */
export const resolveProviderSwitchCopy = (providerLabel: string): { title: LibraryHomeMessage; description: LibraryHomeMessage } => ({
    title: { key: 'home.switchOnlineProvider' },
    description: { key: 'home.confirmOnlineProviderSwitch', values: { provider: providerLabel } },
});

// ─── 登出 ───────────────────────────────────────────────────────────────

export type LibraryLogoutEligibility =
    | { allowed: true }
    | { allowed: false; reason: LibraryLogoutRejectReason };

/** 只有当前且已登录的平台可以登出（切换器只在这一行显示登出按钮）。 */
export const resolveLogoutEligibility = (
    provider: ProviderAccountSummary | undefined,
    activeProviderId: OnlineProviderId,
): LibraryLogoutEligibility => {
    if (!provider) return { allowed: false, reason: 'unknown-provider' };
    if (provider.providerId !== activeProviderId) return { allowed: false, reason: 'not-active' };
    if (provider.status !== 'authenticated') return { allowed: false, reason: 'not-authenticated' };
    return { allowed: true };
};

export const canLogoutProvider = (
    provider: ProviderAccountSummary | undefined,
    activeProviderId: OnlineProviderId,
): boolean => resolveLogoutEligibility(provider, activeProviderId).allowed;

// ─── 登录文案 ───────────────────────────────────────────────────────────

const LOGIN_COPY_BY_PROVIDER: Readonly<Record<string, { title: string; note: string }>> = {
    kugou: { title: 'home.loginTitleKugou', note: 'home.loginNoteKugou' },
    qq: { title: 'home.loginTitleQq', note: 'home.loginNoteQq' },
    bodian: { title: 'home.loginTitleBodian', note: 'home.loginNoteBodian' },
};
const NETEASE_LOGIN_COPY = { title: 'home.loginTitle', note: 'home.loginNote' };

/** 登录界面的标题与说明；没有专属文案的 provider（含网易与未知 / mod 源）用网易的（现状，A0 钉着）。 */
export const resolveLoginCopy = (providerId: OnlineProviderId): { title: LibraryHomeMessage; note: LibraryHomeMessage } => {
    // 只认自有属性：'constructor' 这类 id 不该从原型链上取到东西。
    const copy = Object.prototype.hasOwnProperty.call(LOGIN_COPY_BY_PROVIDER, providerId)
        ? LOGIN_COPY_BY_PROVIDER[providerId]
        : NETEASE_LOGIN_COPY;
    return { title: { key: copy.title }, note: { key: copy.note } };
};

const LOGIN_STATUS_KEY_BY_PHASE: Readonly<Partial<Record<LibraryLoginPhase, string>>> = {
    loading: 'home.loadingQr',
    waiting: 'home.scanQr',
    scanned: 'home.qrScanned',
    confirmed: 'home.loginSuccess',
    expired: 'home.qrExpired',
    error: 'home.loginError',
};

/** 阶段对应的状态行（原 useOnlineProviderQrLogin 的 getQrStatusText，返回 key）；还没开始要码的两步没有状态行。 */
export const resolveLoginStatusMessage = (phase: LibraryLoginPhase): LibraryHomeMessage | null => {
    const key = LOGIN_STATUS_KEY_BY_PHASE[phase];
    return key ? { key } : null;
};

/** 多方式登录第一步的文案（键名带 qq 是历史原因，任何声明了多方式的 provider 都用它）。 */
export const LOGIN_METHOD_STEP_COPY: Readonly<{ title: LibraryHomeMessage; hint: LibraryHomeMessage; pending: LibraryHomeMessage }> = {
    title: { key: 'home.qqLoginMethodTitle' },
    hint: { key: 'home.qqLoginMethodHint' },
    pending: { key: 'home.qqLoginMethodPending' },
};

/**
 * 登录失败后先给的简单办法：重启应用；换个网络再重启应用。诊断报告与反馈收在后面（escalation），
 * 用户试过这些还不行才去点，不一上来就让人发 issue。
 */
export const LOGIN_FAILURE_TIPS: Readonly<{ title: LibraryHomeMessage; items: readonly LibraryHomeMessage[]; escalation: LibraryHomeMessage }> = {
    title: { key: 'home.qrTipsTitle' },
    items: [{ key: 'home.qrTipRestart' }, { key: 'home.qrTipSwitchNetwork' }],
    escalation: { key: 'home.qrDiagnosticsToggle' },
};

/** 诊断入口的提示语：扫过码却过期（多半是手机端拒绝）单独一句（buildQrLoginFailureHelpProps）。 */
export const resolveLoginDiagnosticsPrompt = (failure: QrLoginFailureKind): LibraryHomeMessage => ({
    key: failure === 'expired-after-scan' ? 'home.qrDiagnosticsPromptScanned' : 'home.qrDiagnosticsPrompt',
});

// ─── 登录会话的派生 ─────────────────────────────────────────────────────

type LoginMethodState = Pick<LibraryLoginSessionSnapshot, 'methods' | 'selectedMethodId'>;
type LoginRetryState = Pick<LibraryLoginSessionSnapshot, 'phase' | 'methods' | 'selectedMethodId'>
    & Partial<Pick<LibraryLoginSessionSnapshot, 'retryCooldownSeconds'>>
    & { backend: Pick<LibraryLoginBackendState, 'failed'> };

/** 多方式且还没选：停在第一步，不向后端要码（登录弹窗的 awaitingMethod）。 */
export const isAwaitingLoginMethod = ({ methods, selectedMethodId }: LoginMethodState): boolean => (
    methods.length > 0 && selectedMethodId == null
);

/**
 * 登录界面此刻是否该显示。方式还在解析时不显示（Grid3D 解析完才开弹窗）；扫码确认后立即收起
 * （账户刷新失败时会话回到 error，界面再出现）。
 */
export const isLoginDialogVisible = (session: Pick<LibraryLoginSessionSnapshot, 'phase'> | null): boolean => (
    session !== null && session.phase !== 'resolving-methods' && session.phase !== 'confirmed'
);

/** 后端要求的冷却还没结束：这时重新要码只会被拒（429），重试先不给。 */
export const isLoginRetryCoolingDown = (session: Partial<Pick<LibraryLoginSessionSnapshot, 'retryCooldownSeconds'>>): boolean => (
    session.retryCooldownSeconds != null
);

/** 重试可用：expired / error，且不在选方式的第一步、后端没有故障、没有在冷却（grid 弹窗与 TUI 都看它）。 */
export const canRetryLogin = (session: LoginRetryState): boolean => (
    (session.phase === 'expired' || session.phase === 'error')
    && !isAwaitingLoginMethod(session)
    && !session.backend.failed
    && !isLoginRetryCoolingDown(session)
);

/**
 * 诊断入口：有失败形态就给（grid 的诊断区块与 TUI 的 F4 都看它）。后端没拉起来时同样给：
 * 重启不一定能解决，报告里有拉起的每一步和错误原文，正是排查要的东西。
 */
export const canShowLoginDiagnostics = (session: Pick<LibraryLoginSessionSnapshot, 'failure'>): boolean => (
    session.failure !== null
    // 在手机上取消是用户自己的操作，没有要排查的东西。
    && session.failure !== 'canceled-on-device'
);

// ─── 登录 / 账户错误的日志描述 ──────────────────────────────────────────

/**
 * 写进日志与诊断时间线的错误描述（扫码会话与账户 controller 共用，不分 provider）：名字与原文，
 * 加上 OnlineProviderError 的错误类别、HTTP 状态、冷却时长，Node 错误码，扫码的结构化原因，以及后端的原始响应（cause）。
 * 凭据不会出现在这里：provider 的错误与后端响应本身不带 cookie / token 的值。
 */
export const describeLoginError = (error: unknown): Record<string, unknown> => {
    if (!(error instanceof Error)) return { name: 'Error', message: String(error) };
    const record = error as Error & Record<string, unknown>;
    const cause = error instanceof OnlineProviderError ? error.cause : record.cause;
    const detail: Record<string, unknown> = {
        name: error.name,
        message: error.message,
        code: record.code,
        httpStatus: record.httpStatus,
        retryAfterMs: record.retryAfterMs,
        reason: record.qrLoginReason,
        transient: record.transient,
        cause: cause instanceof Error ? `${cause.name}: ${cause.message}` : cause,
    };
    return Object.fromEntries(Object.entries(detail).filter(([, value]) => value !== undefined && value !== null));
};

const QR_LOGIN_ERROR_REASONS: ReadonlySet<string> = new Set<QrLoginErrorReason>(['canceled-on-device', 'connection-reset']);

/** 扫码失败的结构化原因只认已知的几种；provider 或主进程带回的其它值按普通失败处理。 */
export const knownQrLoginErrorReason = (reason: unknown): QrLoginErrorReason | null => (
    typeof reason === 'string' && QR_LOGIN_ERROR_REASONS.has(reason) ? reason as QrLoginErrorReason : null
);

/** 要码 / 轮询抛出的错误上带的结构化原因（error.qrLoginReason，例如连接被重置）；读不出时为 null。 */
export const qrLoginErrorReasonOf = (error: unknown): QrLoginErrorReason | null => (
    knownQrLoginErrorReason(error && typeof error === 'object' ? (error as { qrLoginReason?: unknown }).qrLoginReason : undefined)
);

/** 错误里带的后端冷却时长（OnlineProviderError.retryAfterMs，429 退避）；读不出时为 null。 */
export const retryAfterMsOf = (error: unknown): number | null => {
    const value = error && typeof error === 'object' ? (error as { retryAfterMs?: unknown }).retryAfterMs : undefined;
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * 登录后端的状态：只有网易登录、且 Electron 后端已知启动失败时算故障（web 构建 supported=false，永远不算）。
 * 其它 provider 的后端健康不在范围内。
 */
export const resolveLoginBackendState = (
    providerId: OnlineProviderId,
    health: LibraryNeteaseBackendHealth,
): LibraryLoginBackendState => {
    const failed = health.supported && providerId === 'netease' && health.status === 'error';
    return {
        failed,
        detail: failed ? health.error : null,
        restarting: health.restarting,
        canRestart: failed && !health.restarting,
    };
};

/** 重启后端之后要不要直接把二维码要回来：恢复运行才要，省掉一次手动刷新。 */
export const shouldResumeLoginAfterBackendRestart = (health: LibraryNeteaseBackendHealth): boolean => (
    health.status === 'running'
);

/**
 * 失败时的状态行：在手机上取消、连接被重置、以及要等后端冷却时，换成说明原因 / 剩余秒数的文案；其余按阶段。
 * 秒数按失败那一刻算，不随时间倒数；冷却结束时快照清掉秒数，状态行回到普通文案、重试同时可用。
 */
const resolveLoginFailureStatus = (
    session: Pick<LibraryLoginSessionSnapshot, 'phase'> & Partial<Pick<LibraryLoginSessionSnapshot, 'failure' | 'retryCooldownSeconds'>>,
): LibraryHomeMessage | null => {
    const seconds = session.retryCooldownSeconds ?? null;
    if (session.failure === 'canceled-on-device') {
        return seconds === null
            ? { key: 'home.qrCanceledOnDevice' }
            : { key: 'home.qrCanceledOnDeviceCooldown', values: { seconds } };
    }
    if (session.failure === 'connection-reset' && seconds === null) {
        return { key: 'home.qrConnectionReset' };
    }
    if (seconds !== null && (session.phase === 'error' || session.phase === 'expired')) {
        return { key: 'home.qrRetryCooldown', values: { seconds } };
    }
    return resolveLoginStatusMessage(session.phase);
};

/**
 * 登录会话的整套文案：标题与说明按 provider；状态行按阶段（失败原因与冷却见 resolveLoginFailureStatus），
 * 但在选方式的第一步、后端故障时不显示（弹窗在这两种情况下藏起状态行——关窗重开时上一轮的状态是过期信息）。
 */
export const resolveLoginSessionCopy = (
    session: Pick<LibraryLoginSessionSnapshot, 'providerId' | 'phase' | 'methods' | 'selectedMethodId'>
        & Partial<Pick<LibraryLoginSessionSnapshot, 'failure' | 'retryCooldownSeconds'>>
        & { backend: Pick<LibraryLoginBackendState, 'failed'> },
): LibraryLoginCopy => ({
    ...resolveLoginCopy(session.providerId),
    status: isAwaitingLoginMethod(session) || session.backend.failed
        ? null
        : resolveLoginFailureStatus(session),
});
