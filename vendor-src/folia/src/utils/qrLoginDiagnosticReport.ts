import type { LoginSelfCheckError, LoginSelfCheckHost, LoginSelfCheckResult, OnlineProviderId, QrLoginFailureKind } from '../types/onlineMusic';

// src/utils/qrLoginDiagnosticReport.ts
// 扫码登录诊断报告的格式。报告是给用户原样贴进 issue 的，所以用固定的英文字段、包在代码块里，
// 不随界面语言变化；三段：本轮扫码的时间线、失败后的主动自检、provider 自己排好的行（后端状态、拉起步骤、请求与连接）。

export type QrLoginTimelineEvent = {
    at: number;
    event: string;
    detail: Record<string, unknown>;
};

export const QR_LOGIN_TIMELINE_LIMIT = 60;

// UTC 时刻，精确到毫秒。渲染进程时间线和主进程请求记录都用它，两边的行才能对着看。
export const formatDiagnosticClock = (at: number): string => new Date(at).toISOString().slice(11, 23);

const formatDetailValue = (value: unknown): string => {
    if (typeof value === 'string') return /\s/.test(value) || value === '' ? JSON.stringify(value) : value;
    if (typeof value === 'number' || typeof value === 'boolean' || value == null) return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const formatTimelineEvent = ({ at, event, detail }: QrLoginTimelineEvent): string => {
    const fields = Object.entries(detail)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${formatDetailValue(value)}`);
    return [`  ${formatDiagnosticClock(at)} ${event}`, ...fields].join(' ');
};

/** 报告里的自检（结构与 core/contracts/account 的 LibraryLoginSelfCheck 相同；这里只认结构，不依赖 core）。 */
export type QrLoginReportSelfCheck =
    | { status: 'running' }
    | { status: 'done'; result: LoginSelfCheckResult; verdict: { kind: string; detail: string | null; proxy: string | null } }
    | { status: 'failed'; message: string };

const formatSelfCheckError = (error: LoginSelfCheckError): string => (
    `${error.code ?? 'error'}${error.phase ? ` at ${error.phase}` : ''}: ${error.message}`
);

const formatSelfCheckHost = (host: LoginSelfCheckHost): string[] => {
    const dns = host.dns.error
        ? `dns: ${formatSelfCheckError(host.dns.error)} (${host.dns.durationMs}ms)`
        : `dns: ${host.dns.durationMs}ms → ${host.dns.addresses.map(item => `${item.address} (v${item.family})`).join(', ') || 'no address'}${host.dns.fakeIp ? ' [fake-ip]' : ''}`;
    const connections = host.connections.map(connection => (
        `v${connection.family} ${connection.address}: tcp ${connection.tcpMs ?? '-'}ms`
        + `${connection.tlsMs != null ? `, tls ${connection.tlsMs}ms${connection.protocol ? ` ${connection.protocol}` : ''}` : ''}`
        + `${connection.error ? ` → ${formatSelfCheckError(connection.error)}` : ''}`
    ));
    const https = host.https
        ? host.https.error
            ? `https: ${formatSelfCheckError(host.https.error)} (${host.https.durationMs}ms)`
            : `https: HTTP ${host.https.httpStatus ?? '?'} in ${host.https.durationMs}ms`
                + `${host.https.remote ? ` via ${host.https.remote.address} (v${host.https.remote.family})` : ''}`
                + `${host.https.clockSkewMs != null ? `, clock skew ${(host.https.clockSkewMs / 1000).toFixed(1)}s` : ''}`
        : '';
    return [`  ${host.host}`, ...[dns, ...connections, https].filter(Boolean).map(line => `    ${line}`)];
};

/** 自检段：结论在第一行，后面是本地后端、凭据保存、代理与每个上游域名的逐项结果。 */
export const formatQrLoginSelfCheck = (selfCheck: QrLoginReportSelfCheck | null): string[] => {
    if (!selfCheck) return ['self-check: not run'];
    if (selfCheck.status === 'running') return ['self-check: still running when the report was generated'];
    if (selfCheck.status === 'failed') return [`self-check: failed (${selfCheck.message})`];
    const { result, verdict } = selfCheck;
    const backend = result.backend;
    const probe = backend?.probe;
    const lines = [
        `self-check: ${result.runtime}, ${result.durationMs}ms`,
        `  verdict: ${verdict.kind}${verdict.detail ? ` (${verdict.detail})` : ''}${verdict.proxy ? `; proxy: ${verdict.proxy}` : ''}`,
    ];
    if (backend) {
        lines.push(`  backend: ${backend.status}${backend.url ? ` ${backend.url}` : backend.port ? ` 127.0.0.1:${backend.port}` : ''}`
            + `${backend.error ? ` error=${JSON.stringify(backend.error)}` : ''}`
            + `${probe ? probe.ok ? `; GET / → HTTP ${probe.httpStatus ?? '?'} in ${probe.durationMs}ms` : `; GET / → ${probe.error ? formatSelfCheckError(probe.error) : 'failed'}` : ''}`);
    }
    if (result.credentialStore) {
        const store = result.credentialStore;
        lines.push(store.error
            ? `  credential store: error ${JSON.stringify(store.error)}`
            : `  credential store: encryption=${store.encryptionAvailable ? 'yes' : 'no'}${store.backend ? ` backend=${store.backend}` : ''}`);
    }
    if (result.proxy) {
        const env = Object.entries(result.proxy.env).map(([name, value]) => `${name}=${value}`).join(' ');
        lines.push(`  proxy: env ${env || 'none'}; system ${result.proxy.system ?? 'unknown'}`);
    }
    return [...lines, ...result.hosts.flatMap(formatSelfCheckHost)];
};

// 把一次扫码会话排成可以直接贴进 GitHub issue 的 Markdown 文本。
export const formatQrLoginDiagnosticReport = ({
    generatedAt,
    appVersion,
    userAgent,
    providerId,
    methodId,
    failure,
    timeline,
    selfCheck = null,
    providerLines,
}: {
    generatedAt: number;
    appVersion: string | null;
    userAgent: string;
    providerId: OnlineProviderId;
    methodId: string | null;
    failure: QrLoginFailureKind | null;
    timeline: readonly QrLoginTimelineEvent[];
    selfCheck?: QrLoginReportSelfCheck | null;
    providerLines: readonly string[];
}): string => [
    '### Folia QR login diagnostics',
    '',
    '```text',
    `generated: ${new Date(generatedAt).toISOString()}`,
    `app: ${appVersion ?? 'unknown'}`,
    `user agent: ${userAgent || 'unknown'}`,
    `provider: ${providerId}${methodId ? ` (method ${methodId})` : ''}`,
    `failure: ${failure ?? 'none'}`,
    `QR session timeline (${timeline.length}, UTC):`,
    ...(timeline.length > 0 ? timeline.map(formatTimelineEvent) : ['  (none)']),
    ...formatQrLoginSelfCheck(selfCheck),
    `${providerId} details:`,
    ...(providerLines.length > 0 ? providerLines.map(line => `  ${line}`) : ['  (none)']),
    '```',
].join('\n');

const FOLIA_NEW_ISSUE_URL = 'https://github.com/chthollyphile/folia-major/issues/new';
// GitHub 对过长的 new-issue 链接会直接报错；超过这个长度就不把报告塞进链接，改让用户粘贴剪贴板里的内容。
const MAX_ISSUE_URL_LENGTH = 7000;

// 生成预填好的 new-issue 链接：报告不长就直接放进正文，太长则只留粘贴提示。
export const buildQrLoginIssueUrl = ({
    providerId,
    report,
    pasteHint,
}: {
    providerId: OnlineProviderId;
    report: string;
    pasteHint: string;
}): string => {
    const title = `[QR login] ${providerId} login failed`;
    const build = (body: string) => `${FOLIA_NEW_ISSUE_URL}?${new URLSearchParams({ title, body }).toString()}`;
    // 报告为空说明生成或复制失败了，同样只留粘贴提示。
    const withReport = report ? build(report) : '';
    return withReport && withReport.length <= MAX_ISSUE_URL_LENGTH ? withReport : build(pasteHint);
};
