import type { OnlineProviderId } from '../../types/onlineMusic';
import { formatDiagnosticClock } from '../../utils/qrLoginDiagnosticReport';

// src/services/onlineMusic/loginBackendDiagnostics.ts
// 诊断报告里 provider 段的公共部分：把主进程的内嵌后端快照（electron/loginBackendIpc.cjs 的 get-login-diagnostics）
// 排成报告行。网易与 QQ 共用应用环境、后端状态、拉起步骤、连接记录的格式；各自的专属部分（网易的登录请求与扫码身份、
// QQ 的包内失败与 qq-auth 事件）各排各的。format* 是纯函数；collectLoginBackendDiagnostics 去主进程取快照。
// 报告原样贴进公开 issue，界面已告知用户其中包含哪些数据（版本、网卡与 IP、请求记录与错误原文）；凭据的值从不进快照。

const MAX_RECENT_CONNECTIONS = 20;

const yesNo = (value: boolean | null | undefined): string => (value == null ? 'unknown' : value ? 'yes' : 'no');
const ms = (value: number | null | undefined): string => (value == null ? '-' : `${value}ms`);
const formatValue = (value: unknown): string => {
    if (typeof value === 'string') return /\s/.test(value) || value === '' ? JSON.stringify(value) : value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};
const formatFields = (fields: Record<string, unknown> | null | undefined): string => Object.entries(fields ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(' ');

const formatAddress = (address: string | null | undefined, family: 4 | 6 | null | undefined): string => (
    address ? `${address} (v${family ?? '?'})` : 'no connection'
);

/** 一次连接一行：去向 → 连上的地址、TCP / TLS 耗时 → 结局；Happy Eyeballs 换过地址时附上每次尝试。 */
export const formatConnection = (connection: ElectronNetworkConnection, { withTarget = true } = {}): string => {
    const target = withTarget ? `${connection.method ? `${connection.method} ` : ''}${connection.host}${connection.path} ` : '';
    const timing = [
        `tcp=${ms(connection.connectMs)}`,
        connection.tlsMs != null ? `tls=${ms(connection.tlsMs)}` : '',
        connection.reusedSocket ? 'reused-socket' : '',
    ].filter(Boolean).join(' ');
    const outcome = connection.error
        ? `${connection.error.code ?? 'error'} at ${connection.error.phase}: ${connection.error.message}`
        : connection.dnsError
            ? `DNS ${connection.dnsError.code ?? 'error'}: ${connection.dnsError.message}`
            : connection.status != null ? `HTTP ${connection.status}` : connection.settled ?? 'pending';
    const attempts = connection.attempts.length > 1
        ? `; attempts: ${connection.attempts.map(attempt => `${attempt.address} v${attempt.family ?? '?'} ${attempt.outcome}${attempt.error?.code ? ` ${attempt.error.code}` : ''}`).join(', ')}`
        : '';
    return `${target}→ ${formatAddress(connection.remote?.address, connection.remote?.family)} ${timing} → ${outcome} (${ms(connection.totalMs)})${attempts}`;
};

const formatTimedConnection = (connection: ElectronNetworkConnection): string => (
    `  ${connection.at != null ? `${formatDiagnosticClock(connection.at)} ` : ''}${formatConnection(connection)}`
);

const formatApp = (app: ElectronAppEnvironment): string[] => {
    const store = app.credentialStore;
    return [
        `app: ${app.version} electron ${app.electron} (node ${app.node}, chrome ${app.chrome}) ${app.platform} ${app.arch}`,
        `os: ${app.osRelease}${app.osVersion ? ` (${app.osVersion})` : ''}, locale ${app.locale ?? '?'}, time zone ${app.timeZone ?? '?'}, uptime ${app.uptimeSec}s`,
        store?.error
            ? `credential store: error "${store.error}"`
            : `credential store: encryption=${yesNo(store?.encryptionAvailable)}${store?.backend ? ` backend=${store.backend}` : ''}`,
    ];
};

const formatStartup = (runs: ElectronBackendStartupRun[]): string[] => {
    if (runs.length === 0) return ['startup: (not started)'];
    return [
        `startup runs (${runs.length}, oldest first, UTC):`,
        ...runs.flatMap(run => [
            `  ${formatDiagnosticClock(run.startedAt)} ${run.outcome}${run.finishedAt != null ? ` (${run.finishedAt - run.startedAt}ms)` : ''}`,
            ...run.steps.map(step => [
                `    ${step.id} ${step.outcome} ${ms(step.durationMs)}`,
                formatFields(step.detail),
                step.error ? `error=${formatValue(step.error)}` : '',
            ].filter(Boolean).join(' ')),
        ]),
    ];
};

const formatBackendStatus = (backend: { status: string; port: number | null; error: string | null; updatedAt?: number }): string => (
    `backend: ${backend.status}${backend.port ? ` 127.0.0.1:${backend.port}` : ''}${backend.error ? ` error=${formatValue(backend.error)}` : ''}`
    + `${backend.updatedAt ? ` (since ${formatDiagnosticClock(backend.updatedAt)})` : ''}`
);

const formatRecentConnections = (label: string, connections: ElectronNetworkConnection[]): string[] => {
    const recent = connections.slice(-MAX_RECENT_CONNECTIONS);
    return [
        `${label} (${recent.length}${connections.length > recent.length ? ` of ${connections.length}` : ''}, oldest first, UTC):`,
        ...(recent.length > 0 ? recent.map(formatTimedConnection) : ['  (none)']),
    ];
};

// ─── 网易 ──────────────────────────────────────────────────────────────

const formatNeteaseRequest = (request: ElectronNeteaseLoginRequestRecord): string[] => {
    const { outcome } = request;
    const head = [
        `  ${formatDiagnosticClock(request.at)} ${request.uri}`,
        outcome.settled,
        `status=${outcome.status ?? '-'}`,
        `code=${outcome.code ?? '-'}`,
        outcome.message ? `msg=${JSON.stringify(outcome.message)}` : '',
        ms(request.durationMs),
        `ip-header=${request.ipHeader}`,
        `device=…${request.deviceIdTail || '-'}`,
        `MUSIC_U=${yesNo(request.hasMusicU)}`,
        `MUSIC_A=${yesNo(request.hasMusicA)}`,
    ].filter(Boolean).join(' ');
    return [head, ...(request.connections ?? []).map(connection => `      ↳ ${connection.host} ${formatConnection(connection, { withTarget: false })}`)];
};

const formatNeteaseIdentity = (identity: ElectronNeteaseLoginDiagnostics['identity']): string => {
    const last = identity.lastRotatedAt === null
        ? ''
        : ` (last ${formatDiagnosticClock(identity.lastRotatedAt)}, new anonymous token=${yesNo(identity.lastTokenRenewed)})`;
    return [
        `identity: process started ${new Date(identity.processStartedAt).toISOString()}`,
        `deviceId=${identity.deviceId ?? '-'}`,
        `qr connection resets=${identity.connectionResets}`,
        `device rotations=${identity.rotations}${last}`,
        `rotation pending=${yesNo(identity.pendingRotation)}`,
    ].join(', ');
};

const formatInterfaces = (network: ElectronNeteaseLoginDiagnostics['login']['network']): string => {
    if (network.error) return `network interfaces: error ${JSON.stringify(network.error)}`;
    const interfaces = network.interfaces
        .map(item => `${item.name}: ${item.addresses.map(address => address.address).join(', ')}`)
        .join('; ');
    return `network interfaces: ${interfaces || 'none'}`;
};

const formatNeteaseSnapshot = (snapshot: ElectronNeteaseLoginDiagnostics): string[] => {
    const { requests } = snapshot.login;
    // 同一轮扫码里 deviceId 变过是一个可疑点（渲染进程注册匿名身份会改掉主进程的全局 deviceId），
    // 连接被重置后的主动轮换也会换它，对照 identity 行区分。
    const deviceTails = new Set(requests.map(request => request.deviceIdTail).filter(Boolean));
    return [
        formatInterfaces(snapshot.login.network),
        // 用户说「重启后好了」时，看进程启动时刻与轮换次数，才分得清是换了设备标识还是换了网络。
        formatNeteaseIdentity(snapshot.identity),
        `anonymous token at load: ${snapshot.login.startup.anonymousTokenAtLoad ?? 'unknown'}`,
        `device ids seen in login requests: ${deviceTails.size}`,
        `login requests (${requests.length}, oldest first, UTC):`,
        ...(requests.length > 0 ? requests.flatMap(formatNeteaseRequest) : ['  (none)']),
        ...formatRecentConnections('other upstream connections', snapshot.connections),
    ];
};

// ─── QQ ────────────────────────────────────────────────────────────────

const formatQqFailure = (failure: ElectronQqLoginDiagnostics['failures'][number]): string[] => {
    const { stack, ...error } = failure.error as Record<string, unknown> & { stack?: unknown };
    const head = [
        `  ${formatDiagnosticClock(failure.at)} ${failure.kind}`,
        failure.stage ? `stage=${failure.stage}` : '',
        failure.channel ? `channel=${failure.channel}` : '',
        failure.sessionState ? `state=${failure.sessionState}` : '',
        formatFields(error),
    ].filter(Boolean).join(' ');
    return [head, ...(Array.isArray(stack) ? stack.map(line => `      ${String(line)}`) : [])];
};

const formatQqSnapshot = (snapshot: ElectronQqLoginDiagnostics): string[] => [
    `qq-music-api: ${snapshot.version ?? 'unknown'}, hooks: ${snapshot.hooks.installed.join(', ') || 'none'}${snapshot.hooks.error ? ` (error ${JSON.stringify(snapshot.hooks.error)})` : ''}`,
    `backend login failures (${snapshot.failures.length}, oldest first, UTC):`,
    ...(snapshot.failures.length > 0 ? snapshot.failures.flatMap(formatQqFailure) : ['  (none)']),
    `auth events (${snapshot.authEvents.length}, oldest first, UTC):`,
    ...(snapshot.authEvents.length > 0
        ? snapshot.authEvents.map(event => `  ${formatDiagnosticClock(event.at)} ${event.level} ${event.event} ${event.details && typeof event.details === 'object' ? formatFields(event.details as Record<string, unknown>) : formatValue(event.details ?? '')}`.trimEnd())
        : ['  (none)']),
    ...formatRecentConnections('upstream connections', snapshot.connections),
];

// ─── 汇总 ──────────────────────────────────────────────────────────────

/**
 * 把一份内嵌后端快照排成报告行；sessionLines 是渲染进程这一侧的状态（cookie 有没有、最近一次账户检查等）。
 * snapshot 为 null 表示没有主进程可问（网页版）：remote 是配置的远端 API 地址。
 */
export const formatLoginBackendDiagnostics = (
    snapshot: ElectronLoginDiagnostics | null,
    sessionLines: string[],
    remote: string | null = null,
): string[] => {
    if (!snapshot) return [`runtime: web (remote API ${remote ?? 'not configured'})`, ...sessionLines];
    return [
        'runtime: electron (embedded API)',
        ...formatApp(snapshot.app),
        formatBackendStatus(snapshot.backend),
        ...formatStartup(snapshot.startup),
        ...sessionLines,
        ...(snapshot.providerId === 'netease' ? formatNeteaseSnapshot(snapshot) : formatQqSnapshot(snapshot)),
    ];
};

/** 去主进程取快照并排成行；取快照失败时把错误写进报告（诊断自己不能再失败）。 */
export const collectLoginBackendDiagnostics = async (
    providerId: OnlineProviderId,
    sessionLines: string[],
    remote: string | null = null,
): Promise<string[]> => {
    const getSnapshot = typeof window === 'undefined' ? undefined : window.electron?.getLoginDiagnostics;
    if (!getSnapshot) return formatLoginBackendDiagnostics(null, sessionLines, remote);
    try {
        return formatLoginBackendDiagnostics(await getSnapshot(providerId), sessionLines, remote);
    } catch (error) {
        return [`backend diagnostics unavailable: ${error instanceof Error ? error.message : String(error)}`, ...sessionLines];
    }
};
