import { describe, expect, it } from 'vitest';
import { buildQrLoginIssueUrl, formatQrLoginDiagnosticReport, formatQrLoginSelfCheck } from '@/utils/qrLoginDiagnosticReport';
import { formatConnection, formatLoginBackendDiagnostics } from '@/services/onlineMusic/loginBackendDiagnostics';
import type { LoginSelfCheckResult } from '@/types/onlineMusic';

// test/unit/onlineMusic/qrLoginDiagnosticReport.test.ts

const AT = Date.UTC(2026, 8, 26, 12, 0, 0);

const app: ElectronAppEnvironment = {
    version: '1.2.3',
    electron: '43.7.5',
    node: '24.21.0',
    chrome: '150.0.7871.250',
    platform: 'win32',
    arch: 'x64',
    osRelease: '10.0.22631',
    osVersion: 'Windows 11 Pro',
    locale: 'zh-CN',
    timeZone: 'Asia/Shanghai',
    uptimeSec: 120,
    credentialStore: { encryptionAvailable: true, backend: null },
};

const resetConnection: ElectronNetworkConnection = {
    at: AT,
    method: 'POST',
    host: 'interfacepc.music.163.com',
    path: '/eapi/login/qrcode/client/login',
    dns: [{ address: '240e:96c:6100::7', family: 6 }, { address: '59.111.181.35', family: 4 }],
    attempts: [],
    remote: { address: '240e:96c:6100::7', family: 6 },
    reusedSocket: false,
    connectMs: 31,
    tlsMs: null,
    responseMs: null,
    totalMs: 80,
    status: null,
    error: { code: 'ECONNRESET', message: 'read ECONNRESET', phase: 'tls' },
};

const neteaseSnapshot: ElectronNeteaseLoginDiagnostics = {
    providerId: 'netease',
    capturedAt: AT,
    app,
    backend: { status: 'running', port: 52001, error: null, updatedAt: AT },
    startup: [{
        startedAt: AT,
        finishedAt: AT + 1500,
        outcome: 'running',
        steps: [
            { id: 'port', startedAt: AT, durationMs: 1, outcome: 'ok', detail: { port: 52001 }, error: null },
            { id: 'xeapi-key', startedAt: AT, durationMs: 1400, outcome: 'ok', detail: { cache: 'missing', source: 'network' }, error: null },
            { id: 'anonymous-token', startedAt: AT, durationMs: 90, outcome: 'ok', detail: { refreshed: false, error: 'socket hang up' }, error: null },
        ],
    }],
    login: {
        capturedAt: AT,
        startup: { anonymousTokenAtLoad: 'present' },
        network: {
            interfaces: [
                { name: 'Wi-Fi', addresses: [{ address: '192.168.1.5', family: 4 }, { address: '2408:8000::1', family: 6 }] },
                { name: 'Teredo Tunneling Pseudo-Interface', addresses: [{ address: '2001:0:2851:782c::1', family: 6 }] },
            ],
        },
        requests: [{
            at: AT,
            uri: '/api/login/qrcode/client/login',
            crypto: '',
            ipHeader: 'none',
            deviceIdTail: 'CEABCDEF',
            hasMusicU: false,
            hasMusicA: true,
            durationMs: 80,
            outcome: { settled: 'rejected', status: 502, code: 502, message: 'read ECONNRESET' },
            connections: [resetConnection],
        }],
    },
    identity: {
        processStartedAt: AT - 30 * 60_000,
        deviceId: 'DEVICE0123456789CEABCDEF',
        connectionResets: 3,
        rotations: 2,
        lastRotatedAt: AT + 5 * 60_000,
        lastTokenRenewed: false,
        pendingRotation: true,
    },
    connections: [],
};

describe('login backend diagnostics', () => {
    it('lays out the NetEase backend, its startup steps and each login request with the connection it opened', () => {
        const lines = formatLoginBackendDiagnostics(neteaseSnapshot, ['session: login cookie=no, anonymous cookie=yes']);

        expect(lines).toEqual(expect.arrayContaining([
            'runtime: electron (embedded API)',
            'app: 1.2.3 electron 43.7.5 (node 24.21.0, chrome 150.0.7871.250) win32 x64',
            'os: 10.0.22631 (Windows 11 Pro), locale zh-CN, time zone Asia/Shanghai, uptime 120s',
            'credential store: encryption=yes',
            'backend: running 127.0.0.1:52001 (since 12:00:00.000)',
            'startup runs (1, oldest first, UTC):',
            '  12:00:00.000 running (1500ms)',
            '    xeapi-key ok 1400ms cache=missing source=network',
            '    anonymous-token ok 90ms refreshed=false error="socket hang up"',
            'session: login cookie=no, anonymous cookie=yes',
            'network interfaces: Wi-Fi: 192.168.1.5, 2408:8000::1; Teredo Tunneling Pseudo-Interface: 2001:0:2851:782c::1',
            'identity: process started 2026-09-26T11:30:00.000Z, deviceId=DEVICE0123456789CEABCDEF, qr connection resets=3, device rotations=2 (last 12:05:00.000, new anonymous token=no), rotation pending=yes',
            'anonymous token at load: present',
            '  12:00:00.000 /api/login/qrcode/client/login rejected status=502 code=502 msg="read ECONNRESET" 80ms ip-header=none device=…CEABCDEF MUSIC_U=no MUSIC_A=yes',
            '      ↳ interfacepc.music.163.com → 240e:96c:6100::7 (v6) tcp=31ms → ECONNRESET at tls: read ECONNRESET (80ms)',
        ]));
    });

    it('lists each address Happy Eyeballs tried when the first one failed', () => {
        expect(formatConnection({
            ...resetConnection,
            remote: { address: '59.111.181.35', family: 4 },
            attempts: [
                { address: '240e:96c:6100::7', family: 6, outcome: 'timeout', error: null },
                { address: '59.111.181.35', family: 4, outcome: 'connected', error: null },
            ],
            tlsMs: 120,
            status: 200,
            error: null,
        })).toBe('POST interfacepc.music.163.com/eapi/login/qrcode/client/login → 59.111.181.35 (v4) tcp=31ms tls=120ms → HTTP 200 (80ms); attempts: 240e:96c:6100::7 v6 timeout, 59.111.181.35 v4 connected');
    });

    it('lays out the QQ backend failures with their original error, the auth events and the connections', () => {
        const snapshot: ElectronQqLoginDiagnostics = {
            providerId: 'qq',
            capturedAt: AT,
            app: { ...app, platform: 'linux', credentialStore: { encryptionAvailable: true, backend: 'basic_text' } },
            backend: { status: 'running', port: 41057, error: null, updatedAt: AT },
            version: '3.1.3',
            startup: [],
            hooks: { installed: ['failSession', 'failBootstrap', 'logger'], error: null },
            failures: [{
                at: AT,
                kind: 'session',
                stage: 'session-issue',
                channel: 'qq',
                sessionState: 'exchanging',
                error: {
                    name: 'Error',
                    message: 'Electron safeStorage selected the unencrypted basic_text backend',
                    stack: ['at assertEncryptionAvailable (qqAuthSessionRepository.cjs:19:11)'],
                },
            }],
            authEvents: [{ at: AT, level: 'warn', event: 'qq-auth.session-failed', details: { failureStage: 'session-issue', name: 'Error' } }],
            connections: [{ ...resetConnection, host: 'u.y.qq.com', path: '/cgi-bin/musicu.fcg', error: null, status: 200, tlsMs: 90 }],
        };

        const lines = formatLoginBackendDiagnostics(snapshot, ['session: backend session stored=no']);

        expect(lines).toEqual(expect.arrayContaining([
            'credential store: encryption=yes backend=basic_text',
            'qq-music-api: 3.1.3, hooks: failSession, failBootstrap, logger',
            'startup: (not started)',
            '  12:00:00.000 session stage=session-issue channel=qq state=exchanging name=Error message="Electron safeStorage selected the unencrypted basic_text backend"',
            '      at assertEncryptionAvailable (qqAuthSessionRepository.cjs:19:11)',
            '  12:00:00.000 warn qq-auth.session-failed failureStage=session-issue name=Error',
            '  12:00:00.000 POST u.y.qq.com/cgi-bin/musicu.fcg → 240e:96c:6100::7 (v6) tcp=31ms tls=90ms → HTTP 200 (80ms)',
        ]));
    });

    it('says plainly when there is no main process to ask', () => {
        expect(formatLoginBackendDiagnostics(null, ['session: login cookie=no'], 'https://api.example.test')).toEqual([
            'runtime: web (remote API https://api.example.test)',
            'session: login cookie=no',
        ]);
    });
});

describe('QR login diagnostic report', () => {
    it('wraps the report in a code block ready to paste into an issue', () => {
        const report = formatQrLoginDiagnosticReport({
            generatedAt: AT,
            appVersion: '1.2.3',
            userAgent: 'test-agent',
            providerId: 'netease',
            methodId: null,
            failure: 'check-error',
            timeline: [{ at: AT, event: 'state', detail: { state: 'error', message: 'code 404: Not Found', elapsedMs: 2000 } }],
            providerLines: ['runtime: electron (embedded API)'],
        });

        expect(report.split('\n')).toEqual([
            '### Folia QR login diagnostics',
            '',
            '```text',
            'generated: 2026-09-26T12:00:00.000Z',
            'app: 1.2.3',
            'user agent: test-agent',
            'provider: netease',
            'failure: check-error',
            'QR session timeline (1, UTC):',
            '  12:00:00.000 state state=error message="code 404: Not Found" elapsedMs=2000',
            'self-check: not run',
            'netease details:',
            '  runtime: electron (embedded API)',
            '```',
        ]);
    });

    it('writes the self-check verdict first, then every layer it checked', () => {
        const result: LoginSelfCheckResult = {
            providerId: 'netease',
            runtime: 'electron',
            startedAt: AT,
            durationMs: 1556,
            backend: { status: 'running', port: 52001, error: null, probe: { ok: true, httpStatus: 200, durationMs: 6, error: null } },
            proxy: { env: { HTTPS_PROXY: 'http://***@10.0.0.2:8080' }, system: 'DIRECT' },
            hosts: [{
                host: 'interfacepc.music.163.com',
                dns: { addresses: [{ address: '198.18.6.189', family: 4 }], durationMs: 10, error: null, fakeIp: true },
                connections: [{ address: '198.18.6.189', family: 4, tcpMs: 9, tlsMs: 906, error: null, protocol: 'TLSv1.3' }],
                https: { httpStatus: 200, durationMs: 1543, remote: { address: '198.18.6.189', family: 4 }, error: null, clockSkewMs: -57627 },
            }],
            credentialStore: { encryptionAvailable: true, backend: null },
        };

        expect(formatQrLoginSelfCheck({ status: 'done', result, verdict: { kind: 'network-ok', detail: null, proxy: 'fake-ip' } })).toEqual([
            'self-check: electron, 1556ms',
            '  verdict: network-ok; proxy: fake-ip',
            '  backend: running 127.0.0.1:52001; GET / → HTTP 200 in 6ms',
            '  credential store: encryption=yes',
            '  proxy: env HTTPS_PROXY=http://***@10.0.0.2:8080; system DIRECT',
            '  interfacepc.music.163.com',
            '    dns: 10ms → 198.18.6.189 (v4) [fake-ip]',
            '    v4 198.18.6.189: tcp 9ms, tls 906ms TLSv1.3',
            '    https: HTTP 200 in 1543ms via 198.18.6.189 (v4), clock skew -57.6s',
        ]);
        expect(formatQrLoginSelfCheck({ status: 'running' })).toEqual(['self-check: still running when the report was generated']);
        expect(formatQrLoginSelfCheck({ status: 'failed', message: 'IPC channel closed' })).toEqual(['self-check: failed (IPC channel closed)']);
    });

    it('puts a short report into the issue link and falls back to a paste hint when it is too long', () => {
        const short = new URL(buildQrLoginIssueUrl({ providerId: 'netease', report: 'short report', pasteHint: 'paste here' }));
        expect(short.searchParams.get('title')).toBe('[QR login] netease login failed');
        expect(short.searchParams.get('body')).toBe('short report');

        const long = new URL(buildQrLoginIssueUrl({ providerId: 'netease', report: 'x'.repeat(10_000), pasteHint: 'paste here' }));
        expect(long.searchParams.get('body')).toBe('paste here');

        const empty = new URL(buildQrLoginIssueUrl({ providerId: 'netease', report: '', pasteHint: 'paste here' }));
        expect(empty.searchParams.get('body')).toBe('paste here');
    });
});
